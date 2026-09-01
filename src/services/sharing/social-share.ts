import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { analytics } from '@/services/analytics';
import { logger } from '@/utils/logger';
import {
  buildResultShareMessage,
  buildGameResultShareMessage,
  buildProfileLink,
  buildFriendInviteLink,
  type ResultShareCard,
} from './share-messages';

export type { ResultShareCard };
export { buildResultShareMessage, buildGameResultShareMessage, buildProfileLink, buildFriendInviteLink };

export const shareResult = async (card: ResultShareCard, quizId?: string) => {
  const message = buildResultShareMessage(card);
  if (await Sharing.isAvailableAsync()) {
    try {
      await Sharing.shareAsync(message, { dialogTitle: card.title });
    } catch (e) {
      logger.warn('Share failed', e);
    }
  }
  analytics.track({
    name: 'result_shared',
    params: { quizId: quizId ?? '', score: card.score, channel: 'native' },
  });
  return message;
};

export const shareGameResult = async (
  params: { rank: number; score: number; categoryName: string; playerCount: number },
  roomId?: string,
) => {
  const message = buildGameResultShareMessage(params);
  if (await Sharing.isAvailableAsync()) {
    try {
      await Sharing.shareAsync(message, { dialogTitle: 'Oyun Sonucu' });
    } catch (e) {
      logger.warn('Game share failed', e);
    }
  }
  analytics.track({
    name: 'game_result_shared',
    params: { roomId: roomId ?? '', rank: params.rank, channel: 'native' },
  });
  return message;
};

export const copyShareMessage = async (message: string) => {
  await Clipboard.setStringAsync(message);
};
