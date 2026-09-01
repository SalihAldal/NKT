import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { env } from '@config/environment';
import { analytics } from '@/services/analytics';
import { logger } from '@/utils/logger';

export const buildQuizLink = (shareCode: string) =>
  `https://${env.deepLinkHost}/test/${shareCode}`;

export const buildInviteLink = (userId: string) =>
  `https://${env.deepLinkHost}/invite/${userId}`;

export const shareQuiz = async (quizId: string, shareCode: string, title: string) => {
  const url = buildQuizLink(shareCode);
  const message = `${title}\n\nBeni ne kadar tanıyorsun? Teste başla:\n${url}`;

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(url, { dialogTitle: title, mimeType: 'text/plain', UTI: 'public.url' });
  }

  analytics.track({ name: 'quiz_shared', params: { quizId, channel: 'native' } });
  return message;
};

export const copyQuizLink = async (shareCode: string) => {
  const url = buildQuizLink(shareCode);
  await Clipboard.setStringAsync(url);
  return url;
};

export const shareResult = async (
  quizTitle: string,
  score: number,
  correctCount: number,
  total: number,
) => {
  const message = `%${score} oranında tanıyorsun!\n${correctCount} / ${total} doğru\n\nNKT'de beni geçebilir misin? 🎯`;
  if (await Sharing.isAvailableAsync()) {
    try {
      await Sharing.shareAsync(message, { dialogTitle: quizTitle });
    } catch (e) {
      logger.warn('Share failed', e);
    }
  }
  return message;
};

export const shareToChannel = async (
  channel: 'whatsapp' | 'telegram' | 'instagram' | 'snapchat' | 'x' | 'other',
  message: string,
  quizId: string,
) => {
  analytics.track({ name: 'quiz_shared', params: { quizId, channel } });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(message, { dialogTitle: 'Paylaş' });
  }
};
