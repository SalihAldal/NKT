export interface PlayerPair {
  askerId: string;
  responderId: string;
}

/** Deterministic circle-rotation pairing with bye for odd counts */
export class PairingEngine {
  private pairCounts = new Map<string, number>();

  private pairKey(a: string, b: string): string {
    return [a, b].sort().join(':');
  }

  generatePairs(playerIds: string[], roundNumber: number): PlayerPair[] {
    const n = playerIds.length;
    if (n < 2) return [];

    const rotate = (roundNumber - 1) % Math.max(n - 1, 1);
    const fixed = playerIds[0]!;
    const rest = playerIds.slice(1);
    const rotated = [...rest.slice(rotate), ...rest.slice(0, rotate)];
    const circle = [fixed, ...rotated];

    const pairs: PlayerPair[] = [];
    const half = Math.floor(n / 2);

    for (let i = 0; i < half; i++) {
      const a = circle[i]!;
      const b = circle[n - 1 - i]!;
      const askerId = roundNumber % 2 === 1 ? a : b;
      const responderId = roundNumber % 2 === 1 ? b : a;
      pairs.push({ askerId, responderId });
      const key = this.pairKey(askerId, responderId);
      this.pairCounts.set(key, (this.pairCounts.get(key) ?? 0) + 1);
    }

    return pairs;
  }

  getPairCount(a: string, b: string): number {
    return this.pairCounts.get(this.pairKey(a, b)) ?? 0;
  }

  reset(): void {
    this.pairCounts.clear();
  }
}

export const pairingEngine = new PairingEngine();
