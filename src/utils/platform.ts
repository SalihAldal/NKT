export const getPlatform = (): 'ios' | 'android' => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native') as { Platform: { OS: string } };
    return Platform.OS === 'ios' ? 'ios' : 'android';
  } catch {
    return 'ios';
  }
};
