import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { StateView } from '@/components/feedback/StateView';
import { colors, spacing, typography, radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { historyService, type GameHistoryEntry } from '@/services/history/history.service';
import { analytics } from '@/services/analytics';

export function GameHistoryScreen() {
  const user = useAuthStore((s) => s.user);
  const [entries, setEntries] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const result = await historyService.getGameHistory(user.id);
    setEntries(result.data);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    analytics.track({ name: 'history_viewed', params: { type: 'game' } });
    load();
  }, [load]);

  if (loading) return <StateView type="loading" />;

  return (
    <View style={styles.wrapper}>
      <Header title="Oyun Geçmişi" />
      <ScreenContainer>
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<StateView type="empty" title="Henüz oyun yok" message="Arkadaşlarınla bir oyun başlat." />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.category}>{item.categoryName}</Text>
                <Text style={styles.date}>{new Date(item.date).toLocaleDateString('tr-TR')}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rank}>#{item.rank}</Text>
                <Text style={styles.score}>{item.score} puan</Text>
                <Text style={styles.players}>{item.playerCount} oyuncu</Text>
              </View>
              {item.status === 'in_progress' ? <View style={styles.badge}><Text style={styles.badgeText}>Devam</Text></View> : null}
            </View>
          )}
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.md },
  rowLeft: { flex: 1 },
  category: { ...typography.bodyMedium, color: colors.text },
  date: { ...typography.small, color: colors.textMuted },
  rowRight: { alignItems: 'flex-end' },
  rank: { ...typography.h3, color: colors.primary },
  score: { ...typography.caption, color: colors.textSecondary },
  players: { ...typography.small, color: colors.textMuted },
  badge: { backgroundColor: colors.warning, borderRadius: radii.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { ...typography.small, color: colors.text, fontSize: 10 },
});
