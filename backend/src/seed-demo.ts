// Fills a local demo account with two weeks of history so the Journey screen,
// mood chart and achievements look lived-in for a demo recording.
//   npm run seed:demo            (account: demo@solace.test / solace-demo-2026)
import bcrypt from "bcryptjs";
import { pool, query, queryOne } from "./db.js";
import { migrate } from "./migrate.js";
import { XP } from "./lib/progress.js";

const EMAIL = "demo@solace.test";
const PASSWORD = "solace-demo-2026";

const DAYS: { daysAgo: number; mood: number; emotions: string[]; note?: string; extra?: string[] }[] = [
  { daysAgo: 13, mood: 2, emotions: ["anxious", "tired"], note: "Exams in two weeks and I haven't started properly", extra: ["breathing"] },
  { daysAgo: 12, mood: 2, emotions: ["stressed"], extra: ["grounding"] },
  { daysAgo: 11, mood: 3, emotions: ["tired", "hopeful"], note: "Made a study plan", extra: ["journal"] },
  { daysAgo: 9, mood: 3, emotions: ["calm"], extra: ["breathing"] },
  { daysAgo: 8, mood: 2, emotions: ["overwhelmed", "lonely"], note: "Couldn't sleep, mind racing", extra: ["breathing"] },
  { daysAgo: 7, mood: 3, emotions: ["relieved"], note: "Talked to Priya, felt lighter" },
  { daysAgo: 6, mood: 4, emotions: ["content", "proud"], extra: ["journal", "breathing"] },
  { daysAgo: 5, mood: 3, emotions: ["tired"] },
  { daysAgo: 4, mood: 4, emotions: ["hopeful", "calm"], note: "Mock test went better than expected", extra: ["grounding"] },
  { daysAgo: 3, mood: 4, emotions: ["grateful"], extra: ["breathing", "journal"] },
  { daysAgo: 2, mood: 3, emotions: ["stressed", "hopeful"] },
  { daysAgo: 1, mood: 4, emotions: ["calm", "proud"], note: "Slept 8 hours for once", extra: ["breathing"] },
];

async function main() {
  await migrate();
  let user = await queryOne<{ id: string }>("SELECT id FROM users WHERE email = $1", [EMAIL]);
  if (!user) {
    user = await queryOne<{ id: string }>(
      `INSERT INTO users (email, password_hash, name, timezone, profile)
       VALUES ($1, $2, 'Asha', 'Asia/Kolkata', $3) RETURNING id`,
      [EMAIL, await bcrypt.hash(PASSWORD, 10), { focus: ["stress", "sleep"], checkinTime: "evening", intention: "I have exams soon and can't sleep well" }],
    );
    await query(
      `INSERT INTO reminders (user_id, kind, title, body, hour, minute, enabled, created_by) VALUES
        ($1, 'mood', 'How are you feeling?', 'Take 30 seconds to check in with yourself.', 20, 0, true, 'system'),
        ($1, 'affirmation', 'Your affirmation for today', NULL, 9, 0, true, 'system'),
        ($1, 'breathing', 'Time for a breather', 'One minute of slow breathing can reset your day.', 15, 0, false, 'system'),
        ($1, 'selfcare', 'A little self-care', 'Drink some water, stretch, or step outside for a moment.', 18, 30, false, 'system')`,
      [user!.id],
    );
  }
  const id = user!.id;
  // Start from a clean slate for the seeded kinds of data.
  await query("DELETE FROM mood_entries WHERE user_id = $1", [id]);
  await query("DELETE FROM activities WHERE user_id = $1", [id]);
  await query("DELETE FROM journal_entries WHERE user_id = $1", [id]);
  await query("DELETE FROM assessments WHERE user_id = $1", [id]);
  await query("DELETE FROM daily_cache WHERE user_id = $1", [id]);
  await query("DELETE FROM memories WHERE user_id = $1", [id]);

  for (const d of DAYS) {
    const at = `now() - interval '${d.daysAgo} days' - interval '${Math.floor(Math.random() * 5)} hours'`;
    await query(`INSERT INTO mood_entries (user_id, mood, emotions, note, created_at) VALUES ($1, $2, $3, $4, ${at})`, [
      id,
      d.mood,
      d.emotions,
      d.note ?? null,
    ]);
    await query(`INSERT INTO activities (user_id, kind, xp, created_at) VALUES ($1, 'mood_checkin', $2, ${at})`, [id, XP.mood_checkin]);
    for (const kind of d.extra ?? []) {
      if (kind === "journal") {
        await query(`INSERT INTO journal_entries (user_id, prompt, content, created_at) VALUES ($1, $2, $3, ${at})`, [
          id,
          "What went better today than you expected?",
          "I got through two chapters and actually understood them. Taking breaks helped more than pushing through.",
        ]);
      }
      await query(`INSERT INTO activities (user_id, kind, xp, created_at) VALUES ($1, $2, $3, ${at})`, [
        id,
        kind,
        kind === "journal" ? XP.journal : XP.breathing,
      ]);
    }
  }
  await query(
    `INSERT INTO assessments (user_id, kind, answers, score, max_score, band, moves, created_at)
     VALUES ($1, 'anxiety', '{2,2,1,1}', 6, 12, 'moderate', '[]', now() - interval '10 days')`,
    [id],
  );
  await query(`INSERT INTO activities (user_id, kind, xp, created_at) VALUES ($1, 'assessment', 28, now() - interval '10 days')`, [id]);
  await query(
    `INSERT INTO memories (user_id, content, category) VALUES
      ($1, 'Has university exams starting in about two weeks.', 'events'),
      ($1, 'Priya is a close friend who helps them feel lighter.', 'people'),
      ($1, 'Slow breathing before bed helps them fall asleep.', 'what_helps')`,
    [id],
  );
  console.log(`Seeded demo account ${EMAIL}`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
