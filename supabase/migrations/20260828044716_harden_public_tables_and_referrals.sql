-- Public tables must not inherit broad API grants.
alter table public.admin_audit_log enable row level security;
alter table public.room_creation_log enable row level security;
alter table public.referrals enable row level security;

revoke all on table public.admin_audit_log from anon, authenticated;
revoke all on table public.room_creation_log from anon, authenticated;
revoke all on table public.referrals from anon, authenticated;
grant select, insert on table public.admin_audit_log to authenticated;
grant select on table public.room_creation_log to authenticated;
grant select, insert on table public.referrals to authenticated;

drop policy if exists admin_audit_log_admin_select on public.admin_audit_log;
drop policy if exists admin_audit_log_admin_insert on public.admin_audit_log;
create policy admin_audit_log_admin_select
on public.admin_audit_log for select to authenticated
using (
  public.app_uid() is not null
  and exists (
    select 1 from public.profiles p
    where p.id = public.app_uid() and p.is_admin = true
  )
);
create policy admin_audit_log_admin_insert
on public.admin_audit_log for insert to authenticated
with check (
  public.app_uid() is not null
  and exists (
    select 1 from public.profiles p
    where p.id = public.app_uid() and p.is_admin = true
  )
);

drop policy if exists room_creation_log_select_own_or_admin on public.room_creation_log;
create policy room_creation_log_select_own_or_admin
on public.room_creation_log for select to authenticated
using (
  user_id = public.app_uid()
  or exists (
    select 1 from public.profiles p
    where p.id = public.app_uid() and p.is_admin = true
  )
);

drop policy if exists referrals_select_own on public.referrals;
drop policy if exists referrals_insert_self on public.referrals;
create policy referrals_select_own
on public.referrals for select to authenticated
using (
  public.app_uid() is not null
  and public.app_uid() in (referrer_id, referred_id)
);
create policy referrals_insert_self
on public.referrals for insert to authenticated
with check (
  referred_id = public.app_uid()
  and referrer_id is distinct from public.app_uid()
  and exists (
    select 1 from public.profiles p
    where p.id = referrer_id and p.referral_code = referral_code
  )
);

alter view public.room_engagement set (security_invoker = true);
revoke all on table public.room_engagement from anon, authenticated;
grant select on table public.room_engagement to authenticated;

-- Apply a referral and award both users atomically. Caller and award amount are
-- controlled by the server, not by client input.
create or replace function public.apply_referral_code(
  p_code text,
  p_referred_id text,
  p_is_onboarding boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller text := public.app_uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_owner_id text;
  v_owner_ref_count integer;
  v_referred_created_at timestamptz;
  v_owner_balance integer;
  v_referred_balance integer;
  v_sp_amount constant integer := 50;
begin
  if v_caller is null or v_caller is distinct from p_referred_id then
    raise exception 'Davet kodunu yalnızca kendi hesabın için kullanabilirsin.';
  end if;
  if v_code = '' then raise exception 'Davet kodu boş olamaz.'; end if;

  select p.id into v_owner_id
  from public.profiles p
  where p.referral_code = v_code;
  if not found then raise exception 'Davet kodu bulunamadı.'; end if;
  if v_owner_id = v_caller then raise exception 'Kendi davet kodunu kullanamazsın.'; end if;

  perform 1 from public.profiles p
  where p.id in (v_owner_id, v_caller)
  order by p.id for update;

  select p.created_at into v_referred_created_at
  from public.profiles p where p.id = v_caller;
  if not found then raise exception 'Kullanıcı profili bulunamadı.'; end if;

  select count(*) into v_owner_ref_count
  from public.referrals r where r.referrer_id = v_owner_id;
  if v_owner_ref_count >= 20 then
    raise exception 'Bu davet kodu kullanım sınırına ulaştı.';
  end if;
  if exists (select 1 from public.referrals r where r.referred_id = v_caller) then
    raise exception 'Daha önce bir davet kodu kullandın.';
  end if;
  if not p_is_onboarding and v_referred_created_at > now() - interval '24 hours' then
    raise exception 'Yeni hesaplarda davet kodu için 24 saat beklemelisin.';
  end if;

  insert into public.referrals (referrer_id, referred_id, referral_code)
  values (v_owner_id, v_caller, v_code);
  update public.profiles
  set system_points = coalesce(system_points, 0) + v_sp_amount
  where id = v_owner_id returning system_points into v_owner_balance;
  update public.profiles
  set system_points = coalesce(system_points, 0) + v_sp_amount
  where id = v_caller returning system_points into v_referred_balance;
  insert into public.sp_transactions (user_id, amount, reason, created_at)
  values
    (v_owner_id, v_sp_amount, 'referral_bonus_owner', now()),
    (v_caller, v_sp_amount, 'referral_bonus_referred', now());

  return jsonb_build_object(
    'success', true,
    'message', 'Davet kodu uygulandı. İki hesaba da 50 SP eklendi.',
    'owner_balance', v_owner_balance,
    'referred_balance', v_referred_balance
  );
exception
  when unique_violation then
    raise exception 'Daha önce bir davet kodu kullandın.';
end;
$$;

revoke all on function public.apply_referral_code(text, text, boolean) from public, anon;
grant execute on function public.apply_referral_code(text, text, boolean) to authenticated, service_role;

-- Backwards-compatible signature for already-installed clients.
create or replace function public.award_referral_bonus_atomic(
  p_owner_id text,
  p_referred_id text,
  p_sp_amount integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller text := public.app_uid();
  v_owner_balance integer;
  v_referred_balance integer;
  v_sp_amount constant integer := 50;
begin
  if v_caller is null or v_caller is distinct from p_referred_id then
    raise exception 'Yetkisiz davet ödülü isteği.';
  end if;

  perform 1
  from public.referrals r
  join public.profiles p
    on p.id = r.referrer_id and p.referral_code = r.referral_code
  where r.referrer_id = p_owner_id and r.referred_id = v_caller
  for update of r;
  if not found then raise exception 'Geçerli davet kaydı bulunamadı.'; end if;

  if exists (
    select 1 from public.sp_transactions t
    where t.user_id = v_caller and t.reason = 'referral_bonus_referred'
  ) then
    return jsonb_build_object('success', true, 'already_applied', true);
  end if;

  update public.profiles
  set system_points = coalesce(system_points, 0) + v_sp_amount
  where id = p_owner_id returning system_points into v_owner_balance;
  update public.profiles
  set system_points = coalesce(system_points, 0) + v_sp_amount
  where id = v_caller returning system_points into v_referred_balance;
  insert into public.sp_transactions (user_id, amount, reason, created_at)
  values
    (p_owner_id, v_sp_amount, 'referral_bonus_owner', now()),
    (v_caller, v_sp_amount, 'referral_bonus_referred', now());

  return jsonb_build_object(
    'success', true,
    'owner_balance', v_owner_balance,
    'referred_balance', v_referred_balance,
    'sp_amount', v_sp_amount
  );
end;
$$;

revoke all on function public.award_referral_bonus_atomic(text, text, integer)
from public, anon;
grant execute on function public.award_referral_bonus_atomic(text, text, integer)
to authenticated, service_role;
