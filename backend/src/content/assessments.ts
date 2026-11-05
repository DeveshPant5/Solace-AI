// Short wellbeing check-ins. The mood and anxiety items are the PHQ-4
// (Kroenke et al., 2009) split into its two parts and extended with two items
// each from the PHQ-9 and GAD-7, which are free to use. The self-kindness
// check is our own and is not a clinical scale. None of these are diagnoses.

export type AssessmentKind = "mood" | "anxiety" | "kindness";

export interface AssessmentDef {
  kind: AssessmentKind;
  title: string;
  subtitle: string;
  intro: string;
  questions: string[];
  options: string[];
  /** Highest total = most distress, unless reversed. */
  reversed: boolean;
  bands: { max: number; band: string; label: string; summary: string }[];
}

const FREQUENCY = ["Not at all", "Several days", "More than half the days", "Nearly every day"];

export const ASSESSMENTS: Record<AssessmentKind, AssessmentDef> = {
  mood: {
    kind: "mood",
    title: "Mood check",
    subtitle: "4 questions about the last two weeks",
    intro: "Over the last 2 weeks, how often have you been bothered by…",
    questions: [
      "Little interest or pleasure in doing things",
      "Feeling down, depressed, or hopeless",
      "Feeling tired or having little energy",
      "Feeling bad about yourself, or that you've let yourself or others down",
    ],
    options: FREQUENCY,
    reversed: false,
    bands: [
      { max: 2, band: "steady", label: "Steady", summary: "Your mood has mostly been holding up." },
      { max: 5, band: "mild", label: "A little heavy", summary: "Some low days have been showing up." },
      { max: 8, band: "moderate", label: "Weighed down", summary: "Low mood has been taking up real space lately." },
      { max: 12, band: "high", label: "Really struggling", summary: "Things have felt very heavy. You deserve proper support with this." },
    ],
  },
  anxiety: {
    kind: "anxiety",
    title: "Anxiety check",
    subtitle: "4 questions about the last two weeks",
    intro: "Over the last 2 weeks, how often have you been bothered by…",
    questions: [
      "Feeling nervous, anxious, or on edge",
      "Not being able to stop or control worrying",
      "Trouble relaxing",
      "Becoming easily annoyed or irritable",
    ],
    options: FREQUENCY,
    reversed: false,
    bands: [
      { max: 2, band: "steady", label: "Calm waters", summary: "Worry hasn't been running the show." },
      { max: 5, band: "mild", label: "Some ripples", summary: "Worry has been showing up now and then." },
      { max: 8, band: "moderate", label: "Choppy", summary: "Anxiety has been a frequent visitor." },
      { max: 12, band: "high", label: "Stormy", summary: "Anxiety has been intense. Extra support could really help." },
    ],
  },
  kindness: {
    kind: "kindness",
    title: "Self-kindness check",
    subtitle: "4 questions about this week",
    intro: "This week, how often did you…",
    questions: [
      "Speak to yourself the way you'd speak to a good friend",
      "Let yourself rest without feeling guilty",
      "Notice something you did well",
      "Forgive yourself for a mistake",
    ],
    options: ["Rarely", "Sometimes", "Often", "Almost always"],
    reversed: true,
    bands: [
      { max: 3, band: "high", label: "Running on empty", summary: "Your inner voice has been tough on you this week." },
      { max: 6, band: "moderate", label: "Finding your footing", summary: "Kindness toward yourself comes and goes." },
      { max: 9, band: "mild", label: "Growing gentler", summary: "You're giving yourself more grace than you might think." },
      { max: 12, band: "steady", label: "Your own ally", summary: "You've been a good friend to yourself this week." },
    ],
  },
};

export function scoreAssessment(def: AssessmentDef, answers: number[]) {
  const score = answers.reduce((sum, a) => sum + a, 0);
  const maxScore = def.questions.length * (def.options.length - 1);
  const band = def.bands.find((b) => score <= b.max) ?? def.bands[def.bands.length - 1]!;
  return { score, maxScore, band };
}

/** Offline "next steps" when the AI is unavailable, keyed by band. */
export const FALLBACK_MOVES: Record<AssessmentKind, Record<string, { title: string; body: string; activity: string }[]>> = {
  mood: {
    steady: [
      { title: "Bank a good moment", body: "Write down one thing that went well today and why.", activity: "journal" },
      { title: "Move a little", body: "A 10-minute walk outside is a quiet mood protector.", activity: "none" },
      { title: "Share the light", body: "Send a kind message to someone you care about.", activity: "none" },
    ],
    mild: [
      { title: "Plan one small joy", body: "Pick something tiny you usually enjoy and put it in today.", activity: "none" },
      { title: "Talk it through", body: "Tell Sol what has felt heavy lately.", activity: "chat" },
      { title: "Get some daylight", body: "Ten minutes of morning light helps steady your energy.", activity: "none" },
    ],
    moderate: [
      { title: "Shrink the day", body: "Choose one must-do. Everything else is a bonus.", activity: "none" },
      { title: "Read: lifting low mood", body: "Small, practical steps for heavier days.", activity: "guide_low_mood" },
      { title: "Reach out", body: "Let one person you trust know you're having a hard time.", activity: "none" },
    ],
    high: [
      { title: "You don't have to carry this alone", body: "Talking to a doctor or counsellor can make a real difference.", activity: "help_now" },
      { title: "Talk to Sol now", body: "Say what's on your mind. No judgement.", activity: "chat" },
      { title: "Breathe for a minute", body: "A slow breath can take the edge off right now.", activity: "breathing_calm" },
    ],
  },
  anxiety: {
    steady: [
      { title: "Keep your anchor", body: "A short daily breathing practice keeps calm easy to find.", activity: "breathing_calm" },
      { title: "Protect your sleep", body: "Same wake time each day keeps worry quieter.", activity: "none" },
      { title: "Notice what helps", body: "Write down what kept you steady this week.", activity: "journal" },
    ],
    mild: [
      { title: "Ground yourself", body: "Try the 5-4-3-2-1 senses exercise when worry spikes.", activity: "grounding" },
      { title: "Schedule worry time", body: "Give worries 10 minutes later instead of all day.", activity: "none" },
      { title: "Box breathing", body: "4 in, 4 hold, 4 out, 4 hold. Four rounds.", activity: "breathing_box" },
    ],
    moderate: [
      { title: "Long exhale breathing", body: "Exhaling longer than you inhale tells your body it's safe.", activity: "breathing_478" },
      { title: "Read: calming anxiety", body: "Tools for when your mind won't settle.", activity: "guide_anxiety" },
      { title: "Name the thought", body: "Tell Sol the worry that keeps looping.", activity: "chat" },
    ],
    high: [
      { title: "Get support", body: "A doctor or counsellor can help with anxiety this strong.", activity: "help_now" },
      { title: "Ground yourself now", body: "Notice 5 things you can see, 4 you can touch…", activity: "grounding" },
      { title: "Slow breathing", body: "Follow the circle for a minute.", activity: "breathing_478" },
    ],
  },
  kindness: {
    steady: [
      { title: "Pass it on", body: "Write yourself a note you can reread on a hard day.", activity: "journal" },
      { title: "Keep the streak", body: "Name one thing you did well before bed.", activity: "none" },
      { title: "Rest on purpose", body: "Plan a guilt-free break this week.", activity: "none" },
    ],
    mild: [
      { title: "Three tiny wins", body: "Each night, write three small things you did.", activity: "journal" },
      { title: "Friend test", body: "Would you say it to a friend? If not, rephrase it.", activity: "none" },
      { title: "Read: self-esteem reset", body: "Gentle ways to quiet the inner critic.", activity: "guide_self_esteem" },
    ],
    moderate: [
      { title: "Catch the critic", body: "Notice 'always' and 'never' in your self-talk.", activity: "guide_self_esteem" },
      { title: "Say it out loud", body: "Tell Sol one thing you're proud of, however small.", activity: "chat" },
      { title: "Affirm it", body: "Read today's affirmation slowly, twice.", activity: "none" },
    ],
    high: [
      { title: "Be your own friend", body: "What would you tell a friend who felt this way?", activity: "chat" },
      { title: "Read: self-esteem reset", body: "Small steps that rebuild self-trust.", activity: "guide_self_esteem" },
      { title: "Reach out", body: "If this feeling runs deep, a counsellor can help.", activity: "help_now" },
    ],
  },
};
