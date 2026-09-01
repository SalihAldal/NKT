import { randomBytes } from 'crypto';

const ROOM_ANIMAL_AVATAR_IDS = [
  'lion',
  'wolf',
  'bear',
  'rabbit',
  'eagle',
  'shark',
  'turtle',
  'horse',
  'cow',
  'pig',
] as const;

type AnimalAvatarId = (typeof ROOM_ANIMAL_AVATAR_IDS)[number];

const AVATAR_SET = new Set<string>(ROOM_ANIMAL_AVATAR_IDS);

export function normalizeAvatarId(value?: string): AnimalAvatarId | undefined {
  if (!value) return undefined;
  return AVATAR_SET.has(value) ? (value as AnimalAvatarId) : undefined;
}

export function randomAvatarId(excludedIds: string[] = []): AnimalAvatarId {
  const pool = ROOM_ANIMAL_AVATAR_IDS.filter((avatarId) => !excludedIds.includes(avatarId));
  const source = pool.length > 0 ? pool : ROOM_ANIMAL_AVATAR_IDS;
  const index = randomBytes(1)[0] % source.length;
  return source[index]!;
}
