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
import { historyService, type QuizHistoryEntry } from '@/services/history/history.service';
import { api } from '@/api/client';
import { analytics } from '@/services/analytics';

const FILTERS: Array<{ key: QuizHistoryEntry['type'] | 'all'; label: string }> = [
  { key: 'all', label: 'Tümü' },
  { key: 'created', label: 'Oluşturulan' },
  { key: 'completed', label: 'Tamamlanan' },
  { key: 'draft', label: 'Taslak' },
];

export function QuizHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<QuizHistoryEntry['type'] | 'all'>('all');
  const [entries, setEntries] = useState<QuizHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.track({ name: 'history_viewed', params: { type: 'quiz' } });
    const load = async () => {
      if (!user) return;
      const history = await historyService.getQuizHistory(user.id, filter === 'all' ? undefined : filter);
      if (history.data.length === 0) {
        const quizzes = await api.getQuizzes();
        const mapped: QuizHistoryEntry[] = quizzes.map((q) => ({
          id: q.id,
          quiz: q,
          type: q.status === 'draft' ? 'draft' : 'created',
          date: q.createdAt,
        }));
        setEntries(mapped);
      } else {
        setEntries(history.data);
      }
      setLoading(false);
    };
    load();
  }, [user, filter]);

  if (loading) return <StateView type="loading" />;

  return (
    <View style={styles.wrapper}>
      <Header title="Test Geçmişim" />
      <ScreenContainer>
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f.key} style={[styles.filterBtn, filter === f.key && styles.filterActive]} onPress={() => setFilter(f.key)}>
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<StateView type="empty" title="Henüz test yok" message="İlk testini oluştur." />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('SolveQuiz', { quizId: item.quiz.id })}>
              <View style={styles.rowInfo}>
                <Text style={styles.title} numberOfLines={1}>{item.quiz.title}</Text>
                <Text style={styles.meta}>{item.type} • {new Date(item.date).toLocaleDateString('tr-TR')}</Text>
              </View>
              {item.score !== undefined ? <Text style={styles.score}>%{item.score}</Text> : null}
            </TouchableOpacity>
          )}
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: colors.surface },
  filterActive: { backgroundColor: colors.primary },
  filterText: { ...typography.small, color: colors.textMuted },
  filterTextActive: { color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm },
  rowInfo: { flex: 1 },
  title: { ...typography.bodyMedium, color: colors.text },
  meta: { ...typography.small, color: colors.textMuted },
  score: { ...typography.label, color: colors.primary },
});
