import type { Href } from 'expo-router';

import type { IconName } from '@/components/ui';
import type { ActivityId } from '@/lib/types';
import type { Accent } from '@/theme';

export interface ActivityInfo {
  title: string;
  subtitle: string;
  icon: IconName;
  accent: Accent;
  href: Href;
}

export const ACTIVITY_INFO: Record<Exclude<ActivityId, 'none'>, ActivityInfo> = {
  breathing_calm: { title: 'Calm breathing', subtitle: '2 min · 5 in, 5 out', icon: 'wind', accent: 'sky', href: '/breathe/calm' },
  breathing_box: { title: 'Box breathing', subtitle: '2 min · steady focus', icon: 'square', accent: 'lavender', href: '/breathe/box' },
  breathing_478: { title: '4-7-8 breathing', subtitle: '2 min · long exhale', icon: 'moon', accent: 'lavender', href: '/breathe/478' },
  grounding: { title: '5-4-3-2-1 grounding', subtitle: '3 min · use your senses', icon: 'anchor', accent: 'sage', href: '/grounding' },
  mood_checkin: { title: 'Mood check-in', subtitle: '30 seconds', icon: 'heart', accent: 'rose', href: '/checkin' },
  journal: { title: 'Reflect in your journal', subtitle: 'A few quiet minutes', icon: 'feather', accent: 'butter', href: '/journal/new' },
  assessment_mood: { title: 'Mood check', subtitle: '4 questions', icon: 'sun', accent: 'peach', href: '/assessment/mood' },
  assessment_anxiety: { title: 'Anxiety check', subtitle: '4 questions', icon: 'cloud', accent: 'sky', href: '/assessment/anxiety' },
  assessment_kindness: { title: 'Self-kindness check', subtitle: '4 questions', icon: 'smile', accent: 'rose', href: '/assessment/kindness' },
  guide_anxiety: { title: 'Calming anxiety', subtitle: 'Guide · 4 steps', icon: 'cloud-drizzle', accent: 'lavender', href: '/guide/anxiety' },
  guide_low_mood: { title: 'Lifting low mood', subtitle: 'Guide · 4 steps', icon: 'sunrise', accent: 'butter', href: '/guide/low_mood' },
  guide_sleep: { title: 'Sleep wind-down', subtitle: 'Guide · 4 steps', icon: 'moon', accent: 'sky', href: '/guide/sleep' },
  guide_self_esteem: { title: 'Self-esteem reset', subtitle: 'Guide · 4 steps', icon: 'heart', accent: 'rose', href: '/guide/self_esteem' },
  guide_stress: { title: 'Stress reset', subtitle: 'Guide · 4 steps', icon: 'zap-off', accent: 'peach', href: '/guide/stress' },
  guide_mindfulness: { title: 'Mindfulness basics', subtitle: 'Guide · 4 steps', icon: 'eye', accent: 'sage', href: '/guide/mindfulness' },
  help_now: { title: 'Get support now', subtitle: 'Helplines and next steps', icon: 'life-buoy', accent: 'rose', href: '/help' },
  chat: { title: 'Talk to Luma', subtitle: 'Say what’s on your mind', icon: 'message-circle', accent: 'lavender', href: '/sol' },
};

export function activityInfo(id: ActivityId | undefined | null): ActivityInfo | null {
  if (!id || id === 'none') return null;
  return ACTIVITY_INFO[id] ?? null;
}

export function activityHref(id: ActivityId, journalPrompt?: string): Href {
  if (id === 'journal' && journalPrompt) return { pathname: '/journal/new', params: { prompt: journalPrompt } };
  return ACTIVITY_INFO[id as Exclude<ActivityId, 'none'>]?.href ?? '/';
}
