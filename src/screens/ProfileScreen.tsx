import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, gradients, spacing, typography, radii } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import { badgeService } from '@/services/badges/badge.service';
import { analytics } from '@/services/analytics';
import { useTranslation } from '@/hooks/useTranslation';

const MENU_ITEMS = [
  { icon: 'people-outline', label: 'Arkadaşlarım', screen: 'Friends' as const },
  { icon: 'folder-outline', label: 'Kategorilerim', screen: 'MyCategories' as const },
  { icon: 'time-outline', label: 'Test Geçmişim', screen: 'QuizHistory' as const },
  { icon: 'game-controller-outline', label: 'Oyun Geçmişi', screen: 'GameHistory' as const },
  { icon: 'ribbon-outline', label: 'Rozetlerim', screen: 'Badges' as const },
  { icon: 'stats-chart-outline', label: 'İstatistiklerim', screen: 'Statistics' as const },
  { icon: 'settings-outline', label: 'Ayarlar', screen: 'Settings' as const },
];

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const { t: translate } = useTranslation();
  const [rank, setRank] = useState<number | undefined>();

  useFocusEffect(React.useCallback(() => {
    analytics.track({ name: 'profile_viewed', params: { targetUserId: user?.id ?? '' } });
    api.getLeaderboard('global', 'weekly').then((entries) => {
      const mine = entries.find((e) => e.isCurrentUser);
      setRank(mine?.rank);
    }).catch(() => {});
  }, [user?.id]));

  const badgeCount = user ? badgeService.getUnlockedCount(
    badgeService.computeBadges({
      stats: { ...user.stats, gamesPlayed: 5, friendsCount: user.stats.friendsCount, badgesCount: 0, averageScore: user.stats.averageScore },
      gamesWon: 2,
      bestScore: user.stats.averageScore,
    }),
  ) : 0;

  return (
    <ScreenContainer edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{translate('profile.title')}</Text>
        </View>

        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0] ?? '?'}</Text>
            {user?.isPremium ? <Text style={styles.crown}>👑</Text> : null}
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.username}>@{user?.username}</Text>
          {isGuest ? (
            <Button title="Hesap Oluştur" onPress={() => navigation.navigate('Auth')} fullWidth={false} style={styles.editBtn} />
          ) : (
            <Button title={translate('profile.edit')} onPress={() => navigation.navigate('EditProfile')} fullWidth={false} style={styles.editBtn} />
          )}

          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statNum}>{user?.stats.quizzesCreated ?? 0}</Text><Text style={styles.statLabel}>{translate('profile.created')}</Text></View>
            <View style={styles.stat}><Text style={styles.statNum}>{user?.stats.quizzesCompleted ?? 0}</Text><Text style={styles.statLabel}>{translate('profile.completed')}</Text></View>
            <View style={styles.stat}><Text style={styles.statNum}>5</Text><Text style={styles.statLabel}>{translate('profile.games')}</Text></View>
            <View style={styles.stat}><Text style={styles.statNum}>{user?.stats.friendsCount ?? 0}</Text><Text style={styles.statLabel}>{translate('profile.friendsCount')}</Text></View>
          </View>

          {rank ? (
            <TouchableOpacity style={styles.rankRow} onPress={() => navigation.navigate('Main', { screen: 'Leaderboard' })}>
              <Ionicons name="trophy-outline" size={16} color={colors.premiumGold} />
              <Text style={styles.rankText}>{translate('profile.leaderboardRank')}: #{rank}</Text>
            </TouchableOpacity>
          ) : null}
        </Card>

        {user?.isPremium ? (
          <LinearGradient colors={[...gradients.premium]} style={styles.premiumCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <View style={styles.premiumRow}>
              <Text style={styles.premiumEmoji}>👑</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumTitle}>Premium Üye</Text>
                <Text style={styles.premiumDate}>Bitiş: {user.premiumExpiresAt ? new Date(user.premiumExpiresAt).toLocaleDateString('tr-TR') : '—'}</Text>
              </View>
              <Button title="Yönet" onPress={() => navigation.navigate('Premium')} fullWidth={false} variant="secondary" />
            </View>
          </LinearGradient>
        ) : (
          <TouchableOpacity onPress={() => { analytics.track({ name: 'premium_viewed', params: { source: 'profile' } }); navigation.navigate('Premium'); }}>
            <LinearGradient colors={[...gradients.premium]} style={styles.premiumCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.premiumTitle}>Premium&apos;a Geç ✨</Text>
              <Text style={styles.premiumSub}>15 premium kategori • AI • Reklamsız</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={styles.badgePreview}>
          <Text style={styles.badgePreviewTitle}>🏅 {badgeCount} Rozet</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Badges')}>
            <Text style={styles.badgeLink}>Tümünü Gör</Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.menu}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.screen}
              style={[styles.menuItem, i < MENU_ITEMS.length - 1 && styles.menuBorder]}
              onPress={() => navigation.navigate(item.screen)}
            >
              <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={colors.textSecondary} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </Card>
        <View style={{ height: spacing['3xl'] }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.lg },
  title: { ...typography.h2, color: colors.text },
  profileCard: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, position: 'relative' },
  avatarText: { ...typography.h1, color: colors.text },
  crown: { position: 'absolute', bottom: -4, right: -4, fontSize: 20 },
  name: { ...typography.h2, color: colors.text },
  username: { ...typography.caption, color: colors.textSecondary },
  editBtn: { marginTop: spacing.md, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: colors.surfaceBorder, paddingTop: spacing.lg },
  stat: { alignItems: 'center' },
  statNum: { ...typography.h3, color: colors.text },
  statLabel: { ...typography.small, color: colors.textMuted },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  rankText: { ...typography.caption, color: colors.premiumGold },
  premiumCard: { borderRadius: radii['2xl'], padding: spacing.xl, marginBottom: spacing.lg },
  premiumRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  premiumEmoji: { fontSize: 32 },
  premiumTitle: { ...typography.h3, color: colors.text },
  premiumDate: { ...typography.small, color: 'rgba(255,255,255,0.8)' },
  premiumSub: { ...typography.caption, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  badgePreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, paddingHorizontal: spacing.sm },
  badgePreviewTitle: { ...typography.bodyMedium, color: colors.text },
  badgeLink: { ...typography.label, color: colors.primary },
  menu: { padding: 0, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  menuLabel: { ...typography.body, color: colors.text, flex: 1 },
});
