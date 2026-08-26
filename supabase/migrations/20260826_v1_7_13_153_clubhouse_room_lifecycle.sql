begin;

-- Clubhouse yaşam döngüsü: kurucu ayrılırsa oda yalnızca mevcut bir
-- moderatöre devredilir. Moderatör yoksa oda anında herkes için biter.
create or replace function public.transfer_host_atomic(
  p_room_id uuid,
  p_old_host_id text,
  p_executor_id text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := public.app_uid();
  v_new_host text;
  v_settings jsonb;
begin
  if v_actor is null or v_actor <> p_old_host_id
     or (p_executor_id is not null and p_executor_id <> v_actor) then
    raise exception 'Yetkisiz host transferi';
  end if;

  select coalesce(r.room_settings, '{}'::jsonb)
    into v_settings
    from public.rooms r
   where r.id = p_room_id and r.host_id = v_actor and r.is_live = true
   for update;

  if not found then
    raise exception 'Canlı oda veya sahip kaydı bulunamadı';
  end if;

  select rp.user_id
    into v_new_host
    from public.room_participants rp
   where rp.room_id = p_room_id
     and rp.role = 'moderator'
     and rp.user_id <> v_actor
   order by rp.joined_at asc
   limit 1;

  if v_new_host is not null then
    perform set_config('app.role_change_authorized', 'true', true);
    update public.room_participants
       set role = 'owner'
     where room_id = p_room_id and user_id = v_new_host;

    update public.rooms
       set host_id = v_new_host,
           room_settings = jsonb_set(v_settings, '{original_host_id}', to_jsonb(v_actor), true)
     where id = p_room_id;

    delete from public.room_participants
     where room_id = p_room_id and user_id = v_actor;

    return json_build_object('newHostId', v_new_host, 'keepAlive', false, 'roomEnded', false);
  end if;

  update public.rooms
     set is_live = false, listener_count = 0, expires_at = null
   where id = p_room_id;
  delete from public.room_participants where room_id = p_room_id;

  return json_build_object('newHostId', null, 'keepAlive', false, 'roomEnded', true);
end;
$$;

-- Sahip veya moderatör odayı herkes için bitirebilir. Kimlik istemcinin
-- gönderdiği değere güvenmeden app_uid() üzerinden doğrulanır.
create or replace function public.end_room_atomic(
  p_room_id uuid,
  p_executor_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := public.app_uid();
  v_host text;
  v_role text;
  v_is_admin boolean := false;
begin
  if v_actor is null or (p_executor_id is not null and p_executor_id <> v_actor) then
    raise exception 'Yetkisiz oda kapatma isteği';
  end if;

  select r.host_id into v_host
    from public.rooms r
   where r.id = p_room_id and r.is_live = true
   for update;
  if not found then return true; end if;

  select rp.role into v_role
    from public.room_participants rp
   where rp.room_id = p_room_id and rp.user_id = v_actor;
  select coalesce(p.is_admin, false) into v_is_admin
    from public.profiles p where p.id = v_actor;

  if v_actor <> v_host and coalesce(v_role, '') not in ('owner', 'moderator') and not v_is_admin then
    raise exception 'Bu odayı bitirme yetkin yok';
  end if;

  update public.rooms
     set is_live = false, listener_count = 0, expires_at = null
   where id = p_room_id;
  delete from public.room_participants where room_id = p_room_id;
  return true;
end;
$$;

revoke all on function public.transfer_host_atomic(uuid, text, text) from public;
revoke all on function public.end_room_atomic(uuid, text) from public;
grant execute on function public.transfer_host_atomic(uuid, text, text) to authenticated, service_role;
grant execute on function public.end_room_atomic(uuid, text) to authenticated, service_role;

commit;
