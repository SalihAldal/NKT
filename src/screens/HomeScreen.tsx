import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StateView } from '@/components/feedback/StateView';
import { colors, gradients, spacing, typography, radii } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { homeService, type HomeData } from '@/services/home/home.service';
import { analytics } from '@/services/analytics';
import { useTranslation } from '@/hooks/useTranslation';

const QUICK_ACTIONS = [
  { icon: 'create-outline', label: 'Test Oluştur', route: 'SelectTestType' as const },
  { icon: 'enter-outline', label: 'Odaya Katıl', route: 'JoinRoom' as const },
  { icon: 'people-outline', label: 'Oda Oluştur', route: 'FriendRoom' as const },
  { icon: 'mail-outline', label: 'Gelen Testler', route: 'IncomingQuiz' as const },
  { icon: 'trophy-outline', label: 'Sıralama', tab: 'Leaderboard' as const },
  { icon: 'person-add-outline', label: 'Arkadaşlar', route: 'Friends' as const },
  { icon: 'diamond-outline', label: 'Premium', route: 'Premium' as const },
];

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const membership = useRoomStore((s) => s.membership);
  const { t: translate } = useTranslation();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setError(false);
      const result = await homeService.load(user.id, membership);
      setData(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, membership]);

  useFocusEffect(useCallback(() => {
    analytics.track({ name: 'home_viewed' });
    load();
  }, [load]));

  const handleAction = (action: typeof QUICK_ACTIONS[number]) => {
    analytics.track({ name: 'home_action_clicked', params: { action: action.label } });
    if ('tab' in action && action.tab) {
      navigation.navigate('Main', { screen: action.tab });
      return;
    }
    const route = 'route' in action ? action.route : undefined;
    switch (route) {
      case 'SelectTestType': navigation.navigate('SelectTestType'); break;
      case 'JoinRoom': navigation.navigate('JoinRoom'); break;
      case 'FriendRoom': navigation.navigate('FriendRoom'); break;
      case 'IncomingQuiz': navigation.navigate('IncomingQuiz'); break;
      case 'Friends': navigation.navigate('Friends'); break;
      case 'Premium': navigation.navigate('Premium'); break;
      default: break;
    }
  };

  const subtitle = data?.newQuizCount
    ? translate('home.newQuizzes', { count: data.newQuizCount })
    : user?.stats.quizzesCreated === 0
      ? translate('home.firstQuiz')
      : undefined;

  if (loading && !data) return <StateView type="loading" />;

  return (
    <ScreenContainer edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerLeft} onPress={() => navigation.navigate('Main', { screen: 'Profile' })}>
            <View style={styles.avatar} accessibilityLabel="Profil">
              <Text style={styles.avatarText}>{user?.name?.[0] ?? '?'}</Text>
            </View>
            <View>
              <Text style={styles.greeting}>{translate('home.greeting')}, {user?.name?.split(' ')[0] ?? ''}</Text>
              <Text style={styles.username}>@{user?.username}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerRight}>
            {user?.isPremium ? (
              <View style={styles.premiumBadge}><Text style={styles.premiumBadgeText}>👑</Text></View>
            ) : null}
            <TouchableOpacity
              onPress={() => navigation.navigate('NotificationCenter')}
              accessibilityLabel="Bildirimler"
              style={styles.notifBtn}
            >
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
              {(data?.unreadNotifications ?? 0) > 0 ? (
                <View style={styles.badge}><Text style={styles.badgeText}>{data!.unreadNotifications}</Text></View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{translate('home.whatToday')}</Text>

        {/* Main CTAs */}
        <LinearGradient colors={[...gradients.primarySoft]} style={styles.ctaCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.ctaContent}>
            <Text style={styles.ctaTitle}>{translate('home.quizCta')}</Text>
            {subtitle ? <Text style={styles.ctaSub}>{subtitle}</Text> : null}
            <Button title="Test Oluştur" onPress={() => handleAction(QUICK_ACTIONS[0]!)} fullWidth={false} style={styles.ctaBtn} />
          </View>
          <Text style={styles.ctaEmoji}>📝</Text>
        </LinearGradient>

        <LinearGradient colors={[...gradients.card]} style={styles.friendCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.ctaContent}>
            <Text style={styles.ctaTitle}>{translate('home.roomCta')}</Text>
            <Text style={styles.ctaSub}>Oda oluştur veya koda katıl — gerçek zamanlı lobby!</Text>
            <Button title="Başla" onPress={() => navigation.navigate('FriendRoom')} variant="outline" fullWidth={false} style={styles.ctaBtn} />
          </View>
          <Text style={styles.ctaEmoji}>🎮</Text>
        </LinearGradient>

        {/* Active Game */}
        {data?.activeGame ? (
          <Card style={styles.activeCard} onPress={() => navigation.navigate('Lobby')}>
            <View style={styles.activeHeader}>
              <Ionicons name="game-controller" size={20} color={colors.primary} />
              <Text style={styles.activeTitle}>{translate('home.activeGame')}</Text>
            </View>
            <Text style={styles.activeMeta}>
              {data.activeGame.categoryName ?? 'Kategori seçiliyor'} • {data.activeGame.playerCount} oyuncu
            </Text>
            {data.activeGame.isReconnecting ? (
              <Text style={styles.reconnect}>Bağlantı kesildi, tekrar bağlanılıyor…</Text>
            ) : null}
            <Button title={translate('home.continue')} onPress={() => navigation.navigate('Lobby')} fullWidth={false} style={styles.continueBtn} />
          </Card>
        ) : null}

        {/* Quick Actions */}
        <Text style={styles.sectionLabel}>{translate('home.quickActions')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity key={action.label} style={styles.quickItem} onPress={() => handleAction(action)}>
              <View style={styles.quickIcon}><Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={22} color={colors.primary} /></View>
              <Text style={styles.quickLabel} numberOfLines={2}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Premium CTA */}
        {!user?.isPremium ? (
          <TouchableOpacity onPress={() => { analytics.track({ name: 'premium_viewed', params: { source: 'home' } }); navigation.navigate('Premium'); }}>
            <LinearGradient colors={[...gradients.premium]} style={styles.premiumCta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.premiumCtaTitle}>✨ {translate('home.premiumCta')}</Text>
              <Text style={styles.premiumCtaSub}>AI soru üretimi • Reklamsız deneyim</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.premiumActive}><Text style={styles.premiumActiveText}>{translate('home.premiumActive')}</Text></View>
        )}

        {/* Incoming Quizzes */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>{translate('home.incomingQuizzes')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('IncomingQuiz')}>
            <Text style={styles.seeAll}>{translate('home.seeAll')}</Text>
          </TouchableOpacity>
        </View>
        {error ? <StateView type="error" onRetry={load} /> : null}
        {!error && (data?.incomingQuizzes.length ?? 0) === 0 ? (
          <StateView type="empty" title="Henüz test yok" message={translate('empty.quizzes')} />
        ) : null}
        {data?.incomingQuizzes.slice(0, 3).map((item) => (
          <Card key={item.id} style={styles.quizItem} onPress={() => navigation.navigate('SolveQuiz', { quizId: item.quiz.id })}>
            <View style={styles.quizRow}>
              <View style={styles.quizAvatar}><Text style={styles.quizAvatarText}>{item.senderName[0]}</Text></View>
              <View style={styles.quizInfo}>
                <Text style={styles.quizName} numberOfLines={1}>{item.senderName}</Text>
                <Text style={styles.quizTitle} numberOfLines={1}>{item.quiz.title}</Text>
              </View>
              {item.isNew ? <View style={styles.newDot} /> : null}
              <Button title="Çöz" onPress={() => navigation.navigate('SolveQuiz', { quizId: item.quiz.id })} fullWidth={false} style={styles.solveBtn} />
            </View>
          </Card>
        ))}

        {/* Friend Activity */}
        {(data?.friendActivity.length ?? 0) > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>{translate('home.friendActivity')}</Text>
            {data!.friendActivity.map((a) => (
              <View key={a.id} style={styles.activityRow}>
                <Ionicons name="pulse-outline" size={16} color={colors.textMuted} />
                <Text style={styles.activityText} numberOfLines={2}>{a.title}</Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ height: spacing['3xl'] }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.label, color: colors.text },
  greeting: { ...typography.bodyMedium, color: colors.text },
  username: { ...typography.small, color: colors.textMuted },
  notifBtn: { padding: spacing.sm, position: 'relative' },
  badge: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.error, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, color: colors.text, fontWeight: '700' },
  premiumBadge: { backgroundColor: 'rgba(255,215,0,0.2)', borderRadius: radii.full, padding: 4 },
  premiumBadgeText: { fontSize: 16 },
  sectionTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.lg },
  sectionLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.md },
  ctaCard: { borderRadius: radii['2xl'], padding: spacing.xl, flexDirection: 'row', marginBottom: spacing.md, overflow: 'hidden' },
  friendCard: { borderRadius: radii['2xl'], padding: spacing.xl, flexDirection: 'row', marginBottom: spacing.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.surfaceBorder },
  ctaContent: { flex: 1, gap: spacing.xs },
  ctaTitle: { ...typography.h3, color: colors.text },
  ctaSub: { ...typography.caption, color: colors.textSecondary },
  ctaBtn: { marginTop: spacing.sm, alignSelf: 'flex-start', minWidth: 120 },
  ctaEmoji: { fontSize: 44, alignSelf: 'center' },
  activeCard: { marginBottom: spacing.lg, gap: spacing.sm },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  activeTitle: { ...typography.bodyMedium, color: colors.text },
  activeMeta: { ...typography.caption, color: colors.textSecondary },
  reconnect: { ...typography.small, color: colors.warning },
  continueBtn: { alignSelf: 'flex-start', marginTop: spacing.sm },
  quickScroll: { marginBottom: spacing.lg },
  quickItem: { alignItems: 'center', width: 72, marginRight: spacing.md },
  quickIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  quickLabel: { ...typography.small, color: colors.textSecondary, textAlign: 'center' },
  premiumCta: { borderRadius: radii.xl, padding: spacing.lg, marginBottom: spacing.lg },
  premiumCtaTitle: { ...typography.bodyMedium, color: colors.text },
  premiumCtaSub: { ...typography.small, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  premiumActive: { backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.lg, alignItems: 'center' },
  premiumActiveText: { ...typography.label, color: colors.premiumGold },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  seeAll: { ...typography.label, color: colors.primary },
  quizItem: { marginBottom: spacing.sm },
  quizRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  quizAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  quizAvatarText: { ...typography.caption, color: colors.text },
  quizInfo: { flex: 1 },
  quizName: { ...typography.label, color: colors.text },
  quizTitle: { ...typography.small, color: colors.textMuted },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  solveBtn: { minWidth: 64, paddingHorizontal: spacing.sm },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  activityText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
});
