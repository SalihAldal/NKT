import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { paymentService } from '@/services/payment';
import { useAuthStore } from '@/store/authStore';
import { useEntitlementStore } from '@/store/entitlementStore';
import { analytics } from '@/services/analytics';
import { MONETIZATION_CONFIG } from '@config/monetization';
import { paywallContext } from '@/services/monetization/paywall-context';
import { EntitlementPolicy } from '@/services/entitlement/entitlement-policy';
import { ENTITLEMENT_STATUS } from '@/domain/constants/enums';
import { subscriptionManagementService } from '@/services/subscription/subscription-management.service';
import { openPrivacyPolicy, openTermsOfService } from '@/services/legal/legal-links.service';
import type { StoreProduct } from '@/services/payment/payment.service';

export function PremiumScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, setUser } = useAuthStore();
  const { entitlement, load, refresh } = useEntitlementStore();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const isPremium = entitlement ? EntitlementPolicy.hasPremiumAccess(entitlement) : user?.isPremium;

  useEffect(() => {
    analytics.track({ name: 'premium_viewed', params: { source: paywallContext.get() } });
    void paymentService.getProducts().then(setProducts);
    if (user) void load(user.id);
  }, [user, load]);

  const handlePurchase = async (productId: string, plan: string) => {
    if (!user) return;
    setSelectedPlan(productId);
    setLoading(true);
    analytics.track({ name: 'plan_selected', params: { productId, plan } });
    try {
      const result = await paymentService.purchase(user.id, productId, paywallContext.get());
      if (result.success && result.entitlement) {
        const updated = await refresh(user.id);
        setUser({
          ...user,
          isPremium: EntitlementPolicy.hasPremiumAccess(updated),
          premiumExpiresAt: updated.expiresAt,
        });
        Alert.alert('Premium aktif 👑', 'Tüm premium özellikler açıldı!');
        navigation.goBack();
      } else if (result.status === 'cancelled') {
        Alert.alert('İptal', 'Satın alma iptal edildi.');
      } else {
        Alert.alert('Hata', result.error ?? 'Satın alma tamamlanamadı.');
      }
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  const handleRestore = async () => {
    if (!user) return;
    setRestoreLoading(true);
    try {
      const result = await paymentService.restore(user.id);
      if (result.restored && result.entitlement) {
        const updated = await refresh(user.id);
        setUser({
          ...user,
          isPremium: EntitlementPolicy.hasPremiumAccess(updated),
          premiumExpiresAt: updated.expiresAt,
        });
        Alert.alert('Geri yüklendi', 'Satın alımların geri yüklendi.');
      } else {
        Alert.alert('Bilgi', 'Geri yüklenecek satın alım bulunamadı.');
      }
    } finally {
      setRestoreLoading(false);
    }
  };

  if (isPremium) {
    return (
      <View style={styles.wrapper}>
        <Header title="Premium" />
        <ScreenContainer>
          <Text style={styles.emoji}>👑</Text>
          <Text style={styles.title}>Premium Aktif</Text>
          <Text style={styles.sub}>
            {entitlement?.expiresAt
              ? `Bitiş: ${new Date(entitlement.expiresAt).toLocaleDateString('tr-TR')}`
              : 'Tüm özellikler açık'}
          </Text>
          <Button
            title="Aboneliğimi Yönet"
            variant="outline"
            onPress={() => void subscriptionManagementService.openSubscriptionManagement()}
          />
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Header title="Premium" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenContainer>
          <Text style={styles.emoji}>👑</Text>
          <Text style={styles.title}>NKT PREMIUM</Text>
          <Text style={styles.sub}>Arkadaş ortamında tam deneyim</Text>

          <Card style={styles.compareCard}>
            <Text style={styles.compareTitle}>Ücretsiz</Text>
            {MONETIZATION_CONFIG.freeBenefits.map((b) => (
              <Text key={b} style={styles.featureMuted}>• {b}</Text>
            ))}
          </Card>

          <Card style={styles.features}>
            <Text style={styles.compareTitle}>Premium ile</Text>
            {MONETIZATION_CONFIG.premiumBenefits.map((f) => (
              <Text key={f} style={styles.feature}>✓ {f}</Text>
            ))}
          </Card>

          {products.map((p) => (
            <Button
              key={p.id}
              title={`${p.title} — ${p.price}`}
              onPress={() => handlePurchase(p.id, p.plan)}
              loading={loading && selectedPlan === p.id}
              variant={p.plan === 'monthly' ? 'primary' : 'outline'}
            />
          ))}

          <Button
            title="Satın Alımlarımı Geri Yükle"
            variant="ghost"
            loading={restoreLoading}
            onPress={handleRestore}
          />

          <Text style={styles.disclosure}>
            Abonelik otomatik yenilenir. İptal için {subscriptionManagementService.getStoreName()} abonelik ayarlarını kullanın.
            Fiyatlar mağaza bölgenize göre değişebilir.
          </Text>
          <View style={styles.legalRow}>
            <Text style={styles.legalLink} onPress={openPrivacyPolicy}>Gizlilik</Text>
            <Text style={styles.legalSep}> · </Text>
            <Text style={styles.legalLink} onPress={openTermsOfService}>Koşullar</Text>
          </View>
        </ScreenContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  emoji: { fontSize: 64, textAlign: 'center' },
  title: { ...typography.h1, color: colors.text, textAlign: 'center' },
  sub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  features: { gap: spacing.sm, marginBottom: spacing.lg },
  compareCard: { gap: spacing.xs, marginBottom: spacing.md, backgroundColor: colors.surface },
  compareTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  feature: { ...typography.body, color: colors.text },
  featureMuted: { ...typography.small, color: colors.textSecondary },
  disclosure: { ...typography.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg, lineHeight: 18 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md, marginBottom: spacing.xl },
  legalLink: { ...typography.small, color: colors.primary },
  legalSep: { ...typography.small, color: colors.textMuted },
});
