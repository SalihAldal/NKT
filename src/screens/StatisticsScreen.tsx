import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StateView } from '@/components/feedback/StateView';
import { colors, spacing, typography, radii } from '@/theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { advancedStatsService } from '@/services/stats/advanced-stats.service';
import type { AdvancedStats } from '@/services/stats/advanced-stats.service';
import { analytics } from '@/services/analytics';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function StatisticsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const [advanced, setAdvanced] = useState<AdvancedStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.track({ name: 'stats_viewed' });
    if (!user) return;
    const stats = {
      quizzesCreated: user.stats.quizzesCreated,
      quizzesCompleted: user.stats.quizzesCompleted,
      gamesPlayed: 5,
      averageScore: user.stats.averageScore,
      friendsCount: user.stats.friendsCount,
      badgesCount: user.stats.badgesCount,
    };
    advancedStatsService.getAdvancedStats(user.id, stats).then((a) => {
      setAdvanced(a);
      setLoading(false);
    });
  }, [user]);

  if (!user) return null;
  if (loading) return <StateView type="loading" />;

  const basic = {
    gamesPlayed: 5,
    quizzesCreated: user.stats.quizzesCreated,
    quizzesCompleted: user.stats.quizzesCompleted,
    averageScore: user.stats.averageScore,
    bestScore: user.stats.averageScore,
    wins: 2,
    winRate: 40,
  };

  return (
    <View style={styles.wrapper}>
      <Header title="İstatistiklerim" />
      <ScreenContainer>
        <ScrollView>
          <Text style={styles.section}>Temel İstatistikler</Text>
          <View style={styles.grid}>
            <StatCard label="Oyun" value={basic.gamesPlayed} />
            <StatCard label="Test Oluşturma" value={basic.quizzesCreated} />
            <StatCard label="Test Tamamlama" value={basic.quizzesCompleted} />
            <StatCard label="Ort. Skor" value={`%${basic.averageScore}`} />
            <StatCard label="En İyi Skor" value={`%${basic.bestScore}`} />
            <StatCard label="Kazanma" value={`%${basic.winRate}`} />
          </View>

          {advanced ? (
            <>
              <Text style={styles.section}>Premium Analiz</Text>
              <Card style={styles.premiumCard}>
                <StatCard label="Doğruluk" value={`%${advanced.answerAccuracy}`} />
                <StatCard label="Kazanma Oranı" value={`%${advanced.winRate}`} />
                {advanced.gameHistory.length === 0 ? (
                  <Text style={styles.emptyPremium}>Detaylı geçmiş verisi henüz yok.</Text>
                ) : null}
              </Card>
            </>
          ) : (
            <Card style={styles.upgradeCard}>
              <Text style={styles.upgradeTitle}>Premium İstatistikler</Text>
              <Text style={styles.upgradeSub}>Kategori analizi, hız ve trend verileri için Premium&apos;a geç.</Text>
              <Button title="Premium&apos;a Geç" onPress={() => navigation.navigate('Premium')} fullWidth={false} />
            </Card>
          )}
        </ScrollView>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  section: { ...typography.label, color: colors.textMuted, marginBottom: spacing.md, marginTop: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCard: { width: '47%', backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, alignItems: 'center' },
  statValue: { ...typography.h2, color: colors.primary },
  statLabel: { ...typography.small, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  premiumCard: { gap: spacing.md },
  emptyPremium: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  upgradeCard: { marginTop: spacing.xl, alignItems: 'center', gap: spacing.md },
  upgradeTitle: { ...typography.h3, color: colors.text },
  upgradeSub: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
});
