export interface AnimalAvatarOption {
  id: string;
  icon: string;
  label: string;
  color: string;
}

export const ANIMAL_AVATARS: readonly AnimalAvatarOption[] = [
  { id: 'lion', icon: 'cat', label: 'Aslan', color: '#F59E0B' },
  { id: 'wolf', icon: 'dog', label: 'Kurt', color: '#A3A3A3' },
  { id: 'bear', icon: 'paw', label: 'Ayi', color: '#8B5E3C' },
  { id: 'rabbit', icon: 'rabbit', label: 'Tavsan', color: '#A78BFA' },
  { id: 'eagle', icon: 'bird', label: 'Kartal', color: '#60A5FA' },
  { id: 'shark', icon: 'fish', label: 'Kopek Baligi', color: '#06B6D4' },
  { id: 'turtle', icon: 'tortoise', label: 'Kaplumbaga', color: '#34D399' },
  { id: 'horse', icon: 'horse', label: 'At', color: '#B45309' },
  { id: 'cow', icon: 'cow', label: 'Inek', color: '#D1D5DB' },
  { id: 'pig', icon: 'pig', label: 'Domuz', color: '#F472B6' },
] as const;

const DEFAULT_AVATAR: AnimalAvatarOption = ANIMAL_AVATARS[0]!;

export function getAnimalAvatar(avatarId?: string): AnimalAvatarOption {
  if (!avatarId) return DEFAULT_AVATAR;
  return ANIMAL_AVATARS.find((avatar) => avatar.id === avatarId) || DEFAULT_AVATAR;
}
