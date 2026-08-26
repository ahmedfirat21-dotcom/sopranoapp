-- SopranoChat v1.7.13.154
-- Social notifications, Realtime publication and RLS hardening.

begin;

-- room_follow was emitted by the client but rejected by the old CHECK.
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type = any (array[
    'like', 'comment', 'gift', 'symbol_gift', 'thank_you', 'follow', 'reward',
    'follow_request', 'follow_pending', 'follow_accepted', 'follow_rejected',
    'missed_call', 'incoming_call', 'room_live', 'room_follow', 'room_invite',
    'room_invite_accepted', 'room_invite_rejected', 'room_access_request',
    'event_reminder', 'gold_invite', 'message_request', 'dm', 'admin_report'
  ]));

-- Remove legacy direct Expo triggers. The current multi-device edge sender is
-- the single outbound push path; keeping both could deliver duplicate pushes.
drop trigger if exists trg_notify_follow on public.friendships;
drop trigger if exists trg_notify_new_dm on public.messages;

-- Friendships are private relationships. Remove the permissive compatibility
-- policy which shadowed every ownership policy.
drop policy if exists "Allow all for anon" on public.friendships;
drop policy if exists "Friendships are viewable" on public.friendships;
drop policy if exists "Users can create friendships" on public.friendships;
drop policy if exists "Users can delete friendships" on public.friendships;
drop policy if exists "Users can update friendships" on public.friendships;

create policy friendships_select_parties on public.friendships
  for select to public
  using (app_uid() = user_id or app_uid() = friend_id);
create policy friendships_insert_sender on public.friendships
  for insert to public
  with check (app_uid() = user_id and user_id <> friend_id);
create policy friendships_update_parties on public.friendships
  for update to public
  using (app_uid() = user_id or app_uid() = friend_id)
  with check (app_uid() = user_id or app_uid() = friend_id);
create policy friendships_delete_parties on public.friendships
  for delete to public
  using (app_uid() = user_id or app_uid() = friend_id);

-- Notifications are visible and mutable only by their receiver. A sender may
-- create a notification in their own name and retract one they created.
drop policy if exists notif_delete_open on public.notifications;
drop policy if exists notif_insert_open on public.notifications;
drop policy if exists notif_select_own on public.notifications;
drop policy if exists notif_update_open on public.notifications;

create policy notifications_select_receiver on public.notifications
  for select to public
  using (user_id = app_uid());
create policy notifications_insert_actor on public.notifications
  for insert to public
  with check (
    sender_id = app_uid()
    or (sender_id is null and user_id = app_uid())
  );
create policy notifications_update_receiver on public.notifications
  for update to public
  using (user_id = app_uid())
  with check (user_id = app_uid());
create policy notifications_delete_parties on public.notifications
  for delete to public
  using (user_id = app_uid() or sender_id = app_uid());

-- Room follows are public social graph data, but only the owner of the action
-- may create or delete a row.
drop policy if exists "Users can follow rooms" on public.room_follows;
drop policy if exists "Users can unfollow rooms" on public.room_follows;
drop policy if exists "Users can view room follows" on public.room_follows;

create policy room_follows_select_all on public.room_follows
  for select to public using (true);
create policy room_follows_insert_self on public.room_follows
  for insert to public with check (user_id = app_uid());
create policy room_follows_delete_self on public.room_follows
  for delete to public using (user_id = app_uid());

-- Social counters can subscribe to changes. Guard against duplicate publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'follows'
  ) then
    alter publication supabase_realtime add table public.follows;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_follows'
  ) then
    alter publication supabase_realtime add table public.room_follows;
  end if;
end $$;

alter table public.follows replica identity full;
alter table public.room_follows replica identity full;

commit;
