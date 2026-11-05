import { useSyncExternalStore } from 'react';

import { pipStage } from '@/components/Pip';
import { storage } from './storage';

/**
 * Pip's plant grows with the person's garden level. Home and Journey report
 * the level whenever progress loads; every Pip in the app reads it here.
 * Before an account exists (onboarding), Pip has only just sprouted.
 */

const KEY = 'solace.pip.level';
let level: number | null = null;
const listeners = new Set<() => void>();

void storage.get(KEY).then((v) => {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0 && level === null) {
    level = n;
    listeners.forEach((l) => l());
  }
});

export function setPipLevel(next: number) {
  if (next === level) return;
  level = next;
  listeners.forEach((l) => l());
  void storage.set(KEY, String(next));
}

/** Forget the level, e.g. on sign-out, so a new account starts as a fresh sprout. */
export function resetPipLevel() {
  level = null;
  listeners.forEach((l) => l());
  void storage.remove(KEY);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePipStage(): number {
  const current = useSyncExternalStore(subscribe, () => level, () => level);
  return pipStage(current);
}
