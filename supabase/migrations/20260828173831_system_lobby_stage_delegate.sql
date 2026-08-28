begin;

-- System rooms are owned by the platform. Human speakers must never inherit
-- the room owner/moderator role merely because no staff member is present.
alter table public.rooms
  add column if not exists stage_delegate_user_id text,
  add column if not exists stage_delegate_lease_until timestamptz,
  add column if not exists stage_delegate_assigned_at timestamptz;

-- This existing SECURITY DEFINER trigger referenced `profiles` without a schema.
-- Give it an explicit, deterministic path so room updates from hardened functions
-- (which correctly use an empty path) do not fail inside the nested trigger.
alter function public.enforce_room_tier_settings()
  set search_path = pg_catalog, public;

create index if not exists idx_rooms_active_stage_delegate
  on public.rooms (stage_delegate_user_id, stage_delegate_lease_until)
  where is_system_room = true and stage_delegate_user_id is not null;

create table if not exists public.room_stage_requests (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id text not null,
  requested_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists idx_room_stage_requests_fifo
  on public.room_stage_requests (room_id, requested_at);

alter table public.room_stage_requests enable row level security;
revoke all on table public.room_stage_requests from public, anon, authenticated;
grant all on table public.room_stage_requests to service_role;

-- Pick exactly one active speaker. This helper is intentionally service-only;
-- callers reach it through the Firebase-verifying stage-control Edge Function.
create or replace function public.system_stage_elect_delegate(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_delegate text;
  v_has_official boolean;
begin
  select exists (
    select 1
      from public.room_participants rp
      left join public.profiles p on p.id = rp.user_id
     where rp.room_id = p_room_id
       and (rp.role in ('owner', 'moderator') or coalesce(p.is_admin, false))
  ) into v_has_official;

  if v_has_official then
    update public.rooms
       set stage_delegate_user_id = null,
           stage_delegate_lease_until = null,
           stage_delegate_assigned_at = null
     where id = p_room_id and is_system_room = true;
    return null;
  end if;

  select rp.user_id
    into v_delegate
    from public.room_participants rp
   where rp.room_id = p_room_id
     and rp.role = 'speaker'
     and rp.last_heartbeat_at > now() - interval '2 minutes'
   order by rp.joined_at asc, rp.user_id asc
   limit 1;

  update public.rooms
     set stage_delegate_user_id = v_delegate,
         stage_delegate_lease_until = case when v_delegate is null then null else now() + interval '2 minutes' end,
         stage_delegate_assigned_at = case when v_delegate is null then null else now() end
   where id = p_room_id and is_system_room = true;

  return v_delegate;
end;
$function$;

revoke all on function public.system_stage_elect_delegate(uuid) from public, anon, authenticated;
grant execute on function public.system_stage_elect_delegate(uuid) to service_role;

-- Single atomic entry point used only by stage-control. The actor id has already
-- been verified against Firebase's signed ID token by the Edge Function.
create or replace function public.system_stage_action(
  p_action text,
  p_room_id uuid,
  p_actor_id text,
  p_target_user_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room public.rooms%rowtype;
  v_actor_role text;
  v_target_role text;
  v_delegate text;
  v_is_admin boolean := false;
  v_has_official boolean := false;
  v_can_manage boolean := false;
  v_stage_count integer := 0;
  v_requests jsonb;
begin
  if p_actor_id is null or btrim(p_actor_id) = '' then
    raise exception 'Kimlik doğrulama gereklidir.';
  end if;

  select * into v_room
    from public.rooms
   where id = p_room_id
     and is_system_room = true
     and is_live = true
   for update;
  if not found then
    raise exception 'Aktif sistem odası bulunamadı.';
  end if;

  select rp.role into v_actor_role
    from public.room_participants rp
   where rp.room_id = p_room_id and rp.user_id = p_actor_id
   for update;
  if not found then
    raise exception 'Önce odaya katılmalısın.';
  end if;

  select coalesce(p.is_admin, false) into v_is_admin
    from public.profiles p where p.id = p_actor_id;
  v_is_admin := coalesce(v_is_admin, false);

  select exists (
    select 1
      from public.room_participants rp
      left join public.profiles p on p.id = rp.user_id
     where rp.room_id = p_room_id
       and (rp.role in ('owner', 'moderator') or coalesce(p.is_admin, false))
  ) into v_has_official;

  -- Expired or invalid leases never authorize an action.
  if v_room.stage_delegate_user_id is not null and (
       v_room.stage_delegate_lease_until is null
       or v_room.stage_delegate_lease_until <= now()
       or not exists (
         select 1 from public.room_participants rp
          where rp.room_id = p_room_id
            and rp.user_id = v_room.stage_delegate_user_id
            and rp.role = 'speaker'
            and rp.last_heartbeat_at > now() - interval '2 minutes'
       )
     ) then
    update public.rooms
       set stage_delegate_user_id = null,
           stage_delegate_lease_until = null,
           stage_delegate_assigned_at = null
     where id = p_room_id;
    v_room.stage_delegate_user_id := null;
    v_room.stage_delegate_lease_until := null;
  end if;

  if p_action = 'claim' then
    if v_has_official then
      raise exception 'Yetkili görevli odadayken doğrudan sahneye çıkılamaz.';
    end if;
    if v_actor_role in ('owner', 'moderator', 'speaker') then
      raise exception 'Zaten sahnedesin.';
    end if;
    select count(*) into v_stage_count
      from public.room_participants rp
     where rp.room_id = p_room_id and rp.role in ('owner', 'moderator', 'speaker');
    if v_stage_count > 0 then
      raise exception 'Sahne boş değil; el kaldırma sırasını kullan.';
    end if;

    perform set_config('app.role_change_authorized', 'true', true);
    update public.room_participants
       set role = 'speaker', is_muted = false, hand_raised_at = null,
           stage_expires_at = null, last_seen_at = now(), last_heartbeat_at = now()
     where room_id = p_room_id and user_id = p_actor_id;
    delete from public.room_stage_requests
     where room_id = p_room_id and user_id = p_actor_id;
    update public.rooms
       set stage_delegate_user_id = p_actor_id,
           stage_delegate_lease_until = now() + interval '2 minutes',
           stage_delegate_assigned_at = now()
     where id = p_room_id;

    return jsonb_build_object(
      'ok', true, 'role', 'speaker', 'is_delegate', true,
      'delegate_user_id', p_actor_id,
      'lease_until', now() + interval '2 minutes'
    );

  elsif p_action = 'heartbeat' then
    if v_actor_role <> 'speaker' then
      raise exception 'Sahne sorumluluğu için konuşmacı olmalısın.';
    end if;
    update public.room_participants
       set last_seen_at = now(), last_heartbeat_at = now()
     where room_id = p_room_id and user_id = p_actor_id;

    if v_has_official then
      update public.rooms
         set stage_delegate_user_id = null,
             stage_delegate_lease_until = null,
             stage_delegate_assigned_at = null
       where id = p_room_id;
      return jsonb_build_object('ok', true, 'is_delegate', false, 'delegate_user_id', null);
    end if;

    if v_room.stage_delegate_user_id = p_actor_id then
      update public.rooms
         set stage_delegate_lease_until = now() + interval '2 minutes'
       where id = p_room_id;
      v_delegate := p_actor_id;
    elsif v_room.stage_delegate_user_id is null then
      v_delegate := public.system_stage_elect_delegate(p_room_id);
    else
      v_delegate := v_room.stage_delegate_user_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'is_delegate', v_delegate = p_actor_id,
      'delegate_user_id', v_delegate,
      'lease_until', case when v_delegate is null then null else now() + interval '2 minutes' end
    );

  elsif p_action = 'request' then
    if v_actor_role in ('owner', 'moderator', 'speaker') then
      raise exception 'Sahnedeki kullanıcı el kaldıramaz.';
    end if;
    insert into public.room_stage_requests(room_id, user_id)
      values (p_room_id, p_actor_id)
      on conflict (room_id, user_id) do nothing;
    return jsonb_build_object('ok', true, 'requested', true);

  elsif p_action = 'cancel' then
    delete from public.room_stage_requests
     where room_id = p_room_id and user_id = p_actor_id;
    return jsonb_build_object('ok', true, 'requested', false);

  elsif p_action = 'list' then
    select coalesce(jsonb_agg(r.user_id order by r.requested_at), '[]'::jsonb)
      into v_requests
      from public.room_stage_requests r
      join public.room_participants rp
        on rp.room_id = r.room_id and rp.user_id = r.user_id
     where r.room_id = p_room_id
       and rp.role not in ('owner', 'moderator', 'speaker');
    return jsonb_build_object('ok', true, 'user_ids', v_requests);
  end if;

  v_can_manage := v_is_admin
    or v_actor_role in ('owner', 'moderator')
    or (
      v_room.stage_delegate_user_id = p_actor_id
      and v_room.stage_delegate_lease_until > now()
      and v_actor_role = 'speaker'
    );

  if p_action in ('promote', 'reject') and not v_can_manage then
    raise exception 'Sahne kuyruğunu yönetme yetkin yok.';
  end if;
  if p_target_user_id is null or btrim(p_target_user_id) = '' then
    raise exception 'Hedef kullanıcı eksik.';
  end if;

  if p_action = 'reject' then
    delete from public.room_stage_requests
     where room_id = p_room_id and user_id = p_target_user_id;
    return jsonb_build_object('ok', true, 'rejected', p_target_user_id);
  elsif p_action = 'promote' then
    if not exists (
      select 1 from public.room_stage_requests r
       where r.room_id = p_room_id and r.user_id = p_target_user_id
    ) then
      raise exception 'Kullanıcının aktif sahne isteği yok.';
    end if;
    select rp.role into v_target_role
      from public.room_participants rp
     where rp.room_id = p_room_id and rp.user_id = p_target_user_id
     for update;
    if not found then raise exception 'Hedef kullanıcı bu odada değil.'; end if;
    if v_target_role in ('owner', 'moderator', 'speaker') then
      delete from public.room_stage_requests
       where room_id = p_room_id and user_id = p_target_user_id;
      return jsonb_build_object('ok', true, 'role', v_target_role);
    end if;
    select count(*) into v_stage_count
      from public.room_participants rp
     where rp.room_id = p_room_id and rp.role in ('owner', 'moderator', 'speaker');
    if v_stage_count >= least(coalesce(v_room.max_speakers, 20), 20) then
      raise exception 'Sahne dolu (max: %).', least(coalesce(v_room.max_speakers, 20), 20);
    end if;
    perform set_config('app.role_change_authorized', 'true', true);
    update public.room_participants
       set role = 'speaker', is_muted = false, hand_raised_at = null,
           stage_expires_at = null, last_seen_at = now(), last_heartbeat_at = now()
     where room_id = p_room_id and user_id = p_target_user_id;
    delete from public.room_stage_requests
     where room_id = p_room_id and user_id = p_target_user_id;
    return jsonb_build_object('ok', true, 'role', 'speaker');
  elsif p_action = 'demote' then
    if p_actor_id <> p_target_user_id and not v_can_manage then
      raise exception 'Konuşmacıyı indirme yetkin yok.';
    end if;
    select rp.role into v_target_role
      from public.room_participants rp
     where rp.room_id = p_room_id and rp.user_id = p_target_user_id
     for update;
    if not found then raise exception 'Hedef kullanıcı bu odada değil.'; end if;
    if v_target_role in ('owner', 'moderator') then
      raise exception 'Yetkili görevli sahneden indirilemez.';
    end if;
    perform set_config('app.role_change_authorized', 'true', true);
    update public.room_participants
       set role = 'listener', is_muted = true, hand_raised_at = null,
           stage_expires_at = null, last_seen_at = now()
     where room_id = p_room_id and user_id = p_target_user_id;
    delete from public.room_stage_requests
     where room_id = p_room_id and user_id = p_target_user_id;

    if v_room.stage_delegate_user_id = p_target_user_id then
      update public.rooms
         set stage_delegate_user_id = null,
             stage_delegate_lease_until = null,
             stage_delegate_assigned_at = null
       where id = p_room_id;
      v_delegate := public.system_stage_elect_delegate(p_room_id);
    else
      v_delegate := v_room.stage_delegate_user_id;
    end if;
    return jsonb_build_object(
      'ok', true, 'role', 'listener',
      'delegate_user_id', v_delegate, 'cooldown_sec', 0, 'cooldown_until', null
    );
  end if;

  raise exception 'Geçersiz sahne işlemi.';
end;
$function$;

revoke all on function public.system_stage_action(text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.system_stage_action(text, uuid, text, text)
  to service_role;

-- Immediately clear a departed delegate or yield to official staff. Remaining
-- speakers elect a new delegate through their next heartbeat.
create or replace function public.sync_system_stage_delegate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room_id uuid := coalesce(new.room_id, old.room_id);
  v_user_id text := coalesce(new.user_id, old.user_id);
  v_new_role text := case when tg_op = 'DELETE' then null else new.role end;
  v_is_admin boolean := false;
begin
  if not exists (select 1 from public.rooms r where r.id = v_room_id and r.is_system_room = true) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' or v_new_role in ('owner', 'moderator', 'speaker') then
    delete from public.room_stage_requests
     where room_id = v_room_id and user_id = v_user_id;
  end if;

  select coalesce(p.is_admin, false) into v_is_admin
    from public.profiles p where p.id = v_user_id;

  if v_new_role in ('owner', 'moderator') or coalesce(v_is_admin, false) then
    update public.rooms
       set stage_delegate_user_id = null,
           stage_delegate_lease_until = null,
           stage_delegate_assigned_at = null
     where id = v_room_id;
  elsif tg_op = 'DELETE' or v_new_role is distinct from 'speaker' then
    update public.rooms
       set stage_delegate_user_id = null,
           stage_delegate_lease_until = null,
           stage_delegate_assigned_at = null
     where id = v_room_id and stage_delegate_user_id = v_user_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

drop trigger if exists trg_sync_system_stage_delegate on public.room_participants;
create trigger trg_sync_system_stage_delegate
after insert or delete or update of role on public.room_participants
for each row execute function public.sync_system_stage_delegate();

revoke all on function public.sync_system_stage_delegate() from public, anon, authenticated;

-- The old public caretaker RPC must never manage the platform-owned lobby.
-- It remains available only to signed-in Supabase roles for non-system rooms.
create or replace function public.claim_stage_seat(
  p_room_id uuid,
  p_user_id text,
  p_executor_id text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller text := public.app_uid();
  v_is_system boolean;
  v_authority_count integer;
  v_stage_count integer;
  v_existing_role text;
  v_cooldown_until timestamptz;
  v_stage_expires timestamptz;
begin
  if v_caller is null then raise exception 'Kimlik doğrulama gereklidir.'; end if;
  if p_executor_id is not null and p_executor_id is distinct from v_caller then
    raise exception 'Yetkisiz yürütücü kimliği.';
  end if;
  if v_caller is distinct from p_user_id then
    raise exception 'Yetkisiz: sadece kendin için sahne talep edebilirsin.';
  end if;

  select coalesce(r.is_system_room, false) into v_is_system
    from public.rooms r where r.id = p_room_id for update;
  if not found then raise exception 'Oda bulunamadı.'; end if;
  if v_is_system then
    raise exception 'Sistem odası sahnesi güvenli sahne denetleyicisini kullanır.';
  end if;

  select count(*) into v_authority_count from public.room_participants
   where room_id = p_room_id and role in ('owner', 'moderator');
  if v_authority_count > 0 then raise exception 'Yetkili sahnedeyken doğrudan çıkılamaz.'; end if;

  select role, stage_expires_at into v_existing_role, v_cooldown_until
    from public.room_participants
   where room_id = p_room_id and user_id = p_user_id for update;
  if not found then raise exception 'Önce odaya katılmalısın.'; end if;
  if v_existing_role = 'speaker' then raise exception 'Zaten sahnedesin.'; end if;
  if v_cooldown_until is not null and v_cooldown_until > now() then
    raise exception 'Henüz cooldown süresinde, biraz bekle.';
  end if;

  select count(*) into v_stage_count from public.room_participants
   where room_id = p_room_id and role = 'speaker';
  if v_stage_count > 0 then raise exception 'Sahne boş değil; el kaldırma sırasını kullan.'; end if;

  v_stage_expires := now() + interval '5 minutes';
  perform set_config('app.role_change_authorized', 'true', true);
  update public.room_participants
     set role = 'speaker', stage_expires_at = v_stage_expires,
         is_muted = false, last_seen_at = now(), last_heartbeat_at = now()
   where room_id = p_room_id and user_id = p_user_id;
  return json_build_object('ok', true, 'role', 'speaker',
    'expires_at', v_stage_expires, 'duration_sec', 300);
end;
$function$;

revoke all on function public.claim_stage_seat(uuid, text, text) from public, anon;
grant execute on function public.claim_stage_seat(uuid, text, text) to authenticated, service_role;

update public.rooms
   set max_speakers = 20,
       stage_delegate_user_id = null,
       stage_delegate_lease_until = null,
       stage_delegate_assigned_at = null,
       room_settings = jsonb_set(coalesce(room_settings, '{}'::jsonb), '{speaking_mode}', '"permission_only"'::jsonb, true)
 where is_system_room = true;

commit;
