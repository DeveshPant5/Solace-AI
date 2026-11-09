import type { Href } from 'expo-router';

import type { Accent } from '@/theme';

import type { TaskActivity, TaskItem } from './types';

/** The app's practices a task can be. Doing one in the app ticks its task by itself. */
export const PRACTICE_CHOICES: { activity: Exclude<TaskActivity, 'own'>; title: string; icon: string; accent: Accent }[] = [
  { activity: 'breathe_calm', title: 'Calm breathing', icon: 'wind', accent: 'sky' },
  { activity: 'breathe_box', title: 'Box breathing', icon: 'square', accent: 'sky' },
  { activity: 'breathe_478', title: '4-7-8 breathing', icon: 'moon', accent: 'lavender' },
  { activity: 'grounding', title: 'Grounding', icon: 'anchor', accent: 'sage' },
  { activity: 'journal', title: 'Journal', icon: 'notebook', accent: 'peach' },
  { activity: 'checkin', title: 'Check in with yourself', icon: 'heart', accent: 'rose' },
];

/** Ideas for the person's own tasks, with a sensible timer. */
export const OWN_CHOICES: { title: string; icon: string; minutes: number | null }[] = [
  { title: 'Yoga', icon: 'yoga', minutes: 20 },
  { title: 'Stretching', icon: 'stretch', minutes: 10 },
  { title: 'A short walk', icon: 'footprints', minutes: 15 },
  { title: 'Meditation', icon: 'flower', minutes: 10 },
  { title: 'Drink water', icon: 'droplet', minutes: null },
  { title: 'Read', icon: 'book-open', minutes: 20 },
];

export const TIMER_CHOICES = [null, 5, 10, 15, 20, 30, 45, 60] as const;

const OWN_ICONS: [RegExp, string][] = [
  [/yoga|asana|surya/i, 'yoga'],
  [/stretch|pilates|exercise|workout|gym/i, 'stretch'],
  [/walk|run|jog|steps|hike/i, 'footprints'],
  [/medita|mindful|pray/i, 'flower'],
  [/water|drink|hydrat/i, 'droplet'],
  [/read|book|study/i, 'book-open'],
  [/sleep|bed|nap/i, 'moon'],
  [/sun|outside|garden/i, 'sun'],
  [/tea|coffee|eat|meal|lunch|breakfast/i, 'coffee'],
  [/call|phone|friend|family/i, 'phone'],
  [/write|journal/i, 'notebook'],
];

export function taskLook(task: Pick<TaskItem, 'activity' | 'title'>): { icon: string; accent: Accent } {
  const practice = PRACTICE_CHOICES.find((p) => p.activity === task.activity);
  if (practice) return practice;
  const icon = OWN_ICONS.find(([re]) => re.test(task.title))?.[1] ?? 'sprout';
  return { icon, accent: 'butter' };
}

/** Where a task opens: the practice itself, or the task's own screen (with its timer). */
export function taskHref(task: Pick<TaskItem, 'id' | 'activity'>): Href {
  switch (task.activity) {
    case 'breathe_calm':
      return '/breathe/calm';
    case 'breathe_box':
      return '/breathe/box';
    case 'breathe_478':
      return '/breathe/478';
    case 'grounding':
      return '/grounding';
    case 'journal':
      return '/journal/new';
    case 'checkin':
      return '/checkin';
    default:
      return `/tasks/${task.id}`;
  }
}

/** The gentle line under a task's reminder. */
export function reminderLine(task: Pick<TaskItem, 'activity' | 'minutes'>): string {
  switch (task.activity) {
    case 'breathe_calm':
    case 'breathe_box':
    case 'breathe_478':
      return 'A few slow breaths, whenever you’re ready.';
    case 'grounding':
      return 'A quiet minute to come back to the here and now.';
    case 'journal':
      return 'A few lines, just for you.';
    case 'checkin':
      return 'How are you feeling, really?';
    default:
      return task.minutes ? `${task.minutes} minutes, just for you.` : 'Whenever you’re ready.';
  }
}

export const EVERY_DAY = 127;
const WEEKDAYS = 0b0111110;
const WEEKEND = 0b1000001;
/** Monday first, as people read a week. Index is the JS weekday (0 = Sunday). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const hasDay = (days: number, weekday: number) => ((days >> weekday) & 1) === 1;

export function daysLabel(days: number): string {
  if (days === EVERY_DAY) return 'Every day';
  if (days === WEEKDAYS) return 'Weekdays';
  if (days === WEEKEND) return 'Weekends';
  const picked = WEEK_ORDER.filter((d) => hasDay(days, d));
  return picked.length === 1 ? `${DAY_FULL[picked[0]!]}s` : picked.map((d) => DAY_NAMES[d]).join(', ');
}

export const dayName = (weekday: number) => DAY_FULL[weekday]!;
