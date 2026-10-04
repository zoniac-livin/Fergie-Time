import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, rehydrateGameStore, getStorage } from '../store/gameStore';
import { PLACEHOLDER_SEED } from '../lib/game/engine';

describe('GameStore & Persistence', () => {
  const STORAGE_KEY = 'fergie-time-game-v1';

  beforeEach(() => {
    // Clear storage before each test
    const storage = getStorage();
    storage.removeItem(STORAGE_KEY);
    // Reset store to placeholder
    useGameStore.setState({
      budget: 250_000_000,
      currentYear: 0,
      roster: { GK: [], DEF: [], MID: [], ATT: [] },
      phase: 'DRAFT',
      seed: PLACEHOLDER_SEED,
      skipsRemaining: 3,
      skippedIds: [],
      transactions: [],
      revealedCount: 0,
    });
  });

  it('startNewGame generates a new non-zero seed and resets state', () => {
    const store = useGameStore.getState();
    expect(store.seed).toBe(PLACEHOLDER_SEED);

    store.startNewGame();
    const updated = useGameStore.getState();
    expect(updated.seed).not.toBe(PLACEHOLDER_SEED);
    expect(updated.seed).toBeGreaterThan(0);
    expect(updated.budget).toBe(250_000_000);
    expect(updated.phase).toBe('DRAFT');
    expect(updated.currentYear).toBe(0);
    expect(updated.skipsRemaining).toBe(3);
    expect(updated.transactions).toEqual([]);

    // Can also accept explicit seed
    store.startNewGame(777);
    expect(useGameStore.getState().seed).toBe(777);
  });

  it('persistence writes only GameState fields (not actions or derived values)', async () => {
    const store = useGameStore.getState();
    store.startNewGame(42);

    const candidate = store.getCurrentCandidate();
    expect(candidate).not.toBeNull();
    if (candidate) {
      store.draftPlayer(candidate);
    }

    // Force persist to write
    const storage = getStorage();
    const raw = storage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveProperty('state');
    const persistedState = parsed.state;

    // Check that exact GameState fields exist
    expect(persistedState).toHaveProperty('budget');
    expect(persistedState).toHaveProperty('currentYear');
    expect(persistedState).toHaveProperty('roster');
    expect(persistedState).toHaveProperty('phase');
    expect(persistedState).toHaveProperty('seed');
    expect(persistedState).toHaveProperty('skipsRemaining');
    expect(persistedState).toHaveProperty('skippedIds');
    expect(persistedState).toHaveProperty('transactions');
    expect(persistedState).toHaveProperty('revealedCount');

    // Check that NO action functions or derived values are in the persisted JSON
    expect(persistedState.startNewGame).toBeUndefined();
    expect(persistedState.getCurrentCandidate).toBeUndefined();
    expect(persistedState.draftPlayer).toBeUndefined();
    expect(persistedState.skipCandidate).toBeUndefined();
    expect(persistedState.startReveal).toBeUndefined();
    expect(persistedState.sellPlayer).toBeUndefined();
    expect(persistedState.squadValue).toBeUndefined();
    expect(persistedState.netWorth).toBeUndefined();

    // Field count: exactly the 9 GameState fields
    const keys = Object.keys(persistedState);
    expect(keys.sort()).toEqual([
      'budget',
      'currentYear',
      'phase',
      'revealedCount',
      'roster',
      'seed',
      'skippedIds',
      'skipsRemaining',
      'transactions',
    ]);
  });

  it('rehydrate helper restores a saved game', async () => {
    const storage = getStorage();

    // Manually write a mock saved game to storage
    const savedGame = {
      state: {
        budget: 180_000_000,
        currentYear: 3,
        roster: { GK: [], DEF: [], MID: [], ATT: [] },
        phase: 'SIMULATION',
        seed: 8888,
        skipsRemaining: 1,
        skippedIds: ['99'],
        transactions: [{ playerId: '1', year: 0, kind: 'DRAFT', amount: 70_000_000 }],
        revealedCount: 7,
      },
      version: 0,
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(savedGame));

    // Current store in memory is different
    expect(useGameStore.getState().budget).toBe(250_000_000);

    // Call rehydrate helper
    await rehydrateGameStore();

    // Store now reflects the persisted state
    const rehydrated = useGameStore.getState();
    expect(rehydrated.budget).toBe(180_000_000);
    expect(rehydrated.currentYear).toBe(3);
    expect(rehydrated.phase).toBe('SIMULATION');
    expect(rehydrated.seed).toBe(8888);
    expect(rehydrated.skipsRemaining).toBe(1);
    expect(rehydrated.skippedIds).toEqual(['99']);
    expect(rehydrated.transactions).toHaveLength(1);
    expect(rehydrated.revealedCount).toBe(7);
  });
});
