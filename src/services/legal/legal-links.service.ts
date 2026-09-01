import { Linking } from 'react-native';
import { getLegalUrl } from '@config/release';

export function openPrivacyPolicy(): void {
  const url = getLegalUrl('privacy');
  if (url) void Linking.openURL(url);
}

export function openTermsOfService(): void {
  const url = getLegalUrl('terms');
  if (url) void Linking.openURL(url);
}
