import { useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { env } from '@config/environment';
import { RELEASE_VERSION } from '@config/version';
import { isVersionSupported } from '@/utils/version';

const STORE_URL = Platform.select({
  ios: 'https://apps.apple.com/app/idCONFIGURE_BEFORE_SUBMISSION',
  android: 'https://play.google.com/store/apps/details?id=com.nkt.app',
  default: '',
});

export function useAppVersionGate(): { blocked: boolean } {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!env.isProduction) return;
    const current = RELEASE_VERSION.app;
    const minimum = env.minSupportedVersion;
    if (!isVersionSupported(current, minimum)) {
      setBlocked(true);
      Alert.alert(
        'Güncelleme Gerekli',
        'Bu sürüm artık desteklenmiyor. Lütfen uygulamayı güncelleyin.',
        [
          {
            text: 'Güncelle',
            onPress: () => {
              if (STORE_URL) void Linking.openURL(STORE_URL);
            },
          },
        ],
        { cancelable: false },
      );
    }
  }, []);

  return { blocked };
}
