import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LobbyUiState } from '@/domain/constants/room';
import { StateView } from '@/components/feedback/StateView';
import { colors, spacing, typography } from '@/theme';

interface LobbyStateViewProps {
  state: LobbyUiState;
  onRetry?: () => void;
}

const MESSAGES: Record<LobbyUiState, { title: string; message: string; emoji?: string }> = {
  loading: { title: 'Yükleniyor...', message: 'Oda hazırlanıyor' },
  empty: { title: 'Arkadaşlarını davet et', message: 'Oda kodunu paylaşarak arkadaşlarını çağır!' },
  waiting: { title: 'Oyuncular bekleniyor', message: 'Herkes hazır olunca host oyunu başlatabilir' },
  ready: { title: 'Herkes hazır!', message: 'Host oyunu başlatabilir' },
  host_starting: { title: 'Oyun başlatılıyor', message: 'Hazırlan...' },
  disconnected: { title: 'Bağlantı yenileniyor', message: 'İnternet bağlantın kontrol ediliyor' },
  room_expired: { title: 'Oda süresi dolmuş', message: 'Bu oda artık aktif değil' },
  room_full: { title: 'Oda dolu', message: 'Maksimum oyuncu sayısına ulaşıldı' },
  invalid_room: { title: 'Oda bulunamadı', message: 'Kod yanlış veya oda kapatılmış olabilir' },
  player_removed: { title: 'Odadan çıkarıldın', message: 'Host seni odadan çıkardı' },
  network_error: { title: 'Bağlantı hatası', message: 'Lütfen tekrar dene' },
};

export function LobbyStateView({ state, onRetry }: LobbyStateViewProps) {
  if (state === 'loading') return <StateView type="loading" />;

  const info = MESSAGES[state];
  const isError = ['room_expired', 'room_full', 'invalid_room', 'player_removed', 'network_error'].includes(state);

  if (isError) {
    return (
      <StateView
        type="error"
        title={info.title}
        message={info.message}
        onRetry={state === 'network_error' ? onRetry : undefined}
      />
    );
  }

  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      {info.emoji ? <Text style={styles.emoji}>{info.emoji}</Text> : null}
      <Text style={styles.title}>{info.title}</Text>
      <Text style={styles.message}>{info.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emoji: { fontSize: 28 },
  title: { ...typography.label, color: colors.text },
  message: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
});
