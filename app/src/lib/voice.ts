import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useSyncExternalStore } from 'react';

import { api, API_URL } from './api';
import { storage } from './storage';

/**
 * Pip's voice. Lines are spoken with the natural ElevenLabs voice the backend
 * proxies (and caches); if that isn't set up or fails, the phone's own
 * text-to-speech voice is used instead, tuned to sound soft, warm and unhurried.
 *
 * Voice is opt-in: `enabled` starts as null ("not asked yet").
 */

const PREF_KEY = 'solace.voice';

/** `line` is what's being said right now, so only the Pip saying it moves its mouth. */
type State = { enabled: boolean | null; speaking: boolean; loaded: boolean; line: string | null };
let state: State = { enabled: null, speaking: false, loaded: false, line: null };
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useVoice() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

void storage.get(PREF_KEY).then((v) => set({ enabled: v === 'on' ? true : v === 'off' ? false : null, loaded: true }));

export async function setVoiceEnabled(enabled: boolean) {
  set({ enabled });
  if (!enabled) stopSpeaking();
  await storage.set(PREF_KEY, enabled ? 'on' : 'off');
}

let serverVoice: Promise<boolean> | null = null;
function hasServerVoice() {
  serverVoice ??= api<{ voice?: boolean }>('/health')
    .then((h) => !!h.voice)
    .catch(() => false);
  return serverVoice;
}

let audioModeSet = false;
async function ensureAudioMode() {
  if (audioModeSet) return;
  audioModeSet = true;
  await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(() => undefined);
}

/** Soft, lighter voices that suit a little seedling, by name or by the engine's own label. */
const GENTLE_VOICE = /female|samantha|ava|allison|susan|karen|moira|tessa|zoe|serena|nicky|veena|kate|fiona|sfg|tpf|tpc|iob|ena|enc/i;

let deviceVoice: Promise<string | undefined> | null = null;
function pickDeviceVoice() {
  deviceVoice ??= Speech.getAvailableVoicesAsync()
    .then((voices) => {
      const english = voices.filter((v) => v.language?.toLowerCase().startsWith('en'));
      const gentle = english.filter((v) => GENTLE_VOICE.test(`${v.name} ${v.identifier}`));
      const pool = gentle.length ? gentle : english;
      const best = pool.find((v) => String(v.quality) === 'Enhanced') ?? pool[0];
      return best?.identifier;
    })
    .catch(() => undefined);
  return deviceVoice;
}

const lineUrl = (text: string) => `${API_URL}/voice/speak?text=${encodeURIComponent(text)}`;

let player: AudioPlayer | null = null;
let generation = 0;

function releasePlayer() {
  if (!player) return;
  try {
    player.pause();
    player.remove();
  } catch {
    // Already released.
  }
  player = null;
}

export function stopSpeaking() {
  generation++;
  releasePlayer();
  void Speech.stop();
  if (state.speaking || state.line) set({ speaking: false, line: null });
}

function speakOnDevice(text: string, gen: number): Promise<void> {
  return pickDeviceVoice().then(
    (voice) =>
      new Promise<void>((resolve) => {
        if (gen !== generation) return resolve();
        const done = () => {
          if (gen === generation) set({ speaking: false, line: null });
          resolve();
        };
        Speech.speak(text, {
          voice,
          // A lighter, younger sound for Pip, still unhurried.
          pitch: 1.25,
          rate: 0.88,
          onStart: () => {
            if (gen === generation) set({ speaking: true });
          },
          onDone: done,
          onStopped: done,
          onError: done,
        });
      }),
  );
}

function speakWithServer(text: string, gen: number): Promise<boolean> {
  return new Promise((resolve) => {
    let started = false;
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (gen === generation) {
        releasePlayer();
        set({ speaking: false, line: null });
      }
      resolve(ok);
    };
    const p = createAudioPlayer({ uri: lineUrl(text) });
    player = p;
    // If nothing has started in 6 seconds, fall back to the device voice.
    const timeout = setTimeout(() => !started && finish(false), 6000);
    p.addListener('playbackStatusUpdate', (s) => {
      if (gen !== generation) return;
      if (s.playing && !started) {
        started = true;
        set({ speaking: true });
      }
      if (s.didJustFinish) finish(true);
    });
    try {
      p.play();
    } catch {
      finish(false);
    }
  });
}

/**
 * Say one line as Pip. Resolves when the line ends or is interrupted.
 * Does nothing unless the person turned voice on.
 */
export async function speak(text: string): Promise<void> {
  if (!state.enabled || !text.trim()) return;
  stopSpeaking();
  const gen = generation;
  set({ line: text });
  await ensureAudioMode();
  if (await hasServerVoice()) {
    if (gen !== generation) return;
    const ok = await speakWithServer(text, gen);
    if (ok || gen !== generation) return;
    // The natural voice failed (for example, the free ElevenLabs credits ran out): ask the server again
    // before the next line, so Pip moves to the phone's voice instead of waiting on it each time.
    serverVoice = null;
  }
  if (gen !== generation) return;
  await speakOnDevice(text, gen);
}

/** Warm the server's cache for a line that's coming up, so it starts instantly. */
export function prefetchLine(text: string) {
  if (!state.enabled || !text.trim()) return;
  void hasServerVoice().then((ok) => {
    if (ok) void fetch(lineUrl(text)).catch(() => undefined);
  });
}

// ---------- Sol's voice in chat ----------
//
// Sol reads its replies aloud with the phone's own voice: free, no limits, and
// it works offline. (Pip's natural ElevenLabs voice is kept for Pip, whose lines
// are short and cached.) A little lower and steadier than Pip, still unhurried.
// On by default; the speaker button in the chat header turns it off, and the
// choice is remembered.

const SOL_PREF_KEY = 'solace.solVoice';
let solVoiceOn = true;
const solListeners = new Set<() => void>();
void storage.get(SOL_PREF_KEY).then((v) => {
  if (v === 'off') {
    solVoiceOn = false;
    solListeners.forEach((l) => l());
  }
});

export function useSolVoice(): boolean {
  return useSyncExternalStore(
    (l) => {
      solListeners.add(l);
      return () => solListeners.delete(l);
    },
    () => solVoiceOn,
    () => solVoiceOn,
  );
}

export async function setSolVoice(on: boolean) {
  solVoiceOn = on;
  solListeners.forEach((l) => l());
  if (!on) stopSpeaking();
  await storage.set(SOL_PREF_KEY, on ? 'on' : 'off');
}

/** Plain words for speaking: no markdown, emoji or list markers. */
function forSpeech(text: string) {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[*_#`~>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Says one of Sol's replies, if Sol's voice is on. Stops anything already playing. */
export async function speakAsSol(text: string): Promise<void> {
  const words = forSpeech(text);
  if (!solVoiceOn || !words) return;
  stopSpeaking();
  const gen = generation;
  const voice = await pickDeviceVoice();
  if (gen !== generation) return;
  Speech.speak(words, { voice, pitch: 1.0, rate: 0.92 });
}
