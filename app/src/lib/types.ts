export type Tone = 'gentle' | 'cheerful' | 'direct';
export type CheckinTime = 'morning' | 'afternoon' | 'evening' | 'night';

export interface User {
  id: string;
  email: string;
  name: string;
  timezone: string;
  profile: { focus?: string[]; intention?: string; checkinTime?: CheckinTime };
  preferences: { tone?: Tone; memoryEnabled?: boolean };
  createdAt: string;
}

export type ActivityId =
  | 'breathing_calm'
  | 'breathing_box'
  | 'breathing_478'
  | 'grounding'
  | 'mood_checkin'
  | 'journal'
  | 'assessment_mood'
  | 'assessment_anxiety'
  | 'assessment_kindness'
  | 'guide_anxiety'
  | 'guide_low_mood'
  | 'guide_sleep'
  | 'guide_self_esteem'
  | 'guide_stress'
  | 'guide_mindfulness'
  | 'help_now'
  | 'chat'
  | 'none';

export interface Level {
  level: number;
  name: string;
  xp: number;
  levelStartXp: number;
  nextLevelXp: number | null;
  nextLevelName: string | null;
}

export interface Streak {
  current: number;
  longest: number;
  activeToday: boolean;
}

export interface DailyCard {
  affirmation: string;
  focusTitle: string;
  focusBody: string;
  activity: ActivityId;
  source: 'ai' | 'offline';
}

export interface HomeData {
  name: string;
  progress: Level & { streak: Streak; today: string };
  todayMood: { mood: number; emotions: string[]; createdAt: string } | null;
  lastConversation: { id: string; title: string | null; updatedAt: string } | null;
  daily: DailyCard | null;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  goal: number;
  value: number;
  earned: boolean;
}

export interface ProgressData extends Level {
  streak: Streak;
  today: string;
  activeDays: string[];
  moodDays: { day: string; mood: number; count: number }[];
  counts: Record<'checkins' | 'breathing' | 'grounding' | 'journal' | 'assessments' | 'conversations', number>;
  achievements: Achievement[];
}

export interface Reflection {
  headline: string;
  reflection: string;
  highlights: string[];
  gentleGoal: string;
}

export interface Suggestion {
  activity: ActivityId;
  reason: string;
  journalPrompt?: string;
}

export interface ChatSignal {
  mood: 'very_low' | 'low' | 'okay' | 'good' | 'great' | 'unclear';
  emotions: string[];
  risk: 'none' | 'concern' | 'crisis';
}

export interface ReminderItem {
  id: string;
  kind: 'mood' | 'affirmation' | 'breathing' | 'selfcare' | 'custom';
  title: string;
  body: string | null;
  hour: number;
  minute: number;
  enabled: boolean;
  createdBy: 'user' | 'system' | 'sol';
}

export type TaskActivity = 'breathe_calm' | 'breathe_box' | 'breathe_478' | 'grounding' | 'journal' | 'checkin' | 'own';

export interface TaskItem {
  id: string;
  activity: TaskActivity;
  title: string;
  hour: number;
  minute: number;
  /** Bit 0 is Sunday ... bit 6 is Saturday (127 = every day). */
  days: number;
  /** Timer length for the person's own tasks. */
  minutes: number | null;
  remind: boolean;
  dueToday: boolean;
  doneToday: boolean;
  /** 'practice': done in the app today, so it can't be unticked. */
  doneVia: 'tick' | 'practice' | null;
}

export interface TasksData {
  today: { day: string; weekday: number };
  tasks: TaskItem[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meta: {
    suggestions?: Suggestion[];
    memories?: { id: string; content: string }[];
    reminders?: Omit<ReminderItem, 'kind' | 'enabled' | 'createdBy'>[];
    safety?: 'concern' | 'crisis';
    signal?: ChatSignal;
  };
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  preview: string | null;
  messageCount: number;
}

export interface AssessmentDef {
  kind: 'mood' | 'anxiety' | 'kindness';
  title: string;
  subtitle: string;
  intro: string;
  questions: string[];
  options: string[];
  xpPerQuestion: number;
  bonusXp: number;
}

export interface Move {
  title: string;
  body: string;
  activity: ActivityId;
}

export interface AssessmentResult {
  id: string;
  kind: AssessmentDef['kind'];
  title: string;
  score: number;
  maxScore: number;
  band: 'steady' | 'mild' | 'moderate' | 'high';
  label: string;
  summary?: string;
  moves?: Move[];
  createdAt: string;
}

export interface MoodEntry {
  id: string;
  mood: number;
  emotions: string[];
  note: string | null;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  prompt: string | null;
  content: string;
  createdAt: string;
}

export interface Memory {
  id: string;
  content: string;
  category: string;
  createdAt: string;
}
