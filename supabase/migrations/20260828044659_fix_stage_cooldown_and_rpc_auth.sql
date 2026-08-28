-- Trust only the authenticated Firebase JWT for caller identity.
create or replace function public.claim_stage_seat(
  p_room_id uuid,
  p_user_id text,
  p_executor_id text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller text := public.app_uid();
  v_authority_count integer;
  v_current_caretaker_count integer;
  v_max_caretakers constant integer := 5;
  v_stage_expires timestamptz;
  v_existing_role text;
  v_cooldown_until timestamptz;
begin
  if v_caller is null then raise exception 'Kimlik doğrulama gereklidir.'; end if;
  if p_executor_id is not null and p_executor_id is distinct from v_caller then
    raise exception 'Yetkisiz yürütücü kimliği.';
  end if;
  if v_caller is distinct from p_user_id then
    raise exception 'Yetkisiz: sadece kendin için sahne talep edebilirsin.';
  end if;

  perform 1 from public.rooms where id = p_room_id for update;
  if not found then raise exception 'Oda bulunamadı.'; end if;

  select count(*) into v_authority_count
  from public.room_participants
  where room_id = p_room_id and role in ('owner', 'moderator');
  if v_authority_count > 0 then
    raise exception 'Caretaker modu aktif değil (yetkili sahnede).';
  end if;

  select role, stage_expires_at into v_existing_role, v_cooldown_until
  from public.room_participants
  where room_id = p_room_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Önce odaya katılmalısın.'; end if;
  if v_existing_role = 'speaker' then raise exception 'Zaten sahnedesin.'; end if;
  if v_cooldown_until is not null and v_cooldown_until > now() then
    raise exception 'Henüz cooldown süresinde, biraz bekle.';
  end if;

  select count(*) into v_current_caretaker_count
  from public.room_participants
  where room_id = p_room_id
    and role = 'speaker'
    and stage_expires_at is not null
    and stage_expires_at > now();
  if v_current_caretaker_count >= v_max_caretakers then
    raise exception 'Sahne dolu (% caretaker slot).', v_max_caretakers;
  end if;

  v_stage_expires := now() + interval '5 minutes';
  perform set_config('app.role_change_authorized', 'true', true);
  update public.room_participants
  set role = 'speaker', stage_expires_at = v_stage_expires,
      is_muted = false, last_seen_at = now()
  where room_id = p_room_id and user_id = p_user_id;

  return json_build_object('ok', true, 'role', 'speaker',
    'expires_at', v_stage_expires, 'duration_sec', 300);
end;
$$;

create or replace function public.demote_speaker_atomic(
  p_room_id uuid,
  p_user_id text,
  p_executor_id text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller text := public.app_uid();
  v_host_id text;
  v_caller_role text;
  v_target_role text;
  v_target_stage_expires timestamptz;
  v_cooldown_until timestamptz;
begin
  if v_caller is null then raise exception 'Kimlik doğrulama gereklidir.'; end if;
  if p_executor_id is not null and p_executor_id is distinct from v_caller then
    raise exception 'Yetkisiz yürütücü kimliği.';
  end if;

  select host_id into v_host_id from public.rooms where id = p_room_id for update;
  if not found then raise exception 'Oda bulunamadı.'; end if;

  select role, stage_expires_at into v_target_role, v_target_stage_expires
  from public.room_participants
  where room_id = p_room_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Hedef kullanıcı bu odada değil.'; end if;
  if v_target_role = 'owner' then raise exception 'Oda sahibi demote edilemez.'; end if;

  if v_caller is distinct from p_user_id then
    select role into v_caller_role
    from public.room_participants
    where room_id = p_room_id and user_id = v_caller;
    if v_host_id is distinct from v_caller
       and coalesce(v_caller_role, '') not in ('owner', 'moderator') then
      raise exception 'Yetkiniz yok.';
    end if;
  end if;

  -- Only temporary caretaker speakers receive a 60-second cooldown.
  v_cooldown_until := case
    when v_target_role = 'speaker' and v_target_stage_expires is not null
      then now() + interval '60 seconds'
    else null
  end;

  perform set_config('app.role_change_authorized', 'true', true);
  update public.room_participants
  set role = 'listener', is_muted = true,
      stage_expires_at = v_cooldown_until, last_seen_at = now()
  where room_id = p_room_id and user_id = p_user_id;

  return json_build_object('ok', true, 'role', 'listener',
    'cooldown_until', v_cooldown_until,
    'cooldown_sec', case when v_cooldown_until is null then 0 else 60 end);
end;
$$;

revoke all on function public.claim_stage_seat(uuid, text, text) from public, anon;
revoke all on function public.demote_speaker_atomic(uuid, text, text) from public, anon;
revoke all on function public.promote_speaker_atomic(uuid, text, text) from public, anon;
revoke all on function public.release_expired_caretakers() from public, anon;
grant execute on function public.claim_stage_seat(uuid, text, text) to authenticated, service_role;
grant execute on function public.demote_speaker_atomic(uuid, text, text) to authenticated, service_role;
grant execute on function public.promote_speaker_atomic(uuid, text, text) to authenticated, service_role;
grant execute on function public.release_expired_caretakers() to authenticated, service_role;
