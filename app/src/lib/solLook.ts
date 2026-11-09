import { useSyncExternalStore } from 'react';

import { storage } from './storage';

/**
 * How the person has dressed Luma up in the secret wardrobe (hold Settings on the
 * You tab for five seconds). Kept on this phone, per account. "auto" eyes and
 * mouth follow Luma's mood, which is how Luma looks out of the box.
 */
export const FRUITS = [
  { id: 'classic', label: 'Luma' },
  { id: 'apple', label: 'Apple' },
  { id: 'orange', label: 'Orange' },
  { id: 'pear', label: 'Pear' },
  { id: 'strawberry', label: 'Strawberry' },
  { id: 'lemon', label: 'Lemon' },
  { id: 'blueberry', label: 'Blueberry' },
  { id: 'peach', label: 'Peach' },
] as const;

export const EYES = [
  { id: 'auto', label: 'As Luma feels' },
  { id: 'round', label: 'Bright' },
  { id: 'big', label: 'Sparkly' },
  { id: 'happy', label: 'Smiling' },
  { id: 'sleepy', label: 'Sleepy' },
  { id: 'angry', label: 'Grumpy' },
  { id: 'worried', label: 'Worried' },
  { id: 'wink', label: 'Wink' },
  { id: 'hearts', label: 'Hearts' },
  { id: 'stars', label: 'Stars' },
] as const;

export const MOUTHS = [
  { id: 'auto', label: 'As Luma feels' },
  { id: 'smile', label: 'Smile' },
  { id: 'grin', label: 'Big grin' },
  { id: 'soft', label: 'Soft' },
  { id: 'tongue', label: 'Cheeky' },
  { id: 'cat', label: 'Kitty' },
  { id: 'open', label: 'Oh!' },
  { id: 'flat', label: 'Meh' },
  { id: 'frown', label: 'Frown' },
  { id: 'smirk', label: 'Smirk' },
  { id: 'grumpy', label: 'Grr' },
] as const;

export const CHEEKS = [
  { id: 'rosy', label: 'Rosy' },
  { id: 'freckles', label: 'Freckles' },
  { id: 'none', label: 'None' },
] as const;

export const GLASSES = [
  { id: 'none', label: 'None' },
  { id: 'round', label: 'Reading' },
  { id: 'sun', label: 'Sunnies' },
] as const;

export type FruitId = (typeof FRUITS)[number]['id'];
export type EyeChoice = (typeof EYES)[number]['id'];
export type MouthChoice = (typeof MOUTHS)[number]['id'];
export type CheekChoice = (typeof CHEEKS)[number]['id'];
export type GlassesChoice = (typeof GLASSES)[number]['id'];

export interface SolLook {
  fruit: FruitId;
  eyes: EyeChoice;
  mouth: MouthChoice;
  cheeks: CheekChoice;
  glasses: GlassesChoice;
}

export const CLASSIC_LOOK: SolLook = { fruit: 'classic', eyes: 'auto', mouth: 'auto', cheeks: 'rosy', glasses: 'none' };

const pick = <T extends { id: string }>(options: readonly T[], value: unknown, fallback: T['id']): T['id'] =>
  options.some((o) => o.id === value) ? (value as T['id']) : fallback;

/** Anything stored earlier (or tampered with) falls back to Luma's usual look, part by part. */
function sanitize(raw: unknown): SolLook {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    fruit: pick(FRUITS, v.fruit, 'classic'),
    eyes: pick(EYES, v.eyes, 'auto'),
    mouth: pick(MOUTHS, v.mouth, 'auto'),
    cheeks: pick(CHEEKS, v.cheeks, 'rosy'),
    glasses: pick(GLASSES, v.glasses, 'none'),
  };
}

let current: SolLook = CLASSIC_LOOK;
let key: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSolLook(): SolLook {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

/** Loads the signed-in person's Luma (or the usual Luma when signed out). */
export async function loadSolLook(userId: string | null) {
  key = userId ? `solace.solLook.${userId}` : null;
  let next = CLASSIC_LOOK;
  if (key) {
    try {
      const raw = await storage.get(key);
      if (raw) next = sanitize(JSON.parse(raw));
    } catch {
      // Unreadable: keep the usual Luma.
    }
  }
  current = next;
  emit();
}

export function setSolLook(next: SolLook) {
  current = sanitize(next);
  emit();
  if (key) void storage.set(key, JSON.stringify(current));
}

export const isClassic = (look: SolLook) =>
  (Object.keys(CLASSIC_LOOK) as (keyof SolLook)[]).every((k) => look[k] === CLASSIC_LOOK[k]);

export function randomLook(): SolLook {
  const any = <T extends { id: string }>(options: readonly T[]) => options[Math.floor(Math.random() * options.length)]!.id;
  return { fruit: any(FRUITS), eyes: any(EYES), mouth: any(MOUTHS), cheeks: any(CHEEKS), glasses: any(GLASSES) } as SolLook;
}
