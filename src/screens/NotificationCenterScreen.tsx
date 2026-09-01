import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { StateView } from '@/components/feedback/StateView';
import { colors, spacing, typography, radii } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { notificationCenterService } from '@/services/notifications/notification-center.service';
import type { Notification } from '@/domain/models/moderation';
import { NOTIFICATION_TYPE } from '@/domain/constants/enums';

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  [NOTIFICATION_TYPE.FRIEND_REQUEST]: 'person-add',
  [NOTIFICATION_TYPE.FRIEND_ACCEPTED]: 'people',
  [NOTIFICATION_TYPE.QUIZ_RECEIVED]: 'mail',
  [NOTIFICATION_TYPE.QUIZ_COMPLETED]: 'checkmark-circle',
  [NOTIFICATION_TYPE.ROOM_INVITE]: 'game-controller',
  [NOTIFICATION_TYPE.GAME_COMPLETED]: 'trophy',
  [NOTIFICATION_TYPE.YOUR_TURN]: 'play',
  [NOTIFICATION_TYPE.PREMIUM]: 'star',
  [NOTIFICATION_TYPE.SYSTEM]: 'information-circle',
};

export function NotificationCenterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userId = useAuthStore((s) => s.user?.id) ?? 'user-1';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await notificationCenterService.list(userId);
      setNotifications(result.data);
      setUnreadCount(result.unreadCount);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handlePress = async (n: Notification) => {
    await notificationCenterService.markRead(n.id);
    const route = notificationCenterService.resolveRoute(n);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    navigation.navigate(route.screen as any, route.params as any);
    load();
  };

  const handleMarkAll = async () => {
    await notificationCenterService.markAllRead(userId);
    load();
  };

  if (loading) return <StateView type="loading" />;

  return (
    <View style={styles.wrapper}>
      <Header
        title="Bildirimler"
        rightAction={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAll}>
              <Text style={styles.markAll}>Tümünü oku</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      <ScreenContainer>
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<StateView type="empty" title="Bildirim yok" message="Yeni bildirimler burada görünecek" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, !item.read && styles.rowUnread]}
              onPress={() => handlePress(item)}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={TYPE_ICONS[item.type] ?? 'notifications'} size={20} color={colors.primary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.time}>{new Date(item.createdAt).toLocaleDateString('tr-TR')}</Text>
              </View>
              {!item.read && <View style={styles.dot} />}
            </TouchableOpacity>
          )}
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  markAll: { ...typography.small, color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, marginBottom: spacing.sm, gap: spacing.md },
  rowUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(139,92,246,0.15)', alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  title: { ...typography.bodyMedium, color: colors.text },
  body: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  time: { ...typography.small, color: colors.textMuted, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 4 },
});
