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

  // ═══ AUTO-EXTRACTED v2 (translate me) ═══
  'auth.login.001': "E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.",  // TODO: translate
  'auth.login.002': "Zayıf",  // TODO: translate
  'auth.login.003': "İyi",  // TODO: translate
  'auth.login.004': "Güçlü",  // TODO: translate
  'auth.login.005': "E-posta ve şifre alanlarını doldurun.",  // TODO: translate
  'auth.login.006': "Geçersiz E-posta",  // TODO: translate
  'auth.login.007': "Geçerli bir e-posta adresi gir.",  // TODO: translate
  'auth.login.008': "Çok Fazla Deneme",  // TODO: translate
  'auth.login.009': "Hesap Geçici Kilitli",  // TODO: translate
  'auth.login.010': "Hesap Geçici Kilitli",  // TODO: translate
  'auth.login.011': "Giriş Başarısız",  // TODO: translate
  'auth.login.012': "E-posta veya şifre hatalı.",  // TODO: translate
  'auth.login.013': "Tüm alanları doldurun.",  // TODO: translate
  'auth.login.014': "Geçersiz E-posta",  // TODO: translate
  'auth.login.015': "Geçerli bir e-posta adresi gir.",  // TODO: translate
  'auth.login.016': "Geçersiz E-posta",  // TODO: translate
  'auth.login.017': "E-posta uzantısı geçerli değil. (.com, .net, .org gibi)",  // TODO: translate
  'auth.login.018': "Geçici E-posta Kabul Edilmiyor",  // TODO: translate
  'auth.login.019': "Mailinator/tempmail gibi geçici e-postalar kayıt için kullanılamaz. Gerçek bir e-posta gir.",  // TODO: translate
  'auth.login.020': "Şifreler Eşleşmiyor",  // TODO: translate
  'auth.login.021': "İki şifre alanı aynı olmalı.",  // TODO: translate
  'auth.login.022': "Şifre Çok Kısa",  // TODO: translate
  'auth.login.023': "En az 8 karakter olmalı.",  // TODO: translate
  'auth.login.024': "Büyük Harf Eksik",  // TODO: translate
  'auth.login.025': "Şifrede en az 1 büyük harf olmalı.",  // TODO: translate
  'auth.login.026': "Şifrede en az 1 rakam olmalı.",  // TODO: translate
  'auth.login.027': "✉️ Doğrulama E-postası Gönderildi",  // TODO: translate
  'auth.login.028': "Lütfen e-posta kutunuzu kontrol edip doğrulayın.",  // TODO: translate
  'auth.login.029': "Bu E-posta Zaten Kayıtlı",  // TODO: translate
  'auth.login.030': "Daha önce bu e-postayla kayıt olmuşsun. Giriş ekranına geçildi.",  // TODO: translate
  'auth.login.031': "Geçersiz E-posta",  // TODO: translate
  'auth.login.032': "Lütfen geçerli bir e-posta gir.",  // TODO: translate
  'auth.login.033': "Şifre Zayıf",  // TODO: translate
  'auth.login.034': "Daha güçlü bir şifre seç.",  // TODO: translate
  'auth.login.035': "Bağlantı Hatası",  // TODO: translate
  'auth.login.036': "İnternet bağlantını kontrol et.",  // TODO: translate
  'auth.login.037': "Kayıt Olunamadı",  // TODO: translate
  'auth.login.038': "Bir sorun oluştu, tekrar dene.",  // TODO: translate
  'auth.login.039': "Lütfen e-posta adresinizi yazın.",  // TODO: translate
  'auth.login.040': "Geçersiz E-posta",  // TODO: translate
  'auth.login.041': "Geçerli bir e-posta adresi gir.",  // TODO: translate
  'auth.login.042': "✉️ Mail Gönderildi",  // TODO: translate
  'auth.login.043': "Sıfırlama bağlantısı e-postana gönderildi. Spam klasörünü de kontrol et.",  // TODO: translate
  'auth.login.044': "Hesap Bulunamadı",  // TODO: translate
  'auth.login.045': "Bu e-posta ile kayıtlı bir hesap yok. Önce kayıt ol.",  // TODO: translate
  'auth.login.046': "Geçersiz E-posta",  // TODO: translate
  'auth.login.047': "Geçerli bir e-posta adresi gir.",  // TODO: translate
  'auth.login.048': "Çok Fazla Deneme",  // TODO: translate
  'auth.login.049': "Bağlantı Hatası",  // TODO: translate
  'auth.login.050': "İnternet bağlantını kontrol et.",  // TODO: translate
  'auth.login.051': "Mail gönderilemedi, tekrar dene.",  // TODO: translate
  'auth.login.052': "✉️ Gönderildi",  // TODO: translate
  'auth.login.053': "Doğrulama e-postası tekrar gönderildi.",  // TODO: translate
  'auth.login.054': "Çok Fazla İstek",  // TODO: translate
  'auth.login.055': "Birkaç dakika bekleyip tekrar dene.",  // TODO: translate
  'auth.login.056': "E-posta Gönderilemedi",  // TODO: translate
  'auth.login.057': "Doğrulama e-postası iletilemedi.",  // TODO: translate
  'auth.login.058': "✅ Doğrulandı",  // TODO: translate
  'auth.login.059': "E-postanız doğrulandı! Giriş yapılıyor...",  // TODO: translate
  'auth.login.060': "Henüz Doğrulanmadı",  // TODO: translate
  'auth.login.061': "Lütfen e-posta kutunuzu kontrol edin.",  // TODO: translate
  'auth.login.062': "Doğrulama durumu alınamadı. Tekrar dene.",  // TODO: translate
  'auth.login.063': "Şifre Sıfırlama",  // TODO: translate
  'auth.onboarding.001': "Kadın",  // TODO: translate
  'auth.onboarding.002': "Müzik",  // TODO: translate
  'auth.onboarding.003': "Onboarding tamamlanamadı — DB hatası. Tekrar deneyin.",  // TODO: translate
  'auth.onboarding.004': "Bağlantı Hatası",  // TODO: translate
  'auth.onboarding.005': "Onboarding kaydedilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.",  // TODO: translate
  'auth.onboarding.006': "Geçersiz Kod",  // TODO: translate
  'auth.onboarding.007': "Lütfen geçerli bir davet kodu gir.",  // TODO: translate
  'auth.onboarding.008': "Topluluğa hoş geldin! Hesabına 50 SP yüklendi.",  // TODO: translate
  'auth.onboarding.009': "📸 Fotoğraf Yüklendi",  // TODO: translate
  'auth.onboarding.010': "Profil fotoğrafın hazır!",  // TODO: translate
  'auth.onboarding.011': "İsim Gerekli",  // TODO: translate
  'auth.onboarding.012': "İsim Çok Kısa",  // TODO: translate
  'auth.onboarding.013': "En az 2 karakter olmalı.",  // TODO: translate
  'auth.onboarding.014': "Uygunsuz İsim",  // TODO: translate
  'auth.onboarding.015': "Lütfen uygun bir isim seçin.",  // TODO: translate
  'auth.onboarding.016': "Geçersiz Karakter",  // TODO: translate
  'auth.onboarding.017': "İsim görünür karakterler içermeli.",  // TODO: translate
  'auth.onboarding.018': "Çok Fazla Emoji",  // TODO: translate
  'auth.onboarding.019': "Profil Oluşturulamadı",  // TODO: translate
  'auth.onboarding.020': "Lütfen doğum yılınızı girin.",  // TODO: translate
  'auth.onboarding.021': "Yaş Sınırı",  // TODO: translate
  'auth.onboarding.022': "SopranoChat kullanımı için 13 yaşında olmalısın.",  // TODO: translate
  'auth.onboarding.023': "Uyarı",  // TODO: translate
  'auth.onboarding.024': "Bilgiler kaydedilemedi, daha sonra güncelleyebilirsin.",  // TODO: translate
  'auth.onboarding.025': "Seçim Yap",  // TODO: translate
  'auth.onboarding.026': "En az 1 ilgi alanı seç",  // TODO: translate
  'auth.onboarding.027': "İlgi alanları yazılamadı. İnternet / DB sorunu olabilir.",  // TODO: translate
  'auth.onboarding.028': "Vazgeçmek istiyor musun?",  // TODO: translate
  'auth.onboarding.029': "Şu ana kadar girdiğin bilgiler kaydedilmeyecek ve oturum kapanacak.",  // TODO: translate
  'tabs.home.001': "✨ Öne Çıkan Profil",  // TODO: translate
  'tabs.home.002': "Zaten bir odadasın",  // TODO: translate
  'tabs.home.003': "Önce mevcut odadan çık.",  // TODO: translate
  'tabs.home.004': "Günlük Limit Doldu",  // TODO: translate
  'tabs.home.005': "Oda Açılamadı",  // TODO: translate
  'tabs.home.006': "Odalar yüklenemedi",  // TODO: translate
  'tabs.home.007': "Giriş Gerekli",  // TODO: translate
  'tabs.home.008': "Odaya katılmak için giriş yapmalısınız.",  // TODO: translate
  'tabs.home.009': "Takip Güncellenmedi",  // TODO: translate
  'tabs.home.010': "Giriş Gerekli",  // TODO: translate
  'tabs.home.011': "Şikayet için giriş yapmalısın.",  // TODO: translate
  'tabs.messages.001': "Mesajlaşmak istiyor — dokun ve cevap ver",  // TODO: translate
  'tabs.messages.002': "Mesajlar yüklenemedi",  // TODO: translate
  'tabs.messages.003': "Arama Hatası",  // TODO: translate
  'tabs.messages.004': "Sabitleme Güncellenmedi",  // TODO: translate
  'tabs.messages.005': "Sohbet sabitleme durumu değişemedi.",  // TODO: translate
  'tabs.messages.006': "Arşiv Güncellenmedi",  // TODO: translate
  'tabs.messages.007': "Sohbet arşiv durumu değişemedi.",  // TODO: translate
  'tabs.messages.008': "Sessize Alma Başarısız",  // TODO: translate
  'tabs.messages.009': "🚫 İstek reddedildi",  // TODO: translate
  'tabs.messages.010': "İstek yok",  // TODO: translate
  'tabs.messages.011': "Bekleyen mesaj isteğin yok.",  // TODO: translate
  'tabs.messages.012': "Arşiv boş",  // TODO: translate
  'tabs.messages.013': "Henüz arşivlenmiş sohbetin yok.",  // TODO: translate
  'tabs.messages.014': "Seçili sohbetler kalıcı olarak silinecek.",  // TODO: translate
  'tabs.messages.015': "Kısmen silindi",  // TODO: translate
  'tabs.myrooms.001': "Müzik",  // TODO: translate
  'tabs.myrooms.002': "Özel",  // TODO: translate
  'tabs.myrooms.003': "📅 Planlı Oda Erken Başlatılıyor",  // TODO: translate
  'tabs.myrooms.004': "Başlatılamadı",  // TODO: translate
  'tabs.myrooms.005': "Canlı Odalarım",  // TODO: translate
  'tabs.myrooms.006': "Ad Değiştirilemedi",  // TODO: translate
  'tabs.myrooms.007': "Oda adı güncellenemedi. Daha sonra tekrar dene.",  // TODO: translate
  'tabs.myrooms.008': "Oda Tipi Değişmedi",  // TODO: translate
  'tabs.myrooms.009': "Tip değişikliği uygulanamadı.",  // TODO: translate
  'tabs.myrooms.010': "Tema Uygulanamadı",  // TODO: translate
  'tabs.myrooms.011': "Oda teması güncellenemedi.",  // TODO: translate
  'tabs.myrooms.012': "Oda ve tüm mesajları kaldırıldı.",  // TODO: translate
  'tabs.myrooms.013': "Günlük Limit Doldu",  // TODO: translate
  'tabs.myrooms.014': "Üyeliğini yükselterek limitsiz oda aç.",  // TODO: translate
  'tabs.myrooms.015': "Oda Açılamadı",  // TODO: translate
  'tabs.myrooms.016': "Oda uyku moduna alındı.",  // TODO: translate
  'tabs.myrooms.017': "Dondurulamadı",  // TODO: translate
  'tabs.myrooms.018': "İzin Gerekli",  // TODO: translate
  'tabs.myrooms.019': "Galeriye erişim izni verilmedi.",  // TODO: translate
  'tabs.myrooms.020': "🖼 Arka Plan Güncellendi",  // TODO: translate
  'tabs.myrooms.021': "Arka Plan Yüklenemedi",  // TODO: translate
  'tabs.myrooms.022': "İzin Gerekli",  // TODO: translate
  'tabs.myrooms.023': "Galeriye erişim izni verilmedi.",  // TODO: translate
  'tabs.myrooms.024': "🖼 Kart Görseli Güncellendi",  // TODO: translate
  'tabs.myrooms.025': "Kart Görseli Yüklenemedi",  // TODO: translate
  'tabs.myrooms.026': "Oda Kapalı",  // TODO: translate
  'tabs.myrooms.027': "Bu oda şu an canlı değil.",  // TODO: translate
  'tabs.myrooms.028': "📨 Davet Gönderildi",  // TODO: translate
  'tabs.profile.001': "Aktivite verileri yüklenemedi",  // TODO: translate
  'tabs.profile.002': "Hesabından çıkış yapmak istediğinden emin misin?",  // TODO: translate
  'tabs.profile.003': "Oturum kapatıldı",  // TODO: translate
  'tabs.profile.004': "Çıkış yapılamadı",  // TODO: translate
  'tabs.profile.005': "💎 50 SP Kazandın!",  // TODO: translate
  'tabs.profile.006': "Kod Uygulanamadı",  // TODO: translate
  'tabs.profile.007': "Geçmiş yüklenemedi",  // TODO: translate
  'tabs.profile.008': "Kopyalandı 📋",  // TODO: translate
  'tabs.profile.009': "Kopyalanamadı",  // TODO: translate
  'tabs.profile.010': "Boost başarısız",  // TODO: translate
  'tabs.profile.011': "Profili Görüntüle",  // TODO: translate
  'tabs.profile.012': "Mesaj Gönder",  // TODO: translate
  'tabs.profile.013': "Arkadaşlıktan Çıkar",  // TODO: translate
  'tabs.profile.014': "Arkadaşlıktan Çıkar",  // TODO: translate
  'tabs.profile.015': "👋 Arkadaş Kaldırıldı",  // TODO: translate
  'tabs.profile.016': "Kaldırılamadı",  // TODO: translate
  'tabs.profile.017': "Kaldırılamadı",  // TODO: translate
  'tabs.profile.018': "Bio güncellendi",  // TODO: translate
  'tabs.profile.019': "Güncellenemedi",  // TODO: translate
  'admin.001': "Şikayet Kapatıldı",  // TODO: translate
  'admin.002': "Uyarı",  // TODO: translate
  'admin.003': "Kullanıcı Uyarıldı",  // TODO: translate
  'admin.004': "Kullanıcı Banlandı",  // TODO: translate
  'admin.005': "Oda Kapatıldı",  // TODO: translate
  'admin.006': "Oda Uyandırıldı",  // TODO: translate
  'admin.007': "Uyandırılamadı",  // TODO: translate
  'admin.008': "Tier Güncellenemedi",  // TODO: translate
  'admin.009': "Yetki Değiştirilemedi",  // TODO: translate
  'admin.010': "İzin Verilmedi",  // TODO: translate
  'admin.011': "Kendi hesabını silemezsin.",  // TODO: translate
  'admin.012': "Kullanıcı Silinemedi",  // TODO: translate
  'admin.013': "🗑 Kullanıcı Silindi",  // TODO: translate
  'admin.014': "Kullanıcılar",  // TODO: translate
  'admin.015': "Toplam Üye",  // TODO: translate
  'admin.016': "Çevrimiçi",  // TODO: translate
  'admin.017': "Canlı Oda",  // TODO: translate
  'admin.018': "Şikayet",  // TODO: translate
  'admin.019': "Gönderi",  // TODO: translate
  'admin.020': "Yeni Oda Oluştur",  // TODO: translate
  'admin.021': "Free Boş Odaları Temizle",  // TODO: translate
  'admin.022': "Tüm Kullanıcılara Duyuru Gönder",  // TODO: translate
  'admin.023': "Skia Parite Testi (geliştirme)",  // TODO: translate
  'admin.024': "Süre",  // TODO: translate
  'auth.resetpassword.001': "Zayıf",  // TODO: translate
  'auth.resetpassword.002': "İyi",  // TODO: translate
  'auth.resetpassword.003': "Güçlü",  // TODO: translate
  'auth.resetpassword.004': "Şifre Çok Kısa",  // TODO: translate
  'auth.resetpassword.005': "En az 8 karakter olmalı.",  // TODO: translate
  'auth.resetpassword.006': "Büyük Harf Eksik",  // TODO: translate
  'auth.resetpassword.007': "Şifrede en az 1 büyük harf olmalı.",  // TODO: translate
  'auth.resetpassword.008': "Şifrede en az 1 rakam olmalı.",  // TODO: translate
  'auth.resetpassword.009': "Şifreler Eşleşmiyor",  // TODO: translate
  'auth.resetpassword.010': "İki alan da aynı olmalı.",  // TODO: translate
  'auth.resetpassword.011': "✅ Şifre Değiştirildi",  // TODO: translate
  'auth.resetpassword.012': "Yeni şifrenle giriş yapabilirsin.",  // TODO: translate
  'auth.resetpassword.013': "Bağlantı Süresi Doldu",  // TODO: translate
  'auth.resetpassword.014': "Yeni bir sıfırlama maili iste.",  // TODO: translate
  'auth.resetpassword.015': "Geçersiz Bağlantı",  // TODO: translate
  'auth.resetpassword.016': "Bu link kullanılmış veya geçersiz.",  // TODO: translate
  'auth.resetpassword.017': "Şifre Zayıf",  // TODO: translate
  'auth.resetpassword.018': "Daha güçlü bir şifre seç.",  // TODO: translate
  'auth.resetpassword.019': "Şifre değiştirilemedi, tekrar dene.",  // TODO: translate
  'call.id.001': "Bağlantı Hatası",  // TODO: translate
  'call.id.002': "Arama bağlantısı kurulamadı.",  // TODO: translate
  'call.id.003': "Arama Hatası",  // TODO: translate
  'chat.id.001': "İlk mesajın istek olarak gönderilir. Karşı taraf onaylarsa mesajlaşabilirsiniz.",  // TODO: translate
  'chat.id.002': "Bu kullanıcı seninle mesajlaşmak istemiyor.",  // TODO: translate
  'chat.id.003': "Karşı taraf onaylayana kadar yeni mesaj atamazsın.",  // TODO: translate
  'chat.id.004': "Cevapsız sesli arama",  // TODO: translate
  'chat.id.005': "Bu kullanıcıyı engellediniz. Mesajlaşmak için engeli kaldırın.",  // TODO: translate
  'chat.id.006': "Kaybolan Mesaj Süresi",  // TODO: translate
  'chat.id.007': "Bu süre sonra mesajlar otomatik silinir (her iki tarafta).",  // TODO: translate
  'chat.id.008': "Ses oynatılamadı",  // TODO: translate
  'chat.id.009': "Ayarlar → Uygulamalar → SopranoChat → İzinler\\'den mikrofonu açın",  // TODO: translate
  'chat.id.010': "Ses kaydı alınamadı",  // TODO: translate
  'chat.id.011': "Sesli mesaj gönderilemedi",  // TODO: translate
  'chat.id.012': "✓ Kopyalandı",  // TODO: translate
  'chat.id.013': "Geçersiz hedef",  // TODO: translate
  'chat.id.014': "✓ İletildi",  // TODO: translate
  'chat.id.015': "İletilemedi",  // TODO: translate
  'chat.id.016': "İncelemeye alındı.",  // TODO: translate
  'chat.id.017': "Düzenlenemedi",  // TODO: translate
  'chat.id.018': "Arama Hatası",  // TODO: translate
  'chat.id.019': "Mesaj isteği reddedildi.",  // TODO: translate
  'chat.id.020': "Artık mesajlaşabilirsiniz.",  // TODO: translate
  'chat.id.021': "Mesaj Seçenekleri",  // TODO: translate
  'chat.id.022': "Arama Hatası",  // TODO: translate
  'chat.id.023': "Fotoğraf gönderilemedi",  // TODO: translate
  'chat.id.024': "Davet gönderilemedi",  // TODO: translate
  'chat.id.025': "Kapalı (sınırsız)",  // TODO: translate
  'chat.id.026': "7 gün",  // TODO: translate
  'chat.id.027': "30 gün",  // TODO: translate
  'chat.id.028': "Bu sohbet geçmişi silinecek. Bu işlem geri alınamaz.",  // TODO: translate
  'chat.id.029': "Engeli Kaldır",  // TODO: translate
  'chat.id.030': "Kullanıcıyı Engelle",  // TODO: translate
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
  'createroom.025': "Bağış",  // TODO: translate
  'createroom.026': "Yaş Sınırı",  // TODO: translate
  'createroom.027': "Yavaş Mod",  // TODO: translate
  'createroom.028': "Müzik Linki",  // TODO: translate
  'editprofile.001': "Şifreniz Google hesabınız üzerinden yönetilmektedir. Şifre değişikliği için Google Hesap Ayarları → Güvenlik bölümünü kullanın.",  // TODO: translate
  'editprofile.002': "📸 Fotoğraf Yüklendi",  // TODO: translate
  'editprofile.003': "Profil fotoğrafın güncellendi.",  // TODO: translate
  'editprofile.004': "Fotoğraf Yüklenemedi",  // TODO: translate
  'editprofile.005': "Uyarı",  // TODO: translate
  'editprofile.006': "Görünen ad boş olamaz.",  // TODO: translate
  'editprofile.007': "Oturum Kapalı",  // TODO: translate
  'editprofile.008': "Giriş bilgin bulunamadı, yeniden giriş yap.",  // TODO: translate
  'editprofile.009': "Kullanıcı adı alınmış",  // TODO: translate
  'editprofile.010': "Başka bir kullanıcı adı dene.",  // TODO: translate
  'editprofile.011': "Kullanıcı adı müsaitliği kontrol ediliyor...",  // TODO: translate
  'editprofile.012': "Başarılı ✓",  // TODO: translate
  'editprofile.013': "Profil güncellendi!",  // TODO: translate
  'editprofile.014': "Kullanıcı Adı Alınmış",  // TODO: translate
  'editprofile.015': "Bu kullanıcı adı başkası tarafından kullanılıyor.",  // TODO: translate
  'editprofile.016': "Profil Güncellenmedi",  // TODO: translate
  'editprofile.017': "Değişiklikler kaydedilemedi. Tekrar dene.",  // TODO: translate
  'editprofile.018': "Başarılı ✓",  // TODO: translate
  'editprofile.019': "Google hesabınız başarıyla bağlandı! Artık Google ile giriş yapabilirsiniz.",  // TODO: translate
  'editprofile.020': "Uyarı",  // TODO: translate
  'editprofile.021': "Bu Google hesabı zaten başka bir kullanıcıya bağlı.",  // TODO: translate
  'editprofile.022': "Google hesabınız zaten bağlı.",  // TODO: translate
  'editprofile.023': "Google Bağlanamadı",  // TODO: translate
  'editprofile.024': "Google hesabı eklenemedi, tekrar dene.",  // TODO: translate
  'editprofile.025': "Lütfen e-posta adresini gir.",  // TODO: translate
  'editprofile.026': "Şifre Çok Kısa",  // TODO: translate
  'editprofile.027': "Şifre en az 6 karakter olmalı.",  // TODO: translate
  'editprofile.028': "Şifreler Eşleşmiyor",  // TODO: translate
  'editprofile.029': "İki şifre alanı aynı olmalı.",  // TODO: translate
  'editprofile.030': "Başarılı ✓",  // TODO: translate
  'editprofile.031': "E-posta hesabınız başarıyla oluşturuldu! Artık e-posta ve şifre ile giriş yapabilirsiniz.",  // TODO: translate
  'editprofile.032': "E-posta Kullanımda",  // TODO: translate
  'editprofile.033': "Bu e-posta başka bir hesaba bağlı.",  // TODO: translate
  'editprofile.034': "Geçersiz E-posta",  // TODO: translate
  'editprofile.035': "Geçerli bir e-posta adresi gir.",  // TODO: translate
  'editprofile.036': "E-posta hesabı zaten bağlı.",  // TODO: translate
  'editprofile.037': "E-posta hesabın güncellenemedi, tekrar dene.",  // TODO: translate
  'editprofile.038': "Uyarı",  // TODO: translate
  'editprofile.039': "Mevcut şifrenizi girin.",  // TODO: translate
  'editprofile.040': "Uyarı",  // TODO: translate
  'editprofile.041': "Yeni şifre en az 6 karakter olmalıdır.",  // TODO: translate
  'editprofile.042': "Uyarı",  // TODO: translate
  'editprofile.043': "Yeni şifreler uyuşmuyor.",  // TODO: translate
  'editprofile.044': "Başarılı ✓",  // TODO: translate
  'editprofile.045': "Şifreniz güncellendi!",  // TODO: translate
  'editprofile.046': "Şifre Yanlış",  // TODO: translate
  'editprofile.047': "Mevcut şifren doğru değil.",  // TODO: translate
  'editprofile.048': "Yeniden Giriş Gerekli",  // TODO: translate
  'editprofile.049': "Güvenlik için çıkış yapıp tekrar gir.",  // TODO: translate
  'editprofile.050': "Şifre Değiştirilemedi",  // TODO: translate
  'editprofile.051': "İşlem tamamlanamadı, tekrar dene.",  // TODO: translate
  'editprofile.052': "Google Hesabı",  // TODO: translate
  'editprofile.053': "E-posta Hesabı",  // TODO: translate
  'hiddenrooms.001': "Liste yüklenemedi",  // TODO: translate
  'hiddenrooms.002': "Tüm gizli odalar geri getirildi",  // TODO: translate
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
  'notifications.001': "Arkadaşlık istekleri, hediyeler ve mesajlar burada görünecek",  // TODO: translate
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
  'plus.011': "Günlük Oda",  // TODO: translate
  'plus.012': "Kalıcı Oda Slotu",  // TODO: translate
  'plus.013': "Oda Türü",  // TODO: translate
  'plus.014': "Avatar Çerçevesi",  // TODO: translate
  'plus.015': "Yaş/Dil Filtresi",  // TODO: translate
  'plus.016': "Moderatör",  // TODO: translate
  'plus.017': "Takipçi-Only",  // TODO: translate
  'plus.018': "Oda Müziği",  // TODO: translate
  'room.id.001': "yazıyor…",  // TODO: translate
  'room.id.002': "çevrimiçi",  // TODO: translate
  'room.id.003': "Kabul ederseniz mesajlaşmaya başlayabilirsiniz.",  // TODO: translate
  'room.id.004': "İsteğiniz onay bekliyor. Onay gelene kadar yeni mesaj gönderemezsiniz.",  // TODO: translate
  'room.id.005': "İsteğiniz reddedildi — mesaj gönderemezsiniz.",  // TODO: translate
  'room.id.006': "İletildi",  // TODO: translate
  'room.id.007': "Düzenlenemedi",  // TODO: translate
  'room.id.008': "Gönderilemedi",  // TODO: translate
  'room.id.009': "✓ Kopyalandı",  // TODO: translate
  'room.id.010': "Geçersiz hedef",  // TODO: translate
  'room.id.011': "Mesajı kendine iletemezsin.",  // TODO: translate
  'room.id.012': "✓ İletildi",  // TODO: translate
  'room.id.013': "İletilemedi",  // TODO: translate
  'room.id.014': "Oda Başlatılamadı",  // TODO: translate
  'room.id.015': "Sahibine istek gönderirsin, onay bekler.",  // TODO: translate
  'room.id.016': "🎉 Engel Kalktı",  // TODO: translate
  'room.id.017': "Oda sahibi ayarı değiştirdi — odaya alındın!",  // TODO: translate
  'room.id.018': "Giriş Hatası",  // TODO: translate
  'room.id.019': "Metin sohbetiniz moderatör tarafından kapatıldı.",  // TODO: translate
  'room.id.020': "Mesaj gönderilemedi",  // TODO: translate
  'room.id.021': "Yetkiniz olmayabilir veya bağlantı sorunu.",  // TODO: translate
  'room.id.022': "Mesaj gönderilemedi",  // TODO: translate
  'room.id.023': "Bu odada sadece oda sahibinin seçtiği kişiler sahneye çıkabilir. Sahip seni seçene kadar bekle.",  // TODO: translate
  'room.id.024': "⏳ Kuyruğa Yazıldın",  // TODO: translate
  'room.id.025': "Sahne dolu — biri inince otomatik olarak sahneye çıkacaksın.",  // TODO: translate
  'room.id.026': "🤚 Sahne Talebi Gönderildi",  // TODO: translate
  'room.id.027': "Oda sahibinin onayı bekleniyor...",  // TODO: translate
  'room.id.028': "Bağlantı Yok",  // TODO: translate
  'room.id.029': "Ses sunucusuna bağlanılamadı. Mikrofon kullanılamaz.",  // TODO: translate
  'room.id.030': "Moderatör tarafından susturuldunuz. Süre dolana kadar mikrofon açamazsınız.",  // TODO: translate
  'room.id.031': "Mikrofon Hatası",  // TODO: translate
  'room.id.032': "Mikrofon değiştirilemedi",  // TODO: translate
  'room.id.033': "Sahneye Alma Hatası",  // TODO: translate
  'room.id.034': "Odadan Ayrıl",  // TODO: translate
  'room.id.035': "Oda sahibi olarak ayrılmak istediğine emin misin? Yetki uygun birine devredilecek.",  // TODO: translate
  'room.id.036': "Odadan Ayrıl",  // TODO: translate
  'room.id.037': "Odadan ayrılmak istediğine emin misin?",  // TODO: translate
  'room.id.038': "Vekil host olarak odayı silemezsin. Sadece oda sahibi silebilir.",  // TODO: translate
  'room.id.039': "🗑️ Odayı Kalıcı Sil",  // TODO: translate
  'room.id.040': "Bu oda tamamen silinecek ve geri alınamaz! Tüm katılımcılar çıkarılacak. Devam etmek istiyor musun?",  // TODO: translate
  'room.id.041': "Çıkış Yapılamadı",  // TODO: translate
  'room.id.042': "Odadan çıkış başarısız oldu.",  // TODO: translate
  'room.id.043': "Çıkış Yapılamadı",  // TODO: translate
  'room.id.044': "Odadan çıkış başarısız oldu.",  // TODO: translate
  'room.id.045': "🔑 Oda Kapandı",  // TODO: translate
  'room.id.046': "Oda sahibi ve moderatör olmadığı için oda kapatıldı.",  // TODO: translate
  'room.id.047': "⚠️ Oda Kapanıyor!",  // TODO: translate
  'room.id.048': "Oda 5 saniye içinde kapanacak!",  // TODO: translate
  'room.id.049': "Host Değişikliği Engellendi",  // TODO: translate
  'room.id.050': "Aktif odada host değiştirilemez.",  // TODO: translate
  'room.id.051': "Bu rolde host olamazsınız.",  // TODO: translate
  'room.id.052': "Oda yönetimi sende. Geri sayım iptal edildi.",  // TODO: translate
  'room.id.053': "Host Olunamadı",  // TODO: translate
  'room.id.054': "Konuşmacı Değişmedi",  // TODO: translate
  'room.id.055': "Davet/çıkarma işlemi tamamlanamadı.",  // TODO: translate
  'room.id.056': "⏰ Süre Doldu",  // TODO: translate
  'room.id.057': "Oda süresi doldu. Oda kapatılıyor...",  // TODO: translate
  'room.id.058': "⏰ Süre Doldu",  // TODO: translate
  'room.id.059': "Oda süresi doldu. Oda kapanıyor...",  // TODO: translate
  'room.id.060': "⏳ 15 dakika kaldı",  // TODO: translate
  'room.id.061': "Oda süresi azalıyor. Plus\\'a geçerek süresini uzatabilirsin.",  // TODO: translate
  'room.id.062': "Yükselt",  // TODO: translate
  'room.id.063': "⏳ 15 dakika kaldı",  // TODO: translate
  'room.id.064': "Oda kapanmak üzere! Pro ile sınırsız oda süresi.",  // TODO: translate
  'room.id.065': "Pro\\'ya Geç",  // TODO: translate
  'room.id.066': "Bu oda 5 dakika içinde kapanacak.",  // TODO: translate
  'room.id.067': "🎙️ Sıran Geldi!",  // TODO: translate
  'room.id.068': "Sahneye otomatik olarak çıktın.",  // TODO: translate
  'room.id.069': "⏳ 30 saniye kaldı",  // TODO: translate
  'room.id.070': "Sahne süren bitiyor",  // TODO: translate
  'room.id.071': "🔇 Tümünü Sustur",  // TODO: translate
  'room.id.072': "Sahnedeki tüm konuşmacıların mikrofonları kapatılacak.",  // TODO: translate
  'room.id.073': "🔇 Tümü Susturuldu",  // TODO: translate
  'room.id.074': "🔊 Tümünü Aç",  // TODO: translate
  'room.id.075': "Sahnedeki tüm konuşmacıların mikrofonları tekrar açılacak.",  // TODO: translate
  'room.id.076': "🔊 Tümü Açıldı",  // TODO: translate
  'room.id.077': "🔒 Seçilmişler Modu",  // TODO: translate
  'room.id.078': "Bu odada sadece oda sahibinin seçtiği kişiler sahneye çıkabilir.",  // TODO: translate
  'room.id.079': "🤚 Sahne Talebi Gönderildi",  // TODO: translate
  'room.id.080': "Oda sahibinin onayı bekleniyor...",  // TODO: translate
  'room.id.081': "Sahne talebiniz zaten gönderildi.",  // TODO: translate
  'room.id.082': "⏳ Kuyruğa Yazıldın",  // TODO: translate
  'room.id.083': "Sahne dolu — biri inince otomatik olarak sahneye çıkacaksın.",  // TODO: translate
  'room.id.084': "Zaten Kuyruktasın",  // TODO: translate
  'room.id.085': "Sırada bekliyorsun, sahne boşalınca otomatik promote olacaksın.",  // TODO: translate
  'room.id.086': "Mikrofon otomatik açılıyor...",  // TODO: translate
  'room.id.087': "Sahneye Çıkılamadı",  // TODO: translate
  'room.id.088': "Mikrofon açılamadı, tekrar dene.",  // TODO: translate
  'room.id.089': "Sahneye Çıkılamadı",  // TODO: translate
  'room.id.090': "Mikrofon açılamadı, tekrar dene.",  // TODO: translate
  'room.id.091': "Sahnede sadece oda sahibi ve moderatörler var. Yer açılamıyor.",  // TODO: translate
  'room.id.092': "Sahneye Çıkılamadı",  // TODO: translate
  'room.id.093': "Mikrofon açılamadı, tekrar dene.",  // TODO: translate
  'room.id.094': "Paylaşılamadı",  // TODO: translate
  'room.id.095': "Link kopyalanamadı",  // TODO: translate
  'room.id.096': "İşlem Tamamlanamadı",  // TODO: translate
  'room.id.097': "Bir sorun oluştu, tekrar dene.",  // TODO: translate
  'room.id.098': "🎧 Odaya Katıldın!",  // TODO: translate
  'room.id.099': "Şifre doğrulandı — hoş geldin!",  // TODO: translate
  'room.id.100': "Giriş Hatası",  // TODO: translate
  'room.id.101': "İstek Gönderilemedi",  // TODO: translate
  'room.id.102': "🎧 Odaya Katıldın!",  // TODO: translate
  'room.id.103': "İsteğin onaylandı — hoş geldin!",  // TODO: translate
  'room.id.104': "Giriş Hatası",  // TODO: translate
  'room.id.105': "Kamera Kapalı",  // TODO: translate
  'room.id.106': "Bu tier\\'da kamera kullanılamıyor. Üyeliği yükselt!",  // TODO: translate
  'room.id.107': "Odadan Ayrıl",  // TODO: translate
  'room.id.108': "Odadan ayrılmak istediğinize emin misiniz?",  // TODO: translate
  'room.id.109': "✨ Parlatıldı",  // TODO: translate
  'room.id.110': "Gönderilemedi",  // TODO: translate
  'room.id.111': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.112': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.113': "Seçilmişler modu Pro abonelik gerektirir.",  // TODO: translate
  'room.id.114': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.115': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.116': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.117': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.118': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.119': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.120': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.121': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.122': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.123': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.124': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.125': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.126': "✏️ Oda Adı Güncellendi",  // TODO: translate
  'room.id.127': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.128': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.129': "💬 Hoş Geldin Mesajı Güncellendi",  // TODO: translate
  'room.id.130': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.131': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.132': "📋 Kurallar Güncellendi",  // TODO: translate
  'room.id.133': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.134': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.135': "📝 Açıklama Güncellendi",  // TODO: translate
  'room.id.136': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.137': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.138': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.139': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.140': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.141': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.142': "🎨 Tema Güncellendi",  // TODO: translate
  'room.id.143': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.144': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.145': "❄️ Odayı Dondur",  // TODO: translate
  'room.id.146': "Oda dondurulacak. Tüm katılımcılar çıkarılacak. Daha sonra \"Odalarım\" sekmesinden tekrar aktifleştirebilirsin.",  // TODO: translate
  'room.id.147': "Odalarım sekmesinden tekrar aktifleştirebilirsin.",  // TODO: translate
  'room.id.148': "Dondurulamadı",  // TODO: translate
  'room.id.149': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.150': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.151': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.152': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.153': "İzin Gerekli",  // TODO: translate
  'room.id.154': "🖼 Arka Plan Güncellendi",  // TODO: translate
  'room.id.155': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.156': "Arka Plan Kaldırıldı",  // TODO: translate
  'room.id.157': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.158': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.159': "İzin Gerekli",  // TODO: translate
  'room.id.160': "🖼 Kart Görseli Güncellendi",  // TODO: translate
  'room.id.161': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.162': "Kart Görseli Kaldırıldı",  // TODO: translate
  'room.id.163': "Ayar Güncellenemedi",  // TODO: translate
  'room.id.164': "Değişiklik kaydedilemedi. Tekrar dene.",  // TODO: translate
  'room.id.165': "Altın Davet",  // TODO: translate
  'room.id.166': "Listeden bir dinleyici seç.",  // TODO: translate
  'room.id.167': "Boost Başarısız",  // TODO: translate
  'room.id.168': "📨 Davet Gönderildi",  // TODO: translate
  'room.id.169': "🎧 Odaya Katıldın!",  // TODO: translate
  'room.id.170': "Şifre doğrulandı — hoş geldin!",  // TODO: translate
  'room.id.171': "🎧 Odaya Katıldın!",  // TODO: translate
  'room.id.172': "İsteğin onaylandı — hoş geldin!",  // TODO: translate
  'room.id.173': "Giriş Hatası",  // TODO: translate
  'room.id.174': "İstek Gönderilemedi",  // TODO: translate
  'settings.001': "Teşhis hatası",  // TODO: translate
  'spstore.001': "SP ile profilini öne çıkarabilir, oda giriş ücreti ödeyebilir ve premium özelliklere erişebilirsin.",  // TODO: translate
  'spstore.002': "🚧 Yakında",  // TODO: translate
  'spstore.003': "SP mağazası alfa sürüm süresince kapalı. Yakında Google Play üzerinden aktif olacak!",  // TODO: translate
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
  'layout.001': "Bağlantı Sorunu",  // TODO: translate
  'layout.002': "Profilini sunucudan getiremedik. İnternet bağlantını kontrol edip tekrar dene.",  // TODO: translate
  'layout.003': "🔴 Canlı Yayın",  // TODO: translate
  'layout.004': "🎁 Hediye Aldın",  // TODO: translate
  'layout.005': "💖 Teşekkür Aldın",  // TODO: translate
  'layout.006': "📞 Cevapsız Arama",  // TODO: translate
  'layout.007': "⏰ Etkinlik Hatırlatıcı",  // TODO: translate
  'layout.008': "🎉 Arkadaşlık Kabul",  // TODO: translate
  'blockeduserssheet.001': "Liste Yüklenemedi",  // TODO: translate
  'blockeduserssheet.002': "Engellenen kullanıcılar çekilemedi.",  // TODO: translate
  'blockeduserssheet.003': "Engel Kaldırıldı",  // TODO: translate
  'blockeduserssheet.004': "Engel Kaldırılamadı",  // TODO: translate
  'boostpickersheet.001': "Hızlı Boost",  // TODO: translate
  'createroomcoachmark.001': "butonuna dokun ve ilk odanı aç.",  // TODO: translate
  'discoverwelcomesheet.001': "Sesle tanış",  // TODO: translate
  'discoverwelcomesheet.002': "Kendi odanı aç",  // TODO: translate
  'discoverwelcomesheet.003': "Keşfet ve katıl",  // TODO: translate
  'discoverwelcomesheet.004': "Canlı ses",  // TODO: translate
  'discoverwelcomesheet.005': "Anlık",  // TODO: translate
  'discoverwelcomesheet.006': "Ücretsiz",  // TODO: translate
  'discoverwelcomesheet.007': "Gizli/Açık",  // TODO: translate
  'discoverwelcomesheet.008': "Müzik/Sohbet",  // TODO: translate
  'discoverwelcomesheet.009': "Popüler",  // TODO: translate
  'discoverwelcomesheet.010': "Canlı",  // TODO: translate
  'discoverwelcomesheet.011': "Ödül",  // TODO: translate
  'emojipicker.001': "Sık Kullanılan",  // TODO: translate
  'emojipicker.002': "Yüzler",  // TODO: translate
  'emojireactions.001': "Popüler",  // TODO: translate
  'emojireactions.002': "Yüzler",  // TODO: translate
  'emojireactions.003': "Aşk",  // TODO: translate
  'emojireactions.004': "Doğa",  // TODO: translate
  'fabhintoverlay.001': "Buradan yeni bir oda açabilirsin. Arkadaşlarını davet et, sohbete başla!",  // TODO: translate
  'followlistmodal.001': "ARKADAŞLAR",  // TODO: translate
  'followlistmodal.002': "TAKİPÇİLER",  // TODO: translate
  'followlistmodal.003': "TAKİP EDİLENLER",  // TODO: translate
  'followlistmodal.004': "Arkadaşlıktan Çıkar",  // TODO: translate
  'followlistmodal.005': "Takipten Çık",  // TODO: translate
  'messageactionmenu.001': "Yanıtla",  // TODO: translate
  'messageactionmenu.002': "İlet",  // TODO: translate
  'messageactionmenu.003': "Düzenle",  // TODO: translate
  'messageactionmenu.004': "Herkes İçin Sil",  // TODO: translate
  'notificationdrawer.001': "Davet Geçersiz",  // TODO: translate
  'notificationdrawer.002': "Odaya katılım işlenemedi, tekrar dene.",  // TODO: translate
  'notificationdrawer.003': "İşlem tamamlanamadı.",  // TODO: translate
  'notificationdrawer.004': "Bildirimler silinirken hata oluştu.",  // TODO: translate
  'notificationdrawer.005': "İşaretlenemedi",  // TODO: translate
  'notificationdrawer.006': "Bildirimler okundu olarak işaretlenemedi.",  // TODO: translate
  'notifpreferencessheet.001': "Belirttiğin saatlerde bildirim almazsın (acil çağrılar hariç).",  // TODO: translate
  'notifpreferencessheet.002': "Acil çağrılar ve arkadaşlık istekleri her zaman ulaşır.",  // TODO: translate
  'notifpreferencessheet.003': "Kapalı",  // TODO: translate
  'notifpreferencessheet.004': "İş (09→18)",  // TODO: translate
  'notifpreferencessheet.005': "Akşam (19→23)",  // TODO: translate
  'notifpreferencessheet.006': "Sadece arkadaşlardan",  // TODO: translate
  'notifpreferencessheet.007': "Sadece arkadaşların gönderdiği bildirimleri al",  // TODO: translate
  'notifpreferencessheet.008': "DM mesajları",  // TODO: translate
  'notifpreferencessheet.009': "Yeni özel mesaj geldiğinde",  // TODO: translate
  'notifpreferencessheet.010': "Bir odada sahneye çağrıldığında",  // TODO: translate
  'notifpreferencessheet.011': "Sana SP gönderildiğinde",  // TODO: translate
  'notifpreferencessheet.012': "Arkadaş çevrimiçi",  // TODO: translate
  'notifpreferencessheet.013': "Arkadaşın yeni oda açtığında",  // TODO: translate
  'profile.badgecelebration.001': "NADİR",  // TODO: translate
  'profile.badgecelebration.002': "EPİK",  // TODO: translate
  'profile.badgecelebration.003': "EFSANEVİ",  // TODO: translate
  'profile.featuredbadgespicker.001': "Öne çıkan rozetler güncellendi",  // TODO: translate
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
  'reportmodal.007': "Diğer",  // TODO: translate
  'reportmodal.008': "Bir sebep seçin",  // TODO: translate
  'reportmodal.009': "Raporun alındı",  // TODO: translate
  'reportmodal.010': "En kısa sürede incelenecektir.",  // TODO: translate
  'reportmodal.011': "Rapor Gönderilemedi",  // TODO: translate
  'room.connectionqualityindicator.001': "Mükemmel",  // TODO: translate
  'room.connectionqualityindicator.002': "İyi",  // TODO: translate
  'room.connectionqualityindicator.003': "Zayıf",  // TODO: translate
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
  'room.roommanagesheet.035': "Şifre Çok Kısa",  // TODO: translate
  'room.roommanagesheet.036': "En az 4 karakter olmalı.",  // TODO: translate
  'room.roommanagesheet.037': "Şifre Çok Kısa",  // TODO: translate
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
  'room.roomoverlays.005': "Açık",  // TODO: translate
  'room.roomoverlays.006': "Şifreli",  // TODO: translate
  'room.roomoverlays.007': "✅ Ban Kaldırıldı",  // TODO: translate
  'room.roomoverlays.008': "Ban Kaldırılamadı",  // TODO: translate
  'room.roomoverlays.009': "Bu kullanıcının banı kaldırılamadı.",  // TODO: translate
  'room.roomoverlays.010': "Konuşma",  // TODO: translate
  'room.roomoverlays.011': "Müzik",  // TODO: translate
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
  'sessionconflictmodal.001': "Bu hesap az önce başka bir cihazda kullanılmaya başladı. Aynı hesap iki yerden aktif olamaz.",  // TODO: translate
  'sessionconflictmodal.002': "\"Devam Et\" dersen diğer cihaz oturumdan düşer.",  // TODO: translate
};
export default en;
