/**
 * Database-ready relational contract documentation.
 * Maps domain entities to future PostgreSQL tables.
 *
 * Relationships:
 * - User 1:1 Profile
 * - User 1:N AuthIdentity
 * - User 1:N Friend (as userId)
 * - User 1:N Quiz (as creatorId)
 * - User 1:N Subscription
 * - User 1:N Purchase
 * - User 1:N Notification
 * - User 1:N Report (as reporterId)
 * - User 1:N Block (as blockerId)
 * - User 1:N CustomCategory (as ownerId)
 * - User 1:1 Entitlement (current)
 *
 * - Quiz 1:N QuizQuestion
 * - Quiz 1:N QuizSession
 * - QuizSession 1:1 QuizResult
 * - QuizResult 1:N QuizAnswer (embedded or separate table)
 *
 * - Category 1:N GameContent
 * - CustomCategory N:N GameContent (via contentIds)
 *
 * - GameRoom 1:N RoomPlayer
 * - GameRoom 1:N GameRound
 * - GameRound 1:N Match
 * - GameRoom 1:N GameScore (aggregated)
 *
 * - GameContent N:1 Category
 * - Report N:1 User (reporter)
 * - Block N:1 User (blocker, blocked)
 */

export interface DatabaseRelationMap {
  users: { primaryKey: 'id'; foreignKeys: [] };
  profiles: { primaryKey: 'userId'; foreignKeys: ['userId -> users.id'] };
  auth_identities: {
    primaryKey: 'id';
    foreignKeys: ['userId -> users.id'];
    unique: ['provider + providerId'];
  };
  friends: {
    primaryKey: 'id';
    foreignKeys: ['userId -> users.id', 'friendUserId -> users.id'];
  };
  quizzes: { primaryKey: 'id'; foreignKeys: ['creatorId -> users.id', 'categoryId -> categories.id'] };
  quiz_questions: { primaryKey: 'id'; foreignKeys: ['quizId -> quizzes.id'] };
  quiz_sessions: { primaryKey: 'id'; foreignKeys: ['quizId -> quizzes.id', 'solverId -> users.id'] };
  quiz_results: { primaryKey: 'id'; foreignKeys: ['sessionId -> quiz_sessions.id', 'quizId -> quizzes.id'] };
  categories: { primaryKey: 'id'; foreignKeys: [] };
  game_contents: { primaryKey: 'id'; foreignKeys: ['categoryId -> categories.id'] };
  game_rooms: { primaryKey: 'id'; foreignKeys: ['hostUserId -> users.id']; unique: ['code'] };
  room_players: { primaryKey: 'id'; foreignKeys: ['roomId -> game_rooms.id', 'userId -> users.id'] };
  game_rounds: { primaryKey: 'id'; foreignKeys: ['roomId -> game_rooms.id', 'contentId -> game_contents.id'] };
  matches: {
    primaryKey: 'id';
    foreignKeys: ['roundId -> game_rounds.id', 'playerId -> room_players.id'];
  };
  game_scores: { primaryKey: 'id'; foreignKeys: ['roomId -> game_rooms.id', 'playerId -> room_players.id'] };
  subscriptions: { primaryKey: 'id'; foreignKeys: ['userId -> users.id'] };
  purchases: { primaryKey: 'id'; foreignKeys: ['userId -> users.id'] };
  entitlements: { primaryKey: 'userId'; foreignKeys: ['userId -> users.id'] };
  notifications: { primaryKey: 'id'; foreignKeys: ['userId -> users.id'] };
  reports: { primaryKey: 'id'; foreignKeys: ['reporterId -> users.id'] };
  blocks: { primaryKey: 'id'; foreignKeys: ['blockerId -> users.id', 'blockedUserId -> users.id'] };
  custom_categories: { primaryKey: 'id'; foreignKeys: ['ownerId -> users.id'] };
}

export type TableName = keyof DatabaseRelationMap;
