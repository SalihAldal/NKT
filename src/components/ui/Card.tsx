import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radii, spacing, shadows } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  glass?: boolean;
  glow?: boolean;
}

export function Card({ children, style, onPress, glass = false, glow = false }: CardProps) {
  const content = (
    <View style={[styles.card, glow && shadows.md, style]}>
      {glass ? (
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    overflow: 'hidden',
  },
});
