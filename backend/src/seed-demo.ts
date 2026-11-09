// Fills a demo account with two weeks of history so the Journey screen,
// mood chart and achievements look lived-in for a demo recording.
//   npm run seed:demo
//
// On a local database the account is demo@solace.test with the local password
// below. Any other database (a deployed one) needs ALLOW_DEMO_SEED=1 and its own
// SEED_DEMO_PASSWORD, because the local password is public in this repository.
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { pool, query, queryOne } from "./db.js";
import { migrate } from "./migrate.js";
import { XP } from "./lib/progress.js";

const EMAIL = "demo@solace.test";
const LOCAL_PASSWORD = "solace-demo-2026";

function demoPassword(): string {
  const host = new URL(config.databaseUrl).hostname;
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
  if (local && !config.isProduction) return process.env.SEED_DEMO_PASSWORD?.trim() || LOCAL_PASSWORD;
  if (process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error(`Refusing to seed the demo account on ${host}: this isn't a local database. Set ALLOW_DEMO_SEED=1 and SEED_DEMO_PASSWORD to do it on purpose.`);
  }
  const password = process.env.SEED_DEMO_PASSWORD?.trim() ?? "";
  if (password.length < 12 || password === LOCAL_PASSWORD) {
    throw new Error("Set SEED_DEMO_PASSWORD to a private password of at least 12 characters for a deployed database.");
  }
  return password;
}

const PASSWORD = demoPassword();

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
  await query("UPDATE users SET password_hash = $2 WHERE id = $1", [id, await bcrypt.hash(PASSWORD, 10)]);
  // Start from a clean slate for the seeded kinds of data.
  await query("DELETE FROM mood_entries WHERE user_id = $1", [id]);
  await query("DELETE FROM activities WHERE user_id = $1", [id]);
  await query("DELETE FROM journal_entries WHERE user_id = $1", [id]);
  await query("DELETE FROM assessments WHERE user_id = $1", [id]);
  await query("DELETE FROM daily_cache WHERE user_id = $1", [id]);
  await query("DELETE FROM memories WHERE user_id = $1", [id]);

  for (const d of DAYS) {
    const at = new Date(Date.now() - d.daysAgo * 86_400_000 - Math.floor(Math.random() * 5) * 3_600_000).toISOString();
    await query("INSERT INTO mood_entries (user_id, mood, emotions, note, created_at) VALUES ($1, $2, $3, $4, $5)", [
      id,
      d.mood,
      d.emotions,
      d.note ?? null,
      at,
    ]);
    await query("INSERT INTO activities (user_id, kind, xp, created_at) VALUES ($1, 'mood_checkin', $2, $3)", [id, XP.mood_checkin, at]);
    for (const kind of d.extra ?? []) {
      if (kind === "journal") {
        await query("INSERT INTO journal_entries (user_id, prompt, content, created_at) VALUES ($1, $2, $3, $4)", [
          id,
          "What went better today than you expected?",
          "I got through two chapters and actually understood them. Taking breaks helped more than pushing through.",
          at,
        ]);
      }
      await query("INSERT INTO activities (user_id, kind, xp, created_at) VALUES ($1, $2, $3, $4)", [
        id,
        kind,
        kind === "journal" ? XP.journal : XP.breathing,
        at,
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
