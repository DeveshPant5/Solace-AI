export interface BreathPattern {
  id: string;
  title: string;
  subtitle: string;
  phases: { label: string; seconds: number; scale: number }[];
  cycles: number;
}

// scale: how big the circle is at the end of the phase.
export const BREATH_PATTERNS: Record<string, BreathPattern> = {
  calm: {
    id: 'calm',
    title: 'Calm breathing',
    subtitle: 'In for 5, out for 5. A gentle, even rhythm.',
    phases: [
      { label: 'Breathe in', seconds: 5, scale: 1 },
      { label: 'Breathe out', seconds: 5, scale: 0.55 },
    ],
    cycles: 12,
  },
  box: {
    id: 'box',
    title: 'Box breathing',
    subtitle: 'In 4, hold 4, out 4, hold 4. Steady and focusing.',
    phases: [
      { label: 'Breathe in', seconds: 4, scale: 1 },
      { label: 'Hold', seconds: 4, scale: 1 },
      { label: 'Breathe out', seconds: 4, scale: 0.55 },
      { label: 'Hold', seconds: 4, scale: 0.55 },
    ],
    cycles: 8,
  },
  '478': {
    id: '478',
    title: '4-7-8 breathing',
    subtitle: 'In 4, hold 7, out 8. The long exhale calms you down.',
    phases: [
      { label: 'Breathe in', seconds: 4, scale: 1 },
      { label: 'Hold', seconds: 7, scale: 1 },
      { label: 'Breathe out', seconds: 8, scale: 0.55 },
    ],
    cycles: 6,
  },
};

export const GROUNDING_STEPS = [
  { count: 5, sense: 'see', prompt: 'Look around. Name 5 things you can see.', icon: 'eye-outline' as const },
  { count: 4, sense: 'touch', prompt: 'Notice 4 things you can feel or touch.', icon: 'hand-left-outline' as const },
  { count: 3, sense: 'hear', prompt: 'Listen for 3 sounds, near or far.', icon: 'ear-outline' as const },
  { count: 2, sense: 'smell', prompt: 'Find 2 things you can smell.', icon: 'flower-outline' as const },
  { count: 1, sense: 'taste', prompt: 'Notice 1 thing you can taste.', icon: 'cafe-outline' as const },
];

export const EMOTIONS = {
  low: ['sad', 'lonely', 'anxious', 'overwhelmed', 'tired', 'frustrated', 'numb', 'stressed', 'hurt', 'scared'],
  high: ['calm', 'grateful', 'hopeful', 'content', 'proud', 'loved', 'energised', 'relieved', 'curious', 'joyful'],
};

export const JOURNAL_PROMPTS = [
  'What’s taking up the most space in your mind right now?',
  'What went better today than you expected?',
  'What would you tell a friend who had the day you had?',
  'What are you carrying that isn’t yours to carry?',
  'Name three small things that brought you comfort today.',
  'What do you need more of this week? What do you need less of?',
  'When did you feel most like yourself recently?',
  'What’s one thing you’re proud of, however small?',
  'What are you looking forward to, even a little?',
  'If your feelings could talk, what would they ask you for?',
];

export const FOCUS_AREAS = [
  { id: 'stress', label: 'Stress', icon: 'zap' as const },
  { id: 'anxiety', label: 'Anxiety', icon: 'cloud' as const },
  { id: 'low mood', label: 'Low mood', icon: 'cloud-rain' as const },
  { id: 'sleep', label: 'Sleep', icon: 'moon' as const },
  { id: 'self-esteem', label: 'Self-esteem', icon: 'heart' as const },
  { id: 'loneliness', label: 'Loneliness', icon: 'users' as const },
  { id: 'focus', label: 'Focus', icon: 'target' as const },
  { id: 'relationships', label: 'Relationships', icon: 'link' as const },
  { id: 'habits', label: 'Healthy habits', icon: 'repeat' as const },
];

/** Offline affirmations for reminder notifications. */
export const AFFIRMATIONS = [
  'You can begin again as many times as you need.',
  'Rest is part of the work, not a break from it.',
  'Your feelings are visitors. You can let them come and go.',
  'You’re allowed to take up space.',
  'Small steps still move you forward.',
  'You don’t have to have it all figured out today.',
  'You’re doing better than your worries say you are.',
  'You can be gentle with yourself and still grow.',
  'You’ve made it through every hard day so far.',
  'Your worth isn’t measured by your productivity.',
];

export interface HelpLine {
  name: string;
  detail: string;
  phone?: string;
  url?: string;
}

/** Support lines by country. Shown on the Help screen. */
export const HELPLINES: { region: string; zones: string[]; lines: HelpLine[] }[] = [
  {
    region: 'India',
    zones: ['Asia/Kolkata', 'Asia/Calcutta'],
    lines: [
      { name: 'Tele-MANAS', detail: 'Free, 24/7 mental health support from the Government of India', phone: '14416' },
      { name: 'Emergency', detail: 'Police, ambulance, fire', phone: '112' },
    ],
  },
  {
    region: 'United States',
    zones: ['America/'],
    lines: [
      { name: '988 Suicide & Crisis Lifeline', detail: 'Call or text, 24/7', phone: '988' },
      { name: 'Emergency', detail: 'Police, ambulance, fire', phone: '911' },
    ],
  },
  {
    region: 'United Kingdom & Ireland',
    zones: ['Europe/London', 'Europe/Dublin'],
    lines: [
      { name: 'Samaritans', detail: 'Free, 24/7, any time you need to talk', phone: '116123' },
      { name: 'Emergency', detail: 'Police, ambulance, fire', phone: '999' },
    ],
  },
];

export const FIND_A_HELPLINE = {
  name: 'Find A Helpline',
  detail: 'Free, confidential helplines in over 130 countries',
  url: 'https://findahelpline.com',
};
