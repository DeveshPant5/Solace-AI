import type { ActivityId } from '@/lib/types';
import type { Accent } from '@/theme';

export interface GuideStep {
  title: string;
  body: string;
  /** Optional in-app practice that goes with this step. */
  activity?: ActivityId;
}

export interface Guide {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  accent: Accent;
  steps: GuideStep[];
  closing: string;
}

export const GUIDES: Record<string, Guide> = {
  anxiety: {
    id: 'anxiety',
    eyebrow: 'When worry takes over',
    title: 'Calming anxiety',
    intro: 'Anxiety is your body trying to protect you. These steps help it stand down.',
    accent: 'lavender',
    steps: [
      { title: 'Ground in your senses', body: 'Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste. It pulls attention out of the loop and into the room.', activity: 'grounding' },
      { title: 'Lengthen the exhale', body: 'Breathe in for 4, hold for 7, out for 8. A long out-breath is the quickest signal to your nervous system that you are safe.', activity: 'breathing_478' },
      { title: 'Label the thought', body: 'Try "I notice I’m having the thought that…" before the worry. It puts a little distance between you and the story.' },
      { title: 'Cool down', body: 'Splash cold water on your face or hold something cold for 30 seconds. Cold slows your heart rate within moments.' },
    ],
    closing: 'Still spiralling? Talk it through with Sol, or reach out to someone you trust.',
  },
  low_mood: {
    id: 'low_mood',
    eyebrow: 'For the heavier days',
    title: 'Lifting low mood',
    intro: 'Low mood shrinks your world. Small actions, done before you feel like it, slowly widen it again.',
    accent: 'butter',
    steps: [
      { title: 'Do one tiny thing', body: 'Make your bed, wash one cup, open a window. Motivation usually follows action, not the other way round.' },
      { title: 'Find the light', body: 'Spend 10 minutes outside or by a bright window, ideally in the morning. Daylight helps reset mood and sleep.' },
      { title: 'Move gently', body: 'A short walk or a few stretches is enough. You don’t need a workout; you need a little momentum.' },
      { title: 'Reach toward someone', body: 'Send one message to a person you like. Connection is one of the strongest mood lifters we know of.' },
    ],
    closing: 'If low mood has stayed for two weeks or more, talking to a doctor or counsellor can really help.',
  },
  sleep: {
    id: 'sleep',
    eyebrow: 'When your mind won’t switch off',
    title: 'Sleep wind-down',
    intro: 'Sleep comes more easily when your body gets a clear signal that the day is over.',
    accent: 'sky',
    steps: [
      { title: 'Dim the day', body: 'An hour before bed, lower the lights and put your phone on Do Not Disturb. Bright screens tell your brain it’s still daytime.' },
      { title: 'Empty your head', body: 'Write down everything you’re carrying: tasks, worries, half-thoughts. Paper can hold it until morning.', activity: 'journal' },
      { title: 'Relax from toes to head', body: 'Lying down, notice each part of your body in turn and let it get heavy. If your mind wanders, just come back.' },
      { title: 'Keep a steady wake time', body: 'Getting up at the same time every day, weekends included, is the most reliable way to steady your sleep.' },
    ],
    closing: 'Lying awake? Try slow 4-7-8 breathing rather than checking the time.',
  },
  self_esteem: {
    id: 'self_esteem',
    eyebrow: 'When your inner critic is loud',
    title: 'Self-esteem reset',
    intro: 'The way you talk to yourself becomes the way you feel about yourself. These steps soften that voice.',
    accent: 'rose',
    steps: [
      { title: 'Talk to yourself like a friend', body: 'When you mess up, ask: what would I say to a friend in this exact spot? Then say that to yourself.' },
      { title: 'Spot the absolutes', body: 'Listen for "always", "never", "everyone". They’re usually the critic exaggerating. Swap them for something truer.' },
      { title: 'Collect small proof', body: 'Each night, write three things you did, however small. Over time it builds evidence your critic can’t ignore.', activity: 'journal' },
      { title: 'Curate your feed', body: 'Mute a few accounts that leave you feeling smaller. What you see every day shapes how you see yourself.' },
    ],
    closing: 'Want help rewriting a harsh thought? Sol can work through it with you.',
  },
  stress: {
    id: 'stress',
    eyebrow: 'When everything feels like too much',
    title: 'Stress reset',
    intro: 'Stress builds up in the body. These quick resets help release it before it piles higher.',
    accent: 'peach',
    steps: [
      { title: 'Drop your shoulders', body: 'Notice your jaw, shoulders and hands. Unclench them, and take one deep breath all the way down.' },
      { title: 'Shake it out', body: 'Stand up and shake your hands and arms for 30 seconds. It sounds silly, but it helps your body burn off stress energy.' },
      { title: 'Shrink the list', body: 'Write everything down, then circle just one thing for the next hour. The rest can wait.' },
      { title: 'Take a breathing break', body: 'Two minutes of slow, even breathing lowers your heart rate and clears your head.', activity: 'breathing_calm' },
    ],
    closing: 'Stress is a signal, not a failure. It’s okay to ask for help with what’s on your plate.',
  },
  mindfulness: {
    id: 'mindfulness',
    eyebrow: 'Coming back to now',
    title: 'Mindfulness basics',
    intro: 'Mindfulness is noticing what’s happening right now, kindly. It gets easier the more you practise.',
    accent: 'sage',
    steps: [
      { title: 'One mindful breath', body: 'Feel one full breath: the air coming in, the pause, the air going out. That’s a complete practice.' },
      { title: 'Notice and name', body: 'When a feeling shows up, name it quietly: "this is frustration". Naming a feeling makes it easier to hold.' },
      { title: 'Do one thing slowly', body: 'Drink a cup of tea or wash your hands with full attention: temperature, texture, smell.' },
      { title: 'Be kind when you drift', body: 'Your mind will wander. Noticing that it wandered is the practice. Come back without scolding yourself.' },
    ],
    closing: 'A few minutes a day is enough. Try pairing it with your morning or bedtime routine.',
  },
};
