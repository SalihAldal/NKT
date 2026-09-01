import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Button } from '@/components/ui/Button';
import { colors, gradients, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { getCategoryById } from '@/domain/constants/categories';
import { getCategoryTypeLines, getGameplayStyleSummary } from '@/domain/constants/category-display';
import { getCategoryContentMix } from '@/domain/constants/category-mix';
import { GAME_CONFIG } from '@/domain/constants/game';
import { useRoomStore } from '@/store/roomStore';
import { apiServices } from '@/api/client';
import { useGameStore } from '@/store/gameStore';
import { analytics } from '@/services/analytics';
import { isAppError } from '@/services/errors/app-error';
import { realtimeClient } from '@/services/realtime/realtime-client';
import { REALTIME_EVENTS } from '@/services/realtime/events';

export function GameIntroScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GameIntro'>>();
  const membership = useRoomStore((s) => s.membership);
  const initGame = useGameStore((s) => s.initGame);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const category = getCategoryById(route.params.categoryId);
  const isHost = membership?.player.isHost ?? false;

  useEffect(() => {
    if (!membership || isHost) return;
    const unsub = realtimeClient.on(REALTIME_EVENTS.GAME_STARTED, (event) => {
      if (event.roomId !== membership.room.id) return;
      const gameId = (event.payload as { gameId?: string }).gameId;
      if (gameId) {
        void initGame(gameId, {
          playerId: membership.player.id,
          sessionToken: membership.sessionToken,
          roomId: membership.room.id,
        });
        navigation.replace('Game', { gameId });
      }
    });
    return unsub;
  }, [membership, isHost, initGame, navigation]);

  useEffect(() => {
    if (category) {
      analytics.track({ name: 'game_intro_viewed', params: { categoryId: category.id, roomId: membership?.room.id } });
    }
  }, [category, membership?.room.id]);

  const handleStart = async () => {
    if (!membership || !isHost) return;
    setLoading(true);
    setError('');
    try {
      const ctx = {
        roomId: membership.room.id,
        playerId: membership.player.id,
        sessionToken: membership.sessionToken,
      };
      const room = await apiServices.room.startGame(ctx);
      const gameId = room.currentGameId;
      if (!gameId) throw new Error('Oyun başlatılamadı');
      await initGame(gameId, ctx);
      navigation.replace('Game', { gameId });
    } catch (e) {
      setError(isAppError(e) ? e.userMessage : 'Oyun başlatılamadı');
    } finally {
      setLoading(false);
    }
  };

  if (!category) {
    return (
      <ScreenContainer>
        <Text style={styles.error}>Kategori bulunamadı</Text>
      </ScreenContainer>
    );
  }

  const mix = getCategoryContentMix(category.id);
  const typeLines = getCategoryTypeLines(category);

  return (
    <ScreenContainer>
      <Button
        title=""
        onPress={() => navigation.goBack()}
        variant="ghost"
        icon={<Ionicons name="arrow-back" size={24} color={colors.text} />}
        fullWidth={false}
        style={styles.back}
      />

      <LinearGradient colors={[...gradients.primarySoft]} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={styles.icon}>{category.icon}</Text>
        <Text style={styles.title}>{category.name}</Text>
        <Text style={styles.desc}>{category.description}</Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Oyun Tarzı</Text>
          {typeLines.map((line) => (
            <Text key={line} style={styles.line}>{line}</Text>
          ))}
          <Text style={styles.hint}>{getGameplayStyleSummary(category)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kurallar</Text>
          <Text style={styles.line}>📋 {GAME_CONFIG.TOTAL_QUESTIONS} soru</Text>
          <Text style={styles.line}>🎯 3 aşama (EASY → MEDIUM → HARD)</Text>
          <Text style={styles.line}>👥 Eşleşmeli oyun</Text>
          <Text style={styles.line}>📈 Her 10 soruda zorluk artar</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İçerik Dağılımı</Text>
          {Object.entries(mix).map(([type, pct]) => (
            <Text key={type} style={styles.line}>{type}: %{pct}</Text>
          ))}
          <Text style={styles.hint}>~{membership?.room.isPremiumRoom ? 'Premium' : 'Free'} · Pool: aktif içerikler</Text>
        </View>
      </ScrollView>

      {isHost ? (
        <Button title={loading ? 'Başlatılıyor...' : 'Başla'} onPress={handleStart} disabled={loading} />
      ) : (
        <Text style={styles.wait}>Host oyunu başlatmayı bekliyor...</Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginBottom: spacing.lg, minWidth: 44, minHeight: 44 },
  hero: { borderRadius: 24, padding: spacing.xl, marginBottom: spacing.lg, gap: spacing.sm },
  icon: { fontSize: 48 },
  title: { ...typography.h1, color: colors.text },
  desc: { ...typography.body, color: colors.textSecondary },
  scroll: { flex: 1, marginBottom: spacing.lg },
  section: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md, gap: spacing.xs },
  sectionTitle: { ...typography.label, color: colors.text, marginBottom: spacing.xs },
  line: { ...typography.body, color: colors.textSecondary },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  wait: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  error: { ...typography.small, color: colors.error, marginTop: spacing.md },
});
