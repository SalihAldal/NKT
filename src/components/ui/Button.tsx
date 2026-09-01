import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, gradients, radii, spacing, typography } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  fullWidth = true,
}: ButtonProps) {
  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.85}
        style={[fullWidth && styles.fullWidth, style]}
      >
        <LinearGradient
          colors={[...gradients.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradient, disabled && styles.disabled]}
        >
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <View style={styles.content}>
              {icon}
              <Text style={[styles.primaryText, textStyle]}>{title}</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const variantStyles = {
    secondary: styles.secondary,
    outline: styles.outline,
    ghost: styles.ghost,
    danger: styles.danger,
  };

  const variantTextStyles = {
    secondary: styles.secondaryText,
    outline: styles.outlineText,
    ghost: styles.ghostText,
    danger: styles.dangerText,
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.base,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.baseText, variantTextStyles[variant], textStyle]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' },
  base: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  gradient: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  primaryText: { ...typography.bodyMedium, color: colors.text, fontWeight: '700' },
  baseText: { ...typography.bodyMedium, fontWeight: '600' },
  secondary: { backgroundColor: colors.surface },
  secondaryText: { color: colors.text },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.surfaceBorder },
  outlineText: { color: colors.text },
  ghost: { backgroundColor: 'transparent' },
  ghostText: { color: colors.textSecondary },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.error },
  dangerText: { color: colors.error },
  disabled: { opacity: 0.5 },
});
