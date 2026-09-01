export const buildRoomLink = (code: string): string => `nkt://room/${code.toUpperCase()}`;

export const buildRoomWebLink = (code: string, host: string): string =>
  `https://${host}/room/${code.toUpperCase()}`;
