import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StateView } from '@/components/feedback/StateView';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { api } from '@/api/client';
import type { IncomingQuiz } from '@/types';

export function InboxScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<IncomingQuiz[]>([]);
  const [selected, setSelected] = useState<IncomingQuiz | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getIncomingQuizzes().then((data) => {
      setItems(data);
      setSelected(data[0] ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) return <StateView type="loading" />;

  return (
    <ScreenContainer edges={['top']}>
      <Text style={styles.title}>Gelen Testler</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stories}>
        {items.map((item) => (
          <TouchableOpacity key={item.id} onPress={() => setSelected(item)} style={styles.storyItem}>
            <View style={[styles.storyAvatar, selected?.id === item.id && styles.storySelected]}>
              <Text style={styles.storyText}>{item.senderName[0]}</Text>
              {item.isNew ? <View style={styles.badge}><Text style={styles.badgeText}>Yeni</Text></View> : null}
            </View>
            <Text style={styles.storyName} numberOfLines={1}>{item.senderName.split(' ')[0]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {selected ? (
        <Card glow style={styles.featured}>
          <Text style={styles.emoji}>🧠</Text>
          <Text style={styles.featuredTitle}>{selected.quiz.title}</Text>
          <Text style={styles.featuredSub}>{selected.senderName} tarafından gönderildi • {selected.quiz.questions.length} soru</Text>
          <Button title="Teste Başla" onPress={() => navigation.navigate('SolveQuiz', { quizId: selected.quiz.id })} />
          <Button title="Daha Sonra" variant="ghost" onPress={() => navigation.goBack()} />
        </Card>
      ) : (
        <StateView type="empty" title="Gelen test yok" message="Arkadaşların test gönderdiğinde burada görünecek" />
      )}
    </ScreenContainer>
  );
}

export function IncomingQuizScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'IncomingQuiz'>>();
  const quizId = route.params?.quizId;

  useEffect(() => {
    if (quizId) navigation.replace('SolveQuiz', { quizId });
  }, [quizId, navigation]);

  return <InboxScreen />;
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.lg },
  stories: { marginBottom: spacing.xl },
  storyItem: { alignItems: 'center', marginRight: spacing.lg, width: 72 },
  storyAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  storySelected: { borderColor: colors.primary },
  storyText: { ...typography.h3, color: colors.text },
  storyName: { ...typography.small, color: colors.textSecondary, marginTop: 4 },
  badge: { position: 'absolute', bottom: -4, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { ...typography.small, color: colors.text, fontSize: 10 },
  featured: { alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 48 },
  featuredTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  featuredSub: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
});
