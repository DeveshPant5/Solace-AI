import { api } from './api';
import type { Tone } from './types';

/** Pip's help during onboarding. Every call is optional: on any failure the flow just carries on. */

export interface IntentionHelp {
  say: string;
  rephrasings: string[];
  focus: string[];
  concern: boolean;
  source: 'ai' | 'offline';
}

export interface ToneHelp {
  say: string;
  previews: Record<Tone, string>;
  concern: boolean;
  source: 'ai' | 'offline';
}

export async function helpWithIntention(input: { name?: string; text: string; focus?: string[] }): Promise<IntentionHelp | null> {
  try {
    return await api<IntentionHelp>('/onboarding/assist', { body: { kind: 'intention', ...input } });
  } catch {
    return null;
  }
}

export async function helpWithTone(input: { name?: string; text: string }): Promise<ToneHelp | null> {
  try {
    return await api<ToneHelp>('/onboarding/assist', { body: { kind: 'tone', ...input } });
  } catch {
    return null;
  }
}
