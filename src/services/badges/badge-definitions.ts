import type { BadgeDefinition } from '@/domain/models/badge';

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { id: 'first-quiz', slug: 'first-quiz', name: 'İlk Test', description: 'İlk testini oluşturdun', icon: '📝', rarity: 'common', condition: 'quizzes_created', target: 1 },
  { id: 'first-game', slug: 'first-game', name: 'İlk Oyun', description: 'İlk Arkadaş Ortamı oyununu oynadın', icon: '🎮', rarity: 'common', condition: 'games_played', target: 1 },
  { id: 'quiz-10', slug: 'quiz-10', name: '10 Test', description: '10 test oluşturdun', icon: '📚', rarity: 'rare', condition: 'quizzes_created', target: 10 },
  { id: 'quiz-50', slug: 'quiz-50', name: '50 Test', description: '50 test oluşturdun', icon: '🏆', rarity: 'epic', condition: 'quizzes_created', target: 50 },
  { id: 'first-win', slug: 'first-win', name: 'İlk Galibiyet', description: 'İlk oyununu kazandın', icon: '🥇', rarity: 'common', condition: 'games_won', target: 1 },
  { id: 'win-10', slug: 'win-10', name: '10 Galibiyet', description: '10 oyun kazandın', icon: '👑', rarity: 'rare', condition: 'games_won', target: 10 },
  { id: 'friend-group', slug: 'friend-group', name: 'Arkadaş Grubu', description: '5 arkadaş edindin', icon: '👥', rarity: 'rare', condition: 'friends_count', target: 5 },
  { id: 'quiz-master', slug: 'quiz-master', name: 'Quiz Ustası', description: '25 test tamamladın', icon: '🧠', rarity: 'epic', condition: 'quizzes_completed', target: 25 },
  { id: 'record-breaker', slug: 'record-breaker', name: 'Rekor Kıran', description: '%90+ skor elde ettin', icon: '⚡', rarity: 'epic', condition: 'high_score', target: 90 },
  { id: 'veteran', slug: 'veteran', name: 'NKT Veteran', description: '50 oyun oynadın', icon: '🎖️', rarity: 'legendary', condition: 'games_played', target: 50 },
];
