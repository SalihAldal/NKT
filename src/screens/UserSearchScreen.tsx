import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { StateView } from '@/components/feedback/StateView';
import { colors, spacing, typography, radii } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { socialService } from '@/services/social/social.service';
import { friendService } from '@/services/social/friend.service';
import type { UserSearchResult } from '@/domain/models/social';
import { FRIENDSHIP_STATUS } from '@/domain/constants/enums';

export function UserSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userId = useAuthStore((s) => s.user?.id) ?? 'user-1';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    setError('');
    try {
      const res = await socialService.searchUsers(q, userId);
      setResults(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Arama başarısız');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const handleSendRequest = async (targetId: string) => {
    await friendService.sendRequest(userId, targetId);
    search(query);
  };

  return (
    <View style={styles.wrapper}>
      <Header title="Kullanıcı Ara" />
      <ScreenContainer>
        <TextInput
          style={styles.input}
          placeholder="Kullanıcı adı veya isim..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} /> : null}
        <FlatList
          data={results}
          keyExtractor={(item) => item.userId}
          ListEmptyComponent={
            query.length >= 2 && !loading ? (
              <StateView type="empty" title="Sonuç bulunamadı" message="Farklı bir arama dene" />
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('FriendProfile', { userId: item.userId })}
            >
              <View style={styles.avatar}><Text style={styles.avatarText}>{item.displayName[0]}</Text></View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName} numberOfLines={1}>{item.displayName}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>@{item.username}</Text>
              </View>
              {item.friendshipStatus === 'none' && (
                <Button title="Ekle" onPress={() => handleSendRequest(item.userId)} fullWidth={false} style={styles.smallBtn} />
              )}
              {item.friendshipStatus === FRIENDSHIP_STATUS.ACCEPTED && (
                <Text style={styles.friendBadge}>Arkadaş</Text>
              )}
              {item.friendshipStatus === FRIENDSHIP_STATUS.PENDING && (
                <Text style={styles.pendingBadge}>Bekliyor</Text>
              )}
            </TouchableOpacity>
          )}
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  input: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, color: colors.text, ...typography.body, marginBottom: spacing.md },
  error: { ...typography.small, color: colors.error, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, marginBottom: spacing.sm, gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.label, color: colors.text },
  rowInfo: { flex: 1 },
  rowName: { ...typography.bodyMedium, color: colors.text },
  rowSub: { ...typography.small, color: colors.textMuted },
  smallBtn: { paddingHorizontal: spacing.md, minHeight: 32 },
  friendBadge: { ...typography.small, color: colors.primary },
  pendingBadge: { ...typography.small, color: colors.textMuted },
});
