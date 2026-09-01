import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

describe('PHASE 22 — Mobile multiplayer flow', () => {
  it('lobby navigates to category without premature startGame', () => {
    const lobby = readFileSync(join(ROOT, 'src/screens/LobbyScreen.tsx'), 'utf-8');
    expect(lobby).toContain("navigate('CategorySelect')");
    expect(lobby).not.toContain('await startGame()');
  });

  it('game intro is the single startGame entry point', () => {
    const intro = readFileSync(join(ROOT, 'src/screens/GameIntroScreen.tsx'), 'utf-8');
    expect(intro).toContain('startGame');
  });

  it('no public room discovery in HTTP client', () => {
    const http = readFileSync(join(ROOT, 'src/api/http/room.http.ts'), 'utf-8');
    expect(http).toContain('listActiveRooms');
    expect(http).toContain('not supported');
  });

  it('game view mapper maps server roles', () => {
    const mapper = readFileSync(join(ROOT, 'src/api/http/game-view.mapper.ts'), 'utf-8');
    expect(mapper).toContain('asker');
    expect(mapper).toContain('responder');
    expect(mapper).toContain('timeRemainingMs');
  });

  it('friend room has create and join only', () => {
    const friend = readFileSync(join(ROOT, 'src/screens/FriendRoomScreen.tsx'), 'utf-8');
    expect(friend).toContain('Oda Oluştur');
    expect(friend).toContain('Odaya Katıl');
    expect(friend).not.toContain('Keşfet');
  });

  it('deep link room code only', () => {
    const linking = readFileSync(join(ROOT, 'src/navigation/linking.ts'), 'utf-8');
    expect(linking).toContain('room/:code');
  });
});
