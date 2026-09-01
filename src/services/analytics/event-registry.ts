/** Type-safe analytics event registry — single source of truth */

export type AnalyticsEvent =
  | { name: 'app_open'; params?: { source?: string } }
  | { name: 'signup'; params?: { method: string } }
  | { name: 'login'; params?: { method: string } }
  | { name: 'guest_started'; params?: { guestId: string } }
  | { name: 'quiz_created'; params: { categoryId: string; questionCount: number } }
  | { name: 'quiz_published'; params: { quizId: string } }
  | { name: 'quiz_shared'; params: { quizId: string; channel: string } }
  | { name: 'quiz_opened'; params: { quizId: string; source: string } }
  | { name: 'quiz_started'; params: { quizId: string } }
  | { name: 'quiz_completed'; params: { quizId: string; score: number } }
  | { name: 'result_viewed'; params: { quizId: string; score: number } }
  | { name: 'room_created'; params: { roomId: string; code: string } }
  | { name: 'room_create_started'; params?: Record<string, never> }
  | { name: 'room_share_clicked'; params: { code: string } }
  | { name: 'room_code_copied'; params: { code: string } }
  | { name: 'room_join_started'; params: { code: string } }
  | { name: 'room_join_success'; params: { roomId: string; code: string } }
  | { name: 'room_join_failed'; params: { code: string; reason: string } }
  | { name: 'room_player_joined'; params: { roomId: string; code: string } }
  | { name: 'room_player_left'; params: { roomId: string } }
  | { name: 'room_ready'; params: { roomId: string } }
  | { name: 'room_unready'; params: { roomId: string } }
  | { name: 'room_start_clicked'; params: { roomId: string } }
  | { name: 'room_started'; params: { roomId: string } }
  | { name: 'room_closed'; params?: { roomId?: string } }
  | { name: 'room_expired'; params?: { roomId?: string } }
  | { name: 'room_reconnect'; params: { roomId: string } }
  | { name: 'host_changed'; params: { roomId: string } }
  | { name: 'room_joined'; params: { roomId: string; code: string } }
  | { name: 'category_selected'; params: { categoryId: string; roomId?: string } }
  | { name: 'game_start'; params: { roomId: string } }
  | { name: 'game_countdown'; params: { roomId: string } }
  | { name: 'round_start'; params: { roomId: string; roundNumber: number } }
  | { name: 'question_viewed'; params: { roomId: string; roundNumber: number } }
  | { name: 'answer_started'; params: { roomId: string; matchId: string } }
  | { name: 'answer_timeout'; params: { roomId: string; matchId: string } }
  | { name: 'round_completed'; params: { roomId: string; roundNumber: number } }
  | { name: 'stage_completed'; params: { roomId: string; stage: number } }
  | { name: 'match_created'; params: { roomId: string; matchId: string } }
  | { name: 'score_updated'; params: { roomId: string; playerId: string } }
  | { name: 'player_disconnected'; params: { roomId: string; playerId: string } }
  | { name: 'player_reconnected'; params: { roomId: string; playerId: string } }
  | { name: 'game_resumed'; params: { roomId: string } }
  | { name: 'game_completed'; params: { roomId: string } }
  | { name: 'game_aborted'; params: { roomId: string; reason?: string } }
  | { name: 'game_started'; params: { roomId: string } }
  | { name: 'round_started'; params: { roomId: string; roundNumber: number } }
  | { name: 'answer_submitted'; params: { roomId: string; matchId: string } }
  | { name: 'invite_shared'; params: { channel: string; type: 'quiz' | 'room' } }
  | { name: 'invite_clicked'; params?: { source?: string } }
  | { name: 'premium_viewed'; params?: { source?: string } }
  | { name: 'plan_selected'; params: { productId: string; plan: string } }
  | { name: 'purchase_started'; params: { productId: string; platform?: string; source?: string } }
  | { name: 'purchase_pending'; params: { productId: string; platform?: string } }
  | { name: 'purchase_success'; params: { productId: string; platform?: string; source?: string } }
  | { name: 'purchase_completed'; params: { productId: string } }
  | { name: 'purchase_failed'; params: { productId: string; platform?: string; reason?: string } }
  | { name: 'purchase_cancelled'; params: { productId: string; platform?: string } }
  | { name: 'restore_started'; params?: { platform?: string } }
  | { name: 'restore_success'; params?: { platform?: string } }
  | { name: 'restore_failed'; params?: { platform?: string; reason?: string } }
  | { name: 'subscription_expired'; params?: { userId?: string } }
  | { name: 'subscription_grace'; params?: { userId?: string } }
  | { name: 'subscription_revoked'; params?: { userId?: string } }
  | { name: 'ad_requested'; params: { type: string; placement: string } }
  | { name: 'ad_loaded'; params: { type: string; placement: string } }
  | { name: 'ad_failed'; params: { type: string; placement: string } }
  | { name: 'ad_impression'; params: { type: string; placement: string } }
  | { name: 'ad_clicked'; params: { type: string; placement: string } }
  | { name: 'reward_started'; params: { placement: string; rewardType: string } }
  | { name: 'reward_completed'; params: { placement: string; rewardType: string } }
  | { name: 'reward_granted'; params: { placement: string; rewardType: string } }
  | { name: 'reward_failed'; params: { placement: string; rewardType?: string } }
  | { name: 'ad_watched'; params: { type: string } }
  | { name: 'notification_opened'; params: { type: string } }
  | { name: 'custom_category_created'; params: { categoryId: string } }
  | { name: 'category_viewed'; params: { categoryId: string } }
  | { name: 'category_previewed'; params: { categoryId: string } }
  | { name: 'premium_category_locked'; params: { categoryId: string } }
  | { name: 'premium_category_unlocked'; params: { categoryId: string } }
  | { name: 'game_intro_viewed'; params: { categoryId: string; roomId?: string } }
  | { name: 'challenge_viewed'; params: { roomId: string; roundNumber: number } }
  | { name: 'performance_viewed'; params: { roomId: string; roundNumber: number } }
  | { name: 'game_result_viewed'; params: { roomId: string } }
  | { name: 'rematch_started'; params: { roomId: string } }
  | { name: 'custom_content_created'; params: { contentId: string; categoryId: string } }
  | { name: 'friend_search'; params: { queryLength: number } }
  | { name: 'friend_request_sent'; params: { targetUserId: string } }
  | { name: 'friend_request_received'; params: { requesterId: string } }
  | { name: 'friend_request_accepted'; params: { friendshipId: string } }
  | { name: 'friend_request_declined'; params: { friendshipId: string } }
  | { name: 'friend_removed'; params: { targetUserId: string } }
  | { name: 'friend_blocked'; params: { targetUserId: string } }
  | { name: 'friend_invite_sent'; params: { receiverId: string } }
  | { name: 'room_invite_sent'; params: { receiverId: string; referenceId: string } }
  | { name: 'room_invite_opened'; params: { invitationId: string } }
  | { name: 'quiz_invite_sent'; params: { receiverId: string; quizId: string } }
  | { name: 'quiz_invite_opened'; params: { quizId: string } }
  | { name: 'result_shared'; params: { quizId: string; score: number; channel: string } }
  | { name: 'game_result_shared'; params: { roomId: string; rank: number; channel: string } }
  | { name: 'profile_viewed'; params: { targetUserId: string } }
  | { name: 'friend_suggestion_viewed'; params: { count: number } }
  | { name: 'friend_suggestion_hidden'; params: { targetUserId: string } }
  | { name: 'viral_share'; params: { type: string; source: string } }
  | { name: 'viral_open'; params: { type: string; source: string } }
  | { name: 'viral_play'; params: { type: string } }
  | { name: 'viral_complete'; params: { type: string } }
  | { name: 'viral_create'; params: { type: string } }
  | { name: 'home_viewed'; params?: Record<string, never> }
  | { name: 'home_action_clicked'; params: { action: string } }
  | { name: 'profile_edited'; params: { fields: string } }
  | { name: 'badge_viewed'; params?: Record<string, never> }
  | { name: 'badge_unlocked'; params: { badgeId: string } }
  | { name: 'stats_viewed'; params?: Record<string, never> }
  | { name: 'history_viewed'; params: { type: string } }
  | { name: 'settings_viewed'; params?: Record<string, never> }
  | { name: 'privacy_changed'; params: { field: string } }
  | { name: 'notification_settings_changed'; params: { field: string } }
  | { name: 'language_changed'; params: { language: string } }
  | { name: 'theme_changed'; params: { theme: string } }
  | { name: 'help_opened'; params: { articleId: string } }
  | { name: 'support_ticket_created'; params: { category: string } }
  | { name: 'delete_account_started'; params?: Record<string, never> }
  | { name: 'delete_account_completed'; params?: Record<string, never> };

export type AnalyticsEventName = AnalyticsEvent['name'];

export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] = [
  'app_open',
  'signup',
  'login',
  'guest_started',
  'quiz_created',
  'quiz_published',
  'quiz_shared',
  'quiz_opened',
  'quiz_started',
  'quiz_completed',
  'result_viewed',
  'room_created',
  'room_create_started',
  'room_share_clicked',
  'room_code_copied',
  'room_join_started',
  'room_join_success',
  'room_join_failed',
  'room_player_joined',
  'room_player_left',
  'room_ready',
  'room_unready',
  'room_start_clicked',
  'room_started',
  'room_closed',
  'room_expired',
  'room_reconnect',
  'host_changed',
  'room_joined',
  'category_selected',
  'game_start',
  'game_countdown',
  'round_start',
  'question_viewed',
  'answer_started',
  'answer_timeout',
  'round_completed',
  'stage_completed',
  'match_created',
  'score_updated',
  'player_disconnected',
  'player_reconnected',
  'game_resumed',
  'game_completed',
  'game_aborted',
  'game_started',
  'round_started',
  'answer_submitted',
  'invite_shared',
  'invite_clicked',
  'premium_viewed',
  'plan_selected',
  'purchase_started',
  'purchase_pending',
  'purchase_success',
  'purchase_completed',
  'purchase_failed',
  'purchase_cancelled',
  'restore_started',
  'restore_success',
  'restore_failed',
  'subscription_expired',
  'subscription_grace',
  'subscription_revoked',
  'ad_requested',
  'ad_loaded',
  'ad_failed',
  'ad_impression',
  'ad_clicked',
  'reward_started',
  'reward_completed',
  'reward_granted',
  'reward_failed',
  'ad_watched',
  'notification_opened',
  'custom_category_created',
  'category_viewed',
  'category_previewed',
  'premium_category_locked',
  'premium_category_unlocked',
  'game_intro_viewed',
  'challenge_viewed',
  'performance_viewed',
  'game_result_viewed',
  'rematch_started',
  'custom_content_created',
  'friend_search',
  'friend_request_sent',
  'friend_request_received',
  'friend_request_accepted',
  'friend_request_declined',
  'friend_removed',
  'friend_blocked',
  'friend_invite_sent',
  'room_invite_sent',
  'room_invite_opened',
  'quiz_invite_sent',
  'quiz_invite_opened',
  'result_shared',
  'game_result_shared',
  'profile_viewed',
  'friend_suggestion_viewed',
  'friend_suggestion_hidden',
  'viral_share',
  'viral_open',
  'viral_play',
  'viral_complete',
  'viral_create',
  'home_viewed',
  'home_action_clicked',
  'profile_edited',
  'badge_viewed',
  'badge_unlocked',
  'stats_viewed',
  'history_viewed',
  'settings_viewed',
  'privacy_changed',
  'notification_settings_changed',
  'language_changed',
  'theme_changed',
  'help_opened',
  'support_ticket_created',
  'delete_account_started',
  'delete_account_completed',
] as const;

export const isAnalyticsEventName = (name: string): name is AnalyticsEventName =>
  (ANALYTICS_EVENT_NAMES as readonly string[]).includes(name);
