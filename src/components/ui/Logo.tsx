import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, radii, typography } from '@/theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoSource = require('../../../assets/icon.png');

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = { sm: 40, md: 64, lg: 96, xl: 140 };

export function Logo({ size = 'md' }: LogoProps) {
  const dim = sizes[size];
  return (
    <Image
      source={logoSource}
      style={{ width: dim, height: dim, borderRadius: radii.lg }}
      contentFit="contain"
      transition={200}
    />
  );
}

export function BrandMark({ showText = true }: { showText?: boolean }) {
  return (
    <View style={styles.brand}>
      <Logo size="lg" />
      {showText ? <Text style={styles.brandText}>NKT</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: 12 },
  brandText: { ...typography.h1, color: colors.text, letterSpacing: 2 },
});
