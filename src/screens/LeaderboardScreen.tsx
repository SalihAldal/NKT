import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { StateView } from '@/components/feedback/StateView';
import { colors, spacing, typography, radii } from '@/theme';
import { api } from '@/api/client';
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardScope } from '@/types';

export function LeaderboardScreen() {
  const [scope, setScope] = useState<LeaderboardScope>('friends');
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await api.getLeaderboard(scope, period);
      setEntries(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [scope, period]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <ScreenContainer edges={['top']}>
      <Text style={styles.title}>Leaderboard</Text>

      <View style={styles.tabs}>
        {(['friends', 'global'] as const).map((s) => (
          <TouchableOpacity key={s} style={[styles.tab, scope === s && styles.tabActive]} onPress={() => setScope(s)}>
            <Text style={[styles.tabText, scope === s && styles.tabTextActive]}>{s === 'friends' ? 'Arkadaşlar' : 'Global'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.subTabs}>
        {(['weekly', 'monthly', 'all_time'] as const).map((p) => (
          <TouchableOpacity key={p} style={[styles.subTab, period === p && styles.subTabActive]} onPress={() => setPeriod(p)}>
            <Text style={[styles.subTabText, period === p && styles.subTabTextActive]}>
              {p === 'weekly' ? 'Haftalık' : p === 'monthly' ? 'Aylık' : 'Tüm Zamanlar'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <StateView type="loading" /> : null}
      {error ? <StateView type="error" onRetry={load} /> : null}

      {!loading && !error ? (
        <>
          <View style={styles.podium}>
            {[top3[1], top3[0], top3[2]].map((entry, i) => entry ? (
              <View key={entry.userId} style={[styles.podiumItem, i === 1 && styles.podiumFirst]}>
                {i === 1 ? <Text style={styles.crown}>👑</Text> : null}
                <View style={styles.podiumAvatar}><Text style={styles.podiumInitial}>{entry.name[0]}</Text></View>
                <Text style={styles.podiumName} numberOfLines={1}>{entry.name}</Text>
                <Text style={styles.podiumScore}>%{entry.percentage}</Text>
              </View>
            ) : null)}
          </View>

          <FlatList
            data={rest}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => (
              <View style={[styles.row, item.isCurrentUser && styles.rowHighlight]}>
                <Text style={styles.rank}>{item.rank}</Text>
                <View style={styles.rowAvatar}><Text style={styles.rowInitial}>{item.name[0]}</Text></View>
                <Text style={styles.rowName} numberOfLines={1}>{item.isCurrentUser ? 'Sen' : item.name}</Text>
                <Text style={styles.rowScore}>%{item.percentage}</Text>
                <Text style={styles.rowRaw}>{item.score}/{item.totalQuestions}</Text>
              </View>
            )}
          />
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.lg },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radii.full, padding: 4, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radii.full },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.label, color: colors.textMuted },
  tabTextActive: { color: colors.text },
  subTabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  subTab: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: colors.surface },
  subTabActive: { backgroundColor: 'rgba(139,92,246,0.2)' },
  subTabText: { ...typography.small, color: colors.textMuted },
  subTabTextActive: { color: colors.primary },
  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: spacing.md, marginBottom: spacing.xl, minHeight: 140 },
  podiumItem: { alignItems: 'center', flex: 1 },
  podiumFirst: { marginBottom: 20 },
  crown: { fontSize: 20, marginBottom: 4 },
  podiumAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  podiumInitial: { ...typography.h3, color: colors.text },
  podiumName: { ...typography.caption, color: colors.text, marginTop: 4 },
  podiumScore: { ...typography.label, color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radii.lg, marginBottom: spacing.sm, gap: spacing.md },
  rowHighlight: { backgroundColor: 'rgba(139,92,246,0.15)', borderWidth: 1, borderColor: colors.primary },
  rank: { ...typography.label, color: colors.textMuted, width: 24 },
  rowAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  rowInitial: { ...typography.caption, color: colors.text },
  rowName: { ...typography.bodyMedium, color: colors.text, flex: 1 },
  rowScore: { ...typography.label, color: colors.primary },
  rowRaw: { ...typography.small, color: colors.textMuted },
});
