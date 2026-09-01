import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Share, Platform } from 'react-native';
import { buildRoomLink, buildRoomWebLink } from '@/services/sharing/room-links';
import { env } from '@config/environment';
import { analytics } from '@/services/analytics';

export const buildRoomShareMessage = (code: string): string =>
  `NKT'de arkadaşlarla oynuyoruz! Odaya katıl: ${code.toUpperCase()}`;

export const copyRoomCode = async (code: string): Promise<void> => {
  await Clipboard.setStringAsync(code.toUpperCase());
  analytics.track({ name: 'room_code_copied', params: { code } });
};

export const shareRoom = async (code: string): Promise<void> => {
  const message = buildRoomShareMessage(code);
  const url = buildRoomLink(code);
  analytics.track({ name: 'room_share_clicked', params: { code } });
  analytics.track({ name: 'invite_shared', params: { channel: 'native', type: 'room' } });

  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(`${message}\n${url}`);
    return;
  }

  try {
    await Share.share({
      message: `${message}\n${url}`,
      url: buildRoomWebLink(code, env.deepLinkHost),
      title: 'NKT Arkadaş Ortamı',
    });
  } catch {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(url, { dialogTitle: 'Odayı Paylaş' });
    }
  }
};

export const getInviteLink = (code: string): string => buildRoomLink(code);
