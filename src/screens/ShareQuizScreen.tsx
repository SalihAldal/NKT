import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { colors, gradients, spacing, typography, radii } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useQuizStore } from '@/store/quizStore';
import { useAuthStore } from '@/store/authStore';
import { copyQuizLink, shareQuiz, shareToChannel } from '@/services/sharing';
import { buildQuizLink } from '@/services/sharing';

export function ShareQuizScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ShareQuiz'>>();
  const user = useAuthStore((s) => s.user);
  const { draft, publishDraft, currentQuiz, isPublishing } = useQuizStore();
  const [published, setPublished] = useState(currentQuiz);
  const [copied, setCopied] = useState(false);

  const handlePublish = async () => {
    try {
      const quiz = await publishDraft(user?.id ?? 'guest', user?.name ?? 'Misafir');
      setPublished(quiz);
      Alert.alert('Başarılı', 'Testin yayınlandı!');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Yayınlanamadı');
    }
  };

  const quiz = published ?? currentQuiz;
  const shareCode = quiz?.shareCode ?? 'preview';
  const link = buildQuizLink(shareCode);

  const handleCopy = async () => {
    await copyQuizLink(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const channels = [
    { id: 'whatsapp' as const, icon: 'logo-whatsapp', color: '#25D366' },
    { id: 'instagram' as const, icon: 'logo-instagram', color: '#E4405F' },
    { id: 'telegram' as const, icon: 'paper-plane', color: '#0088CC' },
    { id: 'snapchat' as const, icon: 'logo-snapchat', color: '#FFFC00' },
    { id: 'x' as const, icon: 'logo-twitter', color: '#1DA1F2' },
    { id: 'other' as const, icon: 'share-social', color: colors.primary },
  ];

  return (
    <View style={styles.wrapper}>
      <Header title="Testini Paylaş" />
      <ScreenContainer>
        <LinearGradient colors={[...gradients.primary]} style={styles.previewCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.previewTitle}>{draft.title || quiz?.title}</Text>
          <Text style={styles.previewMeta}>{draft.questions.length} Soru • Herkese açık • Sınırsız süre</Text>
        </LinearGradient>

        {!quiz ? (
          <Button title="Testi Yayınla" onPress={handlePublish} loading={isPublishing} />
        ) : null}

        <Text style={styles.sectionTitle}>Link Paylaş</Text>
        <View style={styles.linkRow}>
          <Text style={styles.link} numberOfLines={1}>{link}</Text>
          <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
            <Text style={styles.copyText}>{copied ? 'Kopyalandı!' : 'Kopyala'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.channels}>
          {channels.map((ch) => (
            <TouchableOpacity
              key={ch.id}
              style={styles.channelBtn}
              onPress={() => shareToChannel(ch.id, link, quiz?.id ?? 'draft')}
            >
              <Ionicons name={ch.icon as keyof typeof Ionicons.glyphMap} size={24} color={ch.color} />
            </TouchableOpacity>
          ))}
        </View>

        {quiz ? (
          <>
            <Button title="Paylaşım Görseli Oluştur ✨" onPress={() => shareQuiz(quiz.id, quiz.shareCode, quiz.title)} />
            <Button title="Ana Sayfaya Dön" variant="outline" onPress={() => navigation.navigate('Main', { screen: 'Home' })} />
          </>
        ) : null}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  previewCard: { borderRadius: radii['2xl'], padding: spacing.xl, marginBottom: spacing.xl },
  previewTitle: { ...typography.h2, color: colors.text },
  previewMeta: { ...typography.caption, color: 'rgba(255,255,255,0.8)', marginTop: spacing.sm },
  sectionTitle: { ...typography.label, color: colors.text, marginBottom: spacing.md },
  linkRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.md, alignItems: 'center', marginBottom: spacing.xl },
  link: { flex: 1, ...typography.caption, color: colors.textSecondary },
  copyBtn: { backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  copyText: { ...typography.small, color: colors.text, fontWeight: '600' },
  channels: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.xl },
  channelBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
