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
  'auth.onboarding.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 32 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.onboarding.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 31 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.onboarding.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 31 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.onboarding.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 31 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.onboarding.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 31 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.onboarding.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 31 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.onboarding.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 31 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.onboarding.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 30 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.onboarding.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 30 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.onboarding.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 30 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'tabs.home.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 30 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'tabs.myrooms.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 30 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'tabs.profile.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 30 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'tabs.profile.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 30 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'admin.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 29 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'admin.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 29 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'admin.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 29 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'admin.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 29 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'admin.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 29 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'admin.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 29 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'admin.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 29 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'admin.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 28 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'admin.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 28 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'admin.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 28 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'admin.011': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 28 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'admin.012': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 28 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.resetpassword.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 28 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.resetpassword.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 28 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.resetpassword.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 27 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.resetpassword.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 27 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.resetpassword.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 27 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.resetpassword.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 27 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.resetpassword.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 27 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.resetpassword.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 27 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.resetpassword.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 27 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.resetpassword.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 26 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'auth.resetpassword.011': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 26 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'call.id.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 26 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'call.id.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 26 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'chat.id.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 26 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'chat.id.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 26 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'chat.id.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 25 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'chat.id.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 25 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'chat.id.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 25 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'chat.id.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 25 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'chat.id.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 25 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 25 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 25 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 24 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 24 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 24 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 24 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 24 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 24 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 24 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 23 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.011': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 23 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.012': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 23 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.013': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 23 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.014': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 23 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.015': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 23 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.016': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 23 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.017': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 22 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.018': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 22 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.019': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 22 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.020': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 22 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.021': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 22 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.022': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 22 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.023': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 22 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroom.024': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 21 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'editprofile.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 21 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'editprofile.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 21 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'editprofile.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 21 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'editprofile.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 21 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'editprofile.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 21 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'editprofile.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 21 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'editprofile.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 20 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'editprofile.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 20 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'hiddenrooms.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 20 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'hiddenrooms.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 20 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'hiddenrooms.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 20 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'hiddenrooms.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 20 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'leaderboard.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 19 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'leaderboard.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 19 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'leaderboard.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 19 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'leaderboard.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 19 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'leaderboard.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 19 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'leaderboard.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 19 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'leaderboard.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 19 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'leaderboard.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 18 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'leaderboard.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 18 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'leaderboard.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 18 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'plus.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 18 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'plus.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 18 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'plus.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 18 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'plus.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 18 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'plus.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 17 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'plus.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 17 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'plus.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 17 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'plus.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 17 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'plus.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 17 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'plus.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 17 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.id.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 17 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.id.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 16 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'skiatest.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 16 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'skiatest.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 16 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'skiatest.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 16 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'spstore.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 16 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'spstore.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 16 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.collection.id.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 16 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 15 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 15 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 15 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 15 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 15 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 15 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 15 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 14 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 14 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 14 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.011': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 14 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.012': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 14 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.013': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 14 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.014': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 13 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.015': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 13 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.016': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 13 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.017': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 13 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.018': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 13 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.019': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 13 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.020': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 13 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.021': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 12 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.022': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 12 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.023': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 12 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.024': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 12 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.025': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 12 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.026': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 12 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.027': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 12 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.028': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 11 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'blockeduserssheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 11 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'blockeduserssheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 11 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'blockeduserssheet.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 11 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'boostpickersheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 11 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'boostpickersheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 11 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'boostpickersheet.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 11 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'createroomcoachmark.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 10 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'discoverwelcomesheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 10 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'discoverwelcomesheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 10 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'fabhintoverlay.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 10 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'fabhintoverlay.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 10 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'followlistmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 10 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'followlistmodal.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 10 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'incomingcalloverlay.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 09 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.badgelistmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 09 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.badgelistmodal.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 09 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.bioeditorsheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 09 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.bioeditorsheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 09 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.featuredbadgespicker.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 09 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.featuredbadgespicker.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 09 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.featuredbadgespicker.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 08 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.featuredbadgespicker.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 08 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.giftdetailmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 08 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.giftdetailmodal.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 08 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.giftsheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 08 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.giftsheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 08 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.giftshowcase.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 07 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.giftshowcase.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 07 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.languageinterestpicker.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 07 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.personalnotecard.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 07 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.sociallinkseditor.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 07 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spdonatesheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 07 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spdonatesheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 07 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.sphistorysheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 06 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.sphistorysheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 06 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.sphistorysheet.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 06 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.sphistorysheet.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 06 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.sphistorysheet.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 06 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spreceivedmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 06 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spreceivedmodal.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 06 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spsentsuccessmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 05 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.symbolgiftsheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 05 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.symbolgiftsheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 05 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.thankyoureceivedmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 05 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.thankyoureceivedmodal.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 05 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.tieredprofilesections.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 05 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.tieredprofilesections.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 05 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.tieredprofilesections.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 04 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.tieredprofilesections.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 04 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.voicebiorecorder.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 04 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.voicebiorecorder.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 04 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.voicebiorecorder.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 04 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.voicebiorecorder.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 04 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.voicebiorecorder.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 04 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.welcomebonusmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 03 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'quickcreatesheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 03 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 03 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 03 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 03 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 03 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.camerafullscreenmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 03 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.camerafullscreenmodal.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 02 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.entryfeecard.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 02 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.entryfeecard.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 02 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.entryfeecard.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 02 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.hostaccesspanel.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 02 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.hostaccesspanel.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 02 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.hostaccesspanel.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 01 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 01 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.invitefriendsmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 01 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.invitefriendsmodal.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 01 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.messageglowpickersheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 01 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.messageglowpickersheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 01 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.messageglowpickersheet.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 01 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.messageglowpickersheet.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomaccessprompts.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomaccessprompts.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomaccessprompts.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomdisconnectoverlay.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 59 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomentryeffectoverlay.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 59 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomfollowerssheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 59 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomfollowerssheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 59 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomfollowerssheet.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 59 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomgiftpanel.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 59 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomgiftpanel.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 59 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomgiftpanel.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 58 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 58 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 58 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 58 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 58 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 58 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 57 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 57 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 57 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 57 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 57 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 57 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 57 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 56 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 56 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 56 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 56 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 56 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 56 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.011': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 56 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.012': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 55 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.013': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 55 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.014': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 55 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.015': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 55 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.016': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 55 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomrecordingssheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 55 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomrecordingssheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 55 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomstatspanel.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 54 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomstatspanel.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 54 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.speakersection.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 54 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.stagesupportsheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 54 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'roomboostsheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 54 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'roomboostsheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 54 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'roomcreatehintsheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 54 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'roomcreatehintsheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 53 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'roomcreatehintsheet.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 53 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'sessionconflictmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 53 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'sessionconflictmodal.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 53 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.storeitempreviewsheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 53 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'store.storeitempreviewsheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 53 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'systemsettingsoverlay.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 53 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'systemsettingsoverlay.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 52 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'usersearchmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 45 MINUTES 52 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated

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
  'profile.giftsheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 30 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.giftsheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 30 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spdonatesheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 30 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spdonatesheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 30 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spreceivedmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 30 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spreceivedmodal.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 30 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spreceivedmodal.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 29 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spreceivedmodal.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 29 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spreceivedmodal.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 29 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spreceivedmodal.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 29 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spreceivedmodal.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 29 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spreceivedmodal.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 29 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.spsentsuccessmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 29 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.symbolgiftsheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 28 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.symbolgiftsheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 28 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.tieredprofilesections.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 28 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.tieredprofilesections.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 28 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.tieredprofilesections.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 28 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.tieredprofilesections.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 28 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.tieredprofilesections.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 28 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.tieredprofilesections.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 27 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.tieredprofilesections.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 27 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.tieredprofilesections.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 27 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.tieredprofilesections.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 27 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.voicebiorecorder.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 27 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.voicebiorecorder.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 27 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.voicebiorecorder.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 27 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.voicebiorecorder.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 26 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.voicebiorecorder.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 26 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'profile.voicebiorecorder.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 26 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'quickcreatesheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 26 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'quickcreatesheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 26 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'quickcreatesheet.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 26 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'quickcreatesheet.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 25 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 25 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 25 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 25 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 25 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 25 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 25 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 24 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 24 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 24 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 24 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'reportmodal.011': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 24 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.connectionqualityindicator.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 24 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.connectionqualityindicator.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 24 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.connectionqualityindicator.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 23 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.glowstyles.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 23 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.glowstyles.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 23 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.glowstyles.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 23 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.hostaccesspanel.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 23 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.hostaccesspanel.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 23 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.hostaccesspanel.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 23 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.hostaccesspanel.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 22 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.hostaccesspanel.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 22 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.hostaccesspanel.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 22 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 22 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 22 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 22 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 22 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 21 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 21 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 21 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 21 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 21 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 21 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.011': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 20 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.012': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 20 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.013': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 20 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.inroomuserprofile.014': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 20 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.moderationoverlay.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 20 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.moderationoverlay.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 20 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.moderationoverlay.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 20 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.moderationoverlay.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 19 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.moderationoverlay.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 19 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.moderationoverlay.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 19 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.moderationoverlay.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 19 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.moderationoverlay.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 19 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.moderationoverlay.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 19 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.moderationoverlay.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 19 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 18 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 18 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 18 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 18 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 18 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 18 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 18 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 17 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 17 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 17 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.011': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 17 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.012': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 17 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.powerupssheet.013': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 17 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 17 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 16 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 16 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 16 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 16 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 16 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 16 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 15 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 15 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 15 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.011': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 15 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.012': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 15 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.013': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 15 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.014': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 15 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.015': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 14 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.016': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 14 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomclosedscreen.017': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 14 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomcontrolbar.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 14 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomcontrolbar.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 14 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomcontrolbar.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 14 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomcontrolbar.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 14 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomcontrolbar.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 13 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomcontrolbar.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 13 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomcontrolbar.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 13 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomcontrolbar.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 13 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomcontrolbar.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 13 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomentryeffectoverlay.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 13 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomentryeffectoverlay.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 13 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomentryeffectoverlay.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 12 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomentryeffectoverlay.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 12 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomentryeffectoverlay.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 12 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomentryeffectoverlay.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 12 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomgiftpanel.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 12 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomgiftpanel.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 12 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomgiftpanel.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 12 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomgiftpanel.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 11 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomgiftpanel.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 11 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roominfoheader.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 11 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roominfoheader.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 11 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roominfoheader.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 11 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roominfoheader.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 11 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roominfoheader.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 10 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roominfoheader.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 10 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roominfoheader.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 10 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roominfoheader.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 10 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 10 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 10 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 10 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 09 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 09 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 09 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 09 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 09 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 09 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 09 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.011': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 08 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.012': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 08 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.013': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 08 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.014': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 08 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.015': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 08 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.016': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 08 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.017': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 08 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.018': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 07 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.019': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 07 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.020': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 07 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.021': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 07 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.022': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 07 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.023': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 07 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.024': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 07 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.025': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 06 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.026': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 06 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.027': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 06 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.028': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 06 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.029': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 06 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.030': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 06 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.031': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 06 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.032': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 05 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.033': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 05 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.034': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 05 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.035': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 05 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.036': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 05 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.037': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 05 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.038': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 04 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.039': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 04 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.040': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 04 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.041': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 04 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.042': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 04 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.043': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 04 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.044': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 04 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.045': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 03 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.046': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 03 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.047': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 03 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.048': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 03 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.049': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 03 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.050': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 03 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.051': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 03 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.052': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 02 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.053': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 02 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.054': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 02 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.055': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 02 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.056': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 02 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.057': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 02 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.058': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 02 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.059': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 01 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.060': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 01 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roommanagesheet.061': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 01 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 01 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 01 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 01 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 01 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.009': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.010': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 34 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.011': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 59 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.012': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 59 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.013': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 59 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.014': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 59 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.015': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 59 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.016': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 59 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.017': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 59 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.018': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 58 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.019': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 58 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.020': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 58 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.021': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 58 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.022': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 58 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.023': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 58 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.024': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 58 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.025': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 57 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.026': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 57 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.027': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 57 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.028': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 57 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.029': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 57 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.030': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 57 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.031': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 57 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.032': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 56 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.033': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 56 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.034': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 56 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.035': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 56 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomoverlays.036': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 56 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomrecordingssheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 56 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomrecordingssheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 56 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomstatspanel.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 55 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomstatspanel.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 55 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomstatspanel.003': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 55 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomstatspanel.004': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 55 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomstatspanel.005': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 55 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomstatspanel.006': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 55 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomstatspanel.007': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 54 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.roomstatspanel.008': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 54 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.stagesupportsheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 54 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'room.stagesupportsheet.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 54 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'roomboostsheet.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 54 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'sessionconflictmodal.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 54 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
  'sessionconflictmodal.002': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  19 HOURS 33 MINUTES 54 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated
};
export default en;
