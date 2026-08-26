-- SopranoChat gelir modeli: yalnızca SP satın alma ve SP ile hediyeler.
-- Yeni Plus/Pro satışı uygulamada kapalıdır; mevcut abonelik kayıtları korunur.

begin;

-- Daha önce üyeliğe kilitlenen kozmetikleri SP ile tüm kullanıcılara aç.
update public.cosmetic_items
set min_tier = 'Free'
where min_tier is distinct from 'Free';

-- Oda mesajlarını temizleme temel moderasyon yetkisidir; üyelik istemez.
-- İstek sahibini JWT ile doğrula ve yalnızca oda sahibine izin ver.
create or replace function public.clear_room_messages(
  p_room_id uuid,
  p_user_id text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := public.app_uid();
  v_room_host text;
  v_deleted_count integer := 0;
begin
  if p_room_id is null or p_user_id is null or p_user_id = '' then
    raise exception 'Geçersiz parametre.' using errcode = '22023';
  end if;

  if v_actor is null or v_actor <> p_user_id then
    raise exception 'Yetkisiz istek.' using errcode = '42501';
  end if;

  select host_id into v_room_host
  from public.rooms
  where id = p_room_id;

  if v_room_host is null then
    raise exception 'Oda bulunamadı.' using errcode = 'P0002';
  end if;

  if v_room_host <> v_actor then
    raise exception 'Bu işlem için oda sahibi olmalısın.' using errcode = '42501';
  end if;

  delete from public.messages
  where room_id = p_room_id
    and coalesce(type, 'user') <> 'system';
  get diagnostics v_deleted_count = row_count;

  return v_deleted_count;
end;
$$;

revoke all on function public.clear_room_messages(uuid, text) from public;
grant execute on function public.clear_room_messages(uuid, text) to authenticated, service_role;

commit;
