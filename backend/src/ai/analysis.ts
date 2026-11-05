import { z } from "zod";
import { ACTIVITY_IDS, ACTIVITY_LIST_FOR_PROMPT } from "../content/catalog.js";
import { structured } from "./client.js";

// Unknown activity names fall back to "none" instead of failing the whole response.
const ActivityOrNone = z.enum([...ACTIVITY_IDS, "chat", "none"]).catch("none");

// ---------- Mood + safety signal for each chat message ----------

const MessageSignal = z.object({
  mood: z.enum(["very_low", "low", "okay", "good", "great", "unclear"]),
  emotions: z.array(z.string()).describe("Up to 3 lowercase emotion words, e.g. anxious, lonely, hopeful"),
  risk: z
    .enum(["none", "concern", "crisis"])
    .describe(
      "crisis = mentions suicide, self-harm, wanting to die, harming others, or being in danger now. concern = hopelessness, feeling like a burden, severe distress without explicit danger. none = everything else.",
    ),
});
export type MessageSignal = z.infer<typeof MessageSignal>;

export function analyzeMessage(message: string, recent: string) {
  return structured(
    MessageSignal,
    "You read one message from a user of a mental wellness app and estimate their current mood and any safety risk. Be careful: false 'crisis' alarms are upsetting, but missing a real one is worse.",
    `Recent conversation (for context):\n${recent || "(none)"}\n\nMessage to assess:\n"""${message}"""`,
    "signal",
  );
}

// ---------- Conversation title ----------

const Title = z.object({ title: z.string().describe("3-5 words, sentence case, no quotes or trailing punctuation") });

export async function generateTitle(userMessage: string, reply: string) {
  const out = await structured(
    Title,
    "You name conversations in a wellness journal app. Titles are calm, specific, and private-feeling, like a diary heading. Never alarming.",
    `User: ${userMessage.slice(0, 1200)}\nCompanion: ${reply.slice(0, 600)}`,
    "title",
  );
  return out?.title?.replace(/^["']|["'.]$/g, "").slice(0, 60) ?? null;
}

// ---------- Daily card on the home screen ----------

const DailyCard = z.object({
  affirmation: z.string().describe("First-person affirmation, max 14 words, specific to what they're going through"),
  focusTitle: z.string().describe("2-5 word title for today's gentle focus"),
  focusBody: z.string().describe("One or two warm sentences (max 30 words) explaining why this focus fits them today"),
  activity: ActivityOrNone.describe("The app activity that puts the focus into practice, or none"),
});
export type DailyCard = z.infer<typeof DailyCard>;

export function generateDailyCard(context: string) {
  return structured(
    DailyCard,
    `You write the daily card in Solace, a mental wellness app: one personal affirmation and one gentle focus for today. Ground both in what you know about the person (recent moods, check-ins, what they want help with, things they've shared). Avoid clichés and toxic positivity. If you know little, keep it simple and welcoming.\n\nActivities:\n${ACTIVITY_LIST_FOR_PROMPT}\n- chat: talk to Sol, the AI companion`,
    context,
    "daily",
  );
}

// ---------- Next steps after a wellbeing check ----------

const Moves = z.object({
  moves: z
    .array(
      z.object({
        title: z.string().describe("2-4 words"),
        body: z.string().describe("One sentence, max 20 words, concrete and kind"),
        activity: ActivityOrNone,
      }),
    )
    .describe("Exactly 3 next steps"),
});

export async function generateMoves(context: string, checkSummary: string) {
  const out = await structured(
    Moves,
    `You suggest 3 small, doable next steps after someone completes a short wellbeing check in Solace, a mental wellness app. Make them specific to their result and what you know about them. If the result is high, one step must be reaching out for professional support (activity help_now). Never diagnose.\n\nActivities:\n${ACTIVITY_LIST_FOR_PROMPT}\n- chat: talk to Sol, the AI companion\n- none: an offline action`,
    `${checkSummary}\n\nAbout them:\n${context}`,
    "moves",
  );
  return out?.moves?.slice(0, 3) ?? null;
}

// ---------- Response to a mood check-in ----------

const CheckinReply = z.object({
  message: z.string().describe("Sol's reply: 1-2 sentences, max 35 words, warm and specific to the check-in"),
  activity: ActivityOrNone.describe("One activity that would help right now, or none if they're doing well"),
});

export function generateCheckinReply(context: string, checkin: string) {
  return structured(
    CheckinReply,
    `You are Sol, the AI companion in Solace, a mental wellness app. The person just logged a mood check-in. Acknowledge it in a warm, human way that shows you noticed the details (feelings, note, patterns from recent days). No clichés. If they're low, be gentle and offer one helpful activity; if they're doing well, celebrate it simply.\n\nActivities:\n${ACTIVITY_LIST_FOR_PROMPT}\n- chat: talk to Sol\n- none`,
    `New check-in: ${checkin}\n\nAbout them:\n${context}`,
    "checkin",
  );
}

// ---------- Weekly reflection on the Journey screen ----------

const Reflection = z.object({
  headline: z.string().describe("4-8 word headline capturing their week"),
  reflection: z.string().describe("2-3 warm sentences (max 60 words) noticing patterns in their week"),
  highlights: z.array(z.string()).describe("Up to 3 short positive observations, max 10 words each"),
  gentleGoal: z.string().describe("One small, specific goal for the coming days, max 15 words"),
});
export type Reflection = z.infer<typeof Reflection>;

export function generateWeeklyReflection(context: string, week: string) {
  return structured(
    Reflection,
    "You are Sol, the AI companion in Solace, a mental wellness app. Write a short weekly reflection for the person based on their last 7 days. Notice patterns (time of day, triggers, what helped) without judging. Celebrate effort, not outcomes. Never diagnose.",
    `Their last 7 days:\n${week}\n\nAbout them:\n${context}`,
    "reflection",
  );
}
