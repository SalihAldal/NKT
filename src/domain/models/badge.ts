export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type BadgeConditionType =
  | 'quizzes_created'
  | 'quizzes_completed'
  | 'games_played'
  | 'games_won'
  | 'friends_count'
  | 'high_score';

export interface BadgeDefinition {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  condition: BadgeConditionType;
  target: number;
}

export interface UserBadge {
  badgeId: string;
  unlockedAt?: string;
  progress: number;
  target: number;
  isUnlocked: boolean;
}
