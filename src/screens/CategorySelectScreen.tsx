import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useRoomStore } from '@/store/roomStore';
import { useAuthStore } from '@/store/authStore';
import { apiServices } from '@/api/client';
import { isAppError } from '@/services/errors/app-error';
import { ageRestrictionService } from '@/services/content/age-restriction.service';
import { getCategoryTypeLines, getGameplayStyleSummary } from '@/domain/constants/category-display';
import { analytics } from '@/services/analytics';
import { paywallContext } from '@/services/monetization/paywall-context';
import type { Category } from '@/domain/models/category';
import { realtimeClient } from '@/services/realtime/realtime-client';
import { REALTIME_EVENTS } from '@/services/realtime/events';
import { useGameStore } from '@/store/gameStore';

type CategoryStat = Category & { contentCount?: number; warning?: boolean };

export function CategorySelectScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const membership = useRoomStore((s) => s.membership);
  const isGuest = useAuthStore((s) => s.isGuest);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<CategoryStat | null>(null);
  const [premiumModal, setPremiumModal] = useState<CategoryStat | null>(null);
  const [ageModal, setAgeModal] = useState<CategoryStat | null>(null);

  const isPremiumRoom = membership?.room.isPremiumRoom ?? false;
  const isHost = membership?.player.isHost ?? false;
  const initGame = useGameStore((s) => s.initGame);

  useEffect(() => {
    if (!membership || isHost) return;
    const unsubCategory = realtimeClient.on(REALTIME_EVENTS.CATEGORY_SELECTED, (event) => {
      if (event.roomId !== membership.room.id) return;
      const categoryId = (event.payload as { categoryId?: string }).categoryId;
      if (categoryId) navigation.navigate('GameIntro', { categoryId });
    });
    const unsubGame = realtimeClient.on(REALTIME_EVENTS.GAME_STARTED, (event) => {
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
    return () => { unsubCategory(); unsubGame(); };
  }, [membership, isHost, initGame, navigation]);

  useEffect(() => {
    void apiServices.category.getStats().then((cats) => {
      const safeCategories = Array.isArray(cats) ? cats : [];
      setCategories(safeCategories);
      safeCategories.forEach((c) => analytics.track({ name: 'category_viewed', params: { categoryId: c.id } }));
      if (!Array.isArray(cats)) {
        setError('Kategori listesi gecici olarak alinamadi. Lutfen tekrar dene.');
      }
    });
  }, []);

  if (!isHost) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Kategori Seçimi</Text>
        <Text style={styles.sub}>
          {isPremiumRoom ? '👑 Bu oda Premium — host kategori seçiyor.' : 'Host kategori seçiyor, lütfen bekle...'}
        </Text>
      </ScreenContainer>
    );
  }

  const proceedSelect = async (categoryId: string) => {
    if (!membership) return;
    setLoading(true);
    setError('');
    try {
      const ctx = {
        roomId: membership.room.id,
        playerId: membership.player.id,
        sessionToken: membership.sessionToken,
      };
      await apiServices.room.selectCategory(ctx, categoryId);
      analytics.track({ name: 'category_selected', params: { categoryId, roomId: membership.room.id } });
      setPreview(null);
      setAgeModal(null);
      navigation.navigate('GameIntro', { categoryId });
    } catch (e) {
      setError(isAppError(e) ? e.userMessage : 'Kategori seçilemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleCardPress = (cat: CategoryStat) => {
    const locked = !cat.isFree && !isPremiumRoom;
    const ageBlocked = !ageRestrictionService.canAccessCategory(cat.id, { isGuest, userId: membership?.player.userId });

    analytics.track({ name: 'category_previewed', params: { categoryId: cat.id } });

    if (locked) {
      analytics.track({ name: 'premium_category_locked', params: { categoryId: cat.id } });
      setPremiumModal(cat);
      return;
    }
    if (ageBlocked) {
      setError('+18 içerik için yaş doğrulaması gerekli.');
      return;
    }
    if (cat.ageRating === '18+') {
      setAgeModal(cat);
      return;
    }
    setPreview(cat);
  };

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
      <Text style={styles.title}>Kategori Seç</Text>
      <Text style={styles.sub}>
        {isPremiumRoom ? '👑 Premium oda — tüm kategoriler açık.' : 'Ücretsiz kategoriler açık. Premium kategoriler kilitli.'}
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {categories.map((cat) => {
          const locked = !cat.isFree && !isPremiumRoom;
          const ageBlocked = !ageRestrictionService.canAccessCategory(cat.id, { isGuest, userId: membership?.player.userId });
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.card, locked && styles.lockedCard, cat.warning && styles.warningCard]}
              onPress={() => handleCardPress(cat)}
              disabled={loading || ageBlocked}
              accessibilityRole="button"
            >
              <Text style={styles.icon}>{cat.icon}</Text>
              <View style={styles.cardInfo}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{cat.name}</Text>
                  {cat.isFree ? <Text style={styles.badgeFree}>FREE</Text> : <Text style={styles.badgePremium}>👑</Text>}
                </View>
                <Text style={styles.cardDesc}>{cat.description}</Text>
                {cat.warning ? (
                  <Text style={styles.warningText}>⚠ {cat.contentCount ?? 0} / {cat.minimumContentTarget}</Text>
                ) : null}
              </View>
              {locked ? <Ionicons name="lock-closed" size={20} color={colors.textMuted} /> : null}
              {cat.ageRating === '18+' ? <Text style={styles.ageBadge}>18+</Text> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Category Preview Modal */}
      <Modal visible={!!preview} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            {preview ? (
              <>
                <Text style={styles.modalIcon}>{preview.icon}</Text>
                <Text style={styles.modalTitle}>{preview.name}</Text>
                <Text style={styles.modalDesc}>{preview.description}</Text>
                {getCategoryTypeLines({ supportedContentTypes: preview.supportedContentTypes as ('question' | 'challenge' | 'performance')[] }).map((l) => (
                  <Text key={l} style={styles.modalLine}>{l}</Text>
                ))}
                <Text style={styles.modalHint}>{getGameplayStyleSummary({ supportedContentTypes: preview.supportedContentTypes as ('question' | 'challenge' | 'performance')[] })}</Text>
                <Text style={styles.modalHint}>Pool: ~{preview.contentCount ?? 0} içerik · 30 tur · 3 aşama</Text>
                <Button title="Bu Kategoriyi Seç" onPress={() => proceedSelect(preview.id)} loading={loading} />
                <Button title="İptal" onPress={() => setPreview(null)} variant="ghost" />
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Premium Lock Modal */}
      <Modal visible={!!premiumModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Ionicons name="lock-closed" size={40} color={colors.premiumGold} />
            <Text style={styles.modalTitle}>Premium Kategori</Text>
            <Text style={styles.modalDesc}>
              {premiumModal?.name} premium üyelik gerektirir. Premium oda oluşturmak için Premium ol.
              {'\n\n'}Mevcut bir premium host odasına katılırsan satın almana gerek yok.
            </Text>
            <Button title="Premium Oda İçin Premium'a Geç" onPress={() => {
              paywallContext.set('locked_category');
              setPremiumModal(null);
              navigation.navigate('Premium');
            }} />
            <Button title="Kapat" onPress={() => setPremiumModal(null)} variant="ghost" />
          </View>
        </View>
      </Modal>

      {/* +18 Age Modal */}
      <Modal visible={!!ageModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.ageBadge}>18+</Text>
            <Text style={styles.modalTitle}>Yetişkin İçerik Uyarısı</Text>
            <Text style={styles.modalDesc}>
              Bu kategori yetişkinlere özel içerikler içerir. Devam ederek 18 yaş üstü olduğunu onaylıyorsun.
            </Text>
            <Button title="Devam Et" onPress={() => ageModal && proceedSelect(ageModal.id)} />
            <Button title="İptal" onPress={() => setAgeModal(null)} variant="ghost" />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginBottom: spacing.lg, minWidth: 44, minHeight: 44 },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.sm },
  sub: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: 16, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.surfaceBorder,
  },
  lockedCard: { opacity: 0.55 },
  warningCard: { borderColor: colors.warning + '66' },
  icon: { fontSize: 32 },
  cardInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...typography.label, color: colors.text },
  badgeFree: { ...typography.small, color: colors.success, fontWeight: '700' },
  badgePremium: { fontSize: 14 },
  cardDesc: { ...typography.caption, color: colors.textMuted },
  warningText: { ...typography.small, color: colors.warning, marginTop: 4 },
  ageBadge: { ...typography.small, color: colors.error, fontWeight: '700' },
  error: { ...typography.small, color: colors.error, marginTop: spacing.md },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, gap: spacing.md },
  modalIcon: { fontSize: 48, textAlign: 'center' },
  modalTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  modalDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  modalLine: { ...typography.body, color: colors.text },
  modalHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
