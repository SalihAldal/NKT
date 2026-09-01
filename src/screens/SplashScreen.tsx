import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Button } from '@/components/ui/Button';
import { BrandMark } from '@/components/ui/Logo';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { analytics } from '@/services/analytics';

export function SplashScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAuthenticated, isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    analytics.track({ name: 'app_open' });
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitialized) return;
    if (isAuthenticated) {
      const timer = setTimeout(() => navigation.replace('Main', { screen: 'Home' }), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isInitialized, isAuthenticated, navigation]);

  if (!isInitialized) {
    return (
      <ScreenContainer scroll={false} padded={false}>
        <View style={styles.container}>
          <BrandMark />
        </View>
      </ScreenContainer>
    );
  }

  if (isAuthenticated) {
    return (
      <ScreenContainer scroll={false} padded={false}>
        <View style={styles.container}>
          <BrandMark />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false} padded={false}>
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.content}>
          <BrandMark />
          <Animated.Text entering={FadeInDown.delay(300).duration(500)} style={styles.headline}>
            Arkadaşların seni ne kadar{' '}
            <Text style={styles.highlight}>tanıyor?</Text>
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(500).duration(500)} style={styles.sub}>
            Kendi testini oluştur, arkadaşlarına gönder ve skorları gör!
          </Animated.Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(700).duration(500)} style={styles.actions}>
          <Button title="Hadi Başlayalım 🚀" onPress={() => navigation.replace('Auth')} />
          <Button title="Giriş Yap" variant="outline" onPress={() => navigation.replace('Auth')} />
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', alignItems: 'center', padding: spacing['3xl'], paddingBottom: spacing['5xl'] },
  content: { alignItems: 'center', gap: spacing['2xl'], flex: 1, justifyContent: 'center' },
  headline: { ...typography.h1, color: colors.text, textAlign: 'center' },
  highlight: { color: colors.highlight },
  sub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  actions: { width: '100%', gap: spacing.md },
});
