/**
 * SopranoChat — English Language File
 * ═══════════════════════════════════════════════════
 * All keys must mirror tr.ts exactly.
 * Missing keys will fall back to Turkish.
 */
const en: Record<string, string> = {
  // ── General ────────────────────────────────────────
  'app.name': 'SopranoChat',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.close': 'Close',
  'common.ok': 'OK',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.success': 'Success',
  'common.retry': 'Retry',
  'common.search': 'Search',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.done': 'Done',
  'common.send': 'Send',
  'common.share': 'Share',
  'common.copy': 'Copy',
  'common.report': 'Report',
  'common.block': 'Block',
  'common.unblock': 'Unblock',
  'common.coming_soon': 'Coming Soon',
  'common.or': 'or',
  'common.and': 'and',
  'common.clear': 'Clear',
  'common.accept': 'Accept',
  'common.reject': 'Reject',
  'common.approve': 'Approve',
  'common.view': 'View',

  // ── Tab Bar ────────────────────────────────────────
  'tabs.home': 'Home',
  'tabs.discover': 'Discover',
  'tabs.rooms': 'Rooms',
  'tabs.myrooms': 'My Rooms',
  'tabs.messages': 'Messages',
  'tabs.profile': 'Profile',

  // ── Home ───────────────────────────────────────────
  'home.discover': 'Discover',
  'home.live_now': 'Live Now',
  'home.category_rooms': '{{category}} Rooms',
  'home.first_in_category': 'Be the first to open a {{category}} room!',
  'home.trending': 'Trending',
  'home.featured': 'Featured',
  'home.friends_live': 'Friends Live',
  'home.recent_rooms': 'Recent Rooms',
  'home.followed_rooms': 'Followed Rooms',
  'home.connection_issue': 'Connection Issue',
  'home.filter_empty': 'No Results for Filter',
  'home.be_first': 'Be First in This Category',
  'home.restore_all': 'Restore All',
  'home.create_new_room': 'Create New Room',
  'home.swipe_report': 'Report',
  'home.swipe_hide': 'Hide',
  'home.empty_seat': 'Empty',
  'home.sleeping': 'Sleeping',
  'home.good_morning': 'Good morning',
  'home.good_afternoon': 'Good afternoon',
  'home.good_evening': 'Good evening',
  'home.good_night': 'Good night',
  'home.quiet_moment': '🕯️ A quiet moment — new broadcasts coming soon',
  'home.live_count': '{{count}} people in live chat right now',
  'home.rooms_waiting': '{{count}} rooms waiting — be the first to join',
  'home.stage_empty_title': 'Stage is empty — be the first',
  'home.stage_empty_sub': 'Pick a topic, go live in one tap',
  'home.detailed_setup': 'or configure in detail',
  'category.chat': 'Chat',
  'category.music': 'Music',
  'category.game': 'Game',
  'category.tech': 'Tech',
  'category.book': 'Books',
  'category.film': 'Film',
  'category.all': 'All',
  'filter.open': 'Open',
  'filter.closed': 'Locked',
  // ── Create Room (8-step wizard) ───────────────────────
  'create.continue': 'Continue',
  'create.step_indicator': '{{current}} / {{total}}',
  'create.step.basics.title': 'Give your room a name',
  'create.step.basics.subtitle': 'Friends will find you by this name — make it memorable, reflect your vibe.',
  'create.step.category.title': 'What will you talk about?',
  'create.step.category.subtitle': 'The right category attracts the right people.',
  'create.step.access.title': 'Who can join?',
  'create.step.access.subtitle': 'Open the door for everyone, or keep it a private community?',
  'create.step.speaking.title': 'Who can speak?',
  'create.step.speaking.subtitle': 'The order on stage is in your hands.',
  'create.step.welcome.title': 'Welcome time',
  'create.step.welcome.subtitle': 'First thing guests see — a warm greeting and rules.',
  'create.step.visual.title': 'Visual touch',
  'create.step.visual.subtitle': 'Pick a theme, add a cover — make your room yours.',
  'create.step.monetization.title': 'Earn or keep it free',
  'create.step.monetization.subtitle': 'Entry fee or donations — entirely up to you.',
  'create.step.review.title': 'Everything ready',
  'create.step.review.subtitle': 'One last check, then we go live.',
  'create.room_name_placeholder': 'Type your room name...',
  'create.desc_label': 'DESCRIPTION (OPTIONAL)',
  'create.desc_placeholder': 'Why does this room exist? A short summary...',
  'create.tag_placeholder': 'e.g. anime',
  'create.password_placeholder': 'Your secret password...',
  'create.welcome_placeholder': 'Hello everyone! Welcome...',
  'create.rules_placeholder': 'Be respectful, no profanity...',
  'create.music_link_placeholder': 'https://youtube.com/... or https://open.spotify.com/...',
  // Categories
  'create.cat.chat.desc': 'Daily talk, free topics',
  'create.cat.music.desc': 'Share tracks you love',
  'create.cat.game.desc': 'Strategy, scores with gamers',
  'create.cat.tech.label': 'Technology',
  'create.cat.tech.desc': 'Software, hardware, new tools',
  'create.cat.book.desc': 'Reading experiences, authors',
  'create.cat.film.desc': 'Cinema, series, discussions',
  'create.cat.other.label': 'Other',
  'create.cat.other.desc': "Anything that doesn't fit categories",
  // Speaking modes
  'create.speak.free.label': 'Free',
  'create.speak.free.desc': 'Anyone can speak anytime',
  'create.speak.permission.label': 'Permission',
  'create.speak.permission.desc': 'Raise hand and wait for permission',
  'create.speak.selected.label': 'Selected',
  'create.speak.selected.desc': 'Only owner-selected people speak',
  // Toasts
  'create.toast.insufficient_tier': 'Insufficient Tier',
  'create.toast.tier_upgrade_msg': 'Upgrade your membership to use this access mode.',
  'create.toast.daily_limit': 'Daily Limit',
  'create.toast.daily_limit_msg': 'You can open at most {{count}} rooms today.',
  'create.toast.invalid_music': 'Invalid Music Link',
  'create.toast.invalid_music_msg': 'Only YouTube, Spotify or SoundCloud links are accepted.',
  'create.toast.create_failed': 'Could Not Create Room',
  'create.toast.invites_sent': 'Invitations Sent!',
  'create.toast.invites_sent_msg': 'Invited {{count}} friends.',
  'create.toast.max_tags': 'Maximum {{count}} tags',
  'create.toast.permission': 'Permission Required',
  'create.toast.permission_gallery': 'Gallery access not granted. Allow it from Settings.',
  'create.toast.image_failed': 'Could not select image',
  'create.toast.try_again': 'Please try again.',
  'create.toast.slow_mode_suggested': '⏱️ Slow Mode Suggested',
  'create.toast.slow_mode_msg': '5s slow mode enabled for locked room (spam protection). You can turn it off below.',
  // Stage button hints
  'create.stage_btn.free': 'Listener sees: 🎙️ Go on Stage button',
  'create.stage_btn.permission': 'Listener sees: ✋ Raise Hand button',
  'create.stage_btn.selected': 'Listener sees: 🔒 Locked button',
  'home.for_you': 'For You',
  'home.no_rooms': 'No live rooms yet',
  'home.create_room': 'Create Room',

  // ── Rooms ──────────────────────────────────────────
  'rooms.title': 'Rooms',
  'rooms.live': 'LIVE',
  'rooms.passive': 'Idle',
  'rooms.premium': 'Premium',
  'rooms.encrypted': 'Locked',
  'rooms.invite_only': 'Invite-Only',
  'rooms.closed': 'Closed',
  'rooms.new': 'Just Opened',
  'rooms.official': 'Official',
  'rooms.boost': 'BOOST',
  'rooms.trend': 'TREND',
  'rooms.managed_rooms': 'My Hosted Rooms',
  'rooms.listeners': 'listeners',
  'rooms.speakers': 'speakers',
  'rooms.join': 'Join',
  'rooms.leave': 'Leave Room',
  'rooms.end': 'End Room',
  'rooms.mute': 'Mute',
  'rooms.unmute': 'Unmute',
  'rooms.raise_hand': 'Raise Hand',
  'rooms.lower_hand': 'Lower Hand',
  'rooms.invite': 'Invite',
  'rooms.recording': 'Recording',
  'rooms.chat_title': 'Messages',
  'rooms.chat_empty': 'No messages yet',
  'rooms.chat_hint': 'Tap someone to send a message',
  'rooms.close': 'Close',
  'rooms.block': 'Block',
  'rooms.stage_in': 'Leave Stage',
  'rooms.stage_out': 'Go on Stage',
  'rooms.stage_full': 'Stage Full',
  'rooms.stage_cooldown': 'wait {{count}}s',
  'rooms.chat_drawer_title': 'Room Chat',
  'rooms.chat_input_placeholder': 'Type a message...',
  'rooms.minutes_short': '{{count}} min',
  'rooms.hours_minutes_short': '{{hours}}h {{minutes}}m',
  'rooms.minutes_remaining': '{{count}} min left',
  'rooms.hours_minutes_remaining': '{{hours}}h {{minutes}}m left',
  // Plus menu
  'rooms.menu.title': 'Menu',
  'rooms.menu.owner_chip': 'Room Owner',
  'rooms.role_moderator': 'Moderator',
  'rooms.role_speaker': 'Speaker',
  'rooms.role_listener': 'Listener',
  'rooms.menu.room_info': 'Room Info',
  'rooms.menu.speaking_audio': 'Speaking & Audio',
  'rooms.menu.access': 'Entry & Access',
  'rooms.menu.bans': 'Banned',
  'rooms.menu.monetization': 'Monetization',
  'rooms.menu.visual': 'Visual & Theme',
  'rooms.menu.invite_share': 'Invite & Share',
  'rooms.menu.freeze': 'Freeze Room',
  'rooms.menu.freeze_desc': 'Participants leave, reopen later',
  'rooms.menu.delete': 'Delete Room',
  'rooms.menu.delete_desc': 'Permanent deletion, no undo',
  // MyRooms stats
  'myrooms.stat_room': 'Room',
  'myrooms.stat_live': 'Live',
  'myrooms.stat_listener': 'Listener',
  'myrooms.stat_sp_week': 'SP/Week',
  'myrooms.section.passive_persistent': 'Passive Persistent Rooms',
  'myrooms.go_to_room': 'Go to Room',
  'myrooms.activate': 'Activate',
  'myrooms.thaw': 'Thaw',
  'myrooms.friends_empty_title': 'Your friends are not in a room right now.',
  'myrooms.friends_empty_sub': 'When people you follow join a room they will appear here!',
  'myrooms.recent_empty_title': 'No live rooms right now.',
  'myrooms.recent_empty_sub': 'Rooms you visited before will appear here when they go live!',
  'myrooms.idle': 'Idle',
  // InRoomUserProfile + AudienceDrawer
  'profile.upper_label': 'PROFILE',
  'profile.not_found': 'User not found',
  'profile.blocked': 'Blocked',
  'profile.friend': 'Friend',
  'profile.request_sent': 'Request Sent',
  'profile.add_friend_short': 'Add Friend',
  'profile.share': 'Share',
  'profile.copy_link': 'Copy Link',
  'profile.invite_to_room': 'Invite to Room',
  'profile.sanction_heading': 'SANCTION',
  'profile.private_title': 'This account is private',
  'profile.private_desc': 'Add as friend to view content',
  'profile.wallet_sub': 'Soprano Points',
  'profile.approve': 'Approve',
  'profile.delete_short': 'Delete',
  'rooms.audience_drawer_title': 'In Room',
  'rooms.role_owner_short': 'Owner',
  'rooms.live_short': 'LIVE',
  'rooms.open_short': 'Open',
  'rooms.sleeping_short': 'Sleeping',
  'rooms.closed_short': 'Closed',
  'rooms.premium_short': 'Premium',
  'rooms.locked_short': 'Locked',
  'rooms.invite_short': 'Invite-Only',
  // RoomManageSheet
  'manage.tags': 'Tags',
  'manage.cta.go_to_room.title': 'Go to Room',
  'manage.cta.go_to_room.sub': 'Enter and manage your live room',
  'manage.cta.wake.title': 'Wake Up',
  'manage.cta.wake.sub': 'Reactivate the frozen room',
  'manage.cta.freeze.title': 'Freeze Room',
  'manage.cta.delete.title': 'Delete Room',
  'manage.empty.bans': 'No banned users',
  'manage.empty.mutes': 'No muted users',
  'manage.empty.followers': 'No followers yet',
  'manage.theme': 'Room Theme',
  'common.remove': 'Remove',
  'rooms.live_pill': 'Live',
  'manage.tab.general': 'General',
  'manage.tab.speaking': 'Speaking',
  'manage.tab.moderation': 'Moderation',
  'manage.tab.visual': 'Visual',
  'manage.tab.monetization': 'Monetization',
  'manage.tab.advanced': 'Advanced',
  'manage.tab.followers': 'Followers',
  'access.locked_room': 'Locked Room',
  'access.invite_room': 'Invite-Only Room',
  'access.cancel': 'Cancel',
  'access.enter': 'Enter',
  'access.continue': 'Continue',
  'access.send_request': 'Send Request',
  'access.joining': 'Joining the room',
  'access.try_later': 'You can try again later',
  'access.discover_similar': 'Discover similar rooms',
  'common.back': 'Back',
  'access.hidden_until_approved': 'Room content is hidden until approved',
  'queue.hand_raised': 'Hand Raised',
  'queue.next': 'Next',
  'queue.empty_title': 'Queue Empty',
  'queue.empty_sub': 'No one has raised their hand yet',
  'invite.empty_title': 'No friends yet',
  'invite.title': 'Invite Your Friends',
  'search.rooms_section': 'Rooms',
  'search.people_section': 'People',
  'search.user_not_found': 'User not found',
  'search.your_friends': 'Your Friends',
  'search.no_friends': 'No friends yet',
  'search.discover_title': 'Discover',
  'search.new_message': 'New Message',
  'search.placeholder_discover': 'Search rooms, people or members...',
  'search.placeholder_message': 'Search by name or username...',
  'search.discover_all_members': 'Discover — All Members',
  'notif_prefs.title': 'Notification Preferences',
  'notif_prefs.dnd': 'DO NOT DISTURB',
  'notif_prefs.filter': 'FILTERING',
  'notif_prefs.categories': 'CATEGORIES',
  'rooms.stage_up': 'Go on Stage',
  'rooms.stage_down': 'Leave Stage',
  'rooms.category': 'Category',

  // ── Messages / DM ─────────────────────────────────
  'messages.title': 'Messages',
  'messages.new': 'New Message',
  'messages.no_messages': 'No messages yet',
  'messages.type_message': 'Type a message...',
  'messages.message_request': 'Message Request',
  'messages.requests': 'Requests',
  'messages.no_pending_requests': 'No pending message requests',
  'messages.connection_issue': 'Connection issue',
  'messages.friends_online': 'Online',
  'messages.media_links': 'Media & Links',
  'messages.no_images': 'No images',
  'messages.no_voice': 'No voice notes',
  'messages.no_links': 'No links',
  'messages.forwarded': 'Forwarded',
  'messages.request_rejected': 'Request rejected',
  'messages.call_back': 'Call Back',
  'messages.view_profile': 'View Profile',
  'messages.call': 'Call',
  'messages.delete_chat': 'Delete Chat',
  'messages.online': 'Online',

  // ── Profile ────────────────────────────────────────
  'profile.title': 'Profile',
  'profile.edit': 'Edit Profile',
  'profile.followers': 'Followers',
  'profile.following': 'Following',
  'profile.friends': 'Friends',
  'profile.badges': 'Badges',
  'profile.level': 'Level',
  'profile.sp_balance': 'SP Balance',
  'profile.recordings': 'Recordings',
  'profile.online': 'Online',
  'profile.offline': 'Offline',
  'profile.add_friend': 'Add Friend',
  'profile.remove_friend': 'Unfriend',
  'profile.send_message': 'Send Message',
  'profile.send_gift': 'Send Gift',
  'profile.sp_wallet': 'MY SP WALLET',
  'profile.your_invite_code': 'Your Code',
  'profile.enter_invite_code': 'Enter Friend Code',
  'profile.invite_code_used': 'Invite code used',
  'profile.tap_to_close': 'Tap to close',
  // Edit Profile
  'profile.edit_title': 'Edit Profile',
  'profile.pick_avatar': 'Choose Avatar',
  'profile.upload_gallery': 'Upload from Gallery',
  'profile.display_name': 'Display Name',
  'profile.username': 'Username',
  'profile.bio': 'Bio',
  'profile.section.account_info': 'ACCOUNT INFO',
  'profile.section.identity': 'YOUR IDENTITY',
  'profile.section.narrative': 'PROFILE STORY',
  'profile.section.privacy': 'PRIVACY',
  'profile.account_type': 'Account Type',
  'profile.verified': 'Verified',
  'profile.change_password': 'Change Password',
  'profile.current_password': 'Current Password',
  'profile.new_password': 'New Password',
  'profile.new_password_again': 'New Password (Repeat)',
  'profile.update_password': 'Update Password',
  'profile.voice_intro': 'Voice Intro',
  'profile.featured_badges': 'Featured Badges',
  'profile.social_links': 'Social Links',
  'profile.hide_rooms': 'Hide My Rooms',
  'profile.profile_privacy': 'Profile Privacy',
  // Profile right menu
  'profile.menu.premium': 'Soprano Premium',
  'profile.menu.store': 'Maison Soprano Store',
  'profile.menu.leaderboard': 'Leaderboard',
  'profile.menu.settings': 'Settings',
  'profile.menu.invite_code': 'Invite Code',
  'profile.menu.boost': 'Feature My Profile',
  'profile.menu.logout': 'Log Out',
  'profile.menu.vip_badge': 'VIP',
  'profile.invite_code_modal_title': '🎁 Invite Code',
  // Friends list
  'profile.friends_label': 'MY FRIENDS',
  'profile.see_all': 'See All',
  'profile.offline_status': 'Offline',
  'profile.online_status': 'Online',
  'profile.plus_required': 'Plus Required',
  'profile.plus_required_boost': 'Profile boost is unlocked with Plus.',
  'profile.join_room': 'Join',
  'profile.view_room': 'View',
  'profile.friends_label_my': 'MY FRIENDS',
  'profile.friends_label_other': 'FRIENDS',
  'profile.see_all_short': 'All',
  'profile.follow': 'Follow',
  'profile.following': 'Following',
  'profile.stage_promote_self': 'Go on Stage',
  'profile.ghost_invisible': 'Invisible Mode',
  'profile.ghost_visible': 'Become Visible',
  'profile.disguise_on': 'Disguise',
  'profile.disguise_off': 'Remove Disguise',
  'profile.report': 'Report',
  'profile.block_action': 'Block',
  'profile.unblock_action': 'Unblock',
  'profile.block_title': 'Block User',
  'profile.block_message': '{{name}} will be blocked. You will not see posts or messages from blocked users.',
  'profile.note_placeholder': 'Add a note for this person (only you see it)',
  'profile.section.membership': 'MEMBERSHIP',
  'profile.section.wallet': 'WALLET',
  'profile.section.my_rooms': 'MY ROOMS',
  'profile.section.their_rooms': 'ROOMS',
  'profile.tier_pro_features': 'Unlimited rooms · 1080p · Stereo audio',
  'profile.tier_plus_features': 'HD audio · 720p video · All room types',
  'profile.tier_free_features': 'Basic features',
  'profile.tier_member_suffix': '{{tier}} Member',
  'date.month_year_joined': 'Joined {{month}} {{year}}',
  'date.month.1': 'January', 'date.month.2': 'February', 'date.month.3': 'March',
  'date.month.4': 'April', 'date.month.5': 'May', 'date.month.6': 'June',
  'date.month.7': 'July', 'date.month.8': 'August', 'date.month.9': 'September',
  'date.month.10': 'October', 'date.month.11': 'November', 'date.month.12': 'December',
  'date.last_seen.just_now': 'Active just now',
  'date.last_seen.minutes': 'Active {{count}}m ago',
  'date.last_seen.hours': 'Active {{count}}h ago',
  'date.last_seen.days': 'Active {{count}}d ago',
  'date.last_seen.weeks': 'Active {{count}}w ago',
  'date.last_seen.months': 'Active {{count}}mo ago',
  'date.last_seen.long_ago': 'Inactive for a long time',
  'title.philanthropist': 'Philanthropist',
  'title.patron': 'Patron',
  'title.community_leader': 'Community Leader',
  'title.stage_star': 'Stage Star',
  'title.sp_baron': 'SP Baron',
  'title.generous_soul': 'Generous Soul',
  'title.social_butterfly': 'Social Butterfly',
  'title.fireball': 'Fireball',
  'title.supporter': 'Supporter',
  'title.rising_star': 'Rising Star',
  // Tiered + Hero + Extras
  'profile.no_active_rooms': 'No active rooms yet',
  'profile.ghost_mode': 'Ghost Mode Active',
  'profile.total_listeners': 'Total Listeners',
  'profile.stage_time': 'Stage Time',
  'profile.engagement': 'Engagement',
  'profile.stereo_active': 'Stereo Audio Active',
  'profile.total_sp': 'Total SP',
  'profile.paid_room': 'Paid Room',
  'profile.donations': 'Donations',
  'profile.monetized_creator': 'Monetized Creator',
  'profile.monetized_desc': 'Creator with supportable content',
  'profile.boost_label': 'BOOST',
  'profile.stat_friend': 'Friend',
  'profile.stat_room': 'Room',
  'profile.stat_gift': 'Gift',
  'profile.voice_intro_label': 'VOICE INTRO',
  'profile.top_supporters': 'TOP SUPPORTERS',
  'profile.featured_badges_label': 'FEATURED BADGES',
  'profile.add_language_interest': 'Add language & interests',
  'profile.frames_tab': 'Frames',
  'profile.entry_effects_tab': 'Entry Effects',
  'profile.remove_uppercase': 'REMOVE',
  'profile.go_to_store': 'GO TO STORE',
  'profile.active_uppercase': 'ACTIVE',
  'profile.your_note': 'YOUR NOTE',
  'profile.cancel': 'Cancel',
  'profile.identity_uppercase': 'YOUR IDENTITY',

  // ── Settings ───────────────────────────────────────
  'settings.title': 'Settings',
  // ★ v284: Section headers
  'settings.section.notifications': 'Notifications',
  'settings.section.appearance': 'Appearance',
  'settings.section.audio': 'Audio & Microphone',
  'settings.section.privacy': 'Privacy',
  'settings.section.account': 'Account',
  'settings.section.about': 'About',
  'settings.section.subscription': 'Subscription',
  'settings.section.session': 'Session',
  // ★ v284: Extra
  'settings.hidden_rooms': 'Hidden Rooms',
  'settings.hidden_rooms_desc': 'Restore rooms you hid',
  'settings.private_profile_save_failed': 'Private profile setting could not be saved. Check your connection.',
  'settings.delete_account_failed': 'Account Deletion Failed',
  'settings.notifications': 'Notifications',
  'settings.notifications_desc': 'Enable/disable push notifications',
  'settings.notification_sound': 'Notification Sound',
  'settings.notification_sound_desc': 'Play sound on notification',
  'settings.notification_vibration': 'Vibration',
  'settings.notification_vibration_desc': 'Vibrate on notification',
  'settings.notification_prefs': 'Notification Preferences',
  'settings.notification_prefs_desc': 'DND hours, category filtering, friends only',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.theme_desc': 'Dark theme (light coming soon)',
  'settings.language': 'Language',
  'settings.language_changed': 'Language changed',
  'settings.language_restart_hint': 'Some text will update after restart',
  'settings.audio': 'Audio & Microphone',
  'settings.echo_cancellation': 'Echo Cancellation',
  'settings.echo_cancellation_desc': 'Filter reflected sounds (recommended)',
  'settings.noise_suppression': 'Noise Suppression',
  'settings.noise_suppression_desc': 'Reduce background noise',
  'settings.auto_gain': 'Auto Gain Control',
  'settings.auto_gain_desc': 'Automatically balance microphone',
  'settings.privacy': 'Privacy',
  'settings.online_status': 'Online Status',
  'settings.online_status_desc': 'Let others see when you\'re online',
  'settings.private_profile': 'Private Profile',
  'settings.private_profile_desc': 'Followers only',
  'settings.account': 'Account',
  'settings.edit_profile': 'Edit Profile',
  'settings.blocked_users': 'Blocked Users',
  'settings.blocked_users_desc': 'Manage blocked users',
  'settings.about': 'About',
  'settings.terms': 'Terms of Service',
  'settings.privacy_policy': 'Privacy Policy',
  'settings.version': 'Version',
  'settings.subscription': 'Subscription',
  'settings.restore_purchases': 'Restore Purchases',
  'settings.restore_purchases_desc': 'Restore premium after device change',
  'settings.session': 'Session',
  'settings.logout': 'Log Out',
  'settings.logout_confirm': 'Are you sure you want to log out?',
  'settings.logout_failed': 'Could not log out, please try again.',
  'settings.delete_account': 'Delete Account',
  'settings.delete_account_desc': 'All data will be permanently deleted',
  'settings.delete_account_confirm': 'This action CANNOT BE UNDONE. All your data, messages, rooms, and badges will be permanently deleted.',
  'settings.delete_account_button': 'Permanently Delete My Account',
  'settings.account_deleted': 'All your data has been deleted.',
  'settings.restoring': 'Restoring...',
  'settings.restoring_desc': 'Checking purchases',
  'settings.restore_success': 'Your {{tier}} membership has been restored',
  'settings.restore_not_found': 'No active subscription found for this account',
  'settings.restore_failed': 'Could not check purchases.',

  // ── Auth ───────────────────────────────────────────
  'auth.login': 'Log In',
  'auth.signup': 'Sign Up',
  'auth.google_signin': 'Continue with Google',
  'auth.email_login': 'Log In with Email',
  'auth.phone_signin': 'Log In with Phone',
  'auth.welcome': 'Welcome',
  'auth.welcome_desc': 'The new home of voice chat',
  'auth.create_account': 'Create New Account',
  'auth.email_placeholder': 'Your email address',
  'auth.password_placeholder': 'Your password',
  'auth.password_confirm_placeholder': 'Password (Repeat)',
  'auth.forgot_password': 'Forgot Password?',
  'auth.have_account': 'Already have an account? Log In',
  'auth.no_account': 'No account? Sign Up',
  'auth.email_not_verified': 'Email Not Verified',
  'auth.email_not_verified_desc': 'Please verify your email to continue. Check your spam folder too.',
  'auth.resend': 'Resend',
  'auth.sending': 'Sending...',
  'auth.verified_check': 'I Verified',
  'auth.terms_prefix': 'By continuing, you accept',
  'auth.terms_suffix': '.',

  // ── Notifications ──────────────────────────────────
  'notif.title': 'Notifications',
  'notif.empty': 'No notifications yet',
  'notif.empty_sub': 'New interactions will appear here',
  'notif.see_all': 'See All',
  'notif.collapse': 'Collapse',
  'notif.no_one_online': 'No one is online right now',
  'notif.offline_in_profile': 'Offline friends are listed on their profile',
  'notif.friend_requests': 'Friend Requests',
  'notif.new_friend': 'New Friend',
  'notif.friend_request': 'Friend Request',
  'notif.room_invite': 'Room Invite',
  'notif.gift_received': 'You got a gift!',
  'notif.missed_call': 'Missed Call',
  'notif.incoming_call': 'Incoming Call',

  // ── Calls ──────────────────────────────────────────
  'call.accept': 'Accept',
  'call.reject': 'Decline',
  'call.end': 'End Call',
  'call.calling': 'Calling...',
  'call.connecting': 'Connecting...',
  'call.busy': 'Busy',
  'call.no_answer': 'No Answer',

  // ── SP / Gifts ─────────────────────────────────────
  'sp.balance': 'SP Balance',
  'sp.send': 'Send SP',
  'sp.received': 'SP Received',
  'sp.history': 'SP History',

  // ── Errors ─────────────────────────────────────────
  'error.network': 'No internet connection',
  'error.generic': 'Something went wrong',
  'error.permission': 'Permission required',
  'error.not_found': 'Not found',

  // ═══ AUTO-EXTRACTED (translate me) ═══
  'auth.onboarding.001': "Female",  // translated
  'auth.onboarding.002': "Music",  // translated
  'auth.onboarding.003': "Onboarding could not complete — database error. Try again.",  // translated
  'auth.onboarding.004': "Connection Error",  // translated
  'auth.onboarding.005': "Onboarding could not be saved. Check your internet connection and try again.",  // translated
  'auth.onboarding.006': "Invalid Code",  // translated
  'auth.onboarding.007': "Please enter a valid invite code.",  // translated
  'auth.onboarding.008': "Welcome to the community! 50 SP added to your account.",  // translated
  'auth.onboarding.009': "📸 Photo Uploaded",  // translated
  'auth.onboarding.010': "Your profile photo is ready!",  // translated
  'tabs.home.001': "✨ Featured Profile",  // translated
  'tabs.myrooms.001': "Music",  // translated
  'tabs.profile.001': "Activity data could not be loaded",  // translated
  'tabs.profile.002': "Are you sure you want to sign out?",  // translated
  'admin.001': "Report Closed",  // translated
  'admin.002': "Warning",  // translated
  'admin.003': "User Warned",  // translated
  'admin.004': "User Banned",  // translated
  'admin.005': "Room Closed",  // translated
  'admin.006': "Room Reopened",  // translated
  'admin.007': "Could Not Reopen",  // translated
  'admin.008': "Tier Could Not Be Updated",  // translated
  'admin.009': "Permission Could Not Be Changed",  // translated
  'admin.010': "Permission Denied",  // translated
  'admin.011': "You cannot delete your own account.",  // translated
  'admin.012': "User Could Not Be Deleted",  // translated
  'auth.resetpassword.001': "Weak",  // translated
  'auth.resetpassword.002': "Good",  // translated
  'auth.resetpassword.003': "Strong",  // translated
  'auth.resetpassword.004': "Password Too Short",  // translated
  'auth.resetpassword.005': "En az 8 karakter olmalı.",  // TODO: translate
  'auth.resetpassword.006': "Büyük Harf Eksik",  // TODO: translate
  'auth.resetpassword.007': "Şifrede en az 1 büyük harf olmalı.",  // TODO: translate
  'auth.resetpassword.008': "Şifrede en az 1 rakam olmalı.",  // TODO: translate
  'auth.resetpassword.009': "Passwords Don't Match",  // translated
  'auth.resetpassword.010': "İki alan da aynı olmalı.",  // TODO: translate
  'auth.resetpassword.011': "✅ Şifre Değiştirildi",  // TODO: translate
  'call.id.001': "Connection Error",  // translated
  'call.id.002': "Arama bağlantısı kurulamadı.",  // TODO: translate
  'chat.id.001': "İlk mesajın istek olarak gönderilir. Karşı taraf onaylarsa mesajlaşabilirsiniz.",  // TODO: translate
  'chat.id.002': "Bu kullanıcı seninle mesajlaşmak istemiyor.",  // TODO: translate
  'chat.id.003': "Karşı taraf onaylayana kadar yeni mesaj atamazsın.",  // TODO: translate
  'chat.id.004': "Cevapsız sesli arama",  // TODO: translate
  'chat.id.005': "Bu kullanıcıyı engellediniz. Mesajlaşmak için engeli kaldırın.",  // TODO: translate
  'chat.id.006': "Kaybolan Mesaj Süresi",  // TODO: translate
  'chat.id.007': "Bu süre sonra mesajlar otomatik silinir (her iki tarafta).",  // TODO: translate
  'createroom.001': "YouTube / Spotify / SoundCloud linki yapıştır — odadakiler kendi platformlarında dinler.",  // TODO: translate
  'createroom.002': "ℹ️ Oda planlanan zamana kadar kapalı kalacak. \"Odalarım\" ekranından manuel başlatabilirsin.",  // TODO: translate
  'createroom.003': "Günlük Oda Limitin Doldu",  // TODO: translate
  'createroom.004': "Gün Batımı",  // TODO: translate
  'createroom.005': "Yetersiz Üyelik",  // TODO: translate
  'createroom.006': "Bu erişim modunu kullanmak için üyeliğini yükselt.",  // TODO: translate
  'createroom.007': "Günlük Limit",  // TODO: translate
  'createroom.008': "Geçersiz Müzik Linki",  // TODO: translate
  'createroom.009': "Oda Açılamadı",  // TODO: translate
  'createroom.010': "Davetler Gönderildi!",  // TODO: translate
  'createroom.011': "⏱️ Yavaş Mod Önerildi",  // TODO: translate
  'createroom.012': "Şifreli odada 5sn yavaş mod açıldı (spam koruması). Aşağıdan kapatabilirsin.",  // TODO: translate
  'createroom.013': "Dinleyici: 🎙️ Sahneye Çık butonu görür",  // TODO: translate
  'createroom.014': "Dinleyici: ✋ El Kaldır butonu görür",  // TODO: translate
  'createroom.015': "Dinleyici: 🔒 Kilitli buton görür",  // TODO: translate
  'createroom.016': "İzin Gerekli",  // TODO: translate
  'createroom.017': "Galeriye erişim izni verilmedi. Ayarlardan izin verebilirsin.",  // TODO: translate
  'createroom.018': "Görsel seçilemedi",  // TODO: translate
  'createroom.019': "İzin Gerekli",  // TODO: translate
  'createroom.020': "Galeriye erişim izni verilmedi.",  // TODO: translate
  'createroom.021': "Görsel seçilemedi",  // TODO: translate
  'createroom.022': "Erişim",  // TODO: translate
  'createroom.023': "Karşılama",  // TODO: translate
  'createroom.024': "Giriş",  // TODO: translate
  'editprofile.001': "Şifreniz Google hesabınız üzerinden yönetilmektedir. Şifre değişikliği için Google Hesap Ayarları → Güvenlik bölümünü kullanın.",  // TODO: translate
  'editprofile.002': "📸 Photo Uploaded",  // translated
  'editprofile.003': "Profil fotoğrafın güncellendi.",  // TODO: translate
  'editprofile.004': "Fotoğraf Yüklenemedi",  // TODO: translate
  'editprofile.005': "Warning",  // translated
  'editprofile.006': "Görünen ad boş olamaz.",  // TODO: translate
  'editprofile.007': "Oturum Kapalı",  // TODO: translate
  'editprofile.008': "Giriş bilgin bulunamadı, yeniden giriş yap.",  // TODO: translate
  'hiddenrooms.001': "Liste yüklenemedi",  // TODO: translate
  'hiddenrooms.002': "Tüm gizli odalar geri getirildi",  // TODO: translate
  'hiddenrooms.003': "Keşfette bir oda kartını sola kaydırıp \"Gizle\" diyerek bu listeye ekleyebilirsin.",  // TODO: translate
  'hiddenrooms.004': "Oda detayları yüklenemedi.",  // TODO: translate
  'leaderboard.001': "Haftalık",  // TODO: translate
  'leaderboard.002': "Aylık",  // TODO: translate
  'leaderboard.003': "Top Cömert",  // TODO: translate
  'leaderboard.004': "SP bağış",  // TODO: translate
  'leaderboard.005': "SP kazandı",  // TODO: translate
  'leaderboard.006': "oda açtı",  // TODO: translate
  'leaderboard.007': "En Popüler",  // TODO: translate
  'leaderboard.008': "takipçi",  // TODO: translate
  'leaderboard.009': "En Popüler Odalar",  // TODO: translate
  'leaderboard.010': "En Cömert",  // TODO: translate
  'plus.001': "Abonelik sistemi bakım modunda. Çok yakında satın almaya açılacak.",  // TODO: translate
  'plus.002': "Gelişmiş",  // TODO: translate
  'plus.003': "Sınırsız",  // TODO: translate
  'plus.004': "Önce giriş yapmalısınız",  // TODO: translate
  'plus.005': "Yükseltme Başarısız",  // TODO: translate
  'plus.006': "Planı İptal Et",  // TODO: translate
  'plus.007': "Plan değiştirildi",  // TODO: translate
  'plus.008': "Free plana geri döndünüz.",  // TODO: translate
  'plus.009': "Aboneliğinizi Google Play ayarlarından iptal edebilirsiniz.",  // TODO: translate
  'plus.010': "Oda Açık Kalma",  // TODO: translate
  'room.id.001': "yazıyor…",  // TODO: translate
  'room.id.002': "çevrimiçi",  // TODO: translate
  'skiatest.001': "Her sıra: solda mevcut RN yaklaşımı, sağda Skia primitive. Aynı görünmeli.",  // TODO: translate
  'skiatest.002': "Skia native modül APK'da yok",  // TODO: translate
  'skiatest.003': "Sağ taraftaki Skia çıktıları şu an fallback (sade View) gösteriyor. APK'yı Skia ile rebuild ettikten sonra gerçek Skia render'ı çalışacak.",  // TODO: translate
  'spstore.001': "SP ile profilini öne çıkarabilir, oda giriş ücreti ödeyebilir ve premium özelliklere erişebilirsin.",  // TODO: translate
  'spstore.002': "🚧 Yakında",  // TODO: translate
  'store.collection.id.001': "Satın Al",  // TODO: translate
  'store.001': "İstek listesi güncellenemedi",  // TODO: translate
  'store.002': "Tüm parçalar sende",  // TODO: translate
  'store.003': "Set Satın Al",  // TODO: translate
  'store.004': "Satın Al",  // TODO: translate
  'store.005': "🚧 Yakında",  // TODO: translate
  'store.006': "SP satın alma alfa sürüm süresince kapalı. Yakında Google Play üzerinden aktif olacak!",  // TODO: translate
  'store.007': "— SETLER · TEMA PAKETLERİ —",  // TODO: translate
  'store.008': "— ÇERÇEVELER · AVATAR —",  // TODO: translate
  'store.009': "— GİRİŞ EFEKTLERİ · ODA —",  // TODO: translate
  'store.010': "— ROZETLER · PROFİL —",  // TODO: translate
  'store.011': "— ÖZEL EMOJİ · SOHBET —",  // TODO: translate
  'store.012': "— KOLEKSİYONLAR · TÜM SEZON —",  // TODO: translate
  'store.013': "Profilini ve ekranlarını kişiselleştir",  // TODO: translate
  'store.014': "Özel Efektler",  // TODO: translate
  'store.015': "Odada görsel şölen · Parçacık efektleri",  // TODO: translate
  'store.016': "Özel Emoji Setleri",  // TODO: translate
  'store.017': "Mesajlarında özel emojiler · Topluluk içinde fark",  // TODO: translate
  'store.018': "Soprano Tezgâhı",  // TODO: translate
  'store.019': "S P · K O L E K S İ Y O N L A R I",  // TODO: translate
  'store.020': "SP PAKETLERİ",  // TODO: translate
  'store.021': "⚜ ŞIK YÜKLEME",  // TODO: translate
  'store.022': "YENİ",  // TODO: translate
  'store.023': "SAHİPSİN",  // TODO: translate
  'store.024': "SAHİPSİN",  // TODO: translate
  'store.025': "SAHİP",  // TODO: translate
  'store.026': "SP · sınırsız",  // TODO: translate
  'store.027': "⚜ EN POPÜLER",  // TODO: translate
  'store.028': "KEŞFET →",  // TODO: translate
  'blockeduserssheet.001': "Liste Yüklenemedi",  // TODO: translate
  'blockeduserssheet.002': "Engellenen kullanıcılar çekilemedi.",  // TODO: translate
  'blockeduserssheet.003': "Engel Kaldırıldı",  // TODO: translate
  'boostpickersheet.001': "Hızlı Boost",  // TODO: translate
  'boostpickersheet.002': "Profilin ve odaların Keşfet'te öne çıkar. Tıklayan kullanıcılar odalarına ulaşır.",  // TODO: translate
  'boostpickersheet.003': "Boost Başlat",  // TODO: translate
  'createroomcoachmark.001': "butonuna dokun ve ilk odanı aç.",  // TODO: translate
  'discoverwelcomesheet.001': "Sesle tanış",  // TODO: translate
  'discoverwelcomesheet.002': "Kendi odanı aç",  // TODO: translate
  'fabhintoverlay.001': "Buradan yeni bir oda açabilirsin. Arkadaşlarını davet et, sohbete başla!",  // TODO: translate
  'fabhintoverlay.002': "Anladım — dokun",  // TODO: translate
  'followlistmodal.001': "ARKADAŞLAR",  // TODO: translate
  'followlistmodal.002': "TAKİPÇİLER",  // TODO: translate
  'incomingcalloverlay.001': "Arıyor...",  // TODO: translate
  'profile.badgelistmodal.001': "Henüz rozet kazanmamış",  // TODO: translate
  'profile.badgelistmodal.002': "Oda kur, arkadaş edin, SP gönder — rozetler otomatik gelir.",  // TODO: translate
  'profile.bioeditorsheet.001': "Cancel",  // translated
  'profile.bioeditorsheet.002': "Örn: Müzik, kahve ve kod ☕",  // TODO: translate
  'profile.featuredbadgespicker.001': "Öne çıkan rozetler güncellendi",  // TODO: translate
  'profile.featuredbadgespicker.002': "Loading...",  // translated
  'profile.featuredbadgespicker.003': "Henüz rozetin yok",  // TODO: translate
  'profile.featuredbadgespicker.004': "Aktif kullanım, sahne, bağış ile rozet kazan",  // TODO: translate
  'profile.giftdetailmodal.001': "ALDIĞI HEDİYELER",  // TODO: translate
  'profile.giftdetailmodal.002': "VERDİĞİ HEDİYELER",  // TODO: translate
  'profile.giftsheet.001': "Hediye gönderilemedi",  // TODO: translate
  'profile.giftsheet.002': "Hediye gönderilemedi",  // TODO: translate
  'profile.giftshowcase.001': "· son 30 gün",  // TODO: translate
  'profile.giftshowcase.002': "· son 30 gün",  // TODO: translate
  'profile.languageinterestpicker.001': "KİMLİĞİN",  // TODO: translate
  'profile.personalnotecard.001': "Bu kişi hakkında özel not bırak (sadece sen görürsün)",  // TODO: translate
  'profile.sociallinkseditor.001': "SOSYAL LİNKLER",  // TODO: translate
  'profile.spdonatesheet.001': "Bağış başarısız",  // TODO: translate
  'profile.spdonatesheet.002': "Bağış başarısız",  // TODO: translate
  'profile.sphistorysheet.001': "SP GEÇMİŞİM",  // TODO: translate
  'profile.sphistorysheet.002': "Son 30 işlem · Canlı",  // TODO: translate
  'profile.sphistorysheet.003': "Güncel Bakiye",  // TODO: translate
  'profile.sphistorysheet.004': "Henüz işlem yok",  // TODO: translate
  'profile.sphistorysheet.005': "Oda aç, sahneye çık — kazanmaya başla",  // TODO: translate
  'profile.spreceivedmodal.001': "Teşekkürler",  // TODO: translate
  'profile.spreceivedmodal.002': "Sağol",  // TODO: translate
  'profile.spsentsuccessmodal.001': "SP HEDİYE EDİLEN KİŞİ",  // TODO: translate
  'profile.symbolgiftsheet.001': "Her gönderimde SP'n düşer · Alıcı %50 kazanır",  // TODO: translate
  'profile.symbolgiftsheet.002': "Gönderilemedi",  // TODO: translate
  'profile.thankyoureceivedmodal.001': "🙏 TEŞEKKÜR ALDIN!",  // TODO: translate
  'profile.thankyoureceivedmodal.002': "sana teşekkür etti",  // TODO: translate
  'profile.tieredprofilesections.001': "Dil & Yaş Etiketleri",  // TODO: translate
  'profile.tieredprofilesections.002': "Kapsamlı Moderasyon Geçmişi",  // TODO: translate
  'profile.tieredprofilesections.003': "Profil Teması",  // TODO: translate
  'profile.tieredprofilesections.004': "Kapak Fotoğrafı",  // TODO: translate
  'profile.voicebiorecorder.001': "Kayıt başlatılamadı",  // TODO: translate
  'profile.voicebiorecorder.002': "Çok kısa",  // TODO: translate
  'profile.voicebiorecorder.003': "Kayıt sonlanmadı",  // TODO: translate
  'profile.voicebiorecorder.004': "Sesli tanıtım kaydedildi",  // TODO: translate
  'profile.voicebiorecorder.005': "Yükleme başarısız",  // TODO: translate
  'profile.welcomebonusmodal.001': "Keşfetmeye Başla",  // TODO: translate
  'quickcreatesheet.001': "Hızlı Aç",  // TODO: translate
  'reportmodal.001': "Taciz / Zorbalık",  // TODO: translate
  'reportmodal.002': "Nefret Söylemi",  // TODO: translate
  'reportmodal.003': "Uygunsuz İçerik",  // TODO: translate
  'reportmodal.004': "Kimliğe Bürünme",  // TODO: translate
  'room.camerafullscreenmodal.001': "Kamera yayını bekleniyor…",  // TODO: translate
  'room.camerafullscreenmodal.002': "Aşağı kaydır ya da ✕ ile kapat",  // TODO: translate
  'room.entryfeecard.001': "ODA BİLETİ",  // TODO: translate
  'room.entryfeecard.002': "GİRİŞ ÜCRETİ",  // TODO: translate
  'room.entryfeecard.003': "Cancel",  // translated
  'room.hostaccesspanel.001': "✅ Ban Kaldırıldı",  // TODO: translate
  'room.hostaccesspanel.002': "Ban Kaldırılamadı",  // TODO: translate
  'room.hostaccesspanel.003': "📨 Davet Gönderildi",  // TODO: translate
  'room.inroomuserprofile.001': "Bu kullanıcıyı engelledin. Profil içeriği gizli.",  // TODO: translate
  'room.invitefriendsmodal.001': "Arkadaşlar yükleniyor...",  // TODO: translate
  'room.invitefriendsmodal.002': "Keşfet sayfasından yeni insanlar bul ve takip et!",  // TODO: translate
  'room.messageglowpickersheet.001': "Bir stil seç — bir sonraki mesajın o şekilde gönderilir",  // TODO: translate
  'room.messageglowpickersheet.002': "STANDART · MESAJ BAŞI ÜCRET",  // TODO: translate
  'room.messageglowpickersheet.003': "★ PREMIUM · KOLEKSİYON ★",  // TODO: translate
  'room.messageglowpickersheet.004': "SAHİPSİN · FREE",  // TODO: translate
  'room.powerupssheet.001': "Süre Uzat",  // TODO: translate
  'room.powerupssheet.002': "Odanın süresini +30 dk uzatır",  // TODO: translate
  'room.roomaccessprompts.001': "Cancel",  // translated
  'room.roomaccessprompts.002': "Erişim kontrol ediliyor…",  // TODO: translate
  'room.roomaccessprompts.003': "Şifreyi girin...",  // TODO: translate
  'room.roomclosedscreen.001': "Bu oda kapanmış",  // TODO: translate
  'room.roomdisconnectoverlay.001': "Odadan Çık",  // TODO: translate
  'room.roomentryeffectoverlay.001': "Sonsuz Burç",  // TODO: translate
  'room.roomfollowerssheet.001': "ODA TAKİPÇİLERİ",  // TODO: translate
  'room.roomfollowerssheet.002': "Bu odanın henüz takipçisi yok",  // TODO: translate
  'room.roomfollowerssheet.003': "Odanın altında \"Takip Et\" tıklayanlar burada listelenir.",  // TODO: translate
  'room.roomgiftpanel.001': "Hediyeler her gönderimde SP'ni düşürür · Alıcı %50 SP kazanır",  // TODO: translate
  'room.roomgiftpanel.002': "Hediye gönderebileceğin kullanıcı yok.",  // TODO: translate
  'room.roomgiftpanel.003': "Önce alıcı seç (üstteki avatarlardan)",  // TODO: translate
  'room.roommanagesheet.001': "Oda kilitli — kimse giremiyor. Erişim modunu değiştirmek için kilidi kapat.",  // TODO: translate
  'room.roommanagesheet.002': "Geçici host moddasın. Yalnız moderasyon ve takipçi görüntüleme açık. Oda adı, teması, ücreti gibi ayarlar yalnız asıl sahibinde.",  // TODO: translate
  'room.roommanagesheet.003': "Gün Batımı",  // TODO: translate
  'room.roommanagesheet.004': "Gül",  // TODO: translate
  'room.roommanagesheet.005': "Ayar Güncellenemedi",  // TODO: translate
  'room.roommanagesheet.006': "🔐 Şifre Gerekli",  // TODO: translate
  'room.roommanagesheet.007': "Şifreli oda için en az 1 karakter şifre yaz.",  // TODO: translate
  'room.roommanagesheet.008': "🔐 Çok Kısa",  // TODO: translate
  'room.roomoverlays.001': "İzinli",  // TODO: translate
  'room.roomoverlays.002': "Seçili",  // TODO: translate
  'room.roomoverlays.003': "Gün Batımı",  // TODO: translate
  'room.roomoverlays.004': "Gül",  // TODO: translate
  'room.roomoverlays.005': "Open",  // translated
  'room.roomoverlays.006': "Şifreli",  // TODO: translate
  'room.roomoverlays.007': "✅ Ban Kaldırıldı",  // TODO: translate
  'room.roomoverlays.008': "Ban Kaldırılamadı",  // TODO: translate
  'room.roomoverlays.009': "Bu kullanıcının banı kaldırılamadı.",  // TODO: translate
  'room.roomoverlays.010': "Konuşma",  // TODO: translate
  'room.roomoverlays.011': "Music",  // translated
  'room.roomoverlays.012': "Katılım İstekleri",  // TODO: translate
  'room.roomoverlays.013': "Katılım İstekleri",  // TODO: translate
  'room.roomoverlays.014': "Oda Linkini Paylaş",  // TODO: translate
  'room.roomoverlays.015': "İstatistikler & Boost",  // TODO: translate
  'room.roomoverlays.016': "Keşfette Öne Çıkar",  // TODO: translate
  'room.roomrecordingssheet.001': "Oda yönetim panelinden \"Kaydı Başlat\" ile sesli sohbeti kaydedin.",  // TODO: translate
  'room.roomrecordingssheet.002': "Kaydı Oynatılamadı",  // TODO: translate
  'room.roomstatspanel.001': "Anlık katılımcı",  // TODO: translate
  'room.roomstatspanel.002': "Benzersiz katılımcı",  // TODO: translate
  'room.speakersection.001': "Sahne boş",  // TODO: translate
  'room.stagesupportsheet.001': "Destek gönderilemedi",  // TODO: translate
  'roomboostsheet.001': "Hızlı Boost",  // TODO: translate
  'roomboostsheet.002': "POPÜLER",  // TODO: translate
  'roomcreatehintsheet.001': "Yeni Oda Oluştur",  // TODO: translate
  'roomcreatehintsheet.002': "Şimdi değil",  // TODO: translate
  'roomcreatehintsheet.003': "Odalarım'a Git",  // TODO: translate
  'sessionconflictmodal.001': "Your account was opened on another device",
  'sessionconflictmodal.002': "Sign Out",
  'store.storeitempreviewsheet.001': "GÜNÜN FIRSATI",  // TODO: translate
  'store.storeitempreviewsheet.002': "FİYAT",  // TODO: translate
  'systemsettingsoverlay.001': "Bakım Modu",  // TODO: translate
  'systemsettingsoverlay.002': "Güncelleme Gerekli",  // TODO: translate
  'usersearchmodal.001': "Yukarıdaki arama çubuğundan tüm üyeleri arayabilirsin!",  // TODO: translate

  // ═══ AUTO-EXTRACTED v2 (translate me) ═══
  'auth.login.001': "Enter your email address and we'll send you a password reset link.",  // translated
  'auth.login.002': "Underweight",  // translated
  'auth.login.003': "Good",  // translated
  'auth.login.004': "Strong",  // translated
  'auth.login.005': "Fill in the email and password fields.",  // translated
  'auth.login.006': "Invalid Email",  // translated
  'auth.login.007': "Enter a valid email address.",  // translated
  'auth.login.008': "Too many attempts",  // translated
  'auth.login.009': "Account Temporarily Locked",  // translated
  'auth.login.010': "Account Temporarily Locked",  // translated
  'auth.login.011': "Login error",  // translated
  'auth.login.012': "Incorrect email or password",  // translated
  'auth.login.013': "Fill all fields",  // translated
  'auth.login.014': "Invalid Email",  // translated
  'auth.login.015': "Enter a valid email address.",  // translated
  'auth.login.016': "Invalid Email",  // translated
  'auth.login.017': "The email extension is not valid. (such as .com, .net, .org)",  // translated
  'auth.login.018': "Temporary Email Not Accepted",  // translated
  'auth.login.019': "Temporary emails such as Mailinator/tempmail cannot be used for registration. Enter a real email.",  // translated
  'auth.login.020': "Passwords don't match.",  // translated
  'auth.login.021': "The two password fields must be the same.",  // translated
  'auth.login.022': "Password is too short!",  // translated
  'auth.login.023': "Have at least 8 characters",  // translated
  'auth.login.024': "Uppercase Missing",  // translated
  'auth.login.025': "Password must contain at least 1 uppercase letter.",  // translated
  'auth.login.026': "Password must have at least 1 number.",  // translated
  'auth.login.027': "Verification email sent",  // translated
  'auth.login.028': "Please check and verify your email inbox.",  // translated
  'auth.login.029': "This email already registered",  // translated
  'auth.login.030': "You have already registered with this email. The home screen has been switched.",  // translated
  'auth.login.031': "Invalid Email",  // translated
  'auth.login.032': "Please enter a valid email address!",  // translated
  'auth.login.033': "Weak Password",  // translated
  'auth.login.034': "Choose a stronger password.",  // translated
  'auth.login.035': "Connection Error",  // translated
  'auth.login.036': "Check your network connection.",  // translated
  'auth.login.037': "Registration Failed",  // translated
  'auth.login.038': "Something went wrong, try again.",  // translated
  'auth.login.039': "Please enter your email address.",  // translated
  'auth.login.040': "Invalid Email",  // translated
  'auth.login.041': "Please enter a valid email address!",  // translated
  'auth.login.042': "✉️ Email Sent",  // translated
  'auth.login.043': "A reset link has been sent to your email. Also check your spam folder.",  // translated
  'auth.login.044': "This account does not exist.",  // translated
  'auth.login.045': "There is no account registered with this email. Sign up first.",  // translated
  'auth.login.046': "Invalid Email",  // translated
  'auth.login.047': "Please enter a valid email address!",  // translated
  'auth.login.048': "Too many attempts",  // translated
  'auth.login.049': "Connection Error",  // translated
  'auth.login.050': "Check your network connection.",  // translated
  'auth.login.051': "Failed to send email, try again.",  // translated
  'auth.login.052': "✉️ Sent",  // translated
  'auth.login.053': "\"Verification email resent\":",  // translated
  'auth.login.054': "Too many requests",  // translated
  'auth.login.055': "Wait a few minutes and try again.",  // translated
  'auth.login.056': "The email could not be sent.",  // translated
  'auth.login.057': "The verification email could not be forwarded.",  // translated
  'auth.login.058': "Authenticated",  // translated
  'auth.login.059': "Your email has been verified! Logging in...",  // translated
  'auth.login.060': "Not yet verified",  // translated
  'auth.login.061': "Please check your mailbox.",  // translated
  'auth.login.062': "Failed to get verification status. Try again.",  // translated
  'auth.login.063': "Reset password",  // translated
  'auth.onboarding.001': "Female",  // translated
  'auth.onboarding.002': "Music",  // translated
  'auth.onboarding.003': "Failed to complete onboarding — DB error. Try again.",  // translated
  'auth.onboarding.004': "Connection Error",  // translated
  'auth.onboarding.005': "Failed to save onboarding. Check your internet connection and try again.",  // translated
  'auth.onboarding.006': "Invalid Code!",  // translated
  'auth.onboarding.007': "Please enter a valid invite code.",  // translated
  'auth.onboarding.008': "Welcome to the community! 50 SP has been added to your account.",  // translated
  'auth.onboarding.009': "Photo successfully uploaded",  // translated
  'auth.onboarding.010': "Your profile photo is ready!",  // translated
  'auth.onboarding.011': "Name is required",  // translated
  'auth.onboarding.012': "Name is too short",  // translated
  'auth.onboarding.013': "Must be at least 2 characters.",  // translated
  'auth.onboarding.014': "Inappropriate Name",  // translated
  'auth.onboarding.015': "Please choose an appropriate name.",  // translated
  'auth.onboarding.016': "Invalid Character",  // translated
  'auth.onboarding.017': "Name must contain visible characters.",  // translated
  'auth.onboarding.018': "Too Many Emojis",  // translated
  'auth.onboarding.019': "Profile Creation Failed",  // translated
  'auth.onboarding.020': "Please enter your birth year:&#09;",  // translated
  'auth.onboarding.021': "Age Limit",  // translated
  'auth.onboarding.022': "You must be 13 years old to use SopranoChat.",  // translated
  'auth.onboarding.023': "Alert",  // translated
  'auth.onboarding.024': "Failed to save information, you can update it later.",  // translated
  'auth.onboarding.025': "You must select",  // translated
  'auth.onboarding.026': "Select at least 1 area of interest",  // translated
  'auth.onboarding.027': "Failed to write interests. There may be an Internet / DB problem.",  // translated
  'auth.onboarding.028': "Do you want to give up?",  // translated
  'auth.onboarding.029': "The information you have entered so far will not be saved and you will be logged out.",  // translated
  'tabs.home.001': "Feature Profile",  // translated
  'tabs.home.002': "You are already in a room",  // translated
  'tabs.home.003': "Leave the existing room first.",  // translated
  'tabs.home.004': "Daily Limit Expired",  // translated
  'tabs.home.005': "Failed to Open Room",  // translated
  'tabs.home.006': "Failed to load rooms",  // translated
  'tabs.home.007': "Login Required",  // translated
  'tabs.home.008': "You must be logged in to join the room.",  // translated
  'tabs.home.009': "Tracking Not Updated",  // translated
  'tabs.home.010': "Login Required",  // translated
  'tabs.home.011': "You must login to ask question .",  // translated
  'tabs.messages.001': "Wants to text — tap and reply",  // translated
  'tabs.messages.002': "Failed to load messages",  // translated
  'tabs.messages.003': "Error Search",  // translated
  'tabs.messages.004': "Fixation Not Updated",  // translated
  'tabs.messages.005': "Chat pin status could not be changed.",  // translated
  'tabs.messages.006': "Archive Not Updated",  // translated
  'tabs.messages.007': "Chat archive status could not be changed.",  // translated
  'tabs.messages.008': "Mute Failed",  // translated
  'tabs.messages.009': "Request rejected",  // translated
  'tabs.messages.010': "No requests",  // translated
  'tabs.messages.011': "You have no pending message requests.",  // translated
  'tabs.messages.012': "Archive is empty",  // translated
  'tabs.messages.013': "You don't have any archived chats yet.",  // translated
  'tabs.messages.014': "Selected chats will be permanently deleted.",  // translated
  'tabs.messages.015': "Partially deleted",  // translated
  'tabs.messages.016': "Check your internet connection.",
  'tabs.messages.017': "User",
  'tabs.messages.018': "📌 Pinned",
  'tabs.messages.019': "Unpinned",
  'tabs.messages.020': "🗄️ {{name}} archived",
  'tabs.messages.021': "↩️ Unarchived",
  'tabs.messages.022': "Will come back automatically on new message.",
  'tabs.messages.023': "🔕 {{name}} muted",
  'tabs.messages.024': "🔔 Unmuted",
  'tabs.messages.025': "Couldn't block",
  'tabs.messages.026': "Error blocking {{name}}.",
  'tabs.messages.027': "Unpin",
  'tabs.messages.028': "Pin",
  'tabs.messages.029': "Unmute",
  'tabs.messages.030': "Mute",
  'tabs.messages.031': "Unarchive",
  'tabs.messages.032': "Archive",
  'tabs.messages.033': "Close search",
  'tabs.messages.034': "Search chats",
  'tabs.messages.035': "Cancel",
  'tabs.messages.036': "Edit",
  'tabs.messages.037': "Back",
  'tabs.messages.038': "Requests ({{count}})",
  'tabs.messages.039': "Archive ({{count}})",
  'tabs.messages.040': "Go to Discover and find someone\nto start chatting!",
  'tabs.messages.041': "Deselect",
  'tabs.messages.042': "Select All",
  'tabs.messages.043': "Muted",
  'tabs.messages.044': "Couldn't start the call.",
  'tabs.messages.045': "Try again.",
  'tabs.messages.046': "Rejected for {{name}}.",
  'tabs.messages.047': "Couldn't reject",
  'tabs.messages.048': "⛔ Blocked",
  'tabs.messages.049': "{{name}} blocked.",
  'tabs.messages.050': "Voice Call",
  'tabs.messages.051': "Delete Chat",
  'tabs.messages.052': "Block",
  'tabs.messages.053': "{{count}} chats will be deleted",
  'tabs.messages.054': "Delete",
  'tabs.messages.055': "Couldn't delete {{count}} chats, try again.",
  'tabs.messages.056': "Delete {{count}}",
  'tabs.messages.057': "{{count}} new messages",
  'auto.auth.login.001': "Gönder",  // TODO: translate
  'auto.auth.login.002': "Gönderiliyor...",  // TODO: translate
  'auto.auth.login.003': "Cancel",  // translated
  'auto.auth.login.004': "Şifreyi göster",  // TODO: translate
  'auto.auth.login.005': "Şifreyi gizle",  // TODO: translate
  'auto.auth.login.006': "canlı oda",  // TODO: translate
  'auto.auth.login.007': "çevrimiçi",  // TODO: translate
  'auto.auth.login.008': "Google ile giriş iptal edildi.",  // TODO: translate
  'auto.auth.login.009': "Google ile giriş şu an kullanılamıyor. E-posta ile giriş yapabilirsin.",  // TODO: translate
  'auto.auth.login.010': "GoogleSignin module yüklendi ama signIn fonksiyonu bulunamadı",  // TODO: translate
  'auto.auth.onboarding.001': "Cancel",  // translated
  'auto.auth.onboarding.002': "Seçimleri Kaydet",  // TODO: translate
  'auto.auth.onboarding.003': "Doğum Yılı",  // TODO: translate
  'auto.auth.onboarding.004': "Profil oluşturulamadı.",  // TODO: translate
  'auto.tabs.home.001': "{{0}} arkadaşın online — ilk sen yayına geç",  // TODO: translate
  'auto.tabs.home.003': "User",  // translated
  'auto.tabs.home.004': "User",  // translated
  'auto.tabs.home.005': "Arkadaşlar",  // TODO: translate
  'auto.tabs.home.006': "Arkadaşlar, {{0}} bekleyen istek",  // TODO: translate
  'auto.tabs.home.007': "Takipten çıkılamadı.",  // TODO: translate
  'auto.tabs.home.008': "İnternet bağlantını kontrol et.",  // TODO: translate
  'auto.tabs.home.009': "User",  // translated
  'auto.tabs.home.011': "Bağlanıyor...",  // TODO: translate
  'auto.tabs.home.012': "Ziyaretçi",  // TODO: translate
  'auto.tabs.home.013': "User",  // translated
  'auto.tabs.myrooms.001': "{{0}} kişiye davet gönderildi",  // TODO: translate
  'auto.tabs.myrooms.002': "SopranoChat Odası",  // TODO: translate
  'auto.tabs.myrooms.003': "🎤 \"{{0}}\" odasına gel! SopranoChat'te konuşalım:\nhttps://sopranochat.com/room/{{1}}",  // TODO: translate
  'auto.tabs.myrooms.004': "Sesli veya görüntülü oda aç",  // TODO: translate
  'auto.tabs.myrooms.005': "Sınırsız oda hakkı · ∞ oda aç",  // TODO: translate
  'auto.tabs.myrooms.006': "Bugün {{0}}/{{1}} kullandın · Sesli oda aç",  // TODO: translate
  'auto.tabs.myrooms.007': "Arkadaşlar",  // TODO: translate
  'auto.tabs.myrooms.008': "Arkadaşlar, {{0}} bekleyen istek",  // TODO: translate
  'auto.tabs.myrooms.009': "Aramayı kapat",  // TODO: translate
  'auto.tabs.myrooms.010': "Görsel yüklenirken hata oluştu.",  // TODO: translate
  'auto.tabs.myrooms.011': "Görsel yüklenirken hata oluştu.",  // TODO: translate
  'auto.tabs.myrooms.012': "Oda uyku moduna alınamadı.",  // TODO: translate
  'auto.tabs.myrooms.013': "User",  // translated
  'auto.tabs.myrooms.014': "İşlem tamamlanamadı.",  // TODO: translate
  'auto.tabs.myrooms.015': "Sunucuya ulaşılamadı.",  // TODO: translate
  'auto.tabs.myrooms.016': "Oda başlatılamadı.",  // TODO: translate
  'auto.tabs.myrooms.017': "Bu oda {{0}} için planlanmıştı, şimdi canlıya alınıyor.",  // TODO: translate
  'auto.tabs.myrooms.018': "Arkadaş",  // TODO: translate
  'auto.tabs.myrooms.019': "Arkadaş",  // TODO: translate
  'auto.tabs.myrooms.020': "İlk odanızı oluşturun!",  // TODO: translate
  'auto.tabs.myrooms.021': "Henüz bir odanız yok.",  // TODO: translate
  'auto.tabs.myrooms.022': "kaldı",  // TODO: translate
  'auto.tabs.profile.001': "Bir sorun oluştu.",  // TODO: translate
  'auto.tabs.profile.002': "Arkadaş listesinden çıkarılamadı.",  // TODO: translate
  'auto.tabs.profile.003': "{{0}} listenden çıkarıldı.",  // TODO: translate
  'auto.tabs.profile.004': "Çıkar",  // TODO: translate
  'auto.tabs.profile.005': "Cancel",  // translated
  'auto.tabs.profile.006': "{{0}} artık arkadaş listenden kaldırılacak.",  // TODO: translate
  'auto.tabs.profile.007': "Hata oluştu",  // TODO: translate
  'auto.tabs.profile.008': "Bir kod zaten uygulandı",  // TODO: translate
  'auto.tabs.profile.009': "SP geçmişi",  // TODO: translate
  'auto.tabs.profile.010': "SopranoChat'e katıl! Davet kodumu kullan, 50 SP hediye kazan: {{0}}\nhttps://sopranochat.com",  // TODO: translate
  'auto.tabs.profile.011': "Bir sorun oluştu.",  // TODO: translate
  'auto.tabs.profile.012': "Çıkış Yap",  // TODO: translate
  'auto.tabs.profile.013': "Cancel",  // translated
  'auto.tabs.profile.014': "User",  // translated
  'auto.tabs.profile.015': "SP işlemi",  // TODO: translate
  'auto.tabs.profile.016': "İade",  // TODO: translate
  'auto.tabs.profile.017': "Admin ödülü",  // TODO: translate
  'auto.tabs.profile.018': "Başarım",  // TODO: translate
  'auto.tabs.profile.019': "Mağaza alışverişi",  // TODO: translate
  'auto.tabs.profile.020': "Hediye gönderildi",  // TODO: translate
  'auto.tabs.profile.021': "Hediye alındı",  // TODO: translate
  'auto.tabs.profile.022': "Davet ödülü",  // TODO: translate
  'auto.tabs.profile.023': "Oda oluşturma",  // TODO: translate
  'auto.tabs.profile.024': "Sahne süresi",  // TODO: translate
  'auto.tabs.profile.025': "Prime-time dönüş",  // TODO: translate
  'auto.tabs.profile.026': "Günlük giriş",  // TODO: translate
  'auto.admin.001': "Offline",  // translated
  'auto.admin.002': "Online",  // translated
  'auto.admin.003': "kişi ·",  // TODO: translate
  'auto.admin.004': "{{0}}gün",  // TODO: translate
  'auto.admin.005': "Bu kategoride kullanıcı odası yok",  // TODO: translate
  'auto.admin.006': "Aramayla eşleşen oda bulunamadı",  // TODO: translate
  'auto.admin.007': "Tümü",  // TODO: translate
  'auto.admin.008': "Canlı",  // TODO: translate
  'auto.admin.009': "Canlı",  // TODO: translate
  'auto.admin.010': "Bu özellik yakında eklenecek.",  // TODO: translate
  'auto.admin.011': "Şikayetler ({{0}})",  // TODO: translate
  'auto.admin.012': "{{0}} kalıcı olarak silindi.",  // TODO: translate
  'auto.admin.013': "İşlem tamamlanamadı.",  // TODO: translate
  'auto.admin.014': "Kalıcı Sil",  // TODO: translate
  'auto.admin.015': "Cancel",  // translated
  'auto.admin.016': "\"{{0}}\" adlı kullanıcıyı KALICI olarak silmek istiyor musun?\n\nBu işlem GERİ ALINAMAZ!\n\nSilinecekler:\n• Profil\n• Tüm odalar\n• Mesajlar\n• Arkadaşlıklar\n• Raporlar",  // TODO: translate
  'auto.admin.017': "⚠️ Kullanıcıyı Sil",  // TODO: translate
  'auto.admin.018': "Transfer başarısız.",  // TODO: translate
  'auto.admin.019': "{{0}} hesabına eklendi.",  // TODO: translate
  'auto.admin.020': "Cancel",  // translated
  'auto.admin.021': "{{0}} adlı kullanıcıya kaç SP vermek istiyorsun?",  // TODO: translate
  'auto.admin.022': "⭐ Admin Yapıldı",  // TODO: translate
  'auto.admin.023': "🔻 Adminlik Kaldırıldı",  // TODO: translate
  'auto.admin.024': "İşlem tamamlanamadı.",  // TODO: translate
  'auto.admin.025': "Cancel",  // translated
  'auto.admin.026': "Adminliği Kaldır",  // TODO: translate
  'auto.admin.027': "Banlandı",  // TODO: translate
  'auto.admin.028': "Ban Kaldırıldı",  // TODO: translate
  'auto.admin.029': "Cancel",  // translated
  'auto.admin.030': "Banı Kaldır",  // TODO: translate
  'auto.admin.031': "\"{{0}}\" — Mevcut: {{1}}\n\nYeni tier seçin:",  // TODO: translate
  'auto.admin.032': "Oda Tier Değiştir",  // TODO: translate
  'auto.admin.033': "Cancel",  // translated
  'auto.admin.034': "{{0}} tier değişikliği uygulanamadı.",  // TODO: translate
  'auto.admin.035': "{{0}} uyandırılamadı.",  // TODO: translate
  'auto.admin.036': "Uyandır",  // TODO: translate
  'auto.admin.037': "Cancel",  // translated
  'auto.admin.038': "\"{{0}}\" odasını yeniden canlıya almak istiyor musun?",  // TODO: translate
  'auto.admin.039': "Odayı Uyandır",  // TODO: translate
  'auto.admin.040': "İşlem tamamlanamadı.",  // TODO: translate
  'auto.admin.041': "Kalıcı Sil",  // TODO: translate
  'auto.admin.042': "Cancel",  // translated
  'auto.admin.043': "\"{{0}}\" odasını KALICI olarak silmek istiyor musun?\n\nBu işlem geri alınamaz!",  // TODO: translate
  'auto.admin.044': "Odayı Kalıcı Sil",  // TODO: translate
  'auto.admin.045': "Cancel",  // translated
  'auto.admin.046': "\"{{0}}\" odasını kapatmak istiyor musun?\n\nTüm kullanıcılar çıkarılacak.",  // TODO: translate
  'auto.admin.047': "Odayı Kapat",  // TODO: translate
  'auto.admin.048': "Cancel",  // translated
  'auto.admin.049': "{{0}} adlı kullanıcıyı BANLAMAK istiyor musun?\n\nBu işlem geri alınabilir.",  // TODO: translate
  'auto.admin.050': "Kullanıcıyı Banla",  // TODO: translate
  'auto.admin.051': "Davranışlarınız nedeniyle bir uyarı aldınız. Kuralları tekrar ihlal etmeniz durumunda hesabınız askıya alınabilir.",  // TODO: translate
  'auto.admin.052': "Cancel",  // translated
  'auto.admin.053': "Bu kullanıcıya uyarı vermek istiyor musun?",  // TODO: translate
  'auto.admin.054': "Kullanıcıyı Uyar",  // TODO: translate
  'auto.admin.055': "Cancel",  // translated
  'auto.admin.056': "Bu şikayeti \"geçersiz\" olarak kapatmak istiyor musun?",  // TODO: translate
  'auto.admin.057': "Şikayeti Kapat",  // TODO: translate
  'auto.admin.058': "Other",  // translated
  'auto.admin.059': "Tartışma",  // TODO: translate
  'auto.admin.060': "Eğitim",  // TODO: translate
  'auto.admin.061': "Music",  // translated
  'auto.admin.062': "Other",  // translated
  'auto.admin.063': "Reşit Olmayan",  // TODO: translate
  'auto.admin.064': "Şiddet",  // TODO: translate
  'auto.admin.065': "Kimliğe Bürünme",  // TODO: translate
  'auto.admin.066': "Uygunsuz İçerik",  // TODO: translate
  'auto.admin.067': "Nefret Söylemi",  // TODO: translate
  'auto.auth.reset_password.001': "Bu şifre sıfırlama bağlantısı süresi dolmuş ya da daha önce kullanılmış. Lütfen giriş ekranından yeni bir sıfırlama maili iste.",  // TODO: translate
  'auto.auth.reset_password.002': "Bu kurtarma bağlantısı süresi dolmuş ya da daha önce kullanılmış. Destekten yardım iste.",  // TODO: translate
  'auto.auth.reset_password.003': "Bu doğrulama bağlantısı süresi dolmuş ya da daha önce kullanılmış. Yeni bir doğrulama maili için profil ayarlarından tekrar talep et.",  // TODO: translate
  'auto.auth.reset_password.004': "E-posta adresin başarıyla kurtarıldı. Artık eski hesabınla giriş yapabilirsin.",  // TODO: translate
  'auto.auth.reset_password.005': "E-posta adresin başarıyla doğrulandı. Artık SopranoChat'in tüm özelliklerini kullanabilirsin.",  // TODO: translate
  'auto.auth.reset_password.006': "E-posta Kurtarıldı",  // TODO: translate
  'auto.auth.reset_password.007': "E-posta Doğrulandı",  // TODO: translate
  'auto.call.id.001': "Arama başlatılamadı",  // TODO: translate
  'auto.call.id.002': "User",  // translated
  'auto.call.id.003': "User",  // translated
  'auto.call.id.004': "Süresi",  // TODO: translate
  'auto.call.id.005': "Arama Sonlandı",  // TODO: translate
  'auto.call.id.006': "Arama Tamamlandı",  // TODO: translate
  'auto.call.id.007': "Süresi",  // TODO: translate
  'auto.call.id.008': "Süresi",  // TODO: translate
  'auto.call.id.009': "Süresi",  // TODO: translate
  'auto.call.id.010': "Hoparlör",  // TODO: translate
  'auto.call.id.011': "Open",  // translated
  'auto.call.id.012': "Offline",  // translated
  'auto.call.id.013': "Online",  // translated
  'auto.call.id.014': "User",  // translated
  'auto.call.id.015': "Arama Sonlandı",  // TODO: translate
  'auto.call.id.016': "Çalıyor...",  // TODO: translate
  'auto.call.id.017': "Aranıyor...",  // TODO: translate
  'auto.call.id.018': "Çalıyor...",  // TODO: translate
  'auto.call.id.019': "User",  // translated
  'auto.call.id.020': "Arama Sonlandı",  // TODO: translate
  'auto.call.id.021': "Arama Süresi: {{0}}",  // TODO: translate
  'auto.call.id.022': "Aramada {{0}} kullanmak için ayarlardan izin vermelisiniz.",  // TODO: translate
  'auto.call.id.023': "⚠️ {{0}} İzni Gerekli",  // TODO: translate
  'auto.call.id.024': "Karşı Taraf Bağlantıyı Kesti",  // TODO: translate
  'auto.call.id.025': "Bağlantı Koptu",  // TODO: translate
  'auto.call.id.026': "User",  // translated
  'auto.call.id.027': "User",  // translated
  'auto.call.id.028': "Meşgul",  // TODO: translate
  'auto.call.id.029': "Meşgul",  // TODO: translate
  'auto.call.id.030': "Arama Sonlandı",  // TODO: translate
  'auto.call.id.031': "Arama Süresi: {{0}}",  // TODO: translate
  'auto.chat.id.001': "Engeli Kaldır",  // TODO: translate
  'auto.chat.id.002': "Cancel",  // translated
  'auto.chat.id.003': "Bu kullanıcı",  // TODO: translate
  'auto.chat.id.004': "Cancel",  // translated
  'auto.chat.id.005': "Kaldır",  // TODO: translate
  'auto.chat.id.006': "Bu kullanıcı",  // TODO: translate
  'auto.chat.id.007': "Sesi Aç",  // TODO: translate
  'auto.chat.id.008': "Cancel",  // translated
  'auto.chat.id.009': "Kaybolan Mesaj Süresi",  // TODO: translate
  'auto.chat.id.010': "Open",  // translated
  'auto.chat.id.011': "30 gün",  // TODO: translate
  'auto.chat.id.012': "7 gün",  // TODO: translate
  'auto.chat.id.013': "Yeni mesajlar bu süre sonra silinecek.",  // TODO: translate
  'auto.chat.id.014': "Mesajlar artık sınırsız.",  // TODO: translate
  'auto.chat.id.015': "✓ Kapatıldı",  // TODO: translate
  'auto.chat.id.016': "🎙️ Şu an \"{{0}}\" odasındayım! Gel katıl → soprano://room/{{1}}",  // TODO: translate
  'auto.chat.id.017': "📷 Fotoğraf",  // TODO: translate
  'auto.chat.id.018': "İlk mesajını yaz...",  // TODO: translate
  'auto.chat.id.019': "Mesaj atılamaz",  // TODO: translate
  'auto.chat.id.020': "Önce isteği kabul et",  // TODO: translate
  'auto.chat.id.021': "📷 Fotoğraf",  // TODO: translate
  'auto.chat.id.022': "Mevcut metni değiştir, gönder",  // TODO: translate
  'auto.chat.id.023': "User",  // translated
  'auto.chat.id.024': "✎ Düzenleniyor",  // TODO: translate
  'auto.chat.id.025': "User",  // translated
  'auto.chat.id.026': "Action failed",  // translated
  'auto.chat.id.027': "Action failed",  // translated
  'auto.chat.id.028': "Bu kullanıcı",  // TODO: translate
  'auto.chat.id.029': "Arama başlatılamadı",  // TODO: translate
  'auto.chat.id.030': "User",  // translated
  'auto.chat.id.031': "Offline",  // translated
  'auto.chat.id.032': "Son görülme: {{0}}",  // TODO: translate
  'auto.chat.id.033': "Mesaj Gönderilemedi",  // TODO: translate
  'auto.chat.id.034': "Mesaj gönderilemedi",  // TODO: translate
  'auto.chat.id.035': "Kaydedilenden çıkarıldı",  // TODO: translate
  'auto.chat.id.036': "User",  // translated
  'auto.chat.id.037': "📷 Fotoğraf",  // TODO: translate
  'auto.chat.id.038': "User",  // translated
  'auto.chat.id.039': "Bu mesaj herkes için silindi",  // TODO: translate
  'auto.create_room.001': "Günlük limit doldu (",  // TODO: translate
  'auto.create_room.002': "Yüklendi",  // TODO: translate
  'auto.create_room.003': "Tanımlandı",  // TODO: translate
  'auto.create_room.004': "Oda adı",  // TODO: translate
  'auto.create_room.005': "Ücretsiz",  // TODO: translate
  'auto.create_room.006': "Oda içinde arkada gösterilir",  // TODO: translate
  'auto.create_room.007': "Plus üyelik gerekli",  // TODO: translate
  'auto.create_room.008': "Lütfen tekrar dene.",  // TODO: translate
  'auto.create_room.009': "Lütfen tekrar dene.",  // TODO: translate
  'auto.create_room.010': "Sadece sen \"Sahneye Davet Et\"le konuşmacı ekleyebilirsin. Dinleyiciler el kaldıramaz, \"sahne kilitli\" uyarısı görürler.",  // TODO: translate
  'auto.create_room.011': "İstek kuyruğa düşer, sen veya moderatörlerin onayıyla sahneye çıkar. Dinleyici sırasını ve kaç kişi olduğunu görebilir.",  // TODO: translate
  'auto.create_room.012': "Tek tıkla mikrofonu açar, onay gerekmez. Sen veya bir moderatör sahnedeyken otomatik olarak \"el kaldırma\" akışına döner — hiyerarşi korunur.",  // TODO: translate
  'auto.create_room.013': "Closed",  // translated
  'auto.create_room.014': "Closed",  // translated
  'auto.create_room.015': "{{0}} arkadaşına davet gönderildi.",  // TODO: translate
  'auto.create_room.016': "Görsel yüklenemedi. Farklı bir resim seç veya internetini kontrol et.",  // TODO: translate
  'auto.create_room.017': "Yetki hatası. Lütfen tekrar giriş yap.",  // TODO: translate
  'auto.create_room.018': "İnternet bağlantın yavaş veya yok. Tekrar dene.",  // TODO: translate
  'auto.create_room.019': "Oda oluşturulamadı.",  // TODO: translate
  'auto.create_room.020': "Odan Hazır",  // TODO: translate
  'auto.create_room.021': "Oda Planlandı",  // TODO: translate
  'auto.create_room.022': "Oda adı uygun değil — 2-60 karakter ve uygunsuz kelime içermemeli.",  // TODO: translate
  'auto.create_room.023': "İnternet bağlantını kontrol et",  // TODO: translate
  'auto.create_room.024': "İnternet bağlantını kontrol et",  // TODO: translate
  'auto.create_room.025': "Bugün en fazla {{0}} oda açabilirsin.",  // TODO: translate
  'auto.create_room.026': "Uygunsuz kelime içeriyor",  // TODO: translate
  'auto.create_room.027': "Odan Hazır",  // TODO: translate
  'auto.edit_profile.001': "Arkadaşlar",  // TODO: translate
  'auto.edit_profile.002': "Profilini sadece arkadaşların görebilir",  // TODO: translate
  'auto.edit_profile.003': "Profilini herkes görebilir",  // TODO: translate
  'auto.edit_profile.004': "{{0}} link bağlı",  // TODO: translate
  'auto.edit_profile.005': "En değer verdiğin 3 rozeti öne çıkar",  // TODO: translate
  'auto.edit_profile.006': "{{0}} rozet seçili — profilde büyük gösterilir",  // TODO: translate
  'auto.edit_profile.007': "15-30sn kendini tanıt — yabancı kullanıcılar dinlesin",  // TODO: translate
  'auto.edit_profile.008': "{{0}}sn kayıt mevcut · değiştirmek için bas",  // TODO: translate
  'auto.edit_profile.009': "{{0}} dil · {{1}} ilgi alanı",  // TODO: translate
  'auto.edit_profile.010': "Konuştuğun dilleri ve ilgi alanlarını ekle",  // TODO: translate
  'auto.edit_profile.011': "Fotoğrafı Değiştir",  // TODO: translate
  'auto.edit_profile.012': "Görsel yüklenirken sorun oluştu.",  // TODO: translate
  'auto.leaderboard.001': "ödülü:",  // TODO: translate
  'auto.leaderboard.002': "User",  // translated
  'auto.leaderboard.003': "İsimsiz Oda",  // TODO: translate
  'auto.leaderboard.004': "User",  // translated
  'auto.leaderboard.005': "User",  // translated
  'auto.leaderboard.006': "User",  // translated
  'auto.leaderboard.007': "User",  // translated
  'auto.leaderboard.008': "User",  // translated
  'auto.leaderboard.009': "katılımcı",  // TODO: translate
  'auto.notifications.001': "User",  // translated
  'auto.notifications.002': "User",  // translated
  'auto.notifications.003': "yeni bir oda açtı",  // TODO: translate
  'auto.notifications.004': "odanızı takip etmeye başladı",  // TODO: translate
  'auto.notifications.005': "arkadaşlık isteğini kabul etti",  // TODO: translate
  'auto.notifications.006': "seninle arkadaş olmak istiyor",  // TODO: translate
  'auto.notifications.007': "seninle arkadaş oldu",  // TODO: translate
  'auto.notifications.008': "sana hediye gönderdi",  // TODO: translate
  'auto.notifications.009': "gönderine yorum yaptı",  // TODO: translate
  'auto.notifications.010': "gönderini beğendi",  // TODO: translate
  'auto.plus.001': "{{0}}₺/yıl",  // TODO: translate
  'auto.plus.002': "Tümü",  // TODO: translate
  'auto.plus.003': "Tümü",  // TODO: translate
  'auto.plus.004': "Açık + Şifreli",  // TODO: translate
  'auto.plus.005': "Seç",  // TODO: translate
  'auto.plus.006': "✓ Seçildi",  // TODO: translate
  'auto.plus.007': "Aylık",  // TODO: translate
  'auto.plus.008': "/yıl",  // TODO: translate
  'auto.plus.009': "Free'ye Dön",  // TODO: translate
  'auto.plus.010': "No",  // translated
  'auto.plus.011': "Mevcut planınız: {{0}}.\n\nFree (ücretsiz) plana dönmek ister misiniz?\nPremium özellikleriniz devre dışı kalacak.",  // TODO: translate
  'auto.plus.012': "Üyelik aktifleştirilemedi.",  // TODO: translate
  'auto.plus.013': "Artık {{0}} üyesisiniz — tüm premium özellikler açıldı.",  // TODO: translate
  'auto.plus.014': "{{0}} Üyelik Aktif!",  // TODO: translate
  'auto.plus.015': "{{0}}'a Geç",  // TODO: translate
  'auto.plus.016': "Cancel",  // translated
  'auto.plus.017': "{{0}} planına geçmek istediğinize emin misiniz?\n\nFiyat: {{1}}{{2}}",  // TODO: translate
  'auto.plus.018': "\n\n⚠️ Test modunda — gerçek ödeme alınmaz.",  // TODO: translate
  'auto.plus.019': "{{0}}₺/yıl",  // TODO: translate
  'auto.plus.020': "Düşür",  // TODO: translate
  'auto.plus.021': "Yükselt",  // TODO: translate
  'auto.plus.022': "1500 SP karşılama bonusu",  // TODO: translate
  'auto.plus.023': "Keşfet boost erişimi",  // TODO: translate
  'auto.plus.024': "Seçilmişler konuşma modu",  // TODO: translate
  'auto.plus.025': "Takipçi-only mod",  // TODO: translate
  'auto.plus.026': "Ghost mode + Kılık",  // TODO: translate
  'auto.plus.027': "Oda müziği + Arka plan",  // TODO: translate
  'auto.plus.028': "Sınırsız oda açabilirsin",  // TODO: translate
  'auto.plus.029': "Odan 7/24 açık kalır, kapanmaz",  // TODO: translate
  'auto.plus.030': "Sınırsız dinleyici",  // TODO: translate
  'auto.plus.031': "{{0}} kişi sahne",  // TODO: translate
  'auto.plus.032': "600 SP karşılama bonusu",  // TODO: translate
  'auto.plus.033': "3 odanı dondurup tekrar açabilirsin",  // TODO: translate
  'auto.plus.034': "Sadece Arkadaşlar modu",  // TODO: translate
  'auto.plus.035': "Yaş/Dil filtresi",  // TODO: translate
  'auto.plus.036': "Oda kart görseli + arka plan",  // TODO: translate
  'auto.plus.037': "Tüm oda türleri",  // TODO: translate
  'auto.plus.038': "Günde {{0}} oda açabilirsin",  // TODO: translate
  'auto.plus.039': "Her oda {{0}} saat açık kalır",  // TODO: translate
  'auto.plus.040': "{{0}} kişi sahne",  // TODO: translate
  'auto.room.id.001': "Odan Hazır",  // TODO: translate
  'auto.room.id.002': "User",  // translated
  'auto.room.id.003': "User",  // translated
  'auto.room.id.004': "User",  // translated
  'auto.room.id.005': "User",  // translated
  'auto.room.id.006': "User",  // translated
  'auto.room.id.007': "User",  // translated
  'auto.room.id.008': "User",  // translated
  'auto.room.id.009': "User",  // translated
  'auto.room.id.010': "User",  // translated
  'auto.room.id.011': "User",  // translated
  'auto.room.id.012': "İstek reddedildi",  // TODO: translate
  'auto.room.id.013': "Bir hata oluştu. Tekrar deneyin.",  // TODO: translate
  'auto.room.id.014': "Yanlış şifre.",  // TODO: translate
  'auto.room.id.015': "Geri Dön",  // TODO: translate
  'auto.room.id.016': "⚠️ Giriş Hatası",  // TODO: translate
  'auto.room.id.017': "⛔ Erişim Engellendi",  // TODO: translate
  'auto.room.id.018': "Odaya katılınamadı.",  // TODO: translate
  'auto.room.id.019': "{{0}} kişiye davet gönderildi",  // TODO: translate
  'auto.room.id.020': "Boost aktifleştirilemedi.",  // TODO: translate
  'auto.room.id.021': "{{0}} saat boyunca keşfette öne çıkacaksın!",  // TODO: translate
  'auto.room.id.022': "SP bakiyeniz yeterli değil.",  // TODO: translate
  'auto.room.id.023': "Sunucuya ulaşılamadı.",  // TODO: translate
  'auto.room.id.024': "Sunucuya ulaşılamadı.",  // TODO: translate
  'auto.room.id.025': "🔇 Müzik Linki Kaldırıldı",  // TODO: translate
  'auto.room.id.026': "🎵 Müzik Linki Eklendi",  // TODO: translate
  'auto.room.id.027': "🆓 Giriş Ücretsiz",  // TODO: translate
  'auto.room.id.028': "💰 Giriş: {{0}} SP",  // TODO: translate
  'auto.room.id.029': "Oda uyku moduna alınamadı.",  // TODO: translate
  'auto.room.id.030': "Cancel",  // translated
  'auto.room.id.031': "🔓 Şifre Kaldırıldı",  // TODO: translate
  'auto.room.id.032': "🔐 Şifre Ayarlandı",  // TODO: translate
  'auto.room.id.033': "Şifreli",  // TODO: translate
  'auto.room.id.034': "Herkese Açık",  // TODO: translate
  'auto.room.id.035': "Türkçe",  // TODO: translate
  'auto.room.id.036': "Bağış Kapatıldı",  // TODO: translate
  'auto.room.id.037': "Bağış Açıldı",  // TODO: translate
  'auto.room.id.038': "Herkese Açık",  // TODO: translate
  'auto.room.id.039': "Arkadaşlara Özel",  // TODO: translate
  'auto.room.id.040': "👥 Yaş Sınırı Kaldırıldı",  // TODO: translate
  'auto.room.id.041': "Slow Mode Kapalı",  // TODO: translate
  'auto.room.id.042': "Seçilmişler Modu",  // TODO: translate
  'auto.room.id.043': "İzinli Mod",  // TODO: translate
  'auto.room.id.044': "🔓 Kilit Açıldı",  // TODO: translate
  'auto.room.id.045': "Bağlantı hatası",  // TODO: translate
  'auto.room.id.046': "Premium stilin sonsuz kullanım hakkı var",  // TODO: translate
  'auto.room.id.047': "{{0}} SP harcandı",  // TODO: translate
  'auto.room.id.048': "Ayrıl",  // TODO: translate
  'auto.room.id.049': "Cancel",  // translated
  'auto.room.id.050': " kamera açılabilir.",  // TODO: translate
  'auto.room.id.051': "🎁 {{0}}, {{1}}'a {{2}} SP hediye gönderdi",  // TODO: translate
  'auto.room.id.052': "✨ {{0}}, {{1}}'ın sahnesini {{2}} SP destekledi",  // TODO: translate
  'auto.room.id.053': "User",  // translated
  'auto.room.id.054': "sn içinde kapanacak",  // TODO: translate
  'auto.room.id.055': "İstek reddedildi",  // TODO: translate
  'auto.room.id.056': "Bir hata oluştu. Tekrar deneyin.",  // TODO: translate
  'auto.room.id.057': "Yanlış şifre.",  // TODO: translate
  'auto.room.id.058': "Oda hazırlanıyor...",  // TODO: translate
  'auto.room.id.059': "Odaya bağlanılıyor...",  // TODO: translate
  'auto.room.id.060': "Artık bu odanın bildirimlerini almayacaksın.",  // TODO: translate
  'auto.room.id.061': "Oda güncellemelerinden haberdar olacaksın.",  // TODO: translate
  'auto.room.id.062': "💔 Takipten çıkıldı",  // TODO: translate
  'auto.room.id.063': "SopranoChat Odası",  // TODO: translate
  'auto.room.id.064': "🎤 \"{{0}}\" odasına gel! SopranoChat'te konuşalım:\nhttps://sopranochat.com/room/{{1}}",  // TODO: translate
  'auto.room.id.065': "Sahneye çıkılamadı",  // TODO: translate
  'auto.room.id.066': "Sahneye Hoş Geldin!",  // TODO: translate
  'auto.room.id.067': "👑 Sahneye Döndün!",  // TODO: translate
  'auto.room.id.068': "User",  // translated
  'auto.room.id.069': "User",  // translated
  'auto.room.id.070': "{{0}} konuşmacı serbest bırakıldı",  // TODO: translate
  'auto.room.id.071': "Open",  // translated
  'auto.room.id.072': "Cancel",  // translated
  'auto.room.id.073': "{{0}} konuşmacı susturuldu",  // TODO: translate
  'auto.room.id.074': "Cancel",  // translated
  'auto.room.id.075': "Tekrar sahneye çıkmak için {{0}} saniye bekle.",  // TODO: translate
  'auto.room.id.076': "Sahneye çıkılamadı",  // TODO: translate
  'auto.room.id.077': "Hoş geldin",  // TODO: translate
  'auto.room.id.078': "⏰ Süre doldu!",  // TODO: translate
  'auto.room.id.079': "Host transferi başarısız.",  // TODO: translate
  'auto.room.id.080': "İşlem tamamlanamadı.",  // TODO: translate
  'auto.room.id.081': "Kalıcı Sil",  // TODO: translate
  'auto.room.id.082': "Cancel",  // translated
  'auto.room.id.083': "Ayrıl",  // TODO: translate
  'auto.room.id.084': "Cancel",  // translated
  'auto.room.id.085': "Ayrıl",  // TODO: translate
  'auto.room.id.086': "Cancel",  // translated
  'auto.room.id.087': "User",  // translated
  'auto.room.id.088': "🤚 sahneye çıktı",  // TODO: translate
  'auto.room.id.089': "Sahnede maksimum {{0}} kişi olabilir",  // TODO: translate
  'auto.room.id.090': "User",  // translated
  'auto.room.id.091': "Bağlantı hatası",  // TODO: translate
  'auto.room.id.092': "Bu odada {{0}} konuşuluyor.",  // TODO: translate
  'auto.room.id.093': "Ayarları Aç",  // TODO: translate
  'auto.room.id.094': "Cancel",  // translated
  'auto.room.id.095': "kameranızı açamadık",  // TODO: translate
  'auto.room.id.096': "mikrofonunuzu açamadık",  // TODO: translate
  'auto.room.id.097': "⚠️ {{0}} İzni Gerekli",  // TODO: translate
  'auto.room.id.098': "odaya katıldı",  // TODO: translate
  'auto.room.id.099': "Geri Dön",  // TODO: translate
  'auto.room.id.100': "⚠️ Giriş Hatası",  // TODO: translate
  'auto.room.id.101': "⛔ Erişim Engellendi",  // TODO: translate
  'auto.room.id.102': "Bu odaya katılınamadı.",  // TODO: translate
  'auto.room.id.103': "Günlük",  // TODO: translate
  'auto.room.id.104': "Giriş Ücreti",  // TODO: translate
  'auto.room.id.105': "Bu oda şu anda dolu. Birazdan tekrar dene.",  // TODO: translate
  'auto.room.id.106': "User",  // translated
  'auto.room.id.107': "User",  // translated
  'auto.room.id.108': "SP Satın Al",  // TODO: translate
  'auto.room.id.109': "Cancel",  // translated
  'auto.room.id.110': "Bu oda için {{0}} SP gerekiyor — bakiyen {{1}} SP.\n{{2}} SP eksik. Mağazadan SP alıp tekrar deneyebilirsin.",  // TODO: translate
  'auto.room.id.111': "now",  // translated
  'auto.room.id.112': "User",  // translated
  'auto.room.id.113': "Düzenle...",  // TODO: translate
  'auto.room.id.114': "📷 Fotoğraf",  // TODO: translate
  'auto.room.id.115': "Mevcut metni değiştir, gönder",  // TODO: translate
  'auto.room.id.116': "User",  // translated
  'auto.room.id.117': "✎ Düzenleniyor",  // TODO: translate
  'auto.room.id.118': "📷 Fotoğraf",  // TODO: translate
  'auto.room.id.119': "User",  // translated
  'auto.room.id.120': "Kaydedilenden çıkarıldı",  // TODO: translate
  'auto.room.id.121': "Mesaj gönderilemedi",  // TODO: translate
  'auto.room.id.122': "Sesi Aç",  // TODO: translate
  'auto.room.id.123': "Oda müziği",  // TODO: translate
  'auto.settings.001': "Türkçe",  // TODO: translate
  'auto.settings.002': "✅ JWT Doğrulanıyor",  // TODO: translate
  'auto.settings.003': "(token alınamadı)",  // TODO: translate
  'auto.skia_test.001': "7. SkiaDivider — hairline çizgi",  // TODO: translate
  'auto.skia_test.002': "Tıklandı",  // TODO: translate
  'auto.skia_test.003': "SkiaButton basıldı",  // TODO: translate
  'auto.skia_test.004': "Tıklandı",  // TODO: translate
  'auto.skia_test.005': "3. Altın glow (premium frame)",  // TODO: translate
  'auto.skia_test.006': "1. Düz kart gölgesi (12px blur, 4px down, %25 black)",  // TODO: translate
  'auto.sp_store.001': "{{0}} üyeliğinle %{{1}} ekstra SP kazanıyorsun! 🎉",  // TODO: translate
  'auto.sp_store.002': "Altın",  // TODO: translate
  'auto.sp_store.003': "Gümüş",  // TODO: translate
  'auto.store.collection.id.001': "parça",  // TODO: translate
  'auto.store.collection.id.002': "Bağlantı sorunu",  // TODO: translate
  'auto.store.collection.id.003': "{{0}} envanterine eklendi · {{1}} SP harcandı",  // TODO: translate
  'auto.store.collection.id.004': "{{0}} Satın Alındı",  // TODO: translate
  'auto.store.collection.id.005': "Ürün",  // TODO: translate
  'auto.store.collection.id.006': "Giriş Efekti",  // TODO: translate
  'auto.store.collection.id.007': "Çerçeve",  // TODO: translate
  'auto.store.collection.id.008': "Satın Al",  // TODO: translate
  'auto.store.collection.id.009': "Cancel",  // translated
  'auto.store.collection.id.010': "{{0}} için {{1}} SP harcanacak. Onaylıyor musun?",  // TODO: translate
  'auto.store.collection.id.011': "YENİ",  // TODO: translate
  'auto.store.collection.id.012': "NADİR",  // TODO: translate
  'auto.store.collection.id.013': "EFSANEVİ",  // TODO: translate
  'auto.store.collection.id.014': "İLAHİ",  // TODO: translate
  'auto.store.001': "Bağlantı hatası",  // TODO: translate
  'auto.store.002': "LÜTUF",  // TODO: translate
  'auto.store.003': "SÜRE DOLDU",  // TODO: translate
  'auto.store.004': "TÜKENDİ",  // TODO: translate
  'auto.store.005': "Bu ürün zaten envanterinde · iyi tercih!",  // TODO: translate
  'auto.store.006': "⚡ GÜNÜN FIRSATI",  // TODO: translate
  'auto.store.007': "✓ SAHİPSİN",  // TODO: translate
  'auto.store.008': "{{0}} üyeliğinle %10 ekstra SP kazanıyorsun! 🎉",  // TODO: translate
  'auto.store.009': "{{0}} üyeliğinle %20 ekstra SP kazanıyorsun! 🎉",  // TODO: translate
  'auto.store.010': "Sadece bu sezona özel.",  // TODO: translate
  'auto.store.011': "Yedi tasarımcı. On iki sınırlı parça.",  // TODO: translate
  'auto.store.012': "Sırala",  // TODO: translate
  'auto.store.013': "Pahalı",  // TODO: translate
  'auto.store.014': "üyeliğinle çerçeve & efektlerde",  // TODO: translate
  'auto.store.015': "Satın Al",  // TODO: translate
  'auto.store.016': "Cancel",  // translated
  'auto.store.017': "{{0}} için {{1}} SP harcanacak ({{2}}). Onaylıyor musun?",  // TODO: translate
  'auto.store.018': "Günün Fırsatı -%{{0}}",  // TODO: translate
  'auto.store.019': "{{0}} için {{1}} SP harcanacak. Onaylıyor musun?",  // TODO: translate
  'auto.store.020': "Bağlantı sorunu",  // TODO: translate
  'auto.store.021': "{{0}}'a Yükselt",  // TODO: translate
  'auto.store.022': "Şimdi Değil",  // TODO: translate
  'auto.store.023': "{{0}} sadece {{1}} üyelere açık. {{2}} üyelik avantajları arasında %10-20 mağaza indirimi, premium oda araçları ve daha fazlası var.",  // TODO: translate
  'auto.store.024': "{{0}} Üyelik Gerekiyor",  // TODO: translate
  'auto.store.025': "{{0}} envanterine eklendi · {{1}} SP harcandı",  // TODO: translate
  'auto.store.026': "{{0}} Satın Alındı",  // TODO: translate
  'auto.store.027': "Bağlantı sorunu",  // TODO: translate
  'auto.store.028': "{{0}} parça envanterine eklendi · {{1}} SP harcandı",  // TODO: translate
  'auto.store.029': "{{0}} Satın Alındı",  // TODO: translate
  'auto.store.030': "Satın Al",  // TODO: translate
  'auto.store.031': "Cancel",  // translated
  'auto.store.032': "{{0}} setinin {{1}} parçası {{2}} SP karşılığında envanterine eklenecek (-%{{3}}{{4}}). Onaylıyor musun?",  // TODO: translate
  'auto.store.033': "{{0}} parçalarına zaten sahipsin.",  // TODO: translate
  'auto.store.034': "Ürün",  // TODO: translate
  'auto.store.035': "Giriş Efekti",  // TODO: translate
  'auto.store.036': "Çerçeve",  // TODO: translate
  'auto.store.037': "Altın · Vitrin",  // TODO: translate
  'auto.store.038': "Gümüş · Salon",  // TODO: translate
  'auto.store.039': "Bronz · Atölye",  // TODO: translate
  'auto.store.040': "YENİ",  // TODO: translate
  'auto.store.041': "NADİR",  // TODO: translate
  'auto.store.042': "EFSANEVİ",  // TODO: translate
  'auto.store.043': "İLAHİ",  // TODO: translate
  'auto._layout.001': "Ekran Yüklenemedi",  // TODO: translate
  'auto._layout.002': "User",  // translated
  'auto._layout.003': "{{0}} hediye aldın",  // TODO: translate
  'auto._layout.004': "User",  // translated
  'auto.BlockedUsersSheet.001': "User",  // translated
  'auto.BlockedUsersSheet.002': "User",  // translated
  'auto.BlockedUsersSheet.003': "User",  // translated
  'auto.BoostPickerSheet.001': "saatlik görünürlük",  // TODO: translate
  'auto.DiscoverWelcomeSheet.001': "Başlayalım",  // TODO: translate
  'auto.DiscoverWelcomeSheet.002': "Soprano Points (SP) ile hediye gönder, profilini öne çıkar.\nOda aç, sohbet et, arkadaş edin — her etkileşim SP kazandırır.",  // TODO: translate
  'auto.DiscoverWelcomeSheet.003': "Canlı odaları kategoriye göre gez, popüler kullanıcıları keşfet.\nKatıl butonuyla anında sohbete dahil ol.",  // TODO: translate
  'auto.DiscoverWelcomeSheet.004': "Odalarım sekmesindeki \"Yeni Oda Oluştur\" düğmesiyle istediğin konuda oda aç.\nArkadaşlarını davet et, topluluğunu kur.",  // TODO: translate
  'auto.DiscoverWelcomeSheet.005': "SopranoChat, anlık sesli sohbet odaları platformudur.\nKonuş, dinle, keşfet — hepsi gerçek zamanlı.",  // TODO: translate
  'auto.EmojiReactions.001': "Popüler GIFler yükleniyor...",  // TODO: translate
  'auto.EmojiReactions.002': "Sonuç bulunamadı",  // TODO: translate
  'auto.EmojiReactions.003': "GIF Hatası (Debug)",  // TODO: translate
  'auto.EmojiReactions.004': "Tenor API boş döndü. Olası sebepler:\n• İnternet/firewall blok\n• Edge Function 401\n• Tenor erişim engelli\n\nLütfen bu mesajı geliştiriciye iletin.",  // TODO: translate
  'auto.EmojiReactions.005': "GIF Yüklenemedi (Debug)",  // TODO: translate
  'auto.ErrorBoundary.001': "Bir Hata Oluştu",  // TODO: translate
  'auto.FollowListModal.001': "Takipten Çık",  // TODO: translate
  'auto.FollowListModal.002': "Cancel",  // translated
  'auto.FollowListModal.003': "{{0}} kullanıcısını takipten çıkmak istiyor musun?",  // TODO: translate
  'auto.FollowListModal.004': "Cancel",  // translated
  'auto.FollowListModal.005': "Çıkar",  // TODO: translate
  'auto.FollowListModal.006': "Cancel",  // translated
  'auto.FollowListModal.007': "{{0}} ile arkadaşlığın sona ersin mi?",  // TODO: translate
  'auto.FollowListModal.008': "Henüz takipçi yok",  // TODO: translate
  'auto.FollowListModal.009': "Henüz arkadaş yok",  // TODO: translate
  'auto.FriendsDrawer.001': "Onaylandı",  // TODO: translate
  'auto.FriendsDrawer.002': "User",  // translated
  'auto.IncomingFriendRequestCard.001': "seninle arkadaş olmak istiyor",  // TODO: translate
  'auto.IncomingFriendRequestCard.002': "✗ İstek reddedildi",  // TODO: translate
  'auto.IncomingFriendRequestCard.003': "✓ Arkadaşlık onaylandı",  // TODO: translate
  'auto.MessageActionMenu.001': "Kaydedilenden Çıkar",  // TODO: translate
  'auto.NotificationDrawer.001': "Uzun bas: tümünü okundu işaretle",  // TODO: translate
  'auto.NotificationDrawer.002': "now",  // translated
  'auto.NotificationDrawer.003': "Önceki",  // TODO: translate
  'auto.NotificationDrawer.004': "Bugün",  // TODO: translate
  'auto.NotificationDrawer.005': "arkadaşlık isteğini reddetti",  // TODO: translate
  'auto.NotificationDrawer.006': "arkadaşlık isteğini kabul etti 🎉",  // TODO: translate
  'auto.NotificationDrawer.007': "sana arkadaşlık isteği gönderdi",  // TODO: translate
  'auto.NotificationDrawer.008': "Etkinlik hatırlatması",  // TODO: translate
  'auto.NotificationDrawer.009': "Cevapsız görüntülü arama",  // TODO: translate
  'auto.NotificationDrawer.010': "Cevapsız sesli arama",  // TODO: translate
  'auto.NotificationDrawer.011': "odaya katılmak istiyor",  // TODO: translate
  'auto.NotificationDrawer.012': "odası canlıya geçti",  // TODO: translate
  'auto.NotificationDrawer.013': "sana teşekkür etti",  // TODO: translate
  'auto.NotificationDrawer.014': "sana bir sembol hediyesi gönderdi",  // TODO: translate
  'auto.NotificationDrawer.015': "sana hediye gönderdi",  // TODO: translate
  'auto.profile.BadgeListModal.001': "\n\n💎 Ödül: +{{0}} SP",  // TODO: translate
  'auto.profile.BadgeListModal.002': "Yaygın",  // TODO: translate
  'auto.profile.BioEditorSheet.001': "Kendini kısaca tanıt —",  // TODO: translate
  'auto.profile.FeaturedBadgesPicker.001': " · Seçilen: {{0}}/{{1}}",  // TODO: translate
  'auto.profile.FeaturedBadgesPicker.002': "En fazla {{0}} rozet seçebilirsin",  // TODO: translate
  'auto.profile.FrameSelectSheet.001': "Odaya her girişte seçili efekt gösterilir.",  // TODO: translate
  'auto.profile.FrameSelectSheet.002': "Tek seferde tek çerçeve aktif. Çıkar diyerek kaldırabilirsin.",  // TODO: translate
  'auto.profile.FrameSelectSheet.003': "Envanterinde giriş efekti yok",  // TODO: translate
  'auto.profile.FrameSelectSheet.004': "Envanterinde çerçeve yok",  // TODO: translate
  'auto.profile.FrameSelectSheet.005': "Odaya girdiğinde herkese gösterilir",  // TODO: translate
  'auto.profile.FrameSelectSheet.006': "Avatarın etrafında görünür",  // TODO: translate
  'auto.profile.FrameSelectSheet.007': "GİRİŞ EFEKTİ SEÇ",  // TODO: translate
  'auto.profile.FrameSelectSheet.008': "ÇERÇEVE SEÇİMİ",  // TODO: translate
  'auto.profile.FrameSelectSheet.009': "Bağlantı hatası",  // TODO: translate
  'auto.profile.FrameSelectSheet.010': "Bağlantı hatası",  // TODO: translate
  'auto.profile.GiftSheet.001': "Mağazaya Git",  // TODO: translate
  'auto.profile.GiftSheet.002': "Cancel",  // translated
  'auto.profile.GiftSheet.003': "{{0}} SP eksik. Mağazadan SP yükleyip hediyeni gönderebilirsin.",  // TODO: translate
  'auto.profile.GiftSheet.004': "Beklenmeyen bir hata, internet bağlantını kontrol et.",  // TODO: translate
  'auto.profile.GiftSheet.005': "Bilinmeyen bir hata oluştu, lütfen tekrar dene.",  // TODO: translate
  'auto.profile.GiftShowcase.001': "Verdiği Hediyeler",  // TODO: translate
  'auto.profile.GiftShowcase.002': "Aldığı Hediyeler",  // TODO: translate
  'auto.profile.ProfileHero.001': "{{0}} yıldır",  // TODO: translate
  'auto.profile.ProfileHero.002': "{{0}} aydır",  // TODO: translate
  'auto.profile.ProfileHero.003': "{{0}} gündür",  // TODO: translate
  'auto.profile.ProfileHero.004': "Yeni üye",  // TODO: translate
  'auto.profile.ProfileHero.005': "{{0}} arkadaş",  // TODO: translate
  'auto.profile.ProfileHero.006': "Avatarı büyüt",  // TODO: translate
  'auto.profile.ProfileHero.007': "Profili düzenle",  // TODO: translate
  'auto.profile.ProfileHero.008': "Çerçeve seç",  // TODO: translate
  'auto.profile.SPDonateSheet.001': "Mağazaya Git",  // TODO: translate
  'auto.profile.SPDonateSheet.002': "Cancel",  // translated
  'auto.profile.SPDonateSheet.003': "{{0}} SP eksik. Mağazadan SP yükleyip bağışını tamamlayabilirsin.",  // TODO: translate
  'auto.profile.SPDonateSheet.004': "SP Gönder",  // TODO: translate
  'auto.profile.SPDonateSheet.005': "Beklenmeyen bir hata, internet bağlantını kontrol et.",  // TODO: translate
  'auto.profile.SPDonateSheet.006': "Bilinmeyen bir hata oluştu, lütfen tekrar dene.",  // TODO: translate
  'auto.profile.SPHistorySheet.001': "{{0}}'e gönderdin",  // TODO: translate
  'auto.profile.SPHistorySheet.002': "{{0}} gönderdi",  // TODO: translate
  'auto.profile.SPHistorySheet.003': "SP işlemi",  // TODO: translate
  'auto.profile.SPHistorySheet.004': "SP harcadın",  // TODO: translate
  'auto.profile.SPHistorySheet.005': "SP kazandın",  // TODO: translate
  'auto.profile.SPHistorySheet.006': "SP işlemi",  // TODO: translate
  'auto.profile.SPHistorySheet.007': "SP harcadın",  // TODO: translate
  'auto.profile.SPHistorySheet.008': "SP kazandın",  // TODO: translate
  'auto.profile.SPHistorySheet.009': "Altın davet",  // TODO: translate
  'auto.profile.SPHistorySheet.010': "Sahne ışığı",  // TODO: translate
  'auto.profile.SPHistorySheet.011': "Süre uzatma",  // TODO: translate
  'auto.profile.SPHistorySheet.012': "İade",  // TODO: translate
  'auto.profile.SPHistorySheet.013': "Admin ödülü",  // TODO: translate
  'auto.profile.SPHistorySheet.014': "Rozet ödülü",  // TODO: translate
  'auto.profile.SPHistorySheet.015': "Başarım",  // TODO: translate
  'auto.profile.SPHistorySheet.016': "Mağaza alışverişi",  // TODO: translate
  'auto.profile.SPHistorySheet.017': "SP işlemi takılı",  // TODO: translate
  'auto.profile.SPHistorySheet.018': "SP iadesi (alıcı alamadı)",  // TODO: translate
  'auto.profile.SPHistorySheet.019': "SP aldın",  // TODO: translate
  'auto.profile.SPHistorySheet.020': "SP gönderdin",  // TODO: translate
  'auto.profile.SPHistorySheet.021': "Hediye gönderildi",  // TODO: translate
  'auto.profile.SPHistorySheet.022': "Hediye alındı",  // TODO: translate
  'auto.profile.SPHistorySheet.023': "Davet ödülü",  // TODO: translate
  'auto.profile.SPHistorySheet.024': "Hoşgeldin bonusu",  // TODO: translate
  'auto.profile.SPHistorySheet.025': "Oda gelir payı",  // TODO: translate
  'auto.profile.SPHistorySheet.026': "Oda giriş ücreti",  // TODO: translate
  'auto.profile.SPHistorySheet.027': "Oda oluşturma",  // TODO: translate
  'auto.profile.SPHistorySheet.028': "Yeni takipçi",  // TODO: translate
  'auto.profile.SPHistorySheet.029': "Mesaj gönderdin",  // TODO: translate
  'auto.profile.SPHistorySheet.030': "Sahne süresi",  // TODO: translate
  'auto.profile.SPHistorySheet.031': "Prime-time dönüş",  // TODO: translate
  'auto.profile.SPHistorySheet.032': "Günlük giriş",  // TODO: translate
  'auto.profile.SPReceivedModal.001': "Teşekkürün iletildi",  // TODO: translate
  'auto.profile.SPReceivedModal.002': "Daha önce teşekkür ettin",  // TODO: translate
  'auto.profile.SPReceivedModal.003': "Yanıtın iletilemedi.",  // TODO: translate
  'auto.profile.SPReceivedModal.004': "Teşekkür gönderilemedi.",  // TODO: translate
  'auto.profile.SPReceivedModal.005': "{{0}} odana katıldı",  // TODO: translate
  'auto.profile.SPReceivedModal.006': "{{0}} sana hediye gönderdi",  // TODO: translate
  'auto.profile.SPSentSuccessCompact.001': "’a gönderildi",  // TODO: translate
  'auto.profile.SPSentSuccessModal.001': "'a bildirim gönderildi",  // TODO: translate
  'auto.profile.SymbolGiftSheet.001': "kişisine",  // TODO: translate
  'auto.profile.SymbolGiftSheet.002': "{{0}} Gönderildi",  // TODO: translate
  'auto.profile.SymbolGiftSheet.003': "Bağlantı hatası",  // TODO: translate
  'auto.profile.SymbolGiftSheet.004': "{{0}} için {{1}} SP gerekli, {{2}} SP'n var.",  // TODO: translate
  'auto.profile.TieredProfileSections.001': "· Katılım",  // TODO: translate
  'auto.profile.TieredProfileSections.002': "{{0}} hf önce",  // TODO: translate
  'auto.profile.TieredProfileSections.003': "{{0}} gün önce",  // TODO: translate
  'auto.profile.TieredProfileSections.004': "Bugün",  // TODO: translate
  'auto.profile.VoiceBioRecorder.001': "Önizle",  // TODO: translate
  'auto.profile.VoiceBioRecorder.002': "Kayıt URI yok",  // TODO: translate
  'auto.ReportModal.001': "Mesajı",  // TODO: translate
  'auto.ReportModal.002': "Gönderiyi",  // TODO: translate
  'auto.ReportModal.003': "Odayı",  // TODO: translate
  'auto.ReportModal.004': "Kullanıcıyı",  // TODO: translate
  'auto.ReportModal.005': "Şikayetin iletilemedi.",  // TODO: translate
  'auto.room.CameraFullscreenModal.001': "Konuşmacı",  // TODO: translate
  'auto.room.CameraFullscreenModal.002': "Moderatör",  // TODO: translate
  'auto.room.CameraFullscreenModal.003': "User",  // translated
  'auto.room.ConnectionQualityIndicator.001': "Bağlantı: {{0}}",  // TODO: translate
  'auto.room.ConnectionQualityIndicator.002': "Bağlantı kalitesi henüz ölçülmedi.",  // TODO: translate
  'auto.room.ConnectionQualityIndicator.003': "Bağlantı zayıf — internet veya hücresel ağı kontrol et.",  // TODO: translate
  'auto.room.ConnectionQualityIndicator.004': "Bağlantı iyi — küçük gecikmeler olabilir.",  // TODO: translate
  'auto.room.ConnectionQualityIndicator.005': "Bağlantı mükemmel — düşük gecikme, kayıpsız ses.",  // TODO: translate
  'auto.room.EntryFeeCard.001': " bakiyenden düşülür ve odaya giriş yaparsın.",  // TODO: translate
  'auto.room.HandRaiseQueuePanel.001': "User",  // translated
  'auto.room.HandRaiseQueuePanel.002': "User",  // translated
  'auto.room.HandRaiseQueuePanel.003': "User",  // translated
  'auto.room.HostAccessPanel.001': "⏳ GEÇİCİ",  // TODO: translate
  'auto.room.HostAccessPanel.002': "User",  // translated
  'auto.room.HostAccessPanel.003': "{{0}}dk kaldı",  // TODO: translate
  'auto.room.HostAccessPanel.004': "Süresi dolmuş",  // TODO: translate
  'auto.room.HostAccessPanel.005': "Kalıcı",  // TODO: translate
  'auto.room.HostAccessPanel.006': "User",  // translated
  'auto.room.HostAccessPanel.007': "User",  // translated
  'auto.room.HostAccessPanel.008': "User",  // translated
  'auto.room.HostAccessPanel.009': "User",  // translated
  'auto.room.InRoomUserProfile.001': "User",  // translated
  'auto.room.InRoomUserProfile.002': "Offline",  // translated
  'auto.room.InRoomUserProfile.003': "Online",  // translated
  'auto.room.InRoomUserProfile.004': "User",  // translated
  'auto.room.InRoomUserProfile.005': "Tümü",  // TODO: translate
  'auto.room.InRoomUserProfile.006': "Benim İçin Sustur",  // TODO: translate
  'auto.room.InRoomUserProfile.007': "Sesi Aç (sadece bana)",  // TODO: translate
  'auto.room.InRoomUserProfile.008': "Moderatör Yap",  // TODO: translate
  'auto.room.InRoomUserProfile.009': "Moderatörlüğü Kaldır",  // TODO: translate
  'auto.room.InRoomUserProfile.010': "Yazı Kapat",  // TODO: translate
  'auto.room.InRoomUserProfile.011': "Yazı Aç",  // TODO: translate
  'auto.room.InRoomUserProfile.012': "Daha fazla seçenek",  // TODO: translate
  'auto.room.InRoomUserProfile.013': "ortak arkadaş",  // TODO: translate
  'auto.room.InRoomUserProfile.014': "Cancel",  // translated
  'auto.room.InRoomUserProfile.015': "\"{{0}}\" odasına davet edildi",  // TODO: translate
  'auto.room.InRoomUserProfile.016': "{{0}} adlı kullanıcının SopranoChat profili: {{1}}",  // TODO: translate
  'auto.room.InRoomUserProfile.017': "User",  // translated
  'auto.room.InviteFriendsModal.001': "Kişiyi Davet Et",  // TODO: translate
  'auto.room.InviteFriendsModal.002': "Arkadaş listesi yüklenemedi",  // TODO: translate
  'auto.room.MessageGlowPickerSheet.001': "SP · KİLİTLİ",  // TODO: translate
  'auto.room.PowerUpsSheet.001': "Bağlantı sorunu",  // TODO: translate
  'auto.room.PowerUpsSheet.002': "Bağlantı sorunu",  // TODO: translate
  'auto.room.PowerUpsSheet.003': "Bağlantı sorunu",  // TODO: translate
  'auto.room.PowerUpsSheet.004': "\"{{0}}\" çok yakında geliyor.",  // TODO: translate
  'auto.room.PremiumEntryBanner.001': "odaya giriş yaptı!",  // TODO: translate
  'auto.room.RoomAccessPrompts.001': "{{0}}'ı incele",  // TODO: translate
  'auto.room.RoomAccessPrompts.002': "{{0}} davetli bir oda. İsteğin yöneticilere iletildi.",  // TODO: translate
  'auto.room.RoomAccessPrompts.003': "Oda yöneticisi isteğini kabul etmedi",  // TODO: translate
  'auto.room.RoomAccessPrompts.004': "Odaya yönlendiriliyorsun...",  // TODO: translate
  'auto.room.RoomAccessPrompts.005': "Katılma İsteği",  // TODO: translate
  'auto.room.RoomAccessPrompts.006': "Onaylandı!",  // TODO: translate
  'auto.room.RoomAccessPrompts.007': "Erişim isteğiniz reddedildi",  // TODO: translate
  'auto.room.RoomAccessPrompts.008': "Oda sahibi isteğini değerlendirecek.",  // TODO: translate
  'auto.room.RoomAccessPrompts.009': "{{0}} isteğini değerlendirecek.",  // TODO: translate
  'auto.room.RoomAccessPrompts.010': "Bu oda davetli kişilere açık.",  // TODO: translate
  'auto.room.RoomAccessPrompts.011': "\"{{0}}\" davetli kişilere açık.",  // TODO: translate
  'auto.room.RoomAccessPrompts.012': "Bu odaya girmek için şartlar var:",  // TODO: translate
  'auto.room.RoomAccessPrompts.013': "{{0}} bu odaya bazı şartlar koymuş:",  // TODO: translate
  'auto.room.RoomAccessPrompts.014': "Bu odaya girmek için şifre gerekiyor",  // TODO: translate
  'auto.room.RoomChatDrawer.001': "User",  // translated
  'auto.room.RoomChatDrawer.002': "odadan ayrıldı",  // TODO: translate
  'auto.room.RoomChatDrawer.003': "odaya katıldı",  // TODO: translate
  'auto.room.RoomClosedScreen.001': "Birden fazla erişim engeli var:",  // TODO: translate
  'auto.room.RoomControlBar.001': "Mikrofon istek kuyruğu{{0}}",  // TODO: translate
  'auto.room.RoomControlBar.002': "Mikrofonu aç",  // TODO: translate
  'auto.room.RoomControlBar.003': "Mikrofon kapalı (susturuldun)",  // TODO: translate
  'auto.room.RoomControlBar.004': "Kamerayı aç",  // TODO: translate
  'auto.room.RoomControlBar.005': "Kamerayı kapat",  // TODO: translate
  'auto.room.RoomControlBar.006': "Oda sesini aç",  // TODO: translate
  'auto.room.RoomControlBar.007': "Sıradasın ({{0}}. sıra) — dokun ve iptal et",  // TODO: translate
  'auto.room.RoomDisconnectOverlay.001': "Birkaç deneme başarısız oldu. Tekrar denemek ister misin?",  // TODO: translate
  'auto.room.RoomDisconnectOverlay.002': "Ses sunucusuna yeniden bağlanmaya çalışıyoruz...",  // TODO: translate
  'auto.room.RoomDisconnectOverlay.003': "Bağlantı kurulamadı",  // TODO: translate
  'auto.room.RoomDisconnectOverlay.004': "Bağlantı koptu",  // TODO: translate
  'auto.room.RoomFollowersSheet.001': "Henüz takipçi yok",  // TODO: translate
  'auto.room.RoomFollowersSheet.002': "{{0}} kişi bu odayı takip ediyor",  // TODO: translate
  'auto.room.RoomGiftAnimationOverlay.001': "User",  // translated
  'auto.room.RoomGiftPanel.001': "{{0}} kişiyi seç",  // TODO: translate
  'auto.room.RoomGiftPanel.002': "{{0}} kişi seçilebilir",  // TODO: translate
  'auto.room.RoomGiftPanel.003': "Odada başka kimse yok",  // TODO: translate
  'auto.room.RoomGiftPanel.004': "Bağlantı hatası",  // TODO: translate
  'auto.room.RoomGiftPanel.005': "Alıcı",  // TODO: translate
  'auto.room.RoomGiftPanel.006': "{{0}} için {{1}} SP gerekli, {{2}} SP'n var.",  // TODO: translate
  'auto.room.RoomGiftPanel.007': "User",  // translated
  'auto.room.RoomInfoHeader.001': "Bu odada {{0}} konuşuluyor.",  // TODO: translate
  'auto.room.RoomInfoHeader.002': "Français",  // TODO: translate
  'auto.room.RoomInfoHeader.003': "Bu odaya girmek için {{0}} SP harcanır.",  // TODO: translate
  'auto.room.RoomInfoHeader.004': "💰 {{0}} SP Giriş Ücreti",  // TODO: translate
  'auto.room.RoomInfoHeader.005': "Dinleyicileri göster",  // TODO: translate
  'auto.room.RoomManageSheet.001': "+ ile açılır",  // TODO: translate
  'auto.room.RoomManageSheet.002': "\"{{0}}\" özelliği {{1}} ve üzeri üyeliklerde kullanılabilir.",  // TODO: translate
  'auto.room.RoomManageSheet.003': "{{0}}+ ile açılır",  // TODO: translate
  'auto.room.RoomManageSheet.004': "Takipçi",  // TODO: translate
  'auto.room.RoomManageSheet.005': "Giriş Ücretsiz",  // TODO: translate
  'auto.room.RoomManageSheet.006': "Giriş: {{0}} SP",  // TODO: translate
  'auto.room.RoomManageSheet.007': "Bağış Kapalı",  // TODO: translate
  'auto.room.RoomManageSheet.008': "Bağış Açık",  // TODO: translate
  'auto.room.RoomManageSheet.009': "Edit",  // translated
  'auto.room.RoomManageSheet.010': "Oda Müzik Linki",  // TODO: translate
  'auto.room.RoomManageSheet.011': "Müzik: {{0}}",  // TODO: translate
  'auto.room.RoomManageSheet.012': "Keşfet akışında görünen banner",  // TODO: translate
  'auto.room.RoomManageSheet.013': "Kart görseli ayarlandı",  // TODO: translate
  'auto.room.RoomManageSheet.014': "Üyelik statüsüne göre",  // TODO: translate
  'auto.room.RoomManageSheet.015': "Arka plan ayarlandı",  // TODO: translate
  'auto.room.RoomManageSheet.016': "User",  // translated
  'auto.room.RoomManageSheet.017': "Süresiz",  // TODO: translate
  'auto.room.RoomManageSheet.018': "{{0}}dk kaldı",  // TODO: translate
  'auto.room.RoomManageSheet.019': "Susturulan Kullanıcılar (",  // TODO: translate
  'auto.room.RoomManageSheet.020': "Sunucu hatası",  // TODO: translate
  'auto.room.RoomManageSheet.021': "GEÇİCİ",  // TODO: translate
  'auto.room.RoomManageSheet.022': "User",  // translated
  'auto.room.RoomManageSheet.023': "{{0}}dk kaldı",  // TODO: translate
  'auto.room.RoomManageSheet.024': "Süresi dolmuş",  // TODO: translate
  'auto.room.RoomManageSheet.025': "Kalıcı",  // TODO: translate
  'auto.room.RoomManageSheet.026': "Banlı Kullanıcılar (",  // TODO: translate
  'auto.room.RoomManageSheet.027': "Tüm yaş gruplarına açık",  // TODO: translate
  'auto.room.RoomManageSheet.028': "Sadece 18 yaş üstü katılabilir",  // TODO: translate
  'auto.room.RoomManageSheet.029': "Yaş Sınırı Yok",  // TODO: translate
  'auto.room.RoomManageSheet.030': "+18 İçerik Aktif",  // TODO: translate
  'auto.room.RoomManageSheet.031': "Türkçe",  // TODO: translate
  'auto.room.RoomManageSheet.032': "Slow Mode Kapalı",  // TODO: translate
  'auto.room.RoomManageSheet.033': "Seçili",  // TODO: translate
  'auto.room.RoomManageSheet.034': "İzinli",  // TODO: translate
  'auto.room.RoomManageSheet.035': "Dinleyiciler el kaldırarak söz ister",  // TODO: translate
  'auto.room.RoomManageSheet.036': "Sadece owner tarafından seçilen kişiler",  // TODO: translate
  'auto.room.RoomManageSheet.037': "Dinleyiciler doğrudan sahneye çıkabilir",  // TODO: translate
  'auto.room.RoomManageSheet.038': "Sadece İzinli",  // TODO: translate
  'auto.room.RoomManageSheet.039': "Sadece Seçilmişler",  // TODO: translate
  'auto.room.RoomManageSheet.040': "Herkes Konuşabilir",  // TODO: translate
  'auto.room.RoomManageSheet.041': "Herkes katılabilir",  // TODO: translate
  'auto.room.RoomManageSheet.042': "Yeni girişler engellendi",  // TODO: translate
  'auto.room.RoomManageSheet.043': "Oda Açık",  // TODO: translate
  'auto.room.RoomManageSheet.044': "Ayarlanmadı (en az 4 karakter)",  // TODO: translate
  'auto.room.RoomManageSheet.045': "Şifreli",  // TODO: translate
  'auto.room.RoomManageSheet.046': "Takipçi",  // TODO: translate
  'auto.room.RoomManageSheet.047': "Open",  // translated
  'auto.room.RoomManageSheet.048': "Sadece arkadaşlar modu Plus üyelikle açılır.",  // TODO: translate
  'auto.room.RoomManageSheet.049': "Davetli oda Plus üyelikle açılır.",  // TODO: translate
  'auto.room.RoomManageSheet.050': "Erişim",  // TODO: translate
  'auto.room.RoomManageSheet.051': "🔴 Şu an kaydediliyor",  // TODO: translate
  'auto.room.RoomManageSheet.052': "Kaydı Başlat",  // TODO: translate
  'auto.room.RoomManageSheet.053': "Kaydı Durdur",  // TODO: translate
  'auto.room.RoomManageSheet.054': "Keşfet için en fazla",  // TODO: translate
  'auto.room.RoomManageSheet.055': "Ayarlanmadı",  // TODO: translate
  'auto.room.RoomManageSheet.056': "Ayarlanmadı",  // TODO: translate
  'auto.room.RoomManageSheet.057': "Sunucuya ulaşılamadı.",  // TODO: translate
  'auto.room.RoomManageSheet.058': "Sunucuya ulaşılamadı.",  // TODO: translate
  'auto.room.RoomManageSheet.059': "Sunucuya ulaşılamadı.",  // TODO: translate
  'auto.room.RoomManageSheet.060': "Cancel",  // translated
  'auto.room.RoomManageSheet.061': "Bu sorumluluğu kabul ediyor musun?",  // TODO: translate
  'auto.room.RoomManageSheet.062': "• Konuşmacı talebi halinde kayıt silinmelidir.\n\n",  // TODO: translate
  'auto.room.RoomManageSheet.063': "• Kayıt 7 gün boyunca saklanır, sonra otomatik silinir.\n",  // TODO: translate
  'auto.room.RoomManageSheet.064': "• Kayıt başlayınca tüm katılımcılar görsel olarak bilgilendirilir.\n",  // TODO: translate
  'auto.room.RoomManageSheet.065': "• Konuşmacıların açık rızası senin sorumluluğundadır.\n",  // TODO: translate
  'auto.room.RoomManageSheet.066': "⚠️ KVKK gereği:\n",  // TODO: translate
  'auto.room.RoomManageSheet.067': "Sunucuya ulaşılamadı.",  // TODO: translate
  'auto.room.RoomManageSheet.068': "Sunucuya ulaşılamadı.",  // TODO: translate
  'auto.room.RoomOverlays.001': "Odayı terk et",  // TODO: translate
  'auto.room.RoomOverlays.002': "Oda açık kalır, sahiplik devri yapılır",  // TODO: translate
  'auto.room.RoomOverlays.003': "Odayı Takip Et",  // TODO: translate
  'auto.room.RoomOverlays.004': "Takibi Bırak",  // TODO: translate
  'auto.room.RoomOverlays.005': "User",  // translated
  'auto.room.RoomOverlays.006': "User",  // translated
  'auto.room.RoomOverlays.007': "Kalıcı",  // TODO: translate
  'auto.room.RoomOverlays.008': "Ücretsiz",  // TODO: translate
  'auto.room.RoomOverlays.009': "Kulaklık",  // TODO: translate
  'auto.room.RoomOverlays.010': "Hoparlör",  // TODO: translate
  'auto.room.RoomOverlays.011': "Kulaklık",  // TODO: translate
  'auto.room.RoomOverlays.012': "Hoparlör",  // TODO: translate
  'auto.room.RoomRecordingsSheet.001': "g kaldı",  // TODO: translate
  'auto.room.RoomRecordingsSheet.002': "Ses dosyası yüklenemedi.",  // TODO: translate
  'auto.room.RoomRecordingsSheet.003': "{{0}}g önce",  // TODO: translate
  'auto.room.RoomRecordingsSheet.004': "{{0}}sa önce",  // TODO: translate
  'auto.room.RoomRecordingsSheet.005': "{{0}}dk önce",  // TODO: translate
  'auto.room.RoomRecordingsSheet.006': "just now",  // translated
  'auto.room.RoomStatsPanel.001': "❤️ Oda Takipçileri (",  // TODO: translate
  'auto.room.StageSupportSheet.001': "Mağazaya Git",  // TODO: translate
  'auto.room.StageSupportSheet.002': "Cancel",  // translated
  'auto.room.StageSupportSheet.003': "{{0}} SP eksik. Mağazadan SP yükleyip sahneyi destekleyebilirsin.",  // TODO: translate
  'auto.room.StageSupportSheet.004': "Beklenmeyen bir hata, internet bağlantını kontrol et.",  // TODO: translate
  'auto.room.StageSupportSheet.005': "Bilinmeyen bir hata oluştu, lütfen tekrar dene.",  // TODO: translate
  'auto.RoomBoostSheet.001': "Boost Başlat",  // TODO: translate
  'auto.RoomBoostSheet.002': "6 saat üst sıra",  // TODO: translate
  'auto.RoomBoostSheet.003': "1 saat üst sıra",  // TODO: translate
  'auto.skia.CustomEmojiRenderer.001': "Önce bir emoji seti seç",  // TODO: translate
  'auto.store.StoreItemPreviewSheet.001': "Satın Al — {{0}} SP",  // TODO: translate
  'auto.store.StoreItemPreviewSheet.002': "Satın alınıyor…",  // TODO: translate
  'auto.store.StoreItemPreviewSheet.003': "Üyelik Gerekli",  // TODO: translate
  'auto.store.StoreItemPreviewSheet.004': "TAM FİYAT",  // TODO: translate
  'auto.store.StoreItemPreviewSheet.005': "Fırsat -%",  // TODO: translate
  'auto.store.StoreItemPreviewSheet.006': "Ürün",  // TODO: translate
  'auto.store.StoreItemPreviewSheet.007': "Giriş Efekti",  // TODO: translate
  'auto.store.StoreItemPreviewSheet.008': "Çerçeve",  // TODO: translate
  'auto.store.StoreItemPreviewSheet.009': "YENİ",  // TODO: translate
  'auto.store.StoreItemPreviewSheet.010': "NADİR",  // TODO: translate
  'auto.store.StoreItemPreviewSheet.011': "EFSANEVİ",  // TODO: translate
  'auto.store.StoreItemPreviewSheet.012': "İLAHİ",  // TODO: translate
  'auto.SystemSettingsOverlay.001': "Tahmini bitiş:",  // TODO: translate
  'auto.UserSearchModal.001': "User",  // translated
  'auto.UserSearchModal.002': "User",  // translated
  'auto.UserSearchModal.003': "User",  // translated
  'auto.UserSearchModal.004': "User",  // translated
  'auto.UserSearchModal.005': "User",  // translated
  'auto.UserSearchModal.006': "User",  // translated
  'auto.account.001': "Hesap silme işlemi başarısız.",  // TODO: translate
  'auto.account.002': "Kullanıcı kimliği bulunamadı.",  // TODO: translate
  'auto.badgeEngine.001': "{{0}} rozeti ödülü",  // TODO: translate
  'auto.badges.001': "Geçersiz parametre.",  // TODO: translate
  'auto.call.001': "📞 Cevapsız sesli arama",  // TODO: translate
  'auto.call.002': "{{0}} seni arıyor",  // TODO: translate
  'auto.call.003': "Sadece arkadaşlarınızı arayabilirsiniz. Önce arkadaş olun.",  // TODO: translate
  'auto.cosmetic.001': "Bağlantı hatası",  // TODO: translate
  'auto.cosmetic.002': "Bağlantı hatası",  // TODO: translate
  'auto.emailDigest.001': "Geçersiz kullanıcı.",  // TODO: translate
  'auto.follows.001': "Geçersiz kullanıcı.",  // TODO: translate
  'auto.follows.002': "Engellediğin birini takip edemezsin.",  // TODO: translate
  'auto.follows.003': "Bu kullanıcı seni engelledi.",  // TODO: translate
  'auto.follows.004': "Geçersiz kullanıcı.",  // TODO: translate
  'auto.friendship.001': "Arkadaşlık kaldırılamadı",  // TODO: translate
  'auto.friendship.002': "arkadaşlık isteğini reddetti",  // TODO: translate
  'auto.friendship.003': "arkadaşlık isteğini kabul etti",  // TODO: translate
  'auto.friendship.004': "{{0}} seninle arkadaş oldu",  // TODO: translate
  'auto.friendship.005': "Arkadaşlık Kabul Edildi",  // TODO: translate
  'auto.friendship.006': "seninle arkadaş olmak istiyor",  // TODO: translate
  'auto.friendship.007': "{{0}} seninle arkadaş olmak istiyor",  // TODO: translate
  'auto.friendship.008': "Arkadaşlık İsteği",  // TODO: translate
  'auto.friendship.009': "Bu kullanıcıya istek gönderemezsiniz.",  // TODO: translate
  'auto.friendship.010': "Bu kullanıcıya tekrar istek göndermek için 24 saat beklemelisiniz.",  // TODO: translate
  'auto.friendship.011': "Çok fazla arkadaşlık isteği gönderdiniz. Lütfen 1 saat sonra tekrar deneyin.",  // TODO: translate
  'auto.friendship.012': "Çok fazla arkadaşlık isteği gönderdin. Bir saat sonra tekrar dene.",  // TODO: translate
  'auto.gamification.001': "SP güncelleme başarısız (eşzamanlı işlem çakışması)",  // TODO: translate
  'auto.gamification.002': "Profil bulunamadı.",  // TODO: translate
  'auto.gamification.003': "SP harcandı: {{0}}",  // TODO: translate
  'auto.gamification.004': "SP kazanıldı: {{0}}",  // TODO: translate
  'auto.gamification.005': "Bugün 300 SP kazanım limitine ulaştın. Yarın tekrar dene.",  // TODO: translate
  'auto.gamification.006': "Günlük Limit",  // TODO: translate
  'auto.giftStats.001': "User",  // translated
  'auto.i18n.001': "Türkçe",  // TODO: translate
  'auto.livekit.001': "Bu cihazda ekran paylaşımı desteklenmiyor",  // TODO: translate
  'auto.livekit.002': "Ekran video track bulunamadı",  // TODO: translate
  'auto.livekit.003': "Ekran paylaşımı zaman aşımı (30s)",  // TODO: translate
  'auto.livekit.004': "Ekran paylaşımı zaman aşımı (15s)",  // TODO: translate
  'auto.livekit.005': "Ses sunucusuna bağlı değilsiniz",  // TODO: translate
  'auto.livekit.006': "Ses sunucusuna bağlı değilsiniz",  // TODO: translate
  'auto.livekit.007': "Oturum süresi dolmuş — tekrar giriş yap",  // TODO: translate
  'auto.livekit.008': "Oda bulunamadı",  // TODO: translate
  'auto.livekit.009': "Sunucuya ulaşılamadı",  // TODO: translate
  'auto.messages.001': "Geçersiz tepki formatı.",  // TODO: translate
  'auto.messages.002': "Mesaj İsteği",  // TODO: translate
  'auto.messages.003': "📷 Fotoğraf",  // TODO: translate
  'auto.messages.004': "Mesaj gönderilemedi.",  // TODO: translate
  'auto.messages.005': "Çok hızlı mesaj gönderiyorsunuz. Lütfen biraz bekleyin.",  // TODO: translate
  'auto.messages.006': "Bu kullanıcıyla mesajlaşamazsınız.",  // TODO: translate
  'auto.messages.007': "Mesaj çok uzun (max 2000 karakter).",  // TODO: translate
  'auto.messages.008': "Boş mesaj gönderilemez.",  // TODO: translate
  'auto.messages.009': "📷 Fotoğraf",  // TODO: translate
  'auto.moderation.001': "Bu işlem için yetkiniz yok.",  // TODO: translate
  'auto.moderation.002': "Oda ismi boş olamaz",  // TODO: translate
  'auto.moderation.003': "Bu işlem için yetkiniz yok.",  // TODO: translate
  'auto.moderation.004': "User",  // translated
  'auto.moderation.005': "Bir kullanıcı",  // TODO: translate
  'auto.moderation.006': "gönderiyi",  // TODO: translate
  'auto.moderation.007': "odayı",  // TODO: translate
  'auto.moderation.008': "kullanıcıyı",  // TODO: translate
  'auto.moderation.009': "Other",  // translated
  'auto.moderation.010': "Reşit Olmayan",  // TODO: translate
  'auto.moderation.011': "Şiddet",  // TODO: translate
  'auto.moderation.012': "Kimliğe Bürünme",  // TODO: translate
  'auto.moderation.013': "Uygunsuz İçerik",  // TODO: translate
  'auto.moderation.014': "Nefret Söylemi",  // TODO: translate
  'auto.moderation.015': "Admin bildirim hatası:",  // TODO: translate
  'auto.moderation.016': "Admin bildirim hatası:",  // TODO: translate
  'auto.moderation.017': "Admin bildirim hatası:",  // TODO: translate
  'auto.moderation.018': "Admin bildirim hatası:",  // TODO: translate
  'auto.moderation.019': "Çok fazla şikayet gönderdiniz. Lütfen 1 saat sonra tekrar deneyin.",  // TODO: translate
  'auto.notifPrefs.001': "Geçersiz kullanıcı.",  // TODO: translate
  'auto.permissions.001': "Odada aktif bir katılımcı değilsiniz.",  // TODO: translate
  'auto.permissions.002': "Bu özellik {{0}}+ abonelik gerektirir.",  // TODO: translate
  'auto.permissions.003': "Kendinizle aynı veya daha yüksek roldeki kişileri yönetemezsiniz.",  // TODO: translate
  'auto.permissions.004': "Hedef kullanıcı belirtilmeli.",  // TODO: translate
  'auto.permissions.005': "Bu aksiyon için minimum \"{{0}}\" rolü gerekli.",  // TODO: translate
  'auto.permissions.006': "Bu aksiyonu kendinize uygulayamazsınız.",  // TODO: translate
  'auto.permissions.007': "Tanımsız yetki.",  // TODO: translate
  'auto.profile.001': "Bağış işlemi tamamlanamadı. Destek kaydı oluşturuldu; SP iadesi için lütfen destek ile iletişime geçin.",  // TODO: translate
  'auto.profile.002': "Alıcıya ulaşılamadı — SP iade edildi.",  // TODO: translate
  'auto.profile.003': "💎 Bağış Aldın!",  // TODO: translate
  'auto.profile.004': "{{0}} sana {{1}} SP gönderdi",  // TODO: translate
  'auto.profile.005': "{{0}} sana {{1}} SP gönderdi: \"{{2}}\"",  // TODO: translate
  'auto.profile.006': "{{0}} SP gönderdi",  // TODO: translate
  'auto.profile.007': "{{0}} SP gönderdi: \"{{1}}\"",  // TODO: translate
  'auto.profile.008': "{{0}} adlı kişiden aldın{{1}}",  // TODO: translate
  'auto.profile.009': "{{0}} adlı kişiye gönderdin{{1}}",  // TODO: translate
  'auto.profile.010': "Çok fazla bağış yaptınız. Lütfen 1 saat sonra tekrar deneyin.",  // TODO: translate
  'auto.profile.011': "Tek seferde en fazla 1000 SP gönderilebilir",  // TODO: translate
  'auto.profile.012': "Geçersiz miktar",  // TODO: translate
  'auto.profile.013': "Kendinize SP gönderemezsiniz",  // TODO: translate
  'auto.profile.014': "Profil boost özelliği Plus ve üzeri üyeliklerde kullanılabilir.",  // TODO: translate
  'auto.profileExtras.001': "Genelde {{0}} - {{1}} arası aktif",  // TODO: translate
  'auto.profileExtras.002': "User",  // translated
  'auto.profileExtras.003': "Sesli tanıtım çok uzun (en fazla 30 saniye)",  // TODO: translate
  'auto.profileExtras.004': "Sesli tanıtım çok kısa (en az 3 saniye)",  // TODO: translate
  'auto.push.001': "{{0}} \"{{1}}\" odanızı takip etmeye başladı",  // TODO: translate
  'auto.push.002': "🏠 Yeni Oda Takipçisi",  // TODO: translate
  'auto.push.003': "{{0}} seni aradı",  // TODO: translate
  'auto.push.004': "📞 Cevapsız Arama",  // TODO: translate
  'auto.push.005': "{{0}} sana {{1}} gönderdi",  // TODO: translate
  'auto.push.006': "🎁 Hediye Aldın!",  // TODO: translate
  'auto.push.007': "{{0}} seninle arkadaş oldu",  // TODO: translate
  'auto.push.008': "👥 Yeni Arkadaş",  // TODO: translate
  'auto.push.009': "{{0}} seni \"{{1}}\" odasına davet etti!",  // TODO: translate
  'auto.push.010': "[Push] Oda push hatası:",  // TODO: translate
  'auto.pushNotifications.001': "{{0}} seni \"{{1}}\" odasına davet etti.",  // TODO: translate
  'auto.pushNotifications.002': "{{0}} gönderini beğendi.",  // TODO: translate
  'auto.pushNotifications.003': "❤️ Paylaşımın beğenildi!",  // TODO: translate
  'auto.pushNotifications.004': "{{0}} sana arkadaşlık isteği gönderdi.",  // TODO: translate
  'auto.pushNotifications.005': "🤝 Yeni Arkadaşlık İsteği",  // TODO: translate
  'auto.pushNotifications.006': "Push token silme hatası:",  // TODO: translate
  'auto.pushNotifications.007': "Push token kayıt hatası:",  // TODO: translate
  'auto.pushNotifications.008': "Push token kayıt hatası:",  // TODO: translate
  'auto.pushNotifications.009': "Push token alınamadı (Emulator veya yetkisiz cihaz olabilir):",  // TODO: translate
  'auto.pushNotifications.010': "Gelen aramalar — telefon kilitliyken de çalar",  // TODO: translate
  'auto.pushNotifications.011': "Sesli/Görüntülü Arama",  // TODO: translate
  'auto.pushNotifications.012': "Bildirim izni daha önce reddedildi. Ayarlardan açılmalı.",  // TODO: translate
  'auto.pushNotifications.013': "Notifications modülü henüz yüklenmemiş.",  // TODO: translate
  'auto.pushNotifications.014': "expo-notifications yüklenirken hata oluştu:",  // TODO: translate
  'auto.rateLimit.001': "Geçersiz kullanıcı.",  // TODO: translate
  'auto.rateLimit.002': "Saatlik şikayet limitini aştın.",  // TODO: translate
  'auto.rateLimit.003': "Saatlik arkadaşlık isteği limitini aştın.",  // TODO: translate
  'auto.rateLimit.004': "Çok hızlı mesaj atıyorsun.",  // TODO: translate
  'auto.rateLimit.005': "Çok fazla sesli mesaj gönderdin, 5 dk bekle.",  // TODO: translate
  'auto.rateLimit.006': "Çok hızlı hediye gönderiyorsun, biraz yavaşla.",  // TODO: translate
  'auto.rateLimit.007': "Bir saat içinde fazla oda kurdun, biraz dinlen.",  // TODO: translate
  'auto.recordings.001': "Geçersiz parametre.",  // TODO: translate
  'auto.recordings.002': "Geçersiz parametre.",  // TODO: translate
  'auto.referral.001': "Tebrikler! Her ikiniz de 50 SP kazandınız.",  // TODO: translate
  'auto.referral.002': "[Referral] Fallback earn de başarısız:",  // TODO: translate
  'auto.referral.003': "İşlem sırasında hata oluştu.",  // TODO: translate
  'auto.referral.004': "Zaten bir davet kodu kullanmışsınız.",  // TODO: translate
  'auto.referral.005': "Zaten bir davet kodu kullanmışsınız.",  // TODO: translate
  'auto.referral.006': "Davet kodunu kullanmak için hesabınızın en az 24 saat eski olması gerekir.",  // TODO: translate
  'auto.referral.007': "Bu davet kodunun limiti dolmuş.",  // TODO: translate
  'auto.referral.008': "Kendi davet kodunuzu kullanamazsınız.",  // TODO: translate
  'auto.referral.009': "Bu davet kodu bulunamadı.",  // TODO: translate
  'auto.referral.010': "Geçersiz davet kodu",  // TODO: translate
  'auto.revenuecat.001': "[RevenueCat] logout hatası:",  // TODO: translate
  'auto.revenuecat.002': "[RevenueCat] restore hatası:",  // TODO: translate
  'auto.revenuecat.003': "Satın alma başarısız",  // TODO: translate
  'auto.revenuecat.004': "Aylık",  // TODO: translate
  'auto.revenuecat.005': "Yıllık",  // TODO: translate
  'auto.revenuecat.006': "{{0}} paketi bulunamadı. Dashboard yapılandırmasını kontrol edin.",  // TODO: translate
  'auto.revenuecat.007': "RevenueCat SDK hazır değil",  // TODO: translate
  'auto.revenuecat.008': "Abonelik sistemi henüz aktif değil. Lütfen uygulamayı güncelleyin veya daha sonra tekrar deneyin.",  // TODO: translate
  'auto.revenuecat.009': "[RevenueCat] getOfferings hatası:",  // TODO: translate
  'auto.revenuecat.010': "[RevenueCat] identify hatası:",  // TODO: translate
  'auto.revenuecat.011': "[RevenueCat] SDK başlatma hatası:",  // TODO: translate
  'auto.revenuecat.012': "[RevenueCat] Dashboard'da offering/ürün bulunamadı — mock offerings kullanılacak",  // TODO: translate
  'auto.revenuecat.013': "Yıllık Pro abonelik",  // TODO: translate
  'auto.revenuecat.014': "Pro Üyelik (Yıllık)",  // TODO: translate
  'auto.revenuecat.015': "Aylık Pro abonelik",  // TODO: translate
  'auto.revenuecat.016': "Pro Üyelik",  // TODO: translate
  'auto.revenuecat.017': "Yıllık Plus abonelik",  // TODO: translate
  'auto.revenuecat.018': "Plus Üyelik (Yıllık)",  // TODO: translate
  'auto.revenuecat.019': "Aylık Plus abonelik",  // TODO: translate
  'auto.revenuecat.020': "Plus Üyelik",  // TODO: translate
  'auto.room.001': "Bu odanın zaten bir sahibi var. Host değiştirme yapılamaz.",  // TODO: translate
  'auto.room.002': "Bu rolde host olamazsınız.",  // TODO: translate
  'auto.room.003': "Bu odada katılımcı değilsiniz.",  // TODO: translate
  'auto.room.004': "Oda bulunamadı",  // TODO: translate
  'auto.room.005': "Moderatör limiti doldu (max {{0}}/{{1}}).",  // TODO: translate
  'auto.room.006': "Bu odanın sahibi değilsiniz",  // TODO: translate
  'auto.room.007': "Sahneye çıkılamadı.",  // TODO: translate
  'auto.room.008': "Sahneye çıkma yetkin yok. Bu modda host izni gerekiyor veya sunucu güncellemesi bekleniyor.",  // TODO: translate
  'auto.room.009': "Sahneye çıkılamadı",  // TODO: translate
  'auto.room.010': "Bu odada sadece oda sahibi konuşmacı seçebilir.",  // TODO: translate
  'auto.room.011': "Tema değiştirmek için Plus+ üyelik gerekli.",  // TODO: translate
  'auto.room.012': "Bu odanın sahibi değilsiniz",  // TODO: translate
  'auto.room.013': "Keşfet boost: {{0}} saat",  // TODO: translate
  'auto.room.014': "Bu odanın sahibi değilsiniz",  // TODO: translate
  'auto.room.015': "Bu odanın sahibi değilsiniz",  // TODO: translate
  'auto.room.016': "Geçici host odayı silemez. Bu yetki yalnız odanın asıl sahibine aittir.",  // TODO: translate
  'auto.room.017': "Bu odanın sahibi değilsiniz",  // TODO: translate
  'auto.room.018': "Oda ismi boş olamaz",  // TODO: translate
  'auto.room.019': "Geçici host kritik oda ayarlarını değiştiremez. Bu yetki yalnız odanın asıl sahibine aittir.",  // TODO: translate
  'auto.room.020': "Bu odanın sahibi değilsiniz",  // TODO: translate
  'auto.room.021': "Bu odaya erişiminiz yasaklanmış veya oda katılıma kapalı.",  // TODO: translate
  'auto.room.022': "Oda giriş ücreti tahsil edilemedi",  // TODO: translate
  'auto.room.023': "Giriş ücreti: {{0}} SP. Mevcut bakiyeniz: {{1}} SP.",  // TODO: translate
  'auto.room.024': "SP işlemi başarısız",  // TODO: translate
  'auto.room.025': "Bu oda şu an kilitli. Yeni giriş kabul edilmiyor.",  // TODO: translate
  'auto.room.026': "Bu odaya erişiminiz yasaklanmıştır.",  // TODO: translate
  'auto.room.027': "Bu odayı sadece sahibi başlatabilir",  // TODO: translate
  'auto.room.028': "Oda bulunamadı",  // TODO: translate
  'auto.room.029': "Kalıcı oda limitine ulaştınız (max {{0}}/{{1}}). Mevcut odalarınızı silebilirsiniz.",  // TODO: translate
  'auto.room.030': "Günlük oda limiti doldu (max {{0}}/{{1}}). Yarın tekrar deneyin.",  // TODO: translate
  'auto.room.031': "{{0}} planıyla \"{{1}}\" oda açılamaz. İzinli tipler: {{2}}",  // TODO: translate
  'auto.room.032': "Oda ismi boş olamaz",  // TODO: translate
  'auto.room.033': "Çok hızlı oda kuruyorsun.",  // TODO: translate
  'auto.room.034': "Oda uyandırılamadı: ",  // TODO: translate
  'auto.room.035': "{{0}}'in Odası",  // TODO: translate
  'auto.room.036': "User",  // translated
  'auto.room.037': "User",  // translated
  'auto.room.038': "Film Odası",  // TODO: translate
  'auto.room.039': "Kitap Odası",  // TODO: translate
  'auto.room.040': "Oyun Odası",  // TODO: translate
  'auto.room.041': "Müzik Odası",  // TODO: translate
  'auto.room.042': "Sohbet Odası",  // TODO: translate
  'auto.room.043': "Bu işlem için yetkiniz yok.",  // TODO: translate
  'auto.roomAccess.001': "🎤 SopranoChat'te \"{{0}}\" odasına katıl!\n{{1}}",  // TODO: translate
  'auto.roomAccess.002': "Dinleyici alanı dolu. Seyirci olarak katılıyorsunuz.",  // TODO: translate
  'auto.roomAccess.003': "Davet bulunamadı",  // TODO: translate
  'auto.roomAccess.004': "Davet bulunamadı",  // TODO: translate
  'auto.roomAccess.005': "Bu oda şu anda aktif değil",  // TODO: translate
  'auto.roomAccess.006': "Bu oda artık mevcut değil",  // TODO: translate
  'auto.roomAccess.007': "{{0}} seni \"{{1}}\" odasına davet etti",  // TODO: translate
  'auto.roomAccess.008': "İstek kaydedilemedi: ",  // TODO: translate
  'auto.roomAccess.009': "Çok fazla katılma isteği gönderdiniz. Lütfen 1 saat sonra tekrar deneyin.",  // TODO: translate
  'auto.roomAccess.010': "En az {{0}} yaşında olmalısın.",  // TODO: translate
  'auto.roomAccess.011': "Sadece sahibin arkadaşları.",  // TODO: translate
  'auto.roomAccess.012': "Oda yeni katılımcı kabul etmiyor.",  // TODO: translate
  'auto.roomAccess.013': "Bu odadan yasaklanmışsın.",  // TODO: translate
  'auto.roomAccess.014': "Bu davetli bir oda. Katılmak için istek göndermek gerekir.",  // TODO: translate
  'auto.roomAccess.015': "Yanlış şifre.",  // TODO: translate
  'auto.roomAccess.016': "Bu oda şifre korumalı.",  // TODO: translate
  'auto.roomAccess.017': "Oda dili ile sizin diliniz farklı.",  // TODO: translate
  'auto.roomAccess.018': "Bu odaya katılmak için en az {{0}} yaşında olmalısınız.",  // TODO: translate
  'auto.roomAccess.019': "Bu odaya katılmak için en az {{0}} yaşında olmalısınız.",  // TODO: translate
  'auto.roomAccess.020': "Bu oda yalnızca oda sahibinin arkadaşlarına açık.",  // TODO: translate
  'auto.roomAccess.021': "Oda şu anda kilitli. Yeni katılımcı kabul edilmiyor.",  // TODO: translate
  'auto.roomAccess.022': "Bu odadan yasaklanmışsınız.",  // TODO: translate
  'auto.roomChat.001': "Bağlantı hatası",  // TODO: translate
  'auto.roomChat.002': "Çok hızlı mesaj gönderiyorsun",  // TODO: translate
  'auto.roomChat.003': "Boş mesaj",  // TODO: translate
  'auto.roomChat.004': "Sistem odasında geçersiz",  // TODO: translate
  'auto.roomChat.005': "Bağlantı hatası.",  // TODO: translate
  'auto.roomChat.006': "Temizleme başarısız.",  // TODO: translate
  'auto.roomChat.007': "Sistem odası temizlenemez.",  // TODO: translate
  'auto.roomFollow.001': "{{0}} yeni bir oda açtı: \"{{1}}\"",  // TODO: translate
  'auto.roomFollow.002': "🎤 Yeni Canlı Oda",  // TODO: translate
  'auto.roomFollow.003': "🎤 yeni bir oda açtı: \"{{0}}\"",  // TODO: translate
  'auto.roomFollow.004': "User",  // translated
  'auto.roomFollow.005': "🏠 {{0}} \"{{1}}\" odanızı takip etmeye başladı",  // TODO: translate
  'auto.settings.001': "Türkçe",  // TODO: translate
  'auto.storage.001': "Ses dosyası",  // TODO: translate
  'auto.storage.002': "çok büyük",  // TODO: translate
  'auto.storage.003': "{{0}} çok büyük ({{1}}MB). Maksimum: {{2}}MB",  // TODO: translate
  'auto.store.001': "Bağlantı hatası",  // TODO: translate
  'auto.systemSettings.001': "Lütfen Play Store'dan güncelleyin.",  // TODO: translate
  'auto.systemSettings.002': "Uygulama bakımda. Lütfen birazdan tekrar deneyin.",  // TODO: translate
  'auto.tags.001': "Geçersiz oda.",  // TODO: translate
  'auto.tags.002': "eğlence",  // TODO: translate
  'auto.tags.003': "gündem",  // TODO: translate
  'auto.tags.004': "müzik",  // TODO: translate
  'auto.upsell.001': "{{0}} üyelik ile bu özelliği açın.",  // TODO: translate
  'auto.upsell.002': "Bu özellik {{0}}+ abonelik gerektirir.",  // TODO: translate
  'auto.upsell.003': "Dinleyici grid'i dolu. {{0}} ile daha geniş bir dinleyici alanına sahip olun!",  // TODO: translate
  'auto.upsell.004': "Kamera limiti doldu. {{0}} ile daha fazla kamera açın!",  // TODO: translate
  'auto.upsell.005': "Moderatör limiti doldu. {{0}} ile daha fazla moderatör atayın!",  // TODO: translate
  'auto.upsell.007': "Sahne kapasitesi dolu. {{0}} ile daha fazla kişiyi sahneye çıkarın!",  // TODO: translate
  'auto.upsell.008': "Kişiselleştirme özellikleri {{0}}+ ile açılır.",  // TODO: translate
  'auto.upsell.009': "Bu oda tipi {{0}}+ üyelere özel.",  // TODO: translate
  'auto.upsell.010': "Oda süreniz doldu. {{0}} ile daha uzun yayın yapın!",  // TODO: translate
  'auto.upsell.011': "Günlük oda limitine ulaştınız. {{0}} ile daha fazla oda açın!",  // TODO: translate
  'auto.userTitles.001': "Yükselen Yıldız",  // TODO: translate
  'auto.userTitles.002': "Destekçi",  // TODO: translate
  'auto.userTitles.003': "Ateş Topu",  // TODO: translate
  'auto.userTitles.004': "Cömert Ruh",  // TODO: translate
  'auto.userTitles.005': "Sahne Yıldızı",  // TODO: translate
  'auto.userTitles.006': "Hayırsever",  // TODO: translate
  'auto.voiceReactions.001': "Yangın",  // TODO: translate
  'auto.voiceReactions.002': "Alkış",  // TODO: translate
  'tabs.myrooms.001': "Music",  // translated
  'tabs.myrooms.002': "Private",  // translated
  'tabs.myrooms.003': "📅 Planned Room Starts Early",  // translated
  'tabs.myrooms.004': "Could not start",  // translated
  'tabs.myrooms.005': "My Live Rooms",  // translated
  'tabs.myrooms.006': "Failed to Change Name",  // translated
  'tabs.myrooms.007': "Failed to update room name. Try again later.",  // translated
  'tabs.myrooms.008': "Room Type Not Changed",  // translated
  'tabs.myrooms.009': "Type change could not be applied.",  // translated
  'tabs.myrooms.010': "Could Not Apply Theme",  // translated
  'tabs.myrooms.011': "Failed to update room theme.",  // translated
  'tabs.myrooms.012': "The room and all its messages have been removed.",  // translated
  'tabs.myrooms.013': "Daily Limit Expired",  // translated
  'tabs.myrooms.014': "Open unlimited rooms by upgrading your membership.",  // translated
  'tabs.myrooms.015': "Failed to Open Room",  // translated
  'tabs.myrooms.016': "The room has been put to sleep.",  // translated
  'tabs.myrooms.017': "Failed to freeze",  // translated
  'tabs.myrooms.018': "\tPermission Required",  // translated
  'tabs.myrooms.019': "Permission to access the gallery was not granted.",  // translated
  'tabs.myrooms.020': "🖼 Background Updated",  // translated
  'tabs.myrooms.021': "Could Not Load Background",  // translated
  'tabs.myrooms.022': "\tPermission Required",  // translated
  'tabs.myrooms.023': "Permission to access the gallery was not granted.",  // translated
  'tabs.myrooms.024': "🖼 Card Image Updated",  // translated
  'tabs.myrooms.025': "Could Not Load Card Image",  // translated
  'tabs.myrooms.026': "Room Closed",  // translated
  'tabs.myrooms.027': "This room is not alive right now.",  // translated
  'tabs.myrooms.028': "Invitation sent",  // translated
  'tabs.profile.001': "Failed to load activity data",  // translated
  'tabs.profile.002': "Are you sure you want to log out of your account?",  // translated
  'tabs.profile.003': "Signed out",  // translated
  'tabs.profile.004': "Failed to logout",  // translated
  'tabs.profile.005': "You 💎 Gained 50 HP!",  // translated
  'tabs.profile.006': "Code Could Not Be Applied",  // translated
  'tabs.profile.007': "Could not load history",  // translated
  'tabs.profile.008': "COPIED",  // translated
  'tabs.profile.009': "Failed to copy",  // translated
  'tabs.profile.010': "Boost failed",  // translated
  'tabs.profile.011': "View Profile",  // translated
  'tabs.profile.012': "Send a Message",  // translated
  'tabs.profile.013': "Unfriend",  // translated
  'tabs.profile.014': "Unfriend",  // translated
  'tabs.profile.015': "Friend has been removed",  // translated
  'tabs.profile.016': "Uninstallation Failed",  // translated
  'tabs.profile.017': "Uninstallation Failed",  // translated
  'tabs.profile.018': "Bio updated",  // translated
  'tabs.profile.019': "Update Failed",  // translated
  'admin.001': "Complaint Closed",  // translated
  'admin.002': "Alert",  // translated
  'admin.003': "User Alerted",  // translated
  'admin.004': "User Banned",  // translated
  'admin.005': "Room Closed",  // translated
  'admin.006': "Room Awakened",  // translated
  'admin.007': "Failed to wake up",  // translated
  'admin.008': "Failed to Update Tier",  // translated
  'admin.009': "Failed to Change Authority",  // translated
  'admin.010': "Disable",  // translated
  'admin.011': "You can't delete your own account.",  // translated
  'admin.012': "User could not be deleted.",  // translated
  'admin.013': "User deleted",  // translated
  'admin.014': "Users",  // translated
  'admin.015': "Total Partner",  // translated
  'admin.016': "Online",  // translated
  'admin.017': "Live Room",  // translated
  'admin.018': "Grievance",  // translated
  'admin.019': "Dispatch",  // translated
  'admin.020': "Create Room",  // translated
  'admin.021': "Clear Free Free Rooms",  // translated
  'admin.022': "Send Announcement to All Users",  // translated
  'admin.023': "Skia Parity Test (development)",  // translated
  'admin.024': "Duration",  // translated
  'auth.resetpassword.001': "Underweight",  // translated
  'auth.resetpassword.002': "Good",  // translated
  'auth.resetpassword.003': "Strong",  // translated
  'auth.resetpassword.004': "Password is too short!",  // translated
  'auth.resetpassword.005': "Have at least 8 characters",  // translated
  'auth.resetpassword.006': "Uppercase Missing",  // translated
  'auth.resetpassword.007': "Password must contain at least 1 uppercase letter.",  // translated
  'auth.resetpassword.008': "Password must have at least 1 number.",  // translated
  'auth.resetpassword.009': "Passwords don't match.",  // translated
  'auth.resetpassword.010': "The two fields must be the same.",  // translated
  'auth.resetpassword.011': "Password changed",  // translated
  'auth.resetpassword.012': "You can login with your new password.",  // translated
  'auth.resetpassword.013': "The link has expired",  // translated
  'auth.resetpassword.014': "Request a new reset email.",  // translated
  'auth.resetpassword.015': "url is invalid",  // translated
  'auth.resetpassword.016': "This link has been used or is invalid.",  // translated
  'auth.resetpassword.017': "Weak Password",  // translated
  'auth.resetpassword.018': "Choose a stronger password.",  // translated
  'auth.resetpassword.019': "Failed to change password, try again.",  // translated
  'call.id.001': "Connection Error",  // translated
  'call.id.002': "Search link could not be established.",  // translated
  'call.id.003': "Error Search",  // translated
  'chat.id.001': "Your first message will be sent as a request. You can text if the other party approves.",  // translated
  'chat.id.002': "This user doesn't want to message you.",  // translated
  'chat.id.003': "You can't send new messages until the other party approves.",  // translated
  'chat.id.004': "Missed voice call",  // translated
  'chat.id.005': "You have blocked this user. Unblock them for messaging.",  // translated
  'chat.id.006': "Missing Message Duration",  // translated
  'chat.id.007': "After this time, messages are automatically deleted (on both sides).",  // translated
  'chat.id.008': "Failed to play audio",  // translated
  'chat.id.009': "Settings → Apps Turn → on the microphone from SopranoChat → Permissions\\\\",  // translated
  'chat.id.010': "Failed to record audio",  // translated
  'chat.id.011': "Failed to send voicemail",  // translated
  'chat.id.012': "copied",  // translated
  'chat.id.013': " Invalid target",  // translated
  'chat.id.014': "✓ Forwarded",  // translated
  'chat.id.015': "Failed to transmit",  // translated
  'chat.id.016': "He was taken into examination.",  // translated
  'chat.id.017': "Failed to edit",  // translated
  'chat.id.018': "Error Search",  // translated
  'chat.id.019': "Message request declined.",  // translated
  'chat.id.020': "You can now text.",  // translated
  'chat.id.021': "[8theme] Post Options",  // translated
  'chat.id.022': "Error Search",  // translated
  'chat.id.023': "Photo send failed",  // translated
  'chat.id.024': "The invitation could not be sent. ",  // translated
  'chat.id.025': "Off (unlimited)",  // translated
  'chat.id.026': "7 days",  // translated
  'chat.id.027': "30 days",  // translated
  'chat.id.028': "This chat history will be deleted. This cannot be undone.",  // translated
  'chat.id.029': "Unblock",  // translated
  'chat.id.030': "Block User",  // translated
  'chat.id.031': "This message was deleted for everyone",
  'chat.id.032': "This message was deleted",
  'chat.id.033': "Yourself",
  'chat.id.034': "📷 Photo",
  'chat.id.035': "Removed from saved",
  'chat.id.036': "🔖 Saved",
  'chat.id.037': "Could not send message",
  'chat.id.038': "Message Failed",
  'chat.id.039': "Last seen: {{time}}",
  'chat.id.040': "Offline",
  'chat.id.041': "This user",
  'chat.id.042': "{{name}} is messaging you for the first time. Accept to start chatting.",
  'chat.id.043': "Action failed",
  'chat.id.044': "✎ Editing",
  'chat.id.045': "↩︎ Reply: {{name}}",
  'chat.id.046': "Modify the current text and send",
  'chat.id.047': "Accept the request first",
  'chat.id.048': "Can't send messages",
  'chat.id.049': "Write your first message...",
  'chat.id.050': "🎙️ I'm currently in the \"{{room}}\" room! Come join",
  'chat.id.051': "✓ Disabled",
  'chat.id.052': "Messages no longer expire.",
  'chat.id.053': "New messages will be deleted after this time.",
  'createroom.001': "Paste YouTube / Spotify / SoundCloud link — people in the room listen on their own platform.",  // translated
  'createroom.002': "∇️ The room will remain closed until the scheduled time. You can start it manually from the \"My Rooms\" screen.",  // translated
  'createroom.003': "Your Daily Room Limit Has Been Expired",  // translated
  'createroom.004': "Sunset Style",  // translated
  'createroom.005': "Insufficient Membership",  // translated
  'createroom.006': "Upgrade your membership to use this access mode.",  // translated
  'createroom.007': "Daily Limit",  // translated
  'createroom.008': "Invalid Music Link",  // translated
  'createroom.009': "Failed to Open Room",  // translated
  'createroom.010': "Invitations Sent",  // translated
  'createroom.011': "∇️ Slow Mode Recommended",  // translated
  'createroom.012': "Slow mode turned on for 5s in the encrypted room (spam protection). You can turn it off below.",  // translated
  'createroom.013': "Audience: Sees the Get 🎙️ On Stage button",  // translated
  'createroom.014': "Audience: He sees the Raise ✋ Hand button",  // translated
  'createroom.015': "Audience: Sees a 🔒 locked button",  // translated
  'createroom.016': "\tPermission Required",  // translated
  'createroom.017': "Permission to access the gallery was not granted. You can allow it in the settings.",  // translated
  'createroom.018': "Failed to select image",  // translated
  'createroom.019': "\tPermission Required",  // translated
  'createroom.020': "Permission to access the gallery was not granted.",  // translated
  'createroom.021': "Failed to select image",  // translated
  'createroom.022': "Access",  // translated
  'createroom.023': "Welcoming",  // translated
  'createroom.024': "Introduction",  // translated
  'createroom.025': "Gift",  // translated
  'createroom.026': "Age Limit",  // translated
  'createroom.027': "SLOW&#10;MODE",  // translated
  'createroom.028': "Music Link",  // translated
  'editprofile.001': "Your password is managed through your Google account. Use the Google Account Settings → Security section to change your password.",  // translated
  'editprofile.002': "Photo successfully uploaded",  // translated
  'editprofile.003': "Your profile photo has been updated.",  // translated
  'editprofile.004': "Failed to Upload Photo",  // translated
  'editprofile.005': "Alert",  // translated
  'editprofile.006': "Display name cannot be empty.",  // translated
  'editprofile.007': "Logged Out",  // translated
  'editprofile.008': "Your login information was not found, please log in again.",  // translated
  'editprofile.009': "Username is already taken",  // translated
  'editprofile.010': "Try another username.",  // translated
  'editprofile.011': "Checking username availability...",  // translated
  'editprofile.012': "Success",  // translated
  'editprofile.013': "Profile updated",  // translated
  'editprofile.014': "Username Taken",  // translated
  'editprofile.015': "Sorry, that username already exists!",  // translated
  'editprofile.016': "Profile Not Updated",  // translated
  'editprofile.017': "Failed to save changes. Try again.",  // translated
  'editprofile.018': "Success",  // translated
  'editprofile.019': "Your Google account has been successfully linked! You can now sign in with Google.",  // translated
  'editprofile.020': "Alert",  // translated
  'editprofile.021': " This %s account is already linked to another user.",  // translated
  'editprofile.022': "Your Google account is already connected.",  // translated
  'editprofile.023': "Google Failed to Connect",  // translated
  'editprofile.024': "Failed to add Google account, try again.",  // translated
  'editprofile.025': "Please enter your email address",  // translated
  'editprofile.026': "Password is too short!",  // translated
  'editprofile.027': "Password must be minimum 6 characters.",  // translated
  'editprofile.028': "Passwords don't match.",  // translated
  'editprofile.029': "The two password fields must be the same.",  // translated
  'editprofile.030': "Success",  // translated
  'editprofile.031': "Your email account has been created successfully! You can now log in with email and password.",  // translated
  'editprofile.032': "Email in Use",  // translated
  'editprofile.033': "This email is linked to another account.",  // translated
  'editprofile.034': "Invalid Email",  // translated
  'editprofile.035': "Please enter a valid email address!",  // translated
  'editprofile.036': "Email account is already connected.",  // translated
  'editprofile.037': "Youremail account could not be updated, please try again.",  // translated
  'editprofile.038': "Alert",  // translated
  'editprofile.039': "Enter your current password.",  // translated
  'editprofile.040': "Alert",  // translated
  'editprofile.041': "Password should be at least 6 characters",  // translated
  'editprofile.042': "Alert",  // translated
  'editprofile.043': "New passwords do not match.",  // translated
  'editprofile.044': "Success",  // translated
  'editprofile.045': "Your password updated",  // translated
  'editprofile.046': "Password Lost and Found",  // translated
  'editprofile.047': "Your current password is not correct.",  // translated
  'editprofile.048': "Re-login required!",  // translated
  'editprofile.049': "Log out and back in for security.",  // translated
  'editprofile.050': "Failed to modify password",  // translated
  'editprofile.051': "Unable to complete transaction, try again.",  // translated
  'editprofile.052': "Google Hesabı",  // translated
  'editprofile.053': "E-mail Account",  // translated
  'hiddenrooms.001': "Could not load ability list.",  // translated
  'hiddenrooms.002': "All secret rooms have been brought back",  // translated
  'leaderboard.001': "Weekly",  // translated
  'leaderboard.002': "Monthly",  // translated
  'leaderboard.003': "Top Generous",  // translated
  'leaderboard.004': "SP donation",  // translated
  'leaderboard.005': "Gained HP",  // translated
  'leaderboard.006': "opened a room",  // translated
  'leaderboard.007': "Most Popularity",  // translated
  'leaderboard.008': "follower",  // translated
  'leaderboard.009': "Most Popular Rooms",  // translated
  'leaderboard.010': "Most Generous",  // translated
  'notifications.001': "Friend requests, gifts, and messages will appear here",  // translated
  'plus.001': "Subscription system is in maintenance mode. It will be available for purchase very soon.",  // translated
  'plus.002': "ENHANCED",  // translated
  'plus.003': "Unlimited",  // translated
  'plus.004': "You need to logged in first",  // translated
  'plus.005': "Upgrade Failed",  // translated
  'plus.006': "Cancel Plan",  // translated
  'plus.007': "Plan has been changed",  // translated
  'plus.008': "You're back on the free plan.",  // translated
  'plus.009': "You can cancel your subscription in Google Play settings.",  // translated
  'plus.010': "Room Staying Open",  // translated
  'plus.011': "Casual Room",  // translated
  'plus.012': "Permanent Room Slot",  // translated
  'plus.013': "Room Type",  // translated
  'plus.014': "Avatar Frame",  // translated
  'plus.015': "Age/Language Filter",  // translated
  'plus.016': "Internet forum",  // translated
  'plus.017': "Follower-Only",  // translated
  'plus.018': "chamber music",  // translated
  'room.id.001': "Writing",  // translated
  'room.id.002': "online",  // translated
  'room.id.003': "If you agree, you can start messaging.",  // translated
  'room.id.004': "Your request is pending approval. You cannot send a new message until approval is received.",  // translated
  'room.id.005': "Your request has been declined — you cannot send a message.",  // translated
  'room.id.006': "Delivered.",  // translated
  'room.id.007': "Failed to edit",  // translated
  'room.id.008': "Failed to send",  // translated
  'room.id.009': "copied",  // translated
  'room.id.010': " Invalid target",  // translated
  'room.id.011': "You can't deliver the message to yourself.",  // translated
  'room.id.012': "✓ Forwarded",  // translated
  'room.id.013': "Failed to transmit",  // translated
  'room.id.014': "Failed to Start Room",  // translated
  'room.id.015': "You send a request to its owner, awaiting approval.",  // translated
  'room.id.016': "🎉 Obstacle Removed",  // translated
  'room.id.017': "The room owner has changed the setting — you have been taken to the room!",  // translated
  'room.id.018': "Input Error",  // translated
  'room.id.019': "Your text chat has been closed by the moderator.",  // translated
  'room.id.020': "Failed to send the message",  // translated
  'room.id.021': "You may not have authorization or connectivity issue.",  // translated
  'room.id.022': "Failed to send the message",  // translated
  'room.id.023': "Only the people chosen by the room owner can perform in this room. Wait until the owner chooses you.",  // translated
  'room.id.024': "∇ You're Enrolled in Queue",  // translated
  'room.id.025': "The stage is full — you'll automatically take the stage when someone gets off.",  // translated
  'room.id.026': "🤚 Scene Request Sent",  // translated
  'room.id.027': "Waiting for room owner's approval...",  // translated
  'room.id.028': "No Connection",  // translated
  'room.id.029': "Failed to connect to audio server. Microphone unavailable.",  // translated
  'room.id.030': "You have been silenced by the moderator. You cannot turn on the microphone until the time is up.",  // translated
  'room.id.031': "Microphone Error",  // translated
  'room.id.032': "Failed to change microphone",  // translated
  'room.id.033': "Staging Error",  // translated
  'room.id.034': "Leave Room",  // translated
  'room.id.035': "Are you sure you want to leave as a room owner? The authority will be transferred to an appropriate person.",  // translated
  'room.id.036': "Leave Room",  // translated
  'room.id.037': "Are you sure you want to leave the room?",  // translated
  'room.id.038': "You cannot delete the room as a proxy host. Only the room owner can delete it.",  // translated
  'room.id.039': "Delete 🗑️ Room Permanently",  // translated
  'room.id.040': "This room will be completely deleted and cannot be undone! All participants will be removed. Do you want to continue?",  // translated
  'room.id.041': "Failed to logout",  // translated
  'room.id.042': "Exit from room failed.",  // translated
  'room.id.043': "Failed to logout",  // translated
  'room.id.044': "Exit from room failed.",  // translated
  'room.id.045': "🔑 Room Closed",  // translated
  'room.id.046': "The room was closed because there was no room owner and moderator.",  // translated
  'room.id.047': "⚠️ Room Closing!",  // translated
  'room.id.048': "The room will close in 5 seconds!",  // translated
  'room.id.049': "Host Change Blocked",  // translated
  'room.id.050': "Host cannot be changed in active room.",  // translated
  'room.id.051': "You cannot be a host in this role.",  // translated
  'room.id.052': "You are in charge of the room. The countdown has been cancelled.",  // translated
  'room.id.053': "Could Not Become a Host",  // translated
  'room.id.054': "Speaker Not Changed",  // translated
  'room.id.055': "Unable to complete invitation/subtraction.",  // translated
  'room.id.056': "Time’s Up",  // translated
  'room.id.057': "Room expired. Closing room...",  // translated
  'room.id.058': "Time’s Up",  // translated
  'room.id.059': "Room expired. Closing room...",  // translated
  'room.id.060': "So, 15 minutes left.",  // translated
  'room.id.061': "Room time is running out. You can extend it by switching to Plus\\\\.",  // translated
  'room.id.062': "Ascend",  // translated
  'room.id.063': "So, 15 minutes left.",  // translated
  'room.id.064': "The room is about to close! Unlimited room time with Pro.",  // translated
  'room.id.065': "Switch to Pro\\\\",  // translated
  'room.id.066': "This room will close in 5 minutes.",  // translated
  'room.id.067': "It's 🎙️ Your Turn!",  // translated
  'room.id.068': "You took to the stage automatically.",  // translated
  'room.id.069': "30 seconds now.",  // translated
  'room.id.070': "Your stage time is ending",  // translated
  'room.id.071': "Mute all",  // translated
  'room.id.072': "All speakers on stage will have their microphones turned off.",  // translated
  'room.id.073': "🔇 All Muted",  // translated
  'room.id.074': "Open All",  // translated
  'room.id.075': "The microphones of all the speakers on stage will be turned back on.",  // translated
  'room.id.076': "🔊 All Opened",  // translated
  'room.id.077': "🔒 Chosen Mode",  // translated
  'room.id.078': "Only the people chosen by the room owner can perform in this room.",  // translated
  'room.id.079': "🤚 Scene Request Sent",  // translated
  'room.id.080': "Waiting for room owner's approval...",  // translated
  'room.id.081': "Your scene request has already been submitted.",  // translated
  'room.id.082': "∇ You're Enrolled in Queue",  // translated
  'room.id.083': "The stage is full — you'll automatically take the stage when someone gets off.",  // translated
  'room.id.084': "You're Already In Queue",  // translated
  'room.id.085': "You are waiting in line, you will be automatically promoted when the stage is empty.",  // translated
  'room.id.086': "The microphone turns on automatically...",  // translated
  'room.id.087': "Failed to Perform",  // translated
  'room.id.088': "Failed to turn on the microphone, try again.",  // translated
  'room.id.089': "Failed to Perform",  // translated
  'room.id.090': "Failed to turn on the microphone, try again.",  // translated
  'room.id.091': "There are only room owners and moderators on the stage. Unable to make room.",  // translated
  'room.id.092': "Failed to Perform",  // translated
  'room.id.093': "Failed to turn on the microphone, try again.",  // translated
  'room.id.094': "Cannot share",  // translated
  'room.id.095': "Failed to copy link",  // translated
  'room.id.096': "Unable to complete process.",  // translated
  'room.id.097': "Something went wrong, try again.",  // translated
  'room.id.098': "You've Joined 🎧 the Room!",  // translated
  'room.id.099': "Password verified — welcome!",  // translated
  'room.id.100': "Input Error",  // translated
  'room.id.101': "Could Not Submit Request",  // translated
  'room.id.102': "You've Joined 🎧 the Room!",  // translated
  'room.id.103': "Your request has been approved — welcome!",  // translated
  'room.id.104': "Input Error",  // translated
  'room.id.105': "Camera is off",  // translated
  'room.id.106': "Camera not available on this tier. Upgrade membership!",  // translated
  'room.id.107': "Leave Room",  // translated
  'room.id.108': "Are you sure you want to leave the room?",  // translated
  'room.id.109': "✨ Polished",  // translated
  'room.id.110': "Failed to send",  // translated
  'room.id.111': "Couldn't update setting",  // translated
  'room.id.112': "Failed to save change. Try again.",  // translated
  'room.id.113': "Chosen mode requires Pro subscription.",  // translated
  'room.id.114': "Couldn't update setting",  // translated
  'room.id.115': "Failed to save change. Try again.",  // translated
  'room.id.116': "Couldn't update setting",  // translated
  'room.id.117': "Failed to save change. Try again.",  // translated
  'room.id.118': "Couldn't update setting",  // translated
  'room.id.119': "Failed to save change. Try again.",  // translated
  'room.id.120': "Couldn't update setting",  // translated
  'room.id.121': "Failed to save change. Try again.",  // translated
  'room.id.122': "Couldn't update setting",  // translated
  'room.id.123': "Failed to save change. Try again.",  // translated
  'room.id.124': "Couldn't update setting",  // translated
  'room.id.125': "Failed to save change. Try again.",  // translated
  'room.id.126': "✏️ Room Name Updated",  // translated
  'room.id.127': "Couldn't update setting",  // translated
  'room.id.128': "Failed to save change. Try again.",  // translated
  'room.id.129': "💬 Welcome Message Updated",  // translated
  'room.id.130': "Couldn't update setting",  // translated
  'room.id.131': "Failed to save change. Try again.",  // translated
  'room.id.132': "Rules Updated",  // translated
  'room.id.133': "Couldn't update setting",  // translated
  'room.id.134': "Failed to save change. Try again.",  // translated
  'room.id.135': "📝 Description Updated",  // translated
  'room.id.136': "Couldn't update setting",  // translated
  'room.id.137': "Failed to save change. Try again.",  // translated
  'room.id.138': "Couldn't update setting",  // translated
  'room.id.139': "Failed to save change. Try again.",  // translated
  'room.id.140': "Couldn't update setting",  // translated
  'room.id.141': "Failed to save change. Try again.",  // translated
  'room.id.142': "Theme updated",  // translated
  'room.id.143': "Couldn't update setting",  // translated
  'room.id.144': "Failed to save change. Try again.",  // translated
  'room.id.145': "Freeze ❄️ Room",  // translated
  'room.id.146': "Room will be frozen. All participants will be removed. You can then reactivate it from the \"My Rooms\" tab.",  // translated
  'room.id.147': "You can reactivate it from the My Rooms tab.",  // translated
  'room.id.148': "Failed to freeze",  // translated
  'room.id.149': "Couldn't update setting",  // translated
  'room.id.150': "Failed to save change. Try again.",  // translated
  'room.id.151': "Couldn't update setting",  // translated
  'room.id.152': "Failed to save change. Try again.",  // translated
  'room.id.153': "\tPermission Required",  // translated
  'room.id.154': "🖼 Background Updated",  // translated
  'room.id.155': "Couldn't update setting",  // translated
  'room.id.156': "Background Removed",  // translated
  'room.id.157': "Couldn't update setting",  // translated
  'room.id.158': "Failed to save change. Try again.",  // translated
  'room.id.159': "\tPermission Required",  // translated
  'room.id.160': "🖼 Card Image Updated",  // translated
  'room.id.161': "Couldn't update setting",  // translated
  'room.id.162': "Card Image Removed",  // translated
  'room.id.163': "Couldn't update setting",  // translated
  'room.id.164': "Failed to save change. Try again.",  // translated
  'room.id.165': "Gold Invitation",  // translated
  'room.id.166': "Select a listener from the list.",  // translated
  'room.id.167': "Boost Failed",  // translated
  'room.id.168': "Invitation sent",  // translated
  'room.id.169': "You've Joined 🎧 the Room!",  // translated
  'room.id.170': "Password verified — welcome!",  // translated
  'room.id.171': "You've Joined 🎧 the Room!",  // translated
  'room.id.172': "Your request has been approved — welcome!",  // translated
  'room.id.173': "Input Error",  // translated
  'room.id.174': "Could Not Submit Request",  // translated
  'settings.001': "Diagnostic error",  // translated
  'spstore.001': "With SP, you can make your profile stand out, pay room admission, and access premium features.",  // translated
  'spstore.002': "Coming Up",  // translated
  'spstore.003': "The SP store is closed for the alpha version. It will be active on Google Play soon!",  // translated
  'store.collection.id.001': "Buy",  // translated
  'store.001': "Failed to update wishlist",  // translated
  'store.002': "You have all the pieces",  // translated
  'store.003': "Buy",  // translated
  'store.004': "Buy",  // translated
  'store.005': "Coming Up",  // translated
  'store.006': "SP purchase is turned off during alpha version. It will be active on Google Play soon!",  // translated
  'store.007': "— SETS · THEME PACKAGES —",  // translated
  'store.008': "-FRAMES · AVATAR —",  // translated
  'store.009': "— INPUT EFFECTS · ROOM —",  // translated
  'store.010': "— BADGES · PROFILE —",  // translated
  'store.011': "— PRIVATE EMOJİ · CHAT —",  // translated
  'store.012': "— COLLECTIONS · ALL SEASON —",  // translated
  'layout.001': "Connection Problem",  // translated
  'layout.002': "We couldn't retrieve your profile from the server. Check your internet connection and try again.",  // translated
  'layout.003': "Live Coverage",  // translated
  'layout.004': "You Received 🎁 a Gift",  // translated
  'layout.005': "You💖 've Been Acknowled",  // translated
  'layout.006': "Missed Call",  // translated
  'layout.007': "⏰ Event Reminder",  // translated
  'layout.008': "🎉 Friendship Acceptance",  // translated
  'blockeduserssheet.001': "Could not load ability list.",  // translated
  'blockeduserssheet.002': "Blocked users could not be withdrawn.",  // translated
  'blockeduserssheet.003': "Unblocked",  // translated
  'blockeduserssheet.004': "Unblock Failed",  // translated
  'boostpickersheet.001': "Fast Boost",  // translated
  'createroomcoachmark.001': "tap the button and open your first room.",  // translated
  'discoverwelcomesheet.001': "Meet the voice",  // translated
  'discoverwelcomesheet.002': "Open your own room",  // translated
  'discoverwelcomesheet.003': "Explore and join",  // translated
  'discoverwelcomesheet.004': "Live audio",  // translated
  'discoverwelcomesheet.005': "Immediate",  // translated
  'discoverwelcomesheet.006': "Free",  // translated
  'discoverwelcomesheet.007': "Confidential/Public",  // translated
  'discoverwelcomesheet.008': "Music/Chat",  // translated
  'discoverwelcomesheet.009': "Hot",  // translated
  'discoverwelcomesheet.010': "Live",  // translated
  'discoverwelcomesheet.011': "Prize",  // translated
  'emojipicker.001': "Favorite",  // translated
  'emojipicker.002': "Faces",  // translated
  'emojireactions.001': "Hot",  // translated
  'emojireactions.002': "Faces",  // translated
  'emojireactions.003': "Love",  // translated
  'emojireactions.004': "Nature",  // translated
  'fabhintoverlay.001': "You can open a new room here. Invite your friends, start chatting!",  // translated
  'followlistmodal.001': "ARKADAŞLAR",  // translated
  'followlistmodal.002': "FOLLOWERS",  // translated
  'followlistmodal.003': "FOLLOWING",  // translated
  'followlistmodal.004': "Unfriend",  // translated
  'followlistmodal.005': "Unsubscribe",  // translated
  'messageactionmenu.001': "Respond",  // translated
  'messageactionmenu.002': "Forward",  // translated
  'messageactionmenu.003': "Edit",  // translated
  'messageactionmenu.004': "Delete For Everyone",  // translated
  'notificationdrawer.001': "Invitation code is invalid.",  // translated
  'notificationdrawer.002': "Failed to process attendance in room, try again.",  // translated
  'notificationdrawer.003': "Unable to complete process.",  // translated
  'notificationdrawer.004': "Error while deleting notifications.",  // translated
  'notificationdrawer.005': "Failed to check",  // translated
  'notificationdrawer.006': "Notifications could not be marked as read.",  // translated
  'notifpreferencessheet.001': "You will not receive notifications at the times you specify (except for emergency calls).",  // translated
  'notifpreferencessheet.002': "Emergency calls and friend requests always arrive.",  // translated
  'notifpreferencessheet.003': "Closed",  // translated
  'notifpreferencessheet.004': "Work (09→18)",  // translated
  'notifpreferencessheet.005': "Evening (19→23)",  // translated
  'notifpreferencessheet.006': "Only from friends",  // translated
  'notifpreferencessheet.007': "Receive notifications only from friends",  // translated
  'notifpreferencessheet.008': "DM messages",  // translated
  'notifpreferencessheet.009': "New private message arrives",  // translated
  'notifpreferencessheet.010': "When called to the stage in a room",  // translated
  'notifpreferencessheet.011': "When SP is sent to you",  // translated
  'notifpreferencessheet.012': "Friend online",  // translated
  'notifpreferencessheet.013': "When your friend opens a new room",  // translated
  'profile.badgecelebration.001': "NADIR",  // translated
  'profile.badgecelebration.002': "EPIC",  // translated
  'profile.badgecelebration.003': "LEGENDARY",  // translated
  'profile.featuredbadgespicker.001': "Featured badges updated",  // translated
  'profile.giftsheet.001': "Hediye gönderilemedi",  // TODO: translate
  'profile.giftsheet.002': "Hediye gönderilemedi",  // TODO: translate
  'profile.spdonatesheet.001': "Bağış başarısız",  // TODO: translate
  'profile.spdonatesheet.002': "Bağış başarısız",  // TODO: translate
  'profile.spreceivedmodal.001': "Teşekkürler",  // TODO: translate
  'profile.spreceivedmodal.002': "Sağol",  // TODO: translate
  'profile.spreceivedmodal.003': "Çok naziksin",  // TODO: translate
  'profile.spreceivedmodal.004': "İyisin",  // TODO: translate
  'profile.spreceivedmodal.005': "HEDİYE GELDİ",  // TODO: translate
  'profile.spreceivedmodal.006': "BAĞIŞ ALDIN",  // TODO: translate
  'profile.spreceivedmodal.007': "İletilemedi",  // TODO: translate
  'profile.spreceivedmodal.008': "Teşekkür Gönderilemedi",  // TODO: translate
  'profile.spsentsuccessmodal.001': "SP HEDİYE EDİLEN KİŞİ",  // TODO: translate
  'profile.symbolgiftsheet.001': "Her gönderimde SP'n düşer · Alıcı %50 kazanır",  // TODO: translate
  'profile.symbolgiftsheet.002': "Gönderilemedi",  // TODO: translate
  'profile.tieredprofilesections.001': "Dil & Yaş Etiketleri",  // TODO: translate
  'profile.tieredprofilesections.002': "Kapsamlı Moderasyon Geçmişi",  // TODO: translate
  'profile.tieredprofilesections.003': "Profil Teması",  // TODO: translate
  'profile.tieredprofilesections.004': "Kapak Fotoğrafı",  // TODO: translate
  'profile.tieredprofilesections.005': "Takipçilere Özel İçerik",  // TODO: translate
  'profile.tieredprofilesections.006': "Destekle / SP Bağış",  // TODO: translate
  'profile.tieredprofilesections.007': "Ghost Mode Göstergesi",  // TODO: translate
  'profile.tieredprofilesections.008': "Gelişmiş İstatistik Paneli",  // TODO: translate
  'profile.tieredprofilesections.009': "Gelir Göstergesi",  // TODO: translate
  'profile.voicebiorecorder.001': "Kayıt başlatılamadı",  // TODO: translate
  'profile.voicebiorecorder.002': "Çok kısa",  // TODO: translate
  'profile.voicebiorecorder.003': "Kayıt sonlanmadı",  // TODO: translate
  'profile.voicebiorecorder.004': "Sesli tanıtım kaydedildi",  // TODO: translate
  'profile.voicebiorecorder.005': "Yükleme başarısız",  // TODO: translate
  'profile.voicebiorecorder.006': "Sesli tanıtım kaldırıldı",  // TODO: translate
  'quickcreatesheet.001': "Hızlı Aç",  // TODO: translate
  'quickcreatesheet.002': "Varsayılanlarla hemen yayına başla",  // TODO: translate
  'quickcreatesheet.003': "Detaylı Ayarla",  // TODO: translate
  'quickcreatesheet.004': "Tema, izin, planlama — tüm seçenekleri elden tut",  // TODO: translate
  'reportmodal.001': "Taciz / Zorbalık",  // TODO: translate
  'reportmodal.002': "Nefret Söylemi",  // TODO: translate
  'reportmodal.003': "Uygunsuz İçerik",  // TODO: translate
  'reportmodal.004': "Kimliğe Bürünme",  // TODO: translate
  'reportmodal.005': "Şiddet",  // TODO: translate
  'reportmodal.006': "Yaş Altı Kullanıcı",  // TODO: translate
  'reportmodal.007': "Other",  // translated
  'reportmodal.008': "Bir sebep seçin",  // TODO: translate
  'reportmodal.009': "Raporun alındı",  // TODO: translate
  'reportmodal.010': "En kısa sürede incelenecektir.",  // TODO: translate
  'reportmodal.011': "Rapor Gönderilemedi",  // TODO: translate
  'room.connectionqualityindicator.001': "Mükemmel",  // TODO: translate
  'room.connectionqualityindicator.002': "Good",  // translated
  'room.connectionqualityindicator.003': "Weak",  // translated
  'room.glowstyles.001': "KALP ATIŞI",  // TODO: translate
  'room.glowstyles.002': "ATEŞ",  // TODO: translate
  'room.glowstyles.003': "GALAKSİ",  // TODO: translate
  'room.hostaccesspanel.001': "✅ Ban Kaldırıldı",  // TODO: translate
  'room.hostaccesspanel.002': "Ban Kaldırılamadı",  // TODO: translate
  'room.hostaccesspanel.003': "📨 Davet Gönderildi",  // TODO: translate
  'room.hostaccesspanel.004': "Davet Gönderilemedi",  // TODO: translate
  'room.hostaccesspanel.005': "İstekler",  // TODO: translate
  'room.hostaccesspanel.006': "Banlılar",  // TODO: translate
  'room.inroomuserprofile.001': "Bu kullanıcıyı engelledin. Profil içeriği gizli.",  // TODO: translate
  'room.inroomuserprofile.002': "Hata oluştu",  // TODO: translate
  'room.inroomuserprofile.003': "Profil linki kopyalandı",  // TODO: translate
  'room.inroomuserprofile.004': "Profil linki kopyalandı",  // TODO: translate
  'room.inroomuserprofile.005': "Kopyalanamadı",  // TODO: translate
  'room.inroomuserprofile.006': "Davet gönderildi",  // TODO: translate
  'room.inroomuserprofile.007': "Davet gönderilemedi",  // TODO: translate
  'room.inroomuserprofile.008': "Kullanıcı engellendi",  // TODO: translate
  'room.inroomuserprofile.009': "Sahneden İndir",  // TODO: translate
  'room.inroomuserprofile.010': "Sahneden İn",  // TODO: translate
  'room.inroomuserprofile.011': "Sesi Aç",  // TODO: translate
  'room.inroomuserprofile.012': "Odadan Çıkar",  // TODO: translate
  'room.inroomuserprofile.013': "Geçici Ban",  // TODO: translate
  'room.inroomuserprofile.014': "Kalıcı Ban",  // TODO: translate
  'room.moderationoverlay.001': "Susturma Kaldırıldı",  // TODO: translate
  'room.moderationoverlay.002': "Metin Açıldı",  // TODO: translate
  'room.moderationoverlay.003': "Odadan Çıkarıldın",  // TODO: translate
  'room.moderationoverlay.004': "Yasaklandın",  // TODO: translate
  'room.moderationoverlay.005': "Kalıcı Yasaklandın",  // TODO: translate
  'room.moderationoverlay.006': "Sahneden İndirildin",  // TODO: translate
  'room.moderationoverlay.007': "Sahneye Alındın!",  // TODO: translate
  'room.moderationoverlay.008': "Moderatör Yapıldın!",  // TODO: translate
  'room.moderationoverlay.009': "Moderatörlük Kaldırıldı",  // TODO: translate
  'room.moderationoverlay.010': "Tümü Susturuldu",  // TODO: translate
  'room.powerupssheet.001': "Süre Uzat",  // TODO: translate
  'room.powerupssheet.002': "Odanın süresini +30 dk uzatır",  // TODO: translate
  'room.powerupssheet.003': "Sahne Işığı",  // TODO: translate
  'room.powerupssheet.004': "10 dk avatarın etrafında glow",  // TODO: translate
  'room.powerupssheet.005': "Yakında",  // TODO: translate
  'room.powerupssheet.006': "Bu güçlendiriciyi sadece oda sahibi kullanabilir.",  // TODO: translate
  'room.powerupssheet.007': "Yapılamadı",  // TODO: translate
  'room.powerupssheet.008': "Oda süresi uzatıldı.",  // TODO: translate
  'room.powerupssheet.009': "Yapılamadı",  // TODO: translate
  'room.powerupssheet.010': "Sonraki 5 mesajın altın çerçeveli.",  // TODO: translate
  'room.powerupssheet.011': "Yapılamadı",  // TODO: translate
  'room.powerupssheet.012': "🔦 Sahne Işığı açıldı",  // TODO: translate
  'room.powerupssheet.013': "10 dk boyunca avatarın parlak.",  // TODO: translate
  'room.roomclosedscreen.001': "Bu oda kapanmış",  // TODO: translate
  'room.roomclosedscreen.002': "Oda sahibi odayı kapattı. Yeni bir oda bulup katılabilirsin.",  // TODO: translate
  'room.roomclosedscreen.003': "Oda süresi dolmuş",  // TODO: translate
  'room.roomclosedscreen.004': "Bu odanın süresi sona erdi. Üyeliğini yükselterek daha uzun süreli odalar açabilirsin.",  // TODO: translate
  'room.roomclosedscreen.005': "Davet süresi geçmiş",  // TODO: translate
  'room.roomclosedscreen.006': "Bu odaya davet edilme sürenin dolmuş. Oda sahibi seni tekrar davet ederse yeniden katılabilirsin.",  // TODO: translate
  'room.roomclosedscreen.007': "Bu odaya erişimin yok",  // TODO: translate
  'room.roomclosedscreen.008': "Oda sahibi/moderatörler tarafından bu odadan engellendin.",  // TODO: translate
  'room.roomclosedscreen.009': "Oda bulunamadı",  // TODO: translate
  'room.roomclosedscreen.010': "Bu oda artık mevcut değil ya da silinmiş olabilir.",  // TODO: translate
  'room.roomclosedscreen.011': "Oda sahibi yeni katılımcı kabulünü geçici olarak durdurdu. Birazdan tekrar dene.",  // TODO: translate
  'room.roomclosedscreen.012': "Yaş sınırı var",  // TODO: translate
  'room.roomclosedscreen.013': "Bu odaya katılmak için belirlenen yaşın üzerinde olmalısın.",  // TODO: translate
  'room.roomclosedscreen.014': "Arkadaşlara özel",  // TODO: translate
  'room.roomclosedscreen.015': "Bu oda yalnızca oda sahibinin arkadaşlarına açık. Arkadaş eklenirsen tekrar dene.",  // TODO: translate
  'room.roomclosedscreen.016': "Bağlantı kurulamadı",  // TODO: translate
  'room.roomclosedscreen.017': "Sunucuya ulaşılamıyor. İnternetini kontrol edip tekrar dene.",  // TODO: translate
  'room.roomcontrolbar.001': "Sahneye çık (serbest mod)",  // TODO: translate
  'room.roomcontrolbar.002': "Sahne kilitli — sadece oda sahibi konuşmacı seçer",  // TODO: translate
  'room.roomcontrolbar.003': "El kaldır (sahne talebi gönder)",  // TODO: translate
  'room.roomcontrolbar.004': "🔇 Sessize alındınız",  // TODO: translate
  'room.roomcontrolbar.005': "Moderatör tarafından sustruldunuz.",  // TODO: translate
  'room.roomcontrolbar.006': "Sahneye geri dön",  // TODO: translate
  'room.roomcontrolbar.007': "Sahneye geri dön",  // TODO: translate
  'room.roomcontrolbar.008': "Hediye gönder",  // TODO: translate
  'room.roomcontrolbar.009': "Daha fazla seçenek",  // TODO: translate
  'room.roomentryeffectoverlay.001': "Sonsuz Burç",  // TODO: translate
  'room.roomentryeffectoverlay.002': "Kadim Altın",  // TODO: translate
  'room.roomentryeffectoverlay.003': "Yıldırımın Sesi",  // TODO: translate
  'room.roomentryeffectoverlay.004': "Zarif Çağ",  // TODO: translate
  'room.roomentryeffectoverlay.005': "Altın Hükmü",  // TODO: translate
  'room.roomentryeffectoverlay.006': "Anka Kuşu",  // TODO: translate
  'room.roomgiftpanel.001': "Hediyeler her gönderimde SP'ni düşürür · Alıcı %50 SP kazanır",  // TODO: translate
  'room.roomgiftpanel.002': "Hediye gönderebileceğin kullanıcı yok.",  // TODO: translate
  'room.roomgiftpanel.003': "Önce alıcı seç (üstteki avatarlardan)",  // TODO: translate
  'room.roomgiftpanel.004': "Kendine hediye gönderemezsin — sahneden başka birini seç.",  // TODO: translate
  'room.roomgiftpanel.005': "Gönderilemedi",  // TODO: translate
  'room.roominfoheader.001': "🔞 Yaş Sınırı",  // TODO: translate
  'room.roominfoheader.002': "Bu odaya yalnızca 18 yaş üzeri kullanıcılar girebilir.",  // TODO: translate
  'room.roominfoheader.003': "🔒 Şifreli Oda",  // TODO: translate
  'room.roominfoheader.004': "Bu odaya girmek için şifre bilmek gerekir.",  // TODO: translate
  'room.roominfoheader.005': "Bu odaya yalnızca oda sahibinin davet ettikleri girebilir.",  // TODO: translate
  'room.roominfoheader.006': "Oda sahibi yeni katılımcı kabulünü geçici olarak durdurdu.",  // TODO: translate
  'room.roominfoheader.007': "👥 Arkadaşlara Özel",  // TODO: translate
  'room.roominfoheader.008': "Bu oda yalnızca oda sahibinin arkadaşlarına açık.",  // TODO: translate
  'room.roommanagesheet.001': "Oda kilitli — kimse giremiyor. Erişim modunu değiştirmek için kilidi kapat.",  // TODO: translate
  'room.roommanagesheet.002': "Geçici host moddasın. Yalnız moderasyon ve takipçi görüntüleme açık. Oda adı, teması, ücreti gibi ayarlar yalnız asıl sahibinde.",  // TODO: translate
  'room.roommanagesheet.003': "Gün Batımı",  // TODO: translate
  'room.roommanagesheet.004': "Gül",  // TODO: translate
  'room.roommanagesheet.005': "Ayar Güncellenemedi",  // TODO: translate
  'room.roommanagesheet.006': "🔐 Şifre Gerekli",  // TODO: translate
  'room.roommanagesheet.007': "Şifreli oda için en az 1 karakter şifre yaz.",  // TODO: translate
  'room.roommanagesheet.008': "🔐 Çok Kısa",  // TODO: translate
  'room.roommanagesheet.009': "Şifre en az 3 karakter olmalı.",  // TODO: translate
  'room.roommanagesheet.010': "⏱️ Yavaş Mod Önerildi",  // TODO: translate
  'room.roommanagesheet.011': "Şifreli odada 5sn yavaş mod açıldı (spam koruması). Aşağıdan kapatabilirsin.",  // TODO: translate
  'room.roommanagesheet.012': "Erişim Değiştirilemedi",  // TODO: translate
  'room.roommanagesheet.013': "✏️ Oda Adı Güncellendi",  // TODO: translate
  'room.roommanagesheet.014': "Ad Değiştirilemedi",  // TODO: translate
  'room.roommanagesheet.015': "Oda adı güncellenemedi.",  // TODO: translate
  'room.roommanagesheet.016': "🔴 Kayıt Başladı",  // TODO: translate
  'room.roommanagesheet.017': "Tüm katılımcılar bildirildi.",  // TODO: translate
  'room.roommanagesheet.018': "Kayıt başlatılamadı",  // TODO: translate
  'room.roommanagesheet.019': "⏹ Kayıt Durduruldu",  // TODO: translate
  'room.roommanagesheet.020': "Kayıt birkaç dakika içinde işlenip listeye eklenir.",  // TODO: translate
  'room.roommanagesheet.021': "Kayıt durdurulamadı",  // TODO: translate
  'room.roommanagesheet.022': "🔴 Oda Kaydı Başlat",  // TODO: translate
  'room.roommanagesheet.023': "Bu odadaki tüm konuşmaların ses kaydı alınacak.\\n\\n",  // TODO: translate
  'room.roommanagesheet.024': "Odalarım sekmesinden tekrar aktifleştirebilirsin.",  // TODO: translate
  'room.roommanagesheet.025': "Ayar Güncellenemedi",  // TODO: translate
  'room.roommanagesheet.026': "İzin Gerekli",  // TODO: translate
  'room.roommanagesheet.027': "Arka Plan Güncellendi",  // TODO: translate
  'room.roommanagesheet.028': "Arka Plan Kaldırıldı",  // TODO: translate
  'room.roommanagesheet.029': "Ayar Güncellenemedi",  // TODO: translate
  'room.roommanagesheet.030': "Banner Yüklendi",  // TODO: translate
  'room.roommanagesheet.031': "Banner Kaldırıldı",  // TODO: translate
  'room.roommanagesheet.032': "Ayar Güncellenemedi",  // TODO: translate
  'room.roommanagesheet.033': "Plus Üyelik Gerekli",  // TODO: translate
  'room.roommanagesheet.034': "Erişim modunu değiştirmek için önce kilidi kapat.",  // TODO: translate
  'room.roommanagesheet.035': "Password Too Short",  // translated
  'room.roommanagesheet.036': "En az 4 karakter olmalı.",  // TODO: translate
  'room.roommanagesheet.037': "Password Too Short",  // translated
  'room.roommanagesheet.038': "En az 4 karakter olmalı.",  // TODO: translate
  'room.roommanagesheet.039': "Pro+ ile açılır",  // TODO: translate
  'room.roommanagesheet.040': "Ban Kaldırıldı",  // TODO: translate
  'room.roommanagesheet.041': "Ban Kaldırılamadı",  // TODO: translate
  'room.roommanagesheet.042': "Susturma Kalkmadı",  // TODO: translate
  'room.roommanagesheet.043': "Kullanıcının susturması kaldırılamadı.",  // TODO: translate
  'room.roommanagesheet.044': "Oda İsmi",  // TODO: translate
  'room.roommanagesheet.045': "Hoş Geldin Mesajı",  // TODO: translate
  'room.roommanagesheet.046': "Oda Kuralları",  // TODO: translate
  'room.roommanagesheet.047': "Kayıtları Dinle",  // TODO: translate
  'room.roommanagesheet.048': "Geçmiş oda kayıtlarını dinle",  // TODO: translate
  'room.roommanagesheet.049': "Oda Şifresi",  // TODO: translate
  'room.roommanagesheet.050': "Sahne Düzeni (Kaç kişi konuşabilir)",  // TODO: translate
  'room.roommanagesheet.051': "Chat mesaj aralığını sınırla",  // TODO: translate
  'room.roommanagesheet.052': "Yaş Filtresi (+18)",  // TODO: translate
  'room.roommanagesheet.053': "Tümünü Sustur (Cooldown ile)",  // TODO: translate
  'room.roommanagesheet.054': "Gelişmiş Ban Seçenekleri",  // TODO: translate
  'room.roommanagesheet.055': "Oda Teması",  // TODO: translate
  'room.roommanagesheet.056': "Kart Görseli",  // TODO: translate
  'room.roommanagesheet.057': "Oda Müzik Linki",  // TODO: translate
  'room.roommanagesheet.058': "Dinleyicilerden SP bağışı kabul et",  // TODO: translate
  'room.roommanagesheet.059': "Bağış (Tip) Aç/Kapat",  // TODO: translate
  'room.roommanagesheet.060': "SP cinsinden oda giriş ücreti",  // TODO: translate
  'room.roommanagesheet.061': "Giriş Ücreti Belirleme (SP)",  // TODO: translate
  'room.roomoverlays.001': "İzinli",  // TODO: translate
  'room.roomoverlays.002': "Seçili",  // TODO: translate
  'room.roomoverlays.003': "Gün Batımı",  // TODO: translate
  'room.roomoverlays.004': "Gül",  // TODO: translate
  'room.roomoverlays.005': "Open",  // translated
  'room.roomoverlays.006': "Şifreli",  // TODO: translate
  'room.roomoverlays.007': "✅ Ban Kaldırıldı",  // TODO: translate
  'room.roomoverlays.008': "Ban Kaldırılamadı",  // TODO: translate
  'room.roomoverlays.009': "Bu kullanıcının banı kaldırılamadı.",  // TODO: translate
  'room.roomoverlays.010': "Konuşma",  // TODO: translate
  'room.roomoverlays.011': "Music",  // translated
  'room.roomoverlays.012': "Katılım İstekleri",  // TODO: translate
  'room.roomoverlays.013': "Katılım İstekleri",  // TODO: translate
  'room.roomoverlays.014': "Oda Linkini Paylaş",  // TODO: translate
  'room.roomoverlays.015': "İstatistikler & Boost",  // TODO: translate
  'room.roomoverlays.016': "Keşfette Öne Çıkar",  // TODO: translate
  'room.roomoverlays.017': "Güçlendiriciler",  // TODO: translate
  'room.roomoverlays.018': "SP harca, an\\'ı taçlandır",  // TODO: translate
  'room.roomoverlays.019': "Odayı Bildir",  // TODO: translate
  'room.roomoverlays.020': "Bağış Yap",  // TODO: translate
  'room.roomoverlays.021': "Host\\'a SP bağışla",  // TODO: translate
  'room.roomoverlays.022': "Mesajları Temizle",  // TODO: translate
  'room.roomoverlays.023': "Sohbet anında silinir, herkesin ekranı tazelenir",  // TODO: translate
  'room.roomoverlays.024': "Odadan Ayrıl",  // TODO: translate
  'room.roomoverlays.025': "Oda Adı",  // TODO: translate
  'room.roomoverlays.026': "Açıklama",  // TODO: translate
  'room.roomoverlays.027': "Hoş Geldin",  // TODO: translate
  'room.roomoverlays.028': "Şifre",  // TODO: translate
  'room.roomoverlays.029': "Odayı Kilitle (yeni giriş yok)",  // TODO: translate
  'room.roomoverlays.030': "+18 İçerik",  // TODO: translate
  'room.roomoverlays.031': "Sadece Arkadaşlar",  // TODO: translate
  'room.roomoverlays.032': "Konuşma Modu",  // TODO: translate
  'room.roomoverlays.033': "Gürültü Engelleme",  // TODO: translate
  'room.roomoverlays.034': "Giriş Ücreti (SP)",  // TODO: translate
  'room.roomoverlays.035': "Bağış Kabul Et",  // TODO: translate
  'room.roomoverlays.036': "Müzik Linki",  // TODO: translate
  'room.roomrecordingssheet.001': "Oda yönetim panelinden \"Kaydı Başlat\" ile sesli sohbeti kaydedin.",  // TODO: translate
  'room.roomrecordingssheet.002': "Kaydı Oynatılamadı",  // TODO: translate
  'room.roomstatspanel.001': "Anlık katılımcı",  // TODO: translate
  'room.roomstatspanel.002': "Benzersiz katılımcı",  // TODO: translate
  'room.roomstatspanel.003': "En yüksek eşzamanlı",  // TODO: translate
  'room.roomstatspanel.004': "Ortalama süre",  // TODO: translate
  'room.roomstatspanel.005': "Süre",  // TODO: translate
  'room.roomstatspanel.006': "Oda açık süresi",  // TODO: translate
  'room.roomstatspanel.007': "Takipçi",  // TODO: translate
  'room.roomstatspanel.008': "Oda takipçisi",  // TODO: translate
  'room.stagesupportsheet.001': "Destek gönderilemedi",  // TODO: translate
  'room.stagesupportsheet.002': "Destek gönderilemedi",  // TODO: translate
  'roomboostsheet.001': "Hızlı Boost",  // TODO: translate
  'roominfoheader.live': "LIVE",
  'sessionconflictmodal.003': "This account was just used on another device. The same account can't be active in two places.",
  'sessionconflictmodal.004': "Continue On This Device",
  'sessionconflictmodal.005': "If you tap \"Continue\", the other device will be signed out.",
};
export default en;
