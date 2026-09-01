import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { StateView } from '@/components/feedback/StateView';
import { colors, spacing, typography, radii } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { badgeService } from '@/services/badges/badge.service';
import type { UserBadge } from '@/domain/models/badge';
import { analytics } from '@/services/analytics';

const RARITY_COLORS = { common: colors.textMuted, rare: '#60A5FA', epic: colors.primary, legendary: colors.premiumGold };

export function BadgesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [selected, setSelected] = useState<UserBadge | null>(null);

  useEffect(() => {
    analytics.track({ name: 'badge_viewed' });
    if (!user) return;
    const computed = badgeService.computeBadges({
      stats: { ...user.stats, gamesPlayed: user.stats.quizzesCompleted > 0 ? 5 : 0, friendsCount: user.stats.friendsCount, badgesCount: 0, averageScore: user.stats.averageScore },
      gamesWon: 2,
      bestScore: user.stats.averageScore,
    });
    setBadges(computed);
  }, [user]);

  const unlocked = badges.filter((b) => b.isUnlocked).length;

  return (
    <View style={styles.wrapper}>
      <Header title="Rozetlerim" />
      <ScreenContainer>
        <Text style={styles.summary}>{unlocked} / {badges.length} rozet kazanıldı</Text>
        {badges.length === 0 ? (
          <StateView type="empty" title="Henüz rozet yok" message="İlk rozetini kazanmak için oynamaya başla." />
        ) : (
          <FlatList
            data={badges}
            keyExtractor={(item) => item.badgeId}
            numColumns={2}
            columnWrapperStyle={styles.row}
            renderItem={({ item }) => {
              const def = badgeService.getDefinition(item.badgeId);
              if (!def) return null;
              return (
                <TouchableOpacity
                  style={[styles.badgeCard, !item.isUnlocked && styles.badgeLocked]}
                  onPress={() => setSelected(item)}
                >
                  <Text style={styles.badgeIcon}>{def.icon}</Text>
                  <Text style={styles.badgeName} numberOfLines={1}>{def.name}</Text>
                  {!item.isUnlocked ? (
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${(item.progress / item.target) * 100}%` }]} />
                    </View>
                  ) : null}
                  <Text style={styles.progressText}>{item.progress}/{item.target}</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
        {selected ? (
          <View style={styles.detail}>
            <Text style={styles.detailIcon}>{badgeService.getDefinition(selected.badgeId)?.icon}</Text>
            <Text style={styles.detailName}>{badgeService.getDefinition(selected.badgeId)?.name}</Text>
            <Text style={styles.detailDesc}>{badgeService.getDefinition(selected.badgeId)?.description}</Text>
            {selected.isUnlocked ? (
              <Text style={styles.unlocked}>✓ Kazanıldı</Text>
            ) : (
              <Text style={styles.progressDetail}>{selected.progress} / {selected.target} tamamlandı</Text>
            )}
            <TouchableOpacity onPress={() => setSelected(null)}><Text style={styles.closeDetail}>Kapat</Text></TouchableOpacity>
          </View>
        ) : null}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  summary: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg, textAlign: 'center' },
  row: { gap: spacing.md, marginBottom: spacing.md },
  badgeCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, alignItems: 'center', gap: spacing.xs },
  badgeLocked: { opacity: 0.6 },
  badgeIcon: { fontSize: 36 },
  badgeName: { ...typography.label, color: colors.text, textAlign: 'center' },
  progressBar: { width: '100%', height: 4, backgroundColor: colors.surfaceBorder, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  progressText: { ...typography.small, color: colors.textMuted },
  detail: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.backgroundElevated, borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'], padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  detailIcon: { fontSize: 48 },
  detailName: { ...typography.h3, color: colors.text },
  detailDesc: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  unlocked: { ...typography.label, color: colors.success },
  progressDetail: { ...typography.caption, color: colors.primary },
  closeDetail: { ...typography.label, color: colors.textMuted, marginTop: spacing.md },
});
