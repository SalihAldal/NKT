import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = radii.md, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: colors.shimmer, opacity }, style]}
    />
  );
}

interface StateViewProps {
  type: 'loading' | 'empty' | 'error';
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function StateView({ type, title, message, onRetry }: StateViewProps) {
  const defaults = {
    loading: { title: 'Yükleniyor...', message: 'Veriler getiriliyor' },
    empty: { title: 'Henüz bir şey yok', message: 'Burada içerik bulunamadı' },
    error: { title: 'Bir hata oluştu', message: 'Lütfen tekrar dene' },
  };
  const t = title ?? defaults[type].title;
  const m = message ?? defaults[type].message;

  return (
    <View style={styles.container}>
      {type === 'loading' ? (
        <View style={styles.skeletonGroup}>
          <Skeleton height={48} borderRadius={radii.full} width={48} />
          <Skeleton height={20} width="60%" />
          <Skeleton height={14} width="80%" />
        </View>
      ) : (
        <>
          <Text style={styles.emoji}>{type === 'empty' ? '📭' : '⚠️'}</Text>
          <Text style={styles.title}>{t}</Text>
          <Text style={styles.message}>{m}</Text>
          {type === 'error' && onRetry ? (
            <Text style={styles.retry} onPress={onRetry}>
              Tekrar Dene
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.md },
  skeletonGroup: { width: '100%', gap: spacing.md, alignItems: 'center' },
  emoji: { fontSize: 48 },
  title: { ...typography.h3, color: colors.text, textAlign: 'center' },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  retry: { ...typography.label, color: colors.primary, marginTop: spacing.md },
});
