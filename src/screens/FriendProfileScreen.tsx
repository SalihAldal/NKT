import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { StateView } from '@/components/feedback/StateView';
import { colors, spacing, typography, radii } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { friendService } from '@/services/social/friend.service';
import { FRIENDSHIP_STATUS, REPORT_TYPE } from '@/domain/constants/enums';
import type { FriendProfile } from '@/domain/models/social';
import { apiServices } from '@/api/client';

export function FriendProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'FriendProfile'>>();
  const viewerId = useAuthStore((s) => s.user?.id) ?? 'user-1';
  const targetId = route.params?.userId;
  const username = route.params?.username;

  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        let userId = targetId;
        if (!userId && username) {
          const search = await apiServices.social.searchUsers(username, viewerId);
          userId = search.data[0]?.userId;
        }
        if (!userId) { setError(true); return; }
        const p = await friendService.getProfile(viewerId, userId);
        setProfile(p);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [targetId, username, viewerId]);

  const handleAction = async (action: 'request' | 'accept' | 'remove' | 'block' | 'quiz' | 'report') => {
    if (!profile) return;
    try {
      if (action === 'request') {
        await friendService.sendRequest(viewerId, profile.userId);
      } else if (action === 'remove') {
        await friendService.removeFriend(viewerId, profile.userId);
      } else if (action === 'block') {
        await friendService.blockUser(viewerId, profile.userId);
        Alert.alert('Engellendi', 'Bu kullanıcı engellendi.');
        navigation.goBack();
        return;
      } else if (action === 'report') {
        await apiServices.moderation.createReport({
          type: REPORT_TYPE.USER,
          reporterId: viewerId,
          targetId: profile.userId,
          targetType: 'user',
          reason: 'inappropriate',
        });
        Alert.alert('Bildirildi', 'Raporun alındı. Moderasyon ekibimiz inceleyecek.');
        return;
      } else if (action === 'quiz') {
        navigation.navigate('SelectTestType');
        return;
      }
      const updated = await friendService.getProfile(viewerId, profile.userId);
      setProfile(updated);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'İşlem başarısız.');
    }
  };

  if (loading) return <StateView type="loading" />;
  if (error || !profile) return <StateView type="error" title="Profil görüntülenemiyor" message="Bu profil gizli veya mevcut değil." onRetry={() => navigation.goBack()} />;

  return (
    <View style={styles.wrapper}>
      <Header title="Profil" />
      <ScreenContainer>
        <View style={styles.card}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{profile.displayName[0]}</Text></View>
          <Text style={styles.name}>{profile.displayName}</Text>
          <Text style={styles.username}>@{profile.username}</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statNum}>{profile.quizzesCompleted}</Text><Text style={styles.statLabel}>Test</Text></View>
            <View style={styles.stat}><Text style={styles.statNum}>{profile.gamesPlayed}</Text><Text style={styles.statLabel}>Oyun</Text></View>
            <View style={styles.stat}><Text style={styles.statNum}>%{Math.round(profile.winRate * 100)}</Text><Text style={styles.statLabel}>Kazanma</Text></View>
          </View>

          {profile.friendshipStatus === 'none' && (
            <Button title="Arkadaş Ekle" onPress={() => handleAction('request')} />
          )}
          {profile.friendshipStatus === FRIENDSHIP_STATUS.PENDING && (
            <Text style={styles.pending}>İstek gönderildi</Text>
          )}
          {profile.isFriend && (
            <>
              <Button title="Test Gönder" onPress={() => handleAction('quiz')} />
              <Button title="Arkadaşlıktan Çıkar" variant="outline" onPress={() => handleAction('remove')} />
            </>
          )}
          <TouchableOpacity onPress={() => handleAction('report')}>
            <Text style={styles.reportLink}>Bildir</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleAction('block')}>
            <Text style={styles.blockLink}>Engelle</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  card: { alignItems: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: radii.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.h2, color: colors.text },
  name: { ...typography.h2, color: colors.text },
  username: { ...typography.caption, color: colors.textMuted },
  statsRow: { flexDirection: 'row', gap: spacing.xl, marginVertical: spacing.md },
  stat: { alignItems: 'center' },
  statNum: { ...typography.h3, color: colors.primary },
  statLabel: { ...typography.small, color: colors.textMuted },
  pending: { ...typography.caption, color: colors.textMuted },
  reportLink: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  blockLink: { ...typography.small, color: colors.error, marginTop: spacing.xs },
});
