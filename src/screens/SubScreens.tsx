import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { colors, spacing, typography } from '@/theme';

type Props = { title: string; description: string };

export function PlaceholderScreen({ title, description }: Props) {
  return (
    <View style={styles.wrapper}>
      <Header title={title} />
      <ScreenContainer>
        <Text style={styles.desc}>{description}</Text>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  desc: { ...typography.body, color: colors.textSecondary },
});

export { PrivacySettingsScreen, NotificationSettingsScreen } from './SocialSettingsScreens';
export { EditProfileScreen } from './EditProfileScreen';
export { BadgesScreen } from './BadgesScreen';
export { StatisticsScreen } from './StatisticsScreen';
export { GameHistoryScreen } from './GameHistoryScreen';
export { QuizHistoryScreen } from './QuizHistoryScreen';
export { HelpCenterScreen } from './HelpCenterScreen';
export { LanguageSettingsScreen } from './LanguageSettingsScreen';
export { ThemeSettingsScreen } from './ThemeSettingsScreen';
export { ContactUsScreen } from './ContactUsScreen';
export { AboutScreen } from './legal/AboutScreen';
export { PrivacyPolicyScreen } from './legal/PrivacyPolicyScreen';
export { TermsOfServiceScreen } from './legal/TermsOfServiceScreen';
export { OpenSourceLicensesScreen } from './legal/OpenSourceLicensesScreen';
export const FavoritesScreen = () => <PlaceholderScreen title="Favori Testler" description="Favori testlerin burada görünür." />;
