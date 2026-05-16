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
  'auth.onboarding.001': "Sesli sohbet dünyasına katıl. Fotoğrafını ve ismini ayarla.",  // TODO: translate
  'auth.onboarding.002': "İsim veya lakap",  // TODO: translate
  'auth.onboarding.003': "Bu bilgiler profilinde gösterilmez, güvenlik ve öneri amaçlıdır.",  // TODO: translate
  'auth.onboarding.004': "Nelerden hoşlanırsın? 🎯",  // TODO: translate
  'auth.onboarding.005': "Seçimlerine göre sana özel odalar önereceğiz.",  // TODO: translate
  'auth.onboarding.006': "Profilin hazır! 🎉",  // TODO: translate
  'auth.onboarding.007': "Bir arkadaşının davet kodu varsa girerek 50 SP kazan.",  // TODO: translate
  'auth.onboarding.008': "Nasıl çağıralım?",  // TODO: translate
  'auth.onboarding.009': "Örn: 2000 (zorunlu)",  // TODO: translate
  'auth.onboarding.010': "KODU GİR",  // TODO: translate
  'tabs.home.001': "Seçili filtrelere uyan oda yok. Filtreleri değiştirmeyi dene.",  // TODO: translate
  'tabs.myrooms.001': "Sesli sohbet, müzik, oyun ve daha fazlası...",  // TODO: translate
  'tabs.profile.001': "Bir arkadaşın kodunu kullanırsa, ikiniz de 50 SP kazanırsınız.",  // TODO: translate
  'tabs.profile.002': "Örn: XHFDK9",  // TODO: translate
  'admin.001': "Erişim Reddedildi",  // TODO: translate
  'admin.002': "Bu sayfaya erişim yetkiniz yok.",  // TODO: translate
  'admin.003': "Geri Dön",  // TODO: translate
  'admin.004': "GodMaster yükleniyor...",  // TODO: translate
  'admin.005': "Platform Yönetimi",  // TODO: translate
  'admin.006': "Hızlı Aksiyonlar",  // TODO: translate
  'admin.007': "Bekleyen şikayet yok",  // TODO: translate
  'admin.008': "Yeni Oda Oluştur",  // TODO: translate
  'admin.009': "Tüm Odalar",  // TODO: translate
  'admin.010': "Bitiş",  // TODO: translate
  'admin.011': "Tier Değiştir",  // TODO: translate
  'admin.012': "Kalıcı Sil",  // TODO: translate
  'auth.resetpassword.001': "Bağlantı doğrulanıyor...",  // TODO: translate
  'auth.resetpassword.002': "Bağlantı Geçersiz",  // TODO: translate
  'auth.resetpassword.003': "Giriş Ekranına Dön",  // TODO: translate
  'auth.resetpassword.004': "Şifreni Sıfırla",  // TODO: translate
  'auth.resetpassword.005': "Hesabın için yeni bir şifre belirle",  // TODO: translate
  'auth.resetpassword.006': "Şifre kuralları:",  // TODO: translate
  'auth.resetpassword.007': "1 büyük harf",  // TODO: translate
  'auth.resetpassword.008': "Şifreyi Değiştir",  // TODO: translate
  'auth.resetpassword.009': "İptal et",  // TODO: translate
  'auth.resetpassword.010': "Yeni şifre",  // TODO: translate
  'auth.resetpassword.011': "Şifre (Tekrar)",  // TODO: translate
  'call.id.001': "Yeniden bağlanılıyor...",  // TODO: translate
  'call.id.002': "Otomatik kapanıyor...",  // TODO: translate
  'chat.id.001': "düzenlendi",  // TODO: translate
  'chat.id.002': "yazıyor",  // TODO: translate
  'chat.id.003': "📨 Mesaj isteği",  // TODO: translate
  'chat.id.004': "📨 Mesaj İsteği",  // TODO: translate
  'chat.id.005': "⏳ İstek gönderildi",  // TODO: translate
  'chat.id.006': "Yazıyor...",  // TODO: translate
  'chat.id.007': "Henüz mesaj yok. İlk mesajı sen yaz!",  // TODO: translate
  'createroom.001': "ETİKETLER (opsiyonel)",  // TODO: translate
  'createroom.002': "Şifre (min 4 karakter)",  // TODO: translate
  'createroom.003': "Yavaş mod",  // TODO: translate
  'createroom.004': "Hoş geldin mesajı",  // TODO: translate
  'createroom.005': "Oda kuralları",  // TODO: translate
  'createroom.006': "Kart görseli (opsiyonel)",  // TODO: translate
  'createroom.007': "Keşfet akışında oda kartında görünür · 16:9 yatay",  // TODO: translate
  'createroom.008': "Keşfet'te görünecek",  // TODO: translate
  'createroom.009': "Oda içi arka plan (opsiyonel · Plus)",  // TODO: translate
  'createroom.010': "Oda içinde dikey arka plan · 9:16 portrait",  // TODO: translate
  'createroom.011': "Oda teması (opsiyonel)",  // TODO: translate
  'createroom.012': "Oda müzik linki (Pro)",  // TODO: translate
  'createroom.013': "Pro üyelik gerekli",  // TODO: translate
  'createroom.014': "Giriş ücreti (SP)",  // TODO: translate
  'createroom.015': "Odaya girmek için SP ödensin mi?",  // TODO: translate
  'createroom.016': "Bağış aktif",  // TODO: translate
  'createroom.017': "Dinleyiciler sana SP bağışlayabilir",  // TODO: translate
  'createroom.018': "+18 İçerik",  // TODO: translate
  'createroom.019': "Yetişkinlere özel oda — 18 yaş altı giremez",  // TODO: translate
  'createroom.020': "Oda içi arka plan",  // TODO: translate
  'createroom.021': "Ne Zaman Başlasın?",  // TODO: translate
  'createroom.022': "Üyeliğimi Yükselt",  // TODO: translate
  'createroom.023': "Geri Dön",  // TODO: translate
  'createroom.024': "Odayı Aç",  // TODO: translate
  'editprofile.001': "Bu kullanıcı adı zaten alınmış.",  // TODO: translate
  'editprofile.002': "Müsait ✓",  // TODO: translate
  'editprofile.003': "Sadece küçük harfler, rakamlar ve alt çizgi",  // TODO: translate
  'editprofile.004': "Diller & İlgi Alanları",  // TODO: translate
  'editprofile.005': "Yabancılar odalarını göremez (arkadaşların görür)",  // TODO: translate
  'editprofile.006': "Adınız",  // TODO: translate
  'editprofile.007': "Mevcut şifreniz",  // TODO: translate
  'editprofile.008': "Yeni şifrenizi tekrar girin",  // TODO: translate
  'hiddenrooms.001': "Tümünü Geri Getir",  // TODO: translate
  'hiddenrooms.002': "Hiç gizlenmiş oda yok",  // TODO: translate
  'hiddenrooms.003': "Keşfette bir oda kartını sola kaydırıp \"Gizle\" diyerek bu listeye ekleyebilirsin.",  // TODO: translate
  'hiddenrooms.004': "Oda detayları yüklenemedi.",  // TODO: translate
  'leaderboard.001': "Sıralama yükleniyor...",  // TODO: translate
  'leaderboard.002': "Haftalık SP Ligi",  // TODO: translate
  'leaderboard.003': "Bu hafta henüz bağış yok",  // TODO: translate
  'leaderboard.004': "Bu hafta kazanım verisi yok",  // TODO: translate
  'leaderboard.005': "Bu hafta oda açılmamış",  // TODO: translate
  'leaderboard.006': "Henüz SP verisi yok",  // TODO: translate
  'leaderboard.007': "Henüz takipçi verisi yok",  // TODO: translate
  'leaderboard.008': "Henüz oda verisi yok",  // TODO: translate
  'leaderboard.009': "Henüz aktivite verisi yok",  // TODO: translate
  'leaderboard.010': "Henüz hediye veren yok — ilk sen ol!",  // TODO: translate
  'plus.001': "Üyelik Planları",  // TODO: translate
  'plus.002': "Mevcut planın:",  // TODO: translate
  'plus.003': "Aylık",  // TODO: translate
  'plus.004': "Yıllık",  // TODO: translate
  'plus.005': "EN İYİ",  // TODO: translate
  'plus.006': "Plan Karşılaştırması",  // TODO: translate
  'plus.007': "Açtığın oda 24 saat sonra otomatik kapanır — kullansan da kullanmasan da.",  // TODO: translate
  'plus.008': "Her odan 12 saat aktif kalır. Süre dolunca silinmez — 3 odanı dondurup istediğinde tekrar açarsın.",  // TODO: translate
  'plus.009': "Odaların 7/24 açık kalır. Kapanmaz, dondurulmaz — istediğin sayıda kalıcı oda kurabilirsin.",  // TODO: translate
  'plus.010': "Planı İptal Et / Free'ye Dön",  // TODO: translate
  'room.id.001': "düzenlendi",  // TODO: translate
  'room.id.002': "Oda sahibi ve moderatör ayrıldı.",  // TODO: translate
  'skiatest.001': "Her sıra: solda mevcut RN yaklaşımı, sağda Skia primitive. Aynı görünmeli.",  // TODO: translate
  'skiatest.002': "Skia native modül APK'da yok",  // TODO: translate
  'skiatest.003': "Sağ taraftaki Skia çıktıları şu an fallback (sade View) gösteriyor. APK'yı Skia ile rebuild ettikten sonra gerçek Skia render'ı çalışacak.",  // TODO: translate
  'spstore.001': "SP Mağaza",  // TODO: translate
  'spstore.002': "POPÜLER",  // TODO: translate
  'store.collection.id.001': "Bu koleksiyonda henüz ürün yok",  // TODO: translate
  'store.001': "CANLI · YENİ KOLEKSİYON",  // TODO: translate
  'store.002': "KEŞFET",  // TODO: translate
  'store.003': "Set Fırsatları",  // TODO: translate
  'store.004': "Birlikte daha ucuz · Tema set + büyük indirim",  // TODO: translate
  'store.005': "Avatar Çerçeveleri",  // TODO: translate
  'store.006': "Profilini özelleştir · Tarzını yansıt",  // TODO: translate
  'store.007': "Giriş Efektleri",  // TODO: translate
  'store.008': "Odaya girdiğinde herkes görsün · Şıklığını göster",  // TODO: translate
  'store.009': "Mesajlarına parıltı kat · Sohbette öne çık",  // TODO: translate
  'store.010': "Özel Rozetler",  // TODO: translate
  'store.011': "Profilinde ayrıcalık · Statünü göster",  // TODO: translate
  'store.012': "Uygulama Arkaplanları",  // TODO: translate
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
  'blockeduserssheet.001': "Engellenen Kullanıcılar",  // TODO: translate
  'blockeduserssheet.002': "Hiç engellediğin kullanıcı yok.",  // TODO: translate
  'blockeduserssheet.003': "Kaldır",  // TODO: translate
  'boostpickersheet.001': "Profili Öne Çıkar",  // TODO: translate
  'boostpickersheet.002': "Profilin ve odaların Keşfet'te öne çıkar. Tıklayan kullanıcılar odalarına ulaşır.",  // TODO: translate
  'boostpickersheet.003': "Boost Başlat",  // TODO: translate
  'createroomcoachmark.001': "+ Yeni Oda Oluştur",  // TODO: translate
  'discoverwelcomesheet.001': "Geç",  // TODO: translate
  'discoverwelcomesheet.002': "Geri Dön",  // TODO: translate
  'fabhintoverlay.001': "İpucu",  // TODO: translate
  'fabhintoverlay.002': "Anladım — dokun",  // TODO: translate
  'followlistmodal.001': "Çıkar",  // TODO: translate
  'followlistmodal.002': "Takipten Çık",  // TODO: translate
  'incomingcalloverlay.001': "Arıyor...",  // TODO: translate
  'profile.badgelistmodal.001': "Henüz rozet kazanmamış",  // TODO: translate
  'profile.badgelistmodal.002': "Oda kur, arkadaş edin, SP gönder — rozetler otomatik gelir.",  // TODO: translate
  'profile.bioeditorsheet.001': "Vazgeç",  // TODO: translate
  'profile.bioeditorsheet.002': "Örn: Müzik, kahve ve kod ☕",  // TODO: translate
  'profile.featuredbadgespicker.001': "ÖNE ÇIKAN ROZETLER",  // TODO: translate
  'profile.featuredbadgespicker.002': "Yükleniyor...",  // TODO: translate
  'profile.featuredbadgespicker.003': "Henüz rozetin yok",  // TODO: translate
  'profile.featuredbadgespicker.004': "Aktif kullanım, sahne, bağış ile rozet kazan",  // TODO: translate
  'profile.giftdetailmodal.001': "ALDIĞI HEDİYELER",  // TODO: translate
  'profile.giftdetailmodal.002': "VERDİĞİ HEDİYELER",  // TODO: translate
  'profile.giftsheet.001': "HEDİYE GÖNDER",  // TODO: translate
  'profile.giftsheet.002': "Kısa bir mesaj ekle (isteğe bağlı)",  // TODO: translate
  'profile.giftshowcase.001': "· son 30 gün",  // TODO: translate
  'profile.giftshowcase.002': "· son 30 gün",  // TODO: translate
  'profile.languageinterestpicker.001': "KİMLİĞİN",  // TODO: translate
  'profile.personalnotecard.001': "Bu kişi hakkında özel not bırak (sadece sen görürsün)",  // TODO: translate
  'profile.sociallinkseditor.001': "SOSYAL LİNKLER",  // TODO: translate
  'profile.spdonatesheet.001': "SP BAĞIŞLA",  // TODO: translate
  'profile.spdonatesheet.002': "adlı kullanıcıya",  // TODO: translate
  'profile.sphistorysheet.001': "SP GEÇMİŞİM",  // TODO: translate
  'profile.sphistorysheet.002': "Son 30 işlem · Canlı",  // TODO: translate
  'profile.sphistorysheet.003': "Güncel Bakiye",  // TODO: translate
  'profile.sphistorysheet.004': "Henüz işlem yok",  // TODO: translate
  'profile.sphistorysheet.005': "Oda aç, sahneye çık — kazanmaya başla",  // TODO: translate
  'profile.spreceivedmodal.001': "Gönderen",  // TODO: translate
  'profile.spreceivedmodal.002': "Ücretsiz teşekkür et:",  // TODO: translate
  'profile.spsentsuccessmodal.001': "'a hediye gönderdin",  // TODO: translate
  'profile.symbolgiftsheet.001': "SEMBOL HEDİYE",  // TODO: translate
  'profile.symbolgiftsheet.002': "Hediye katalogu yüklenemedi",  // TODO: translate
  'profile.thankyoureceivedmodal.001': "🙏 TEŞEKKÜR ALDIN!",  // TODO: translate
  'profile.thankyoureceivedmodal.002': "sana teşekkür etti",  // TODO: translate
  'profile.tieredprofilesections.001': "PREMİUM ÖZELLİKLER (Önizleme)",  // TODO: translate
  'profile.tieredprofilesections.002': "Destekle (SP Gönder)",  // TODO: translate
  'profile.tieredprofilesections.003': "👑 Pro İstatistikler",  // TODO: translate
  'profile.tieredprofilesections.004': "💰 Gelir Özeti",  // TODO: translate
  'profile.voicebiorecorder.001': "SESLİ TANITIM",  // TODO: translate
  'profile.voicebiorecorder.002': "Kaydı Başlat",  // TODO: translate
  'profile.voicebiorecorder.003': "Mevcut tanıtımı kaldır",  // TODO: translate
  'profile.voicebiorecorder.004': "Kayıt sürüyor — bitirmek için bas",  // TODO: translate
  'profile.voicebiorecorder.005': "Yükleniyor...",  // TODO: translate
  'profile.welcomebonusmodal.001': "Keşfetmeye Başla",  // TODO: translate
  'quickcreatesheet.001': "Yeni Oda Aç",  // TODO: translate
  'reportmodal.001': "RAPORLAMA SEBEBİ",  // TODO: translate
  'reportmodal.002': "EK AÇIKLAMA (İSTEĞE BAĞLI)",  // TODO: translate
  'reportmodal.003': "Rapor Gönder",  // TODO: translate
  'reportmodal.004': "Detayları kısaca yaz...",  // TODO: translate
  'room.camerafullscreenmodal.001': "Kamera yayını bekleniyor…",  // TODO: translate
  'room.camerafullscreenmodal.002': "Aşağı kaydır ya da ✕ ile kapat",  // TODO: translate
  'room.entryfeecard.001': "ODA BİLETİ",  // TODO: translate
  'room.entryfeecard.002': "GİRİŞ ÜCRETİ",  // TODO: translate
  'room.entryfeecard.003': "Vazgeç",  // TODO: translate
  'room.hostaccesspanel.001': "Yeni katılım istekleri burada görünecek",  // TODO: translate
  'room.hostaccesspanel.002': "Banlı kullanıcı yok",  // TODO: translate
  'room.hostaccesspanel.003': "Kaldır",  // TODO: translate
  'room.inroomuserprofile.001': "Şu an dinliyor:",  // TODO: translate
  'room.invitefriendsmodal.001': "Arkadaşlar yükleniyor...",  // TODO: translate
  'room.invitefriendsmodal.002': "Keşfet sayfasından yeni insanlar bul ve takip et!",  // TODO: translate
  'room.messageglowpickersheet.001': "Bir stil seç — bir sonraki mesajın o şekilde gönderilir",  // TODO: translate
  'room.messageglowpickersheet.002': "STANDART · MESAJ BAŞI ÜCRET",  // TODO: translate
  'room.messageglowpickersheet.003': "★ PREMIUM · KOLEKSİYON ★",  // TODO: translate
  'room.messageglowpickersheet.004': "SAHİPSİN · FREE",  // TODO: translate
  'room.powerupssheet.001': "GÜÇLENDİRİCİLER",  // TODO: translate
  'room.powerupssheet.002': "Oda içinde anlık etki — SP harca, an'ı taçlandır",  // TODO: translate
  'room.roomaccessprompts.001': "Vazgeç",  // TODO: translate
  'room.roomaccessprompts.002': "Erişim kontrol ediliyor…",  // TODO: translate
  'room.roomaccessprompts.003': "Şifreyi girin...",  // TODO: translate
  'room.roomclosedscreen.001': "Ana Sayfaya Dön",  // TODO: translate
  'room.roomdisconnectoverlay.001': "Odadan Çık",  // TODO: translate
  'room.roomentryeffectoverlay.001': "aramıza katıldı",  // TODO: translate
  'room.roomfollowerssheet.001': "ODA TAKİPÇİLERİ",  // TODO: translate
  'room.roomfollowerssheet.002': "Bu odanın henüz takipçisi yok",  // TODO: translate
  'room.roomfollowerssheet.003': "Odanın altında \"Takip Et\" tıklayanlar burada listelenir.",  // TODO: translate
  'room.roomgiftpanel.001': "HEDİYE GÖNDER",  // TODO: translate
  'room.roomgiftpanel.002': "Hediyeler yükleniyor…",  // TODO: translate
  'room.roomgiftpanel.003': "Hediye katalogu yüklenemedi",  // TODO: translate
  'room.roommanagesheet.001': "Oda dondurulur, dilediğinde tekrar aktifleştir",  // TODO: translate
  'room.roommanagesheet.002': "Oda kalıcı olarak silinir, geri alınamaz",  // TODO: translate
  'room.roommanagesheet.003': "Aç",  // TODO: translate
  'room.roommanagesheet.004': "Seç",  // TODO: translate
  'room.roommanagesheet.005': "Seç",  // TODO: translate
  'room.roommanagesheet.006': "â„ï¸ Dondurulmuş",  // TODO: translate
  'room.roommanagesheet.007': "örn. anime",  // TODO: translate
  'room.roommanagesheet.008': "Oda şifresi (min 4 karakter)...",  // TODO: translate
  'room.roomoverlays.001': "İptal",  // TODO: translate
  'room.roomoverlays.002': "Tümünü Sustur",  // TODO: translate
  'room.roomoverlays.003': "Tümünü Aç",  // TODO: translate
  'room.roomoverlays.004': "Banlı kullanıcı yok 🎉",  // TODO: translate
  'room.roomoverlays.005': "Kaldır",  // TODO: translate
  'room.roomoverlays.006': "Kart Görseli",  // TODO: translate
  'room.roomoverlays.007': "Oda Müzik Linki",  // TODO: translate
  'room.roomoverlays.008': "Arkadaşlarını Davet Et",  // TODO: translate
  'room.roomoverlays.009': "Oda Linkini Paylaş",  // TODO: translate
  'room.roomoverlays.010': "Oda Takipçileri",  // TODO: translate
  'room.roomoverlays.011': "Oda İstatistikleri",  // TODO: translate
  'room.roomoverlays.012': "Keşfette Öne Çıkar",  // TODO: translate
  'room.roomoverlays.013': "Oda adı...",  // TODO: translate
  'room.roomoverlays.014': "Odanın kısa açıklaması...",  // TODO: translate
  'room.roomoverlays.015': "Hoş geldin mesajı...",  // TODO: translate
  'room.roomoverlays.016': "Oda kuralları...",  // TODO: translate
  'room.roomrecordingssheet.001': "Oda Kayıtları",  // TODO: translate
  'room.roomrecordingssheet.002': "Henüz kayıt yok",  // TODO: translate
  'room.roomstatspanel.001': "Oda İstatistikleri",  // TODO: translate
  'room.roomstatspanel.002': "🏆 En Aktif Kullanıcılar",  // TODO: translate
  'room.speakersection.001': "Sahne boş",  // TODO: translate
  'room.stagesupportsheet.001': "SAHNEYİ DESTEKLE",  // TODO: translate
  'roomboostsheet.001': "Keşfette Öne Çıkar",  // TODO: translate
  'roomboostsheet.002': "POPÜLER",  // TODO: translate
  'roomcreatehintsheet.001': "Yeni Oda Oluştur",  // TODO: translate
  'roomcreatehintsheet.002': "Şimdi değil",  // TODO: translate
  'roomcreatehintsheet.003': "Odalarım'a Git",  // TODO: translate
  'sessionconflictmodal.001': "Hesabın başka bir cihazda açıldı",  // TODO: translate
  'sessionconflictmodal.002': "Çıkış Yap",  // TODO: translate
  'store.storeitempreviewsheet.001': "GÜNÜN FIRSATI",  // TODO: translate
  'store.storeitempreviewsheet.002': "FİYAT",  // TODO: translate
  'systemsettingsoverlay.001': "Bakım Modu",  // TODO: translate
  'systemsettingsoverlay.002': "Güncelleme Gerekli",  // TODO: translate
  'usersearchmodal.001': "Yukarıdaki arama çubuğundan tüm üyeleri arayabilirsin!",  // TODO: translate
};
export default en;
