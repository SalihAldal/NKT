import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { AppState } from 'react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { StateView } from '@/components/feedback/StateView';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useGameStore } from '@/store/gameStore';
import { useRoomStore } from '@/store/roomStore';
import { GAME_CONTENT_TYPE } from '@/domain/constants/enums';
import { ANSWER_TYPE } from '@/domain/constants/enums';
import { analytics } from '@/services/analytics';
import { GameProgress } from '@/components/game/GameProgress';
import { GameTimer } from '@/components/game/GameTimer';
import { GameScoreboard } from '@/components/game/GameScoreboard';
import { PlayerContext } from '@/components/game/PlayerContext';
import { QuestionCard } from '@/components/game/QuestionCard';
import { ChallengeCard } from '@/components/game/ChallengeCard';
import { PerformanceCard } from '@/components/game/PerformanceCard';
import { RoundResultCard } from '@/components/game/RoundResultCard';
import { StageTransitionView } from '@/components/game/StageTransitionView';
import { CountdownOverlay } from '@/components/game/CountdownOverlay';
import { GameFinalView } from '@/components/game/GameFinalView';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { apiServices } from '@/api/client';
import * as Sharing from 'expo-sharing';

export function GameScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Game'>>();
  const membership = useRoomStore((s) => s.membership);
  const view = useGameStore((s) => s.view);
  const isSyncing = useGameStore((s) => s.isSyncing);
  const initGame = useGameStore((s) => s.initGame);
  const refresh = useGameStore((s) => s.refresh);
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const resume = useGameStore((s) => s.resume);
  const clear = useGameStore((s) => s.clear);

  const [textAnswer, setTextAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const lastRoundRef = useRef(0);

  useEffect(() => {
    if (!membership) return;
    const gameId = route.params?.gameId ?? membership.room.currentGameId;
    if (gameId) {
      void initGame(gameId, {
        playerId: membership.player.id,
        sessionToken: membership.sessionToken,
        roomId: membership.room.id,
      });
    } else {
      void resume({
        playerId: membership.player.id,
        sessionToken: membership.sessionToken,
        roomId: membership.room.id,
      });
    }
    return () => clear();
  }, [membership, route.params?.gameId, initGame, resume, clear]);

  useEffect(() => {
    const interval = setInterval(() => { void refresh(); }, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    if (!view || !membership) return;
    if (view.stage === 'countdown') {
      analytics.track({ name: 'game_countdown', params: { roomId: view.roomId } });
    }
    if (view.stage === 'round_active' && view.currentQuestion !== lastRoundRef.current) {
      lastRoundRef.current = view.currentQuestion;
      analytics.track({ name: 'round_start', params: { roomId: view.roomId, roundNumber: view.currentQuestion } });
      const eventName = view.contentType === GAME_CONTENT_TYPE.CHALLENGE
        ? 'challenge_viewed'
        : view.contentType === GAME_CONTENT_TYPE.PERFORMANCE
          ? 'performance_viewed'
          : 'question_viewed';
      analytics.track({ name: eventName, params: { roomId: view.roomId, roundNumber: view.currentQuestion } });
    }
    if (view.stage === 'stage_transition') {
      analytics.track({ name: 'stage_completed', params: { roomId: view.roomId, stage: view.currentStageNum } });
    }
    if (view.stage === 'completed' || view.stage === 'final_result') {
      analytics.track({ name: 'game_completed', params: { roomId: view.roomId } });
      analytics.track({ name: 'game_result_viewed', params: { roomId: view.roomId } });
    }
  }, [view?.stage, view?.currentQuestion, view?.contentType, membership]);

  const answerState = submitting ? 'submitting' as const : (view?.answerState ?? 'idle');

  const doSubmit = useCallback(async (matchId: string, answer: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitAnswer(matchId, answer);
    } finally {
      setSubmitting(false);
      setTextAnswer('');
    }
  }, [submitting, submitAnswer, view?.roomId, membership?.room.id]);

  const handleRematch = async () => {
    if (!membership) return;
    const ctx = { roomId: membership.room.id, playerId: membership.player.id, sessionToken: membership.sessionToken };
    analytics.track({ name: 'rematch_started', params: { roomId: membership.room.id } });
    clear();
    await apiServices.room.rematch(ctx);
    navigation.replace('CategorySelect');
  };

  const handleShare = async () => {
    if (!view?.finalStats?.length) return;
    const lines = view.finalStats.map((s) => `${s.rank}. ${s.displayName}: ${s.score}`).join('\n');
    const msg = `NKT Oyun Sonucu 🎉\n${view.categoryName ?? ''}\n\n${lines}`;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(msg);
    }
  };

  if (isSyncing && !view) return <ScreenContainer scroll={false}><StateView type="loading" title="Senkronize ediliyor..." /></ScreenContainer>;
  if (!view) return <ScreenContainer scroll={false}><StateView type="error" title="Oyun yüklenemedi" /></ScreenContainer>;

  if (view.stage === 'countdown') {
    return (
      <ScreenContainer scroll={false}>
        <CountdownOverlay seconds={view.countdownSeconds ?? 0} />
      </ScreenContainer>
    );
  }

  if (view.stage === 'completed' || view.stage === 'final_result') {
    return (
      <ScreenContainer>
        <GameFinalView
          stats={view.finalStats ?? view.scores.map((s) => ({
            playerId: s.playerId,
            displayName: s.displayName,
            avatarEmoji: s.avatarEmoji,
            score: s.score,
            rank: s.rank,
            correctCount: s.correctCount ?? 0,
            challengeCompletions: 0,
            avgResponseMs: s.avgResponseMs ?? 0,
          }))}
          categoryName={view.categoryName}
          isHost={membership?.player.isHost ?? false}
          onRematch={handleRematch}
          onNewCategory={() => { clear(); navigation.replace('CategorySelect'); }}
          onShare={handleShare}
          onLobby={() => { clear(); navigation.replace('Lobby', {}); }}
        />
      </ScreenContainer>
    );
  }

  if (view.stage === 'aborted' || view.stage === 'cancelled') {
    return (
      <ScreenContainer>
        <StateView type="error" title="Oyun sonlandırıldı" message={view.abortReason ?? 'Oyun tamamlanamadı.'} />
        <Button title="Odaya Dön" onPress={() => { clear(); navigation.replace('Lobby', {}); }} />
      </ScreenContainer>
    );
  }

  if (view.stage === 'stage_transition' && view.stageTransition) {
    return (
      <ScreenContainer scroll={false}>
        <StageTransitionView title={view.stageTransition.title} subtitle={view.stageTransition.subtitle} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <GameProgress current={view.currentQuestion} total={view.totalQuestions} stageNum={view.currentStageNum} />

        {view.timeRemainingMs !== undefined && view.stage === 'round_active' ? (
          <GameTimer timeRemainingMs={view.timeRemainingMs} />
        ) : null}

        <GameScoreboard scores={view.scores} />

        {view.stage === 'round_result' && view.lastRoundResult ? (
          <RoundResultCard result={view.lastRoundResult} scores={view.scores} />
        ) : null}

        {view.stage === 'round_active' && view.role === 'bye' ? (
          <View style={styles.centered}>
            <Text style={styles.bye}>Bu tur dinleniyorsun ☕</Text>
          </View>
        ) : null}

        {view.stage === 'round_active' && view.role === 'observer' ? (
          <View style={styles.centered}>
            <Text style={styles.bye}>Diğer oyuncular oynuyor...</Text>
          </View>
        ) : null}

        {view.stage === 'round_active' && (view.role === 'asker' || view.role === 'responder') && view.prompt ? (
          <View style={styles.playArea}>
            <PlayerContext
              name={view.role === 'asker' ? (view.responderName ?? '') : (view.askerName ?? '')}
              avatar={view.role === 'asker' ? view.responderAvatar : view.askerAvatar}
              role={view.role}
              label={view.role === 'asker' ? 'Hedef' : 'Sana soruldu'}
            />

            {view.contentType === GAME_CONTENT_TYPE.QUESTION ? (
              <>
                <QuestionCard
                  prompt={view.prompt}
                  targetName={view.responderName}
                  options={view.role === 'responder' ? view.options : undefined}
                  answerState={answerState}
                  role={view.role}
                  onChoice={(id) => view.matchId && doSubmit(view.matchId, id)}
                />
                {view.role === 'responder' && view.answerType === ANSWER_TYPE.TEXT ? (
                  <View style={styles.textRow}>
                    <Input value={textAnswer} onChangeText={setTextAnswer} placeholder="Cevabını yaz..." />
                    <Button title="Gönder" onPress={() => view.matchId && textAnswer.trim() && doSubmit(view.matchId, textAnswer.trim())} disabled={submitting} />
                  </View>
                ) : null}
              </>
            ) : null}

            {view.contentType === GAME_CONTENT_TYPE.CHALLENGE && view.role === 'responder' ? (
              <ChallengeCard
                prompt={view.prompt}
                answerState={answerState}
                onComplete={() => view.matchId && doSubmit(view.matchId, 'completed')}
                onSkip={() => view.matchId && doSubmit(view.matchId, 'skipped')}
              />
            ) : null}

            {view.contentType === GAME_CONTENT_TYPE.PERFORMANCE && view.role === 'responder' ? (
              <PerformanceCard
                prompt={view.prompt}
                answerState={answerState}
                onComplete={() => view.matchId && doSubmit(view.matchId, 'completed')}
                onSkip={() => view.matchId && doSubmit(view.matchId, 'skipped')}
              />
            ) : null}

            {view.role === 'asker' && view.contentType !== GAME_CONTENT_TYPE.QUESTION ? (
              <Text style={styles.waitHint}>{view.responderName} görevi tamamlıyor...</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing['3xl'], gap: spacing.lg },
  centered: { alignItems: 'center', padding: spacing['3xl'] },
  bye: { ...typography.h3, color: colors.textSecondary },
  playArea: { gap: spacing.lg },
  textRow: { gap: spacing.md },
  waitHint: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
