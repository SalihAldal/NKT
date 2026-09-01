import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { colors, spacing, typography, radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { socialService } from '@/services/social/social.service';
import type { PrivacySettings } from '@/domain/models/social';
import { PROFILE_VISIBILITY } from '@/domain/constants/enums';

export function PrivacySettingsScreen() {
  const userId = useAuthStore((s) => s.user?.id) ?? 'user-1';
  const [settings, setSettings] = useState<PrivacySettings | null>(null);

  useEffect(() => {
    socialService.getPrivacySettings(userId).then(setSettings);
  }, [userId]);

  const update = async (patch: Partial<PrivacySettings>) => {
    const updated = await socialService.updatePrivacySettings(userId, patch);
    setSettings(updated);
  };

  if (!settings) return null;

  return (
    <View style={styles.wrapper}>
      <Header title="Gizlilik" />
      <ScreenContainer>
        <ScrollView>
          <Text style={styles.section}>Profil Görünürlüğü</Text>
          {([
            { v: PROFILE_VISIBILITY.PUBLIC, label: 'Herkese Açık' },
            { v: PROFILE_VISIBILITY.FRIENDS, label: 'Sadece Arkadaşlar' },
            { v: PROFILE_VISIBILITY.PRIVATE, label: 'Gizli' },
          ] as const).map(({ v, label }) => (
            <View key={v} style={styles.optionRow}>
              <Text style={styles.optionLabel}>{label}</Text>
              <Switch
                value={settings.profileVisibility === v}
                onValueChange={() => update({ profileVisibility: v })}
                trackColor={{ true: colors.primary }}
              />
            </View>
          ))}

          <Text style={styles.section}>Aktivite Paylaşımı</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Aktivitelerimi paylaş</Text>
            <Switch value={settings.activitySharing} onValueChange={(val) => update({ activitySharing: val })} trackColor={{ true: colors.primary }} />
          </View>

          <Text style={styles.section}>Keşfedilebilirlik</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Aramalarda görün</Text>
            <Switch value={settings.discoverable} onValueChange={(val) => update({ discoverable: val })} trackColor={{ true: colors.primary }} />
          </View>

          <Text style={styles.note}>
            E-posta, telefon ve ödeme bilgilerin asla paylaşılmaz.
          </Text>
        </ScrollView>
      </ScreenContainer>
    </View>
  );
}

export function NotificationSettingsScreen() {
  const { settings, updateNotifications } = useSettingsStore();
  const notifs = settings.notifications;

  return (
    <View style={styles.wrapper}>
      <Header title="Bildirimler" />
      <ScreenContainer>
        <ScrollView>
          {([
            { key: 'friendInvite' as const, label: 'Arkadaşlık istekleri' },
            { key: 'newQuiz' as const, label: 'Quiz aktivitesi' },
            { key: 'quizSolved' as const, label: 'Oda davetleri' },
            { key: 'results' as const, label: 'Oyun aktivitesi' },
          ]).map(({ key, label }) => (
            <View key={key} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Switch
                value={notifs[key]}
                onValueChange={(v) => updateNotifications({ [key]: v })}
                trackColor={{ true: colors.primary }}
              />
            </View>
          ))}
          <Text style={styles.note}>
            Güvenlik ve sistem bildirimleri kapatılamaz.
          </Text>
        </ScrollView>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  section: { ...typography.label, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.lg, marginBottom: spacing.sm },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.lg, marginBottom: spacing.sm },
  optionLabel: { ...typography.body, color: colors.text },
  label: { ...typography.body, color: colors.text, flex: 1 },
  note: { ...typography.small, color: colors.textMuted, marginTop: spacing.xl, textAlign: 'center' },
});
