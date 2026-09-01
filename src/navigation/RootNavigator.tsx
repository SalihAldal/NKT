import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { linking } from '@/navigation/linking';
import type { RootStackParamList } from '@/navigation/types';
import { MainTabs } from '@/navigation/MainTabs';
import { SplashScreen } from '@/screens/SplashScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import { RecoveryCodeScreen } from '@/screens/RecoveryCodeScreen';
import { ForgotPasswordScreen } from '@/screens/ForgotPasswordScreen';
import { SelectTestTypeScreen } from '@/screens/SelectTestTypeScreen';
import { CreateQuizScreen } from '@/screens/CreateQuizScreen';
import { EditQuestionsScreen } from '@/screens/EditQuestionsScreen';
import { ShareQuizScreen } from '@/screens/ShareQuizScreen';
import { IncomingQuizScreen } from '@/screens/InboxScreen';
import { SolveQuizScreen } from '@/screens/SolveQuizScreen';
import { ResultScreen } from '@/screens/ResultScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { QuestionEditorScreen } from '@/screens/QuestionEditorScreen';
import { QuizPreviewScreen } from '@/screens/QuizPreviewScreen';
import { PremiumScreen } from '@/screens/PremiumScreen';
import { FriendRoomScreen } from '@/screens/FriendRoomScreen';
import { JoinRoomScreen } from '@/screens/JoinRoomScreen';
import { LobbyScreen } from '@/screens/LobbyScreen';
import { CategorySelectScreen } from '@/screens/CategorySelectScreen';
import { GameIntroScreen } from '@/screens/GameIntroScreen';
import { GameResultScreen } from '@/screens/GameResultScreen';
import { MyCategoriesScreen } from '@/screens/MyCategoriesScreen';
import { GameScreen } from '@/screens/GameScreen';
import { FriendsScreen } from '@/screens/FriendsScreen';
import { FriendProfileScreen } from '@/screens/FriendProfileScreen';
import { NotificationCenterScreen } from '@/screens/NotificationCenterScreen';
import { UserSearchScreen } from '@/screens/UserSearchScreen';
import {
  PrivacySettingsScreen, NotificationSettingsScreen,
  LanguageSettingsScreen, ThemeSettingsScreen, HelpCenterScreen, ContactUsScreen,
  AboutScreen, PrivacyPolicyScreen, TermsOfServiceScreen, OpenSourceLicensesScreen,
  FavoritesScreen, BadgesScreen, StatisticsScreen,
  GameHistoryScreen, QuizHistoryScreen, EditProfileScreen,
} from '@/screens/SubScreens';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.background, card: colors.background, text: colors.text, border: colors.surfaceBorder, primary: colors.primary },
};

export function RootNavigator() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme} linking={linking}>
          <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="RecoveryCode" component={RecoveryCodeScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="SelectTestType" component={SelectTestTypeScreen} />
            <Stack.Screen name="CreateQuiz" component={CreateQuizScreen} />
            <Stack.Screen name="EditQuestions" component={EditQuestionsScreen} />
            <Stack.Screen name="ShareQuiz" component={ShareQuizScreen} />
            <Stack.Screen name="IncomingQuiz" component={IncomingQuizScreen} />
            <Stack.Screen name="SolveQuiz" component={SolveQuizScreen} />
            <Stack.Screen name="Result" component={ResultScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="QuestionEditor" component={QuestionEditorScreen} />
            <Stack.Screen name="QuizPreview" component={QuizPreviewScreen} />
            <Stack.Screen name="Premium" component={PremiumScreen} />
            <Stack.Screen name="FriendRoom" component={FriendRoomScreen} />
            <Stack.Screen name="JoinRoom" component={JoinRoomScreen} />
            <Stack.Screen name="Lobby" component={LobbyScreen} />
            <Stack.Screen name="CategorySelect" component={CategorySelectScreen} />
            <Stack.Screen name="GameIntro" component={GameIntroScreen} />
            <Stack.Screen name="Game" component={GameScreen} />
            <Stack.Screen name="GameResult" component={GameResultScreen} />
            <Stack.Screen name="MyCategories" component={MyCategoriesScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="GameHistory" component={GameHistoryScreen} />
            <Stack.Screen name="QuizHistory" component={QuizHistoryScreen} />
            <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
            <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} />
            <Stack.Screen name="ThemeSettings" component={ThemeSettingsScreen} />
            <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
            <Stack.Screen name="ContactUs" component={ContactUsScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
            <Stack.Screen name="OpenSourceLicenses" component={OpenSourceLicensesScreen} />
            <Stack.Screen name="TestHistory" component={QuizHistoryScreen} />
            <Stack.Screen name="Favorites" component={FavoritesScreen} />
            <Stack.Screen name="Friends" component={FriendsScreen} />
            <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
            <Stack.Screen name="UserSearch" component={UserSearchScreen} />
            <Stack.Screen name="NotificationCenter" component={NotificationCenterScreen} />
            <Stack.Screen name="Badges" component={BadgesScreen} />
            <Stack.Screen name="Statistics" component={StatisticsScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
