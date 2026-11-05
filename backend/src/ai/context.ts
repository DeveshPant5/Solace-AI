import type { UserRow } from "../auth.js";
import { ASSESSMENTS, type AssessmentKind } from "../content/assessments.js";
import { MOOD_LABELS } from "../content/catalog.js";
import { query } from "../db.js";
import { progressSummary } from "../lib/progress.js";

function localNow(timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function localDate(date: string | Date, timezone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric" }).format(
    new Date(date),
  );
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Everything Sol knows about the person, as a compact text block. Built fresh
 * for each request from the database, so the person stays in control: deleted
 * memories and disabled memory are respected immediately.
 */
export async function buildUserContext(user: UserRow, opts: { excludeConversationId?: string } = {}) {
  const tz = user.timezone;
  const memoryOn = user.preferences.memoryEnabled !== false;
  const profile = user.profile as { focus?: string[]; intention?: string; checkinTime?: string };

  const [moods, assessments, memories, journals, conversations, progress] = await Promise.all([
    query<{ mood: number; emotions: string[]; note: string | null; created_at: string }>(
      "SELECT mood, emotions, note, created_at FROM mood_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 6",
      [user.id],
    ),
    query<{ kind: AssessmentKind; band: string; score: number; max_score: number; created_at: string }>(
      `SELECT DISTINCT ON (kind) kind, band, score, max_score, created_at FROM assessments
       WHERE user_id = $1 ORDER BY kind, created_at DESC`,
      [user.id],
    ),
    memoryOn
      ? query<{ content: string; category: string }>(
          "SELECT content, category FROM memories WHERE user_id = $1 ORDER BY created_at DESC LIMIT 40",
          [user.id],
        )
      : Promise.resolve([]),
    memoryOn
      ? query<{ prompt: string | null; content: string; created_at: string }>(
          "SELECT prompt, content, created_at FROM journal_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 2",
          [user.id],
        )
      : Promise.resolve([]),
    memoryOn
      ? query<{ title: string | null; updated_at: string }>(
          `SELECT title, updated_at FROM conversations
           WHERE user_id = $1 AND id IS DISTINCT FROM $2 AND title IS NOT NULL
           ORDER BY updated_at DESC LIMIT 5`,
          [user.id, opts.excludeConversationId ?? null],
        )
      : Promise.resolve([]),
    progressSummary(user.id, tz),
  ]);

  const lines: string[] = [];
  lines.push(`Name: ${user.name}`);
  lines.push(`Their local time: ${localNow(tz)} (${tz})`);
  lines.push(`Preferred tone: ${user.preferences.tone ?? "gentle"}`);
  if (profile.focus?.length) lines.push(`What they want help with: ${profile.focus.join(", ")}`);
  if (profile.intention) lines.push(`Their intention for using Solace: "${clip(profile.intention, 200)}"`);
  lines.push(
    `Progress: level ${progress.level} (${progress.name}), ${progress.streak.current}-day streak` +
      (progress.streak.activeToday ? ", already showed up today" : ""),
  );

  if (moods.length) {
    lines.push("\nRecent mood check-ins (newest first):");
    for (const m of moods) {
      const emotions = m.emotions.length ? ` [${m.emotions.join(", ")}]` : "";
      const note = m.note ? ` "${clip(m.note, 160)}"` : "";
      lines.push(`- ${localDate(m.created_at, tz)}: ${MOOD_LABELS[m.mood]}${emotions}${note}`);
    }
  } else {
    lines.push("\nNo mood check-ins yet.");
  }

  if (assessments.length) {
    lines.push("\nLatest wellbeing check results (screening only, not diagnoses):");
    for (const a of assessments) {
      const def = ASSESSMENTS[a.kind];
      const band = def?.bands.find((b) => b.band === a.band);
      lines.push(`- ${def?.title ?? a.kind} on ${localDate(a.created_at, tz)}: ${band?.label ?? a.band} (${a.score}/${a.max_score})`);
    }
  }

  if (!memoryOn) {
    lines.push("\nMemory is OFF: they chose not to let you remember things between conversations. Don't use the remember tool.");
  } else {
    if (memories.length) {
      lines.push("\nThings they've shared before (your memory of them):");
      for (const m of memories) lines.push(`- (${m.category}) ${m.content}`);
    }
    if (journals.length) {
      lines.push("\nRecent journal entries:");
      for (const j of journals) {
        lines.push(`- ${localDate(j.created_at, tz)}${j.prompt ? ` (prompt: ${clip(j.prompt, 80)})` : ""}: "${clip(j.content, 300)}"`);
      }
    }
    if (conversations.length) {
      lines.push("\nOther recent conversations with you:");
      for (const c of conversations) lines.push(`- ${localDate(c.updated_at, tz)}: ${c.title}`);
    }
  }

  return lines.join("\n");
}
