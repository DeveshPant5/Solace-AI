// Activities the app can open. Luma (the AI companion) and the AI-written
// suggestions may only point at these IDs; the app maps each to a screen.
export const ACTIVITIES = {
  breathing_calm: "Calm breathing (5s in, 5s out) for 2 minutes. Good for general stress.",
  breathing_box: "Box breathing (4-4-4-4). Good for focus and mild anxiety.",
  breathing_478: "4-7-8 breathing with a long exhale. Good for strong anxiety and falling asleep.",
  grounding: "5-4-3-2-1 senses grounding. Good for panic, spiralling thoughts, dissociation.",
  mood_checkin: "A 30-second mood check-in.",
  journal: "Write a short reflection in the journal (can include a prompt).",
  assessment_mood: "Mood check: 4 questions about low mood over the last 2 weeks.",
  assessment_anxiety: "Anxiety check: 4 questions about worry over the last 2 weeks.",
  assessment_kindness: "Self-kindness check: 4 questions about self-talk this week.",
  guide_anxiety: "Guide: calming anxiety (grounding, breathing, naming thoughts).",
  guide_low_mood: "Guide: lifting low mood (tiny actions for heavy days).",
  guide_sleep: "Guide: sleep wind-down (body scan, brain dump, steady wake time).",
  guide_self_esteem: "Guide: self-esteem reset (kinder self-talk).",
  guide_stress: "Guide: stress reset (quick ways to release tension).",
  guide_mindfulness: "Guide: mindfulness basics (short present-moment practices).",
  help_now: "Crisis and support lines. Use when the person may be unsafe or needs professional help.",
} as const;

export type ActivityId = keyof typeof ACTIVITIES;
export const ACTIVITY_IDS = Object.keys(ACTIVITIES) as [ActivityId, ...ActivityId[]];

export const ACTIVITY_LIST_FOR_PROMPT = Object.entries(ACTIVITIES)
  .map(([id, description]) => `- ${id}: ${description}`)
  .join("\n");

export const FALLBACK_AFFIRMATIONS = [
  "You can begin again as many times as you need.",
  "Rest is part of the work, not a break from it.",
  "My feelings are visitors. I can let them come and go.",
  "I'm allowed to take up space.",
  "Small steps still move me forward.",
  "I don't have to have it all figured out today.",
  "I'm doing better than my worries say I am.",
  "I can be gentle with myself and still grow.",
  "This moment is enough, and so am I.",
  "I've survived every hard day so far.",
  "My worth isn't measured by my productivity.",
  "It's okay to ask for help. It's a strength.",
  "I choose progress over perfection.",
  "I can hold space for both hope and hurt.",
];

/** Mood scale used everywhere: 1 = very low, 5 = great. */
export const MOOD_LABELS = ["", "Very low", "Low", "Okay", "Good", "Great"] as const;

/** Focus areas a person can pick in onboarding and settings (the app shows the same list). */
export const FOCUS_IDS = [
  "stress",
  "anxiety",
  "low mood",
  "sleep",
  "self-esteem",
  "loneliness",
  "focus",
  "relationships",
  "habits",
] as const;
export type FocusId = (typeof FOCUS_IDS)[number];
export const isFocusId = (value: string): value is FocusId => (FOCUS_IDS as readonly string[]).includes(value);

/** Guides in the app; each step earns XP once. */
export const GUIDE_IDS = ["anxiety", "low_mood", "sleep", "self_esteem", "stress", "mindfulness"] as const;
