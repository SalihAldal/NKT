import { LinkingOptions } from '@react-navigation/native';
import * as ExpoLinking from 'expo-linking';
import { env } from '@config/environment';
import { parseSecureDeepLink } from '@/services/security/validation';
import type { RootStackParamList } from '@/navigation/types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [`${env.appScheme}://`, `https://${env.deepLinkHost}`],
  config: {
    screens: {
      SolveQuiz: {
        path: 'test/:shareCode',
        parse: { shareCode: String },
      },
      Auth: {
        path: 'invite/:inviteUserId',
        parse: { inviteUserId: String },
      },
      JoinRoom: {
        path: 'room/:code',
        parse: { code: String },
      },
      FriendProfile: {
        path: 'profile/:username',
        parse: { username: String },
      },
      Friends: {
        path: 'friend/:token',
        parse: { token: String },
      },
    },
  },
  async getInitialURL() {
    return ExpoLinking.getInitialURL();
  },
  subscribe(listener) {
    const subscription = ExpoLinking.addEventListener('url', ({ url }) => {
      const parsed = parseSecureDeepLink(url);
      if (parsed?.type === 'room') {
        listener(`${env.appScheme}://room/${parsed.id}`);
      } else {
        listener(url);
      }
    });
    return () => subscription.remove();
  },
};

export { parseSecureDeepLink as parseDeepLink };
