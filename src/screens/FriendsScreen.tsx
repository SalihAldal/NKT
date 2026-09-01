import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { StateView } from '@/components/feedback/StateView';
import { colors, spacing, typography, radii } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { friendService } from '@/services/social/friend.service';
import { socialService } from '@/services/social/social.service';
import type { FriendProfile, Friendship, FriendSuggestion } from '@/domain/models/social';

type Tab = 'friends' | 'requests' | 'suggestions';

export function FriendsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Friends'>>();
  const userId = useAuthStore((s) => s.user?.id) ?? 'user-1';
  const initialTab = (route.params?.tab as Tab) ?? 'friends';

  const [tab, setTab] = useState<Tab>(initialTab);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [friendsRes, pendingRes, suggs] = await Promise.all([
        friendService.listFriends(userId),
        friendService.getPendingRequests(userId),
        socialService.getSuggestions(userId),
      ]);
      setFriends(friendsRes.data);
      setRequests(pendingRes.requests);
      setSuggestions(suggs);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async (id: string) => {
    await friendService.acceptRequest(id, userId);
    load();
  };

  const handleDecline = async (id: string) => {
    await friendService.declineRequest(id, userId);
    load();
  };

  const handleSendRequest = async (targetId: string) => {
    await friendService.sendRequest(userId, targetId);
    load();
  };

  const handleHideSuggestion = async (targetId: string) => {
    await socialService.hideSuggestion(userId, targetId);
    load();
  };

  if (loading) return <StateView type="loading" />;

  return (
    <View style={styles.wrapper}>
      <Header
        title="Arkadaşlarım"
        showBack={false}
        rightAction={
          <TouchableOpacity onPress={() => navigation.navigate('UserSearch')}>
            <Ionicons name="search" size={22} color={colors.text} />
          </TouchableOpacity>
        }
      />
      <ScreenContainer>
        <View style={styles.tabs}>
          {(['friends', 'requests', 'suggestions'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'friends' ? 'Arkadaşlar' : t === 'requests' ? `İstekler${requests.length ? ` (${requests.length})` : ''}` : 'Öneriler'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={
            tab === 'friends' ? friends :
            tab === 'requests' ? requests as unknown as FriendProfile[] :
            suggestions as unknown as FriendProfile[]
          }
          keyExtractor={(item, index) => {
            if ('userId' in item && item.userId) return item.userId;
            if ('id' in item) return (item as { id: string }).id;
            return String(index);
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<StateView type="empty" title="Henüz içerik yok" message="Arkadaş ara veya önerilere göz at" />}
          renderItem={({ item }) => {
            if (tab === 'friends') {
              const f = item as FriendProfile;
              return (
                <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('FriendProfile', { userId: f.userId })}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{f.displayName[0]}</Text></View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName} numberOfLines={1}>{f.displayName}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>@{f.username}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              );
            }
            if (tab === 'requests') {
              const r = item as unknown as Friendship;
              return (
                <View style={styles.row}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>?</Text></View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>Arkadaşlık isteği</Text>
                    <Text style={styles.rowSub}>Bekliyor</Text>
                  </View>
                  <View style={styles.rowActions}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(r.id)}><Ionicons name="checkmark" size={18} color={colors.text} /></TouchableOpacity>
                    <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(r.id)}><Ionicons name="close" size={18} color={colors.textMuted} /></TouchableOpacity>
                  </View>
                </View>
              );
            }
            const s = item as unknown as FriendSuggestion;
            return (
              <View style={styles.row}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{s.displayName[0]}</Text></View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>{s.displayName}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>@{s.username} • Belki tanıyorsun</Text>
                </View>
                <View style={styles.rowActions}>
                  <Button title="Ekle" onPress={() => handleSendRequest(s.userId)} fullWidth={false} style={styles.smallBtn} />
                  <TouchableOpacity onPress={() => handleHideSuggestion(s.userId)}><Ionicons name="close" size={18} color={colors.textMuted} /></TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radii.full, padding: 4, marginBottom: spacing.lg },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radii.full },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.small, color: colors.textMuted },
  tabTextActive: { color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, marginBottom: spacing.sm, gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.label, color: colors.text },
  rowInfo: { flex: 1 },
  rowName: { ...typography.bodyMedium, color: colors.text },
  rowSub: { ...typography.small, color: colors.textMuted },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  acceptBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  smallBtn: { paddingHorizontal: spacing.md, minHeight: 32 },
});
