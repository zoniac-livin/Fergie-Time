import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  PlayerProfile,
  GameState,
  ActionResult,
} from '../types/game';
import {
  PLACEHOLDER_SEED,
  createInitialState,
  getCurrentCandidate as engineGetCurrentCandidate,
  draftPlayer as engineDraftPlayer,
  skipCandidate as engineSkipCandidate,
  startReveal as engineStartReveal,
  revealNext as engineRevealNext,
  completeReveal as engineCompleteReveal,
  sellPlayer as engineSellPlayer,
  advanceYear as engineAdvanceYear,
  endSimulation as engineEndSimulation,
} from '../lib/game/engine';
import { generateSeed } from '../lib/game/prng';
import rawPlayers from '../data/players.json';

const playerPool: PlayerProfile[] = rawPlayers as PlayerProfile[];

export interface GameStoreActions {
  startNewGame: (customSeed?: number) => void;
  getCurrentCandidate: () => PlayerProfile | null;
  draftPlayer: (player: PlayerProfile) => ActionResult;
  skipCandidate: () => ActionResult;
  startReveal: () => ActionResult;
  revealNext: () => ActionResult;
  completeReveal: () => ActionResult;
  sellPlayer: (playerId: string) => ActionResult;
  advanceYear: () => ActionResult;
  endSimulation: () => ActionResult;
  resetGame: (customSeed?: number) => void;
}

export type GameStore = GameState & GameStoreActions;

const memoryStorageMap = new Map<string, string>();
const fallbackStorage: Storage = {
  getItem: (key: string) => memoryStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memoryStorageMap.set(key, value);
  },
  removeItem: (key: string) => {
    memoryStorageMap.delete(key);
  },
  clear: () => {
    memoryStorageMap.clear();
  },
  key: () => null,
  length: 0,
};

export const getStorage = (): Storage => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return fallbackStorage;
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(PLACEHOLDER_SEED),

      startNewGame: (customSeed?: number) => {
        const seed = customSeed ?? generateSeed();
        set(createInitialState(seed));
      },

      getCurrentCandidate: () => {
        return engineGetCurrentCandidate(get(), playerPool);
      },

      draftPlayer: (player: PlayerProfile) => {
        const { state: nextState, result } = engineDraftPlayer(get(), player, playerPool);
        if (result.ok) {
          set(nextState);
        }
        return result;
      },

      skipCandidate: () => {
        const { state: nextState, result } = engineSkipCandidate(get(), playerPool);
        if (result.ok) {
          set(nextState);
        }
        return result;
      },

      startReveal: () => {
        const { state: nextState, result } = engineStartReveal(get());
        if (result.ok) {
          set(nextState);
        }
        return result;
      },

      revealNext: () => {
        const { state: nextState, result } = engineRevealNext(get());
        if (result.ok) {
          set(nextState);
        }
        return result;
      },

      completeReveal: () => {
        const { state: nextState, result } = engineCompleteReveal(get());
        if (result.ok) {
          set(nextState);
        }
        return result;
      },

      sellPlayer: (playerId: string) => {
        const { state: nextState, result } = engineSellPlayer(get(), playerId);
        if (result.ok) {
          set(nextState);
        }
        return result;
      },

      advanceYear: () => {
        const { state: nextState, result } = engineAdvanceYear(get());
        if (result.ok) {
          set(nextState);
        }
        return result;
      },

      endSimulation: () => {
        const { state: nextState, result } = engineEndSimulation(get());
        if (result.ok) {
          set(nextState);
        }
        return result;
      },

      resetGame: (customSeed?: number) => {
        const seed = customSeed ?? generateSeed();
        set(createInitialState(seed));
      },
    }),
    {
      name: 'fergie-time-game-v1',
      storage: createJSONStorage(() => getStorage()),
      skipHydration: true,
      partialize: (state) => ({
        budget: state.budget,
        currentYear: state.currentYear,
        roster: state.roster,
        phase: state.phase,
        seed: state.seed,
        skipsRemaining: state.skipsRemaining,
        skippedIds: state.skippedIds,
        transactions: state.transactions,
        revealedCount: state.revealedCount,
      }),
    }
  )
);

export const rehydrateGameStore = () => useGameStore.persist.rehydrate();

