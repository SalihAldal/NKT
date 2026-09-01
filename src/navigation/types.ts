import type { NavigatorScreenParams } from '@react-navigation/native';
import type { QuizAttempt } from '@/types';

export type MainTabParamList = {
  Home: undefined;
  Friends: undefined;
  Create: undefined;
  Leaderboard: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Auth: { inviteUserId?: string } | undefined;
  RecoveryCode: { code: string };
  ForgotPassword: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  SelectTestType: undefined;
  CreateQuiz: undefined;
  EditQuestions: undefined;
  ShareQuiz: { quizId: string };
  IncomingQuiz: { quizId?: string } | undefined;
  SolveQuiz: { quizId?: string; shareCode?: string };
  QuizPreview: undefined;
  Result: { quizId: string; attempt?: QuizAttempt };
  Settings: undefined;
  EditProfile: undefined;
  GameHistory: undefined;
  QuizHistory: undefined;
  PrivacySettings: undefined;
  NotificationSettings: undefined;
  LanguageSettings: undefined;
  ThemeSettings: undefined;
  HelpCenter: undefined;
  ContactUs: undefined;
  About: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  OpenSourceLicenses: undefined;
  TestHistory: undefined;
  Favorites: undefined;
  Friends: { tab?: string; token?: string } | undefined;
  FriendProfile: { userId?: string; username?: string };
  UserSearch: undefined;
  NotificationCenter: undefined;
  Badges: undefined;
  Statistics: undefined;
  Premium: undefined;
  QuestionEditor: { questionId?: string };
  FriendRoom: undefined;
  JoinRoom: { code?: string } | undefined;
  Lobby: { action?: 'create' } | undefined;
  CategorySelect: undefined;
  GameIntro: { categoryId: string };
  Game: { gameId?: string } | undefined;
  GameResult: { roomId: string; gameId?: string };
  MyCategories: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
