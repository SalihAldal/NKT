import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { socialService } from '@/services/social/social.service';
import { analytics } from '@/services/analytics';
import { env } from '@config/environment';
import { RELEASE_VERSION } from '@config/version';

function SettingsRow({ icon, label, value, onPress }: { icon: string; label: string; value?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress} accessibilityRole="button">
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.textSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </TouchableOpacity>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { deleteAccount, user, isGuest } = useAuthStore();
  const { settings, update } = useSettingsStore();

  React.useEffect(() => {
    analytics.track({ name: 'settings_viewed' });
  }, []);

  const handleDelete = () => {
    analytics.track({ name: 'delete_account_started' });
    Alert.alert(
      'Hesabı Sil',
      'Profil, arkadaşlık, davet, bildirim ve oyun geçmişin gizlilik politikasına uygun şekilde silinir veya anonimleştirilir. Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hesabımı Sil',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Son Onay', 'Hesabını kalıcı olarak silmek istediğine emin misin?', [
              { text: 'İptal', style: 'cancel' },
              {
                text: 'Evet, Sil',
                style: 'destructive',
                onPress: async () => {
                  if (user) await socialService.deleteUserData(user.id);
                  await deleteAccount();
                  analytics.track({ name: 'delete_account_completed' });
                  navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
                },
              },
            ]);
          },
        },
      ],
    );
  };

  const langLabel = settings.language === 'en' ? 'English' : 'Türkçe';
  const themeLabel = settings.theme === 'system' ? 'Sistem' : 'Koyu';

  return (
    <View style={styles.wrapper}>
      <Header title="Ayarlar" />
      <ScreenContainer>
        <ScrollView>
          <Text style={styles.section}>Hesap</Text>
          <SettingsRow icon="person-outline" label="Profili Düzenle" onPress={() => navigation.navigate(isGuest ? 'Auth' : 'EditProfile')} />
          <SettingsRow icon="shield-outline" label="Gizlilik" onPress={() => navigation.navigate('PrivacySettings')} />
          {!isGuest ? <SettingsRow icon="key-outline" label="Şifreyi Sıfırla" onPress={() => navigation.navigate('ForgotPassword')} /> : null}

          <Text style={styles.section}>Bildirimler</Text>
          <SettingsRow icon="notifications-outline" label="Bildirim Tercihleri" onPress={() => navigation.navigate('NotificationSettings')} />

          <Text style={styles.section}>Uygulama</Text>
          <SettingsRow icon="language-outline" label="Dil" value={langLabel} onPress={() => navigation.navigate('LanguageSettings')} />
          <SettingsRow icon="moon-outline" label="Tema" value={themeLabel} onPress={() => navigation.navigate('ThemeSettings')} />
          <View style={styles.row}>
            <Ionicons name="volume-high-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.rowLabel}>Ses Efektleri</Text>
            <Switch value={settings.soundEffects} onValueChange={(v) => update({ soundEffects: v })} trackColor={{ true: colors.primary }} accessibilityLabel="Ses efektleri" />
          </View>
          <View style={styles.row}>
            <Ionicons name="phone-portrait-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.rowLabel}>Titreşim</Text>
            <Switch value={settings.vibration} onValueChange={(v) => update({ vibration: v })} trackColor={{ true: colors.primary }} accessibilityLabel="Titreşim" />
          </View>
          <View style={styles.row}>
            <Ionicons name="cellular-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.rowLabel}>Veri Tasarrufu</Text>
            <Switch value={settings.dataSaving} onValueChange={(v) => update({ dataSaving: v })} trackColor={{ true: colors.primary }} accessibilityLabel="Veri tasarrufu" />
          </View>

          <Text style={styles.section}>Yasal</Text>
          <SettingsRow icon="document-text-outline" label="Gizlilik Politikası" onPress={() => navigation.navigate('PrivacyPolicy')} />
          <SettingsRow icon="reader-outline" label="Kullanım Koşulları" onPress={() => navigation.navigate('TermsOfService')} />
          <SettingsRow icon="code-slash-outline" label="Açık Kaynak Lisansları" onPress={() => navigation.navigate('OpenSourceLicenses')} />

          <Text style={styles.section}>Destek</Text>
          <SettingsRow icon="help-circle-outline" label="Yardım Merkezi" onPress={() => navigation.navigate('HelpCenter')} />
          <SettingsRow icon="mail-outline" label="Sorun Bildir" onPress={() => navigation.navigate('ContactUs')} />
          <SettingsRow icon="information-circle-outline" label="Hakkında" value={`v${RELEASE_VERSION.app}`} onPress={() => navigation.navigate('About')} />

          {!isGuest ? (
            <TouchableOpacity onPress={handleDelete} accessibilityLabel="Hesabı sil">
              <Text style={styles.deleteText}>Hesabımı Sil</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  section: { ...typography.label, color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  rowLabel: { ...typography.body, color: colors.text, flex: 1 },
  rowValue: { ...typography.caption, color: colors.textMuted },
  deleteText: { ...typography.body, color: colors.error, textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing['3xl'] },
});
