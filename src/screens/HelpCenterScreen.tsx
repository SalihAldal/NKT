import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { colors, spacing, typography, radii } from '@/theme';
import { supportService, type HelpArticle } from '@/services/support/support.service';
import { analytics } from '@/services/analytics';

export function HelpCenterScreen() {
  const articles = supportService.getHelpArticles();
  const [selected, setSelected] = useState<HelpArticle | null>(null);

  const openArticle = (article: HelpArticle) => {
    analytics.track({ name: 'help_opened', params: { articleId: article.id } });
    setSelected(article);
  };

  if (selected) {
    return (
      <View style={styles.wrapper}>
        <Header title={selected.title} onBack={() => setSelected(null)} />
        <ScreenContainer>
          <Text style={styles.category}>{selected.category}</Text>
          <Text style={styles.content}>{selected.content}</Text>
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Header title="Yardım Merkezi" />
      <ScreenContainer>
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => openArticle(item)}>
              <View>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowCat}>{item.category}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.sm },
  rowTitle: { ...typography.bodyMedium, color: colors.text },
  rowCat: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  arrow: { ...typography.h3, color: colors.textMuted },
  category: { ...typography.label, color: colors.primary, marginBottom: spacing.md },
  content: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
});
