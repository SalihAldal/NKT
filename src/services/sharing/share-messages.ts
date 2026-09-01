const DEEP_LINK_HOST = process.env.EXPO_PUBLIC_DEEP_LINK_HOST ?? 'taniyormusun.app';

export interface ResultShareCard {
  title: string;
  score: number;
  correctCount: number;
  total: number;
  rank?: number;
  categoryName?: string;
}

export const buildResultShareMessage = (card: ResultShareCard): string => {
  const scoreLine = `%${card.score} oranında tanıyorsun!`;
  const detailLine = `${card.correctCount} / ${card.total} doğru`;
  const rankLine = card.rank ? `\nSıralama: #${card.rank}` : '';
  const cta = '\n\nNKT\'de beni geçebilir misin? 🎯\nhttps://' + DEEP_LINK_HOST;
  return `${scoreLine}\n${detailLine}${rankLine}${cta}`;
};

export const buildGameResultShareMessage = (params: {
  rank: number;
  score: number;
  categoryName: string;
  playerCount: number;
}): string => {
  const rankText = params.rank === 1 ? '1. oldum' : `${params.rank}. sıradayım`;
  return `Bizim odada ${rankText}! 🏆\nKategori: ${params.categoryName}\nSkor: ${params.score}\n${params.playerCount} oyuncu\n\nNKT — Arkadaş Ortamı\nhttps://${DEEP_LINK_HOST}`;
};

export const buildProfileLink = (username: string) =>
  `https://${DEEP_LINK_HOST}/profile/${username}`;

export const buildFriendInviteLink = (token: string) =>
  `https://${DEEP_LINK_HOST}/friend/${token}`;
