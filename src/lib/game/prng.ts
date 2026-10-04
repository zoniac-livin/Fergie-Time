/**
 * Seeded PRNG using the Mulberry32 algorithm.
 * Deterministic: the same seed will always produce the exact same sequence of random numbers.
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function (): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle using Mulberry32.
 * Pure function: does not mutate the input array.
 */
export function shufflePool<T>(items: readonly T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Generates a positive 31-bit integer seed on the client.
 * Must only be called inside actions/events (e.g. startNewGame), never at module load.
 */
export function generateSeed(): number {
  return Math.floor(Math.random() * 2147483647) + 1;
}
