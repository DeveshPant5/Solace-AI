# Solace AI: project handoff

Everything a new session needs to pick up this project. Last updated **2026-11-09** (round 2: warm light UI, voice, AI onboarding; round 3: Pip replaces Ray, screen tips, calm-by-design; round 4: security audit and backend hardening, see section 6 "Security"; round 5: Sol moved to Groq's free open models and the backend made deployable on Render). Read this first, then `README.md` for setup and feature details.

---

## 1. What this is

A hackathon entry for the **Solace AI Hackathon** run by Humanity Founders. Brief: https://humanity-founders.notion.site/solace-ai-hackathon-task

**The brief, condensed:**
- Build a **functional mobile app prototype** of an AI wellness companion. It should be calm, friendly, beautiful, personal, and easy to navigate.
- **Required stack:** React Native + Expo app, a Node.js backend, and a database. Any libraries and AI models are allowed.
- **User journey:** splash → onboarding → sign up / login → home (personal welcome, mood check-in, affirmations, AI suggestions, quick wellness activities, breathing, progress/streaks) → simple main navigation.
- **AI is the most important part:**
  - a companion with its own personality and a mascot
  - natural, empathetic conversation that understands mood, keeps context, and avoids generic motivational replies
  - personalisation over time from past chats, check-ins, assessments and preferences, with the user's consent
  - AI-suggested activities: breathing, reflection, affirmations, self-care, plans, challenges
  - **chat history:** view, continue, start new, and delete conversations; earlier context is used
- **Notifications must work** with the app in the background or closed. They're meant to be gentle reminders (mood, affirmation, breathing, self-care, custom). The user manages preferences, and tapping one opens the right screen.
- **Existing features to rethink:** mood check-ins, assessments, breathing, affirmations, plans, progress, streaks and achievements, resources.
- **Judging:** "doing one part extremely well is better than doing everything poorly". The backend must be API-driven and work end to end.
- **Submission:** an **APK + a demo video** walking through everything, posted in the hackathon Telegram group ("Solace AI Hackathon"). TestFlight comes in a later stage. Code is *not* submitted.
- **Prizes:** a full-time founding-member job offer for the winner, certificates for functional MVPs, and possible prizes for the top 3.

**Reference video** (a Google Drive clip embedded in the Notion page, 2:14) shows:
- a cream/yellow UI with a serif font
- Home: welcome banner, "Today's affirmation" card, "Daily check-in", and a Quick start grid with Zen Monk (the AI chat), Check-in, Breathe and Resources
- "Self-Love XP" with levels, e.g. 21/150 XP
- Check-ins: "Mood vibes" (PHQ-inspired), "Anxiety check" (GAD-inspired) and "Self-love meter". Each has 4 questions, earns +2 XP per question plus a +40 bonus, and ends with a results screen of "wellness moves"
- "Box-ish breathing" with a circle
- Resources: Anxiety toolkit, Beating the blues, Self-esteem reset, Sleep wind-down, Therapists near you, and "Call 988"

**We were told not to copy it screen by screen.** Solace is our own design: a different palette, fonts, mascot, names, structure and wording.

## 2. Status

### Done and verified
- **Backend:** typecheck passes, and every route was exercised with curl, both without AI and with offline fallbacks.
- **App:** typecheck passes. Walked through on Expo **web** in Chrome:
  - splash and onboarding
  - sign-up and sign-in
  - Home, then mood check-in and the result
  - Practices, the anxiety assessment and its results
  - box breathing, ticking off a guide step, and Journey (with seeded data)
  - the Sol tab, plus chat's "not connected" error
  - Memory, Reminders, You, Help
- **Round 2 (2026-11-05 afternoon), walked through on web in Chrome:**
  - the new warm light theme ("Hearth") on Home, onboarding and Settings, plus dark mode as an option (Settings → Appearance: Light / Dark / Match phone; Light is the default)
  - the onboarding guide (Ray then, Pip now): the welcome screen with the voice opt-in, then 5 onboarding steps (name, "what's on your mind", focus, check-in time, tone), then sign-up with the name prefilled
  - the guide's offline help: rephrasings after a pause in typing, focus areas pre-picked with a badge, and tone previews
  - the first-run tour on Home: the hand-off to Sol, then 5 stops, skippable
- **Round 3, also walked through on web:**
  - all 11 growth stages, drawn on a temporary gallery page that has since been removed
  - the welcome screen with the bubble above Pip, the typewriter and Sign in under the main button
  - onboarding steps 1–2 growing from sprout to seedling
  - Pip on welcome, Home (tour), Practices (tip), Journey (tip, and Pip drawn at the Bud stage for the demo account's level 4)
  - no console errors
  - the welcome screen: `components/WindowScene.tsx` puts Pip on a windowsill in front of a window whose sky follows the time of day (rising sun, high sun and clouds, sunset, moon and stars), with curtains and a rod. The window fills the space between the wordmark and the buttons; Pip's line sits at the top and Pip stands on the sill.
  - the browser's own voice speaking (fallback path) and the mic button rendering in Chrome
- **Release APK** (2026-11-09): `builds/Solace.apk` (43 MB, arm64-v8a, package `com.solace.companion`), built against the deployed API **https://solace-api-zy7a.onrender.com**. Checked inside the APK: the Render address is in the bundle, the old Wi-Fi address is gone, `usesCleartextTraffic=false`, no keys. The earlier Wi-Fi build (hard-wired to `http://192.168.29.213:4000`, 2026-11-05, before Pip) was removed from `builds/`: installing it by mistake shows Sol instead of Pip and hangs at sign-up, because it calls the laptop. If a phone still has it, uninstall it before installing the new APK.
- **Production check (2026-11-09)** on the deployed API with a throwaway account (deleted after): Pip's help, check-in reply, chat with an activity card and a reminder, a crisis message (help card at once, Sol asks if they're safe, no phone numbers), and one ElevenLabs clip all worked; `/health/ip` shows the caller's real IP with `TRUST_PROXY=3`.

- **Round 4 (2026-11-09), security hardening:**
  - a multi-agent audit found 68 issues; each was checked against the code and fixed or consciously accepted (section 6, "Security")
  - `npm test` in `backend/`: 32 tests (accounts, isolation, limits, privacy, error mapping, and chat end to end against a local stand-in for the Messages API: streaming, a tool call, a declined crisis message, a reply that breaks off)
  - checked by hand: spoofed `X-Forwarded-For` no longer resets limits, production mode blocks browser origins, a weak `JWT_SECRET` or a typo in `CHAT_EFFORT` stops startup, SIGTERM during a streaming reply exits in 0.2 s and saves the half-written reply
  - web preview still works with the hardened API (Home, Journey, You), and a token issued before round 4 is still accepted

- **Round 5 (2026-11-09), Groq and deployment:**
  - the AI layer now runs on Groq by default (`openai/gpt-oss-120b` for chat, `openai/gpt-oss-20b` for JSON jobs); Claude stays available with `AI_PROVIDER=anthropic`
  - `npm test`: 38 tests, including 6 for Groq against a local stand-in for its API (streaming, strict JSON on the fast model, tool calls with and without a written reply, daily-limit and busy-minute messages, check-in fallback when rate limited)
  - production build checked: `npm run build` then `npm start` serves from `dist/` with migrations applied
  - `render.yaml` (Render Blueprint) and `.github/workflows/keep-awake.yml` added; pushed to GitHub (30 commits on 2026-11-09); the user is setting up the Render Blueprint
  - **live with the user's Groq key** (local backend): Pip's help, check-in replies, chat, activity cards and the reminder tool all work on real Groq models in about a second each. At a human pace (20 s between messages) everything stays on `gpt-oss-120b`; back-to-back messages trip the 8K tokens-a-minute limit, which the fallback chain now absorbs
  - this key can use only `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b` (plus guard/audio models); the Llama models in Groq's docs return 404 for it. Fallbacks: chat 120b → qwen → 20b; JSON 20b → qwen. A retired model (404) is skipped with a log line
  - Pip's voice on free credits only (user's request): before a new clip the server reads the ElevenLabs plan balance (`GET /v1/user/subscription`, at most hourly, counting locally in between) and stops 200 characters before the limit; a `quota_exceeded` / 402 / bad-key answer stops it too. While paused, `/health` says `voice:false` and new clips answer 503 `voice_off`, so the app uses the phone's voice; cached clips keep playing; it resumes at the monthly reset. The app re-checks `/health` after a failed natural-voice line (needs the APK rebuild). Covered by `test/voice.test.ts` against a stand-in for ElevenLabs (`ELEVENLABS_BASE_URL`, `VOICE_CACHE_DIR`)
  - safety: an unsafe-sounding message emits the keyword signal at once, and gets a caring reply plus the `help_now` card even when the AI is off, resting, restarting or rate limited (`sendSafetyReply` in `routes/conversations.ts`). Sol's persona now says not to quote phone numbers (Qwen once told an Indian user to text 988)

- **Round 6 (2026-11-09), feedback from the phone:**
  - Sol's replies on Groq: `gpt-oss-120b` sometimes writes a tool call into the reply as JSON, sends `null` for optional tool fields (Groq then rejects the call with 400 `tool_use_failed`), or returns an empty reply. Fixed: a streaming filter in `ai/companion.ts` (`JsonInTextFilter`) holds back JSON objects and turns written-out tool calls into real cards; optional tool fields accept `null`; a rejected tool call is retried once as a plain reply (`tool_choice: "none"`); an empty reply is retried once. Checked live: three tries of the user's screenshot message all gave clean replies.
  - Sol reads its replies aloud with the phone's voice (free; `speakAsSol` in `app/src/lib/voice.ts`), with a speaker toggle in the chat header (remembered in `solace.solVoice`, on by default). The chat box has the mic (long dictation).
  - Remembering: Sol's context now includes the last 4 things the person said in other conversations (memory on only), and the persona asks Sol to save people, events and goals the same turn.
  - The first-run tour and screen tips are for new accounts only: signing in marks them seen on that device (`markTourSeen` in `PipTour.tsx`, called from `signIn`), and the tour only starts by itself for accounts created within a day. "Take the tour with Pip" still replays both.
  - Tab bar: no green box behind the active tab any more (the user found it bad UX); the active tab's icon turns green and slightly larger and its label green and bold (Figtree 700), the others stay grey. The Sol button in the middle is unchanged.
  - Lighter screens: removed most secondary lines (Practices and Journey subtitles, check-in blurbs and XP line, quick-start and You-tab row subtitles, achievement descriptions, Journey hints); shorter Sol intro and privacy note. The Breathe & ground cards size to their content and share one height (152 px, no empty middle).

### Not yet tested
- **Everything that calls a real AI service** (no Groq or Anthropic key on the machine yet; only local stand-ins were used):
  - streaming chat and its three tools
  - the per-message mood/safety signal
  - conversation titles
  - daily card, assessment next steps, check-in reply, weekly reflection
- **Anything on a real phone:** notifications (scheduling, taps, cold start), haptics, keyboard behaviour in chat on Android (`KeyboardAvoidingView behavior="padding"`), and secure storage.
- **Pip with real AI and voice:**
  - AI-written rephrasings, focus picks and tone previews (only the offline versions were seen)
  - the ElevenLabs voice: no `ELEVENLABS_API_KEY` yet, and the default voice ID (`bIHbv24MWmeRgasZH58o`, "Will") wasn't confirmed online; some premade voices need a paid plan (402)
- **Mic dictation:** only rendered on web, never actually used. On Android it needs the rebuilt APK.
- **Animations:** Pip's breathing sway, leaf drift, wave and talking mouth were never seen moving. Chrome throttles the window when it isn't focused, so animations look frozen there.

### Changed after the APK was built (needs a rebuild to take effect)
- **All of round 2.** It adds native modules (`expo-audio`, `expo-speech`, `expo-speech-recognition`, plus the Fraunces font) and the RECORD_AUDIO permission, so the old APK can't run it.
- `app.json`: `android.blockedPermissions` drops `SYSTEM_ALERT_WINDOW`, storage and biometric permissions.
- White `thumbColor` on the switches in Memory and Reminders.
- Backend-only changes don't need a rebuild: the offline weekly reflection, the `.catch("none")` on AI activity fields, the demo seed, and all of round 4's backend work.
- Round 4 app changes (need a rebuild): `app/app.config.js` turns cleartext HTTP off when the APK is built with an `https://` API_URL; sign-out calls `POST /auth/logout`; the You tab's privacy card says replies go through Claude (Anthropic) and Pip's voice through ElevenLabs. Older APKs keep working with the new backend.

## 3. Next steps (in order)

0. The user adds `ELEVENLABS_API_KEY=…` to `backend/.env` (the line already exists, empty). Then:
   - restart the backend
   - check `/health` shows `voice:true`
   - open the welcome screen, choose "Yes, talk me through it" and listen to Pip
   - if ElevenLabs answers 402, or the voice doesn't feel calm enough, set `PIP_VOICE_ID` to another voice from the ElevenLabs library (pick a soft, warm one)
   - generated clips are cached in `backend/.cache/voice/`; delete them after changing the voice
1. The user creates a free Groq key at https://console.groq.com/keys and puts it in `backend/.env` as `GROQ_API_KEY=…` (the line exists, empty), then restarts the backend (`tsx watch` doesn't reload on `.env` changes). `/health` should show `"ai":true`. Then test chat properly:
   - venting, anxiety, asking for a reminder, mentioning a person or event (should be remembered)
   - a crisis phrase (should show the safety card)
   - a check-in, an assessment, the Home daily card, the Journey reflection
   - judge the tone of `openai/gpt-oss-120b`; if it feels less warm, try `GROQ_CHAT_MODEL=qwen/qwen3.8-27b` (felt warmer and more conversational in a live test) and compare
2. Deploy (the APK must work on any phone, so the backend needs a public HTTPS address). The user asked for this on 2026-11-09:
   - commit and push (only when the user says so); Render deploys from GitHub
   - Render → New → Blueprint → this repo → paste `GROQ_API_KEY` (and optionally `ELEVENLABS_API_KEY`); `render.yaml` creates the API (`solace-api`, Singapore, free) and a free Postgres
   - **deployed 2026-11-09: https://solace-api-zy7a.onrender.com** (Blueprint "solace ai", service `solace-api`, database `solace-db`, Singapore, free). `/health` showed db up, AI and voice on, HSTS present
   - Render has **three** proxy hops (three `X-Forwarded-For` entries per request; a spoofed entry adds a fourth on the left), so `render.yaml` sets `TRUST_PROXY=3`; with 1, every user shared one rate-limit bucket (`req.ip` was an internal 10.x address). Check `/health/ip` shows the caller's public IP
   - optional: GitHub repo variable `BACKEND_URL` turns on the keep-awake ping (free instances sleep after 15 idle minutes)
   - Render's free Postgres expires after 30 days; for longer, use Neon and set `DATABASE_URL`
   - to seed the demo account there: `ALLOW_DEMO_SEED=1 SEED_DEMO_PASSWORD=<private> DATABASE_URL=<external url> npm run seed:demo` (the public local password is refused)
3. Build the APK against the deployed API and test on a phone (any network, no firewall change needed):
   - `cd app && API_URL=https://<service>.onrender.com npm run build:apk` → `builds/Solace.apk`; an `https://` URL also turns cleartext HTTP off in the APK
   - test notifications with Reminders → "Send a test notification", the daily ones, and tapping each one
   - for LAN testing against the laptop instead: `API_URL=http://<wifi-ip>:4000`, and the user runs `sudo firewall-cmd --add-port=4000/tcp` (Claude must not change system settings)
   - optional: recreate the local database container bound to localhost only (`podman rm -f solace-db && npm run db:up`; the data volume is kept). The running container still listens on all interfaces because it was created before round 4.
4. Demo video. `npm run seed:demo` fills the demo account with two weeks of history. Suggested order:
   - splash → onboarding → sign-up → home check-in
   - chat with Sol (activity card, memory, reminder) → breathing → a check-in with next steps
   - journey → reminders → memory controls
5. Nice to have:
   - check light mode
   - `npx expo lint`
   - tests
   - real push notifications (needs Firebase/FCM)
   - a "plan" feature (multi-day wellness plan)
   - an iOS/TestFlight build (needs a Mac or EAS)

## 4. Decisions already made (don't re-ask)

- **AI provider (changed 2026-11-09, user's choice): Groq's free tier**, open models via the official `groq-sdk`. The user first asked for "Grok" believing it was free and open source; it's paid (xAI API, about $2/$6 per million tokens) and only an old Grok-1 is open. Given the cost goal they chose Groq (with a q).
  - Chat: `openai/gpt-oss-120b` (`GROQ_CHAT_MODEL`), JSON jobs: `openai/gpt-oss-20b` (`GROQ_FAST_MODEL`, strict JSON Schema output). Free limits are per model (about 8K tokens a minute, 200K a day each), so splitting the work doubles the allowance.
  - Claude remains supported (`AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`); the notes below about Claude apply when it's selected.
  - If the provider changes, update the privacy sentence on the You tab (`app/src/app/(tabs)/you.tsx`), which names Groq.
- **Earlier AI provider:** Claude, via the Anthropic API (the user's original choice).
  - Default model: `claude-opus-5-5`, set by `CLAUDE_MODEL` in `backend/.env`. The question shown to the user had mentioned Sonnet 5.5, but the claude-api skill says to default to Opus 5.5; the user was told and can switch to `claude-sonnet-5-5`.
  - Chat effort `low` (`CHAT_EFFORT`).
- **Database:** PostgreSQL (user's choice), in a local podman container.
- **Calm by design (the user's rule, round 3):** "make sure everything we build calms the user". Apply it to everything built or touched:
  - motion: slow, eased (sine) loops of about 4–5 s, like slow breathing; no hops or snappy springs; respect the phone's reduce-motion setting (`useReducedMotion`)
  - voice: soft and slightly slow (ElevenLabs stability 0.6, style 0.05, speed 0.92; device fallback pitch 1.08, rate 0.9)
  - words: gentle, no urgency, few or no exclamation marks
  - interruptions: inline and dismissible, shown once, never blocking the main action
- **Guide mascot: Pip** (round 3, chosen by the user from three drawn concepts: Pip, a mango "Aamu", and a full-body Ray). It **replaced Ray**, Sol's little brother from round 2.
  - **Look:** a little walking terracotta flower pot with a face on the pot, mitten hands, little brown shoes, and a sprout on top. The user originally asked for a fruit with hands and feet, then said it didn't have to be a fruit.
  - **Story:** the seedling Sol planted for you.
  - **Growth (user's request, round 3):** the plant grows at every onboarding step and becomes a tree once you're in the app. It uses 11 stages:
    - onboarding: welcome 0 (shoot); the five personalize steps 1–5 (sprout, seedling, bud, flower, sapling); sign-up 6 (young tree)
    - entering the app: the tour's first stop grows it into a tree
    - inside the app: the tree keeps growing with the garden level, via `pipStage(level)`: levels 1–2 → 7, 3–4 → 8 (fuller), 5–6 → 9 (blossoms), 7–9 → 10 (fruit)
    - each change crossfades, with the new growth rising from the soil over 1.1 s; Pip's `growFrom` prop grows it on first appearance
  - **Jobs:** onboarding, the first-run Home tour, and first-visit screen tips. The user picked only screen tips for inside the app, not celebrations, a help button, or empty states.
  - **Pip's rules (from round 2, still apply):**
    - voice is opt-in on the welcome screen, and the choice is remembered in `solace.voice`
    - there's a mute toggle on every bubble
    - he says each line once per session, and only on the screen in front
    - he stops when the person types or taps the mic
    - AI help appears quietly as chips and never blocks Continue
  - **Voice:** a natural cloud voice was the user's choice. It uses ElevenLabs `eleven_flash_v2_5` through `GET /voice/speak`, cached on disk. When there's no key or a call fails, the app falls back to the device voice via `expo-speech`, with pitch 1.15. The Claude API has no speech features.
  - **Talking back:** the user wanted the mic. It uses the device's speech recognizer (`expo-speech-recognition`) with the device's locale, falling back to en-US.
- **Look (round 2):** the user asked for "light, feels like home".
  - **Palette "Hearth":** cream `#FBF6EE` background, warm white cards, **sage `#4F7D5F`** as the main colour, apricot/honey/clay accents, and warm brown-charcoal text
  - **Headings:** Fraunces 500/600; Nunito stays for UI text. DM Serif Display was removed.
  - **Window light:** a time-of-day gradient at the top of Home and the welcome screen (`daylight()`)
  - **Dark mode** (the user wanted to keep it) is "Evening in", warm browns. It's opt-in from Settings, and Light is always the default.
- **Mascot and companion:** **Sol**, an original SVG "glow being" with a sprout, with 7 expressions and tints that follow mood. App name: **Solace**.
- **Visual design (round 1, replaced):** linen/lavender with a purple primary and DM Serif Display. See "Look (round 2)" above.
- **Wording:** Claude wrote all user-facing text. The user's Trill-only rule "never add text without asking" does not apply here. The user may still want to review the wording.
- **Help lines:** India Tele-MANAS 14416 and emergency 112; US 988 / 911; UK & Ireland Samaritans 116 123 / 999; findahelpline.com for everywhere else. The local region is picked from the device's time zone.
- **Wellbeing checks:** mood and anxiety use PHQ-4 items extended with PHQ-9 / GAD-7 items (all free to use). The self-kindness check is our own, non-clinical. The app always says "not a diagnosis".
- **Git (2026-11-05):** the root folder is now the git repo, pushed to **https://github.com/DeveshPant5/Solace-AI**. The repo is **public** and the branch is `main`. The user asked for exactly 25 commits that build the project up in logical steps.
  - Commit and push only when the user asks; never add co-author or AI trailers; use the user's git identity (DeveshPant5).
  - The old nested `app/.git` (only create-expo-app's template "Initial commit") was moved to the session scratchpad, so the app's files belong to the root repo.
  - `builds/` (APKs) is gitignored.

## 5. How to run

```bash
# Database: container "solace-db", postgres:16-alpine, port 5433, user/pass/db = solace
cd "/home/devesh/Desktop/solace AI/backend"
npm run db:up        # podman start/run (podman compose doesn't work: no podman socket)

npm run dev          # API on http://0.0.0.0:4000, runs migrations at start
npm run seed:demo    # demo data for the local test account

cd ../app
npx expo start --web --port 8081                      # web preview
API_URL=http://<wifi-ip>:4000 npm run build:apk       # → ../builds/Solace.apk
```

- **`backend/.env`** exists, with a generated `JWT_SECRET` and empty `GROQ_API_KEY`, `ANTHROPIC_API_KEY` and `ELEVENLABS_API_KEY`. It's gitignored and `chmod 600`; never print it.
- **Local test account:** `demo@solace.test` / `solace-demo-2026`. It only exists in the local database; the seed script recreates its data (and refuses to run against a non-local database without `ALLOW_DEMO_SEED=1` and a private `SEED_DEMO_PASSWORD`).
- **Tests:** `cd backend && npm test` (needs the local database running).
- **API base URL in the app** (`src/lib/api.ts`): it uses `EXPO_PUBLIC_API_URL` if set. Otherwise web uses `http://<page host>:4000` and native uses the Expo dev server's host on port 4000.
- **Expo Go:** an SDK 58 build may not be in the stores yet, so use the APK or a dev build on a phone.

## 6. Architecture

### Backend (`backend/`): Express 5, TypeScript (tsc 7), ESM, `pg`, zod 4, bcryptjs, jsonwebtoken

| File | Role |
|---|---|
| `src/index.ts` | Runs migrations, then listens on `PORT` |
| `src/app.ts` | Routes; everything except `/auth` and `/health` sits behind `requireAuth` |
| `src/config.ts` | Env vars, validated at startup; `aiProvider` ("groq" / "anthropic" / null) from `AI_PROVIDER` and the keys; `aiEnabled` |
| `src/db.ts` | Pool. DATE columns come back as `YYYY-MM-DD` strings; int8 and numeric as numbers |
| `src/migrate.ts`, `migrations/001_init.sql` | Tables: users, mood_entries, assessments, conversations, messages, memories, activities (all XP), journal_entries, reminders, daily_cache |
| `src/auth.ts` | JWT (30 days, HS256, carries the account's `token_version`), `requireAuth`, `currentUser(req)`, `safeTimezone` (async: a zone both Node and Postgres accept) |
| `src/routes/*` | auth, me (GET/PATCH/DELETE account), home (+`/home/daily`), moods, assessments (+`/catalog`), conversations (SSE), progress (+`/reflection`), misc.ts (activities, journal, memories, reminders) |
| `src/lib/progress.ts` | XP values, levels, streaks computed in the user's time zone |
| `src/content/assessments.ts` | Question sets, scoring bands, offline "moves" |
| `src/content/catalog.ts` | Activity IDs the AI may suggest, plus offline affirmations |
| `src/ai/client.ts` | The Groq or Anthropic client; `structured()` (Groq: strict `json_schema` from the zod schema on the fast model, validated with zod; Claude: `messages.parse` + `zodOutputFormat`); returns null on a refusal or error. `withGroqRetry`, `aiErrorKind` ("busy" / "daily_limit"), `logAiError` |
| `src/ai/chatProviders.ts` | One chat session per service behind `step()` / `addToolResults()`: Claude (beta messages stream, fallbacks, persona cached) and Groq (streaming chat completions, OpenAI-style tool calls). `chatProfile` sizes history and memories per service. |
| `src/ai/context.ts` | `buildUserContext(user)` builds a text block: name, local time, tone, focus areas, progress, last 6 moods, latest results, and, if memory is on, memories, 2 journal entries and recent chat titles |
| `src/ai/companion.ts` | Sol's persona, 3 tools, and the streaming loop |
| `src/ai/analysis.ts` | Per-message signal (mood/emotions/risk), title, daily card, assessment moves, check-in reply, weekly reflection |
| `src/seed-demo.ts` | Demo data |
| `src/routes/onboarding.ts`, `src/ai/onboarding.ts` | Public `POST /onboarding/assist`: Pip's rephrasings (persona: soft, unhurried, calming), focus picks and tone previews. Structured output, offline fallback, concern detection (AI flag OR keywords), and output clean-up for speech (no emoji or dashes, word caps). Stateless; logs no text. |
| `src/routes/voice.ts` | Public `GET /voice/speak?text=` (1–300 chars). Proxies ElevenLabs streaming TTS and writes a disk cache at `backend/.cache/voice/<sha256>.mp3` (gitignored). Supports Range requests for Safari; returns 503 `voice_off` without a key and 502 `voice_failed` on upstream errors. |
| `src/lib/rateLimit.ts` | In-memory `RateLimiter` plus `rateLimit()` (per IP) and `userRateLimit()` (per account) middleware; bounded key maps. The IP comes from `req.ip`, which only trusts `X-Forwarded-For` when `TRUST_PROXY` is set. |
| `src/lib/budget.ts` | Daily counters for AI requests and output tokens (overall, public helper, per account) and ElevenLabs characters. Past a limit, AI calls return null (offline content) and voice answers 503 (phone voice). |
| `src/lib/text.ts` | `oneLine`, `cleanMultiline`, `lineField`/`textField` zod helpers, `stripTags`: every text field people type goes through these |
| `src/lib/http.ts` | Request id + one log line per request (no query string, no body); security headers (`no-store`, `nosniff`, CSP, HSTS behind TLS) |
| `src/lib/dailyCache.ts` | `invalidateDailyCache(userId)` plus an epoch so a running generation can't write a stale card back |
| `src/lib/lifecycle.ts` | Shutdown signal shared with chat streams |
| `src/ai/safety.ts` | Keyword risk check (`keywordRisk`, `combineRisk`), used by chat and onboarding as a floor under the model |
| `test/*.test.ts` | `npm test`: node:test integration tests against the local database; `chat.test.ts` runs chat against a local stand-in for the Messages API |

**XP:**
- mood check-in 10, the first 3 a day; assessment 2 per question + 20 bonus, once per check type a day
- breathing and grounding 15 each, at most 5 times a day (past 30 a day they aren't recorded at all)
- guide step 5, once per step (only the six real guides); journal 15, the first 3 a day; first chat of the day 10
- every cap is checked inside a per-account database lock (`withUserLock` in `db.ts`), so parallel requests can't slip past it; past a cap the action still works and earns 0 XP

**Levels:** Seed 0, Sprout 60, Seedling 150, Bud 300, Bloom 500, Blossom 800, Grove 1200, Garden 1800, Sanctuary 2600. The streak counts any activity on consecutive local days.

**Chat** (`POST /conversations/:id/messages`), written for Claude; on Groq the same loop runs through `GroqSession` with these differences: one system message (persona + context), no prompt caching or refusals, history capped at 12 messages / 5,000 characters and 12 memories (the free tier's tokens-per-minute limit), and no second request just to acknowledge tool results once the reply is written:
1. Stores the user message, then streams SSE events: `user`, `delta`, `replace`, `suggestion`, `memory`, `reminder`, `signal`, `done`, `title`, `error`. There's a 15-second heartbeat.
2. History is the last 40 messages, **visible text only**. That's deliberate: Opus 5.5 checks that history replayed with its thinking blocks hasn't been edited. Since the context block changes every turn, thinking blocks are never replayed across turns. Within one turn's tool loop the full assistant content is passed back.
3. Request settings:
   - `client.beta.messages.stream` with `betas: ["server-side-fallback-2026-07-01"], fallbacks: "default"`
   - `output_config.effort` from `CHAT_EFFORT`
   - system = [frozen PERSONA, the per-person context]
   - tools have `eager_input_streaming: true` and are validated with zod
   - the `remember` tool is removed when memory is off
   - at most 4 loop iterations; a refusal gives a gentle replacement text
4. The signal (`analyzeMessage`) runs in parallel. It's stored in the user message's meta, and the assistant message's meta stores suggestions, memories, reminders and safety.
5. When a conversation has no title yet, `generateTitle` runs after the first reply.

**Structured-output gotcha:** the SDK's `zodOutputFormat` turns zod enums into plain strings with the allowed values written in the description. So AI activity fields use `z.enum([...]).catch("none")`; otherwise one bad value would throw away the whole response.

**Daily card:** generated once per user per day and cached in `daily_cache`. A cached card only counts if it was written after the latest check-in and assessment, so a check-in always brings a fresh one. Offline cards (AI off, failing, or over budget) are cached for 15 minutes so the model isn't called on every visit. Deleting a memory or journal entry, or changing the memory switch, tone or focus, clears the cache (`invalidateDailyCache`). `/home` returns the cache only and starts generation in the background; the app then calls `/home/daily`. The weekly reflection follows the same rules.

### Security (round 4)

What changed, by area. Each item maps to a finding from the audit.

- **Config (`config.ts`):** every setting is validated at startup with zod. `JWT_SECRET` is always required, at least 32 characters, and placeholders are refused (there's no built-in fallback any more). `CHAT_EFFORT`, `CLAUDE_MODEL`, `PORT` and the voice ids are checked. New settings: `TRUST_PROXY`, `CORS_ORIGINS`, `LOG_REQUESTS`, `AI_DISABLED`, `VOICE_DISABLED`, `VOICE_CACHE_MAX_MB`, the daily budgets, and the demo-seed switches (all in `.env.example`). `npm start` sets `NODE_ENV=production`.
- **Sign-in:** sign-up 20 an hour per address; login 30 per 15 minutes per address plus 10 failures per 15 minutes per account; unknown emails take as long as wrong passwords (dummy bcrypt hash); a duplicate sign-up race answers 409, not 500; emails capped at 254 characters and passwords at 72 bytes (bcrypt's limit). Tokens are pinned to HS256 and carry `ver` (the account's `token_version`): `POST /auth/logout` (the app's Sign out) and `POST /auth/password` bump it, revoking every older token. Tokens issued before round 4 have no `ver` and are treated as version 0, so nobody was signed out by the upgrade.
- **Isolation:** every write includes the `user_id` predicate (reminder delete is one statement now). `/activities/guides` ignores unknown guide names (a stored name like `constructor` used to crash it).
- **Input:** names, titles, emotions, reminder text are single-line and control-character free; notes, journal and chat keep line breaks but lose other control characters; focus areas are limited to the app's nine ids; time zones must be accepted by both Node and Postgres (offsets like `+05:30` mean opposite things in the two and used to break every date query); `GET /moods?days=` accepts any number.
- **AI prompts:** the per-person context is wrapped in `<person_context>` and every system prompt that receives it says it is information, never instructions; person-entered text can't close the tag or fake a new line. The safety classifier gets the message inside `<message_to_assess>`. Model output is cleaned and length-capped before it is stored or shown. Logs never print model output or tool input.
- **Memory switch:** with memory off, check-in notes no longer reach any prompt (context, weekly reflection), the `remember` tool is refused server-side too, and its setting is re-read inside the lock before saving.
- **Safety:** `combineRisk` lifts the classifier's result to at least `concern` when the keyword check sees a clear statement (and uses the keyword result alone when the classifier fails). The signal is saved to the user message as soon as it arrives, even if the reply fails. A crisis signal always adds the `help_now` card, and a declined reply to a risky message is replaced with a caring one that points to the help lines.
- **Chat costs:** 30 messages per 10 minutes and 200 a day per account, 2 replies at a time per account, `max_tokens` 8192 (was 64000), history capped at 40 messages and 24,000 characters, the persona and tools cached with `cache_control` (Opus 5.5 caches prefixes from 512 tokens), timeouts with one retry, no further tool rounds after the person leaves, and a re-issue only for the SDK's tool-JSON parse error. If a turn fails part way, what was written is saved with `meta.incomplete`.
- **Voice:** cached clips are served first and cost nothing; new clips are limited per address (40 per 10 minutes), de-duplicated while in flight, capped at 4 at once and counted against `VOICE_DAILY_CHARS`; the cache is capped (least recently played clips are removed) and stray `.tmp` files are cleaned at startup; an unwritable cache folder no longer breaks voice; clips are `Cache-Control: private`.
- **Errors and logs:** a response already streaming is closed cleanly on error; framework errors (413, 415, bad URL encoding) answer 4xx instead of 500; pg unique violations answer 409; 500s carry a request id and log without row values.
- **Database:** pool `error` listener (a dropped idle connection used to crash the process), connection and statement timeouts, `/health` pings the database (503 when down), migrations take an advisory lock, startup retries while the database wakes up, per-account `withUserLock` for check-then-insert steps. Migration `002_security.sql` adds `users.token_version`, an email length check and an activities index.
- **Shutdown:** SIGTERM stops chat streams (they save what they have and tell the person to try again shortly), closes connections after 5 s, and always exits within 10 s; uncaught errors are logged and trigger the same shutdown.
- **Local setup:** `db:up` and `compose.yaml` bind Postgres to 127.0.0.1; `backend/.env` is `chmod 600`; the demo seed refuses non-local databases unless `ALLOW_DEMO_SEED=1` and a private `SEED_DEMO_PASSWORD` are set.

**Accepted for now (deliberately not changed):**
- No email verification or password reset: there's no email channel. Sign-up still answers 409 for a taken email (normal sign-up UX); the sign-up rate limit slows enumeration.
- Account deletion needs only the session, not the password again (the app asks for confirmation first).
- `/voice/speak` still speaks any text up to 300 characters to anyone: the per-address limit, daily character budget and cache cap bound the cost. Pip's lines (which can include the first name) still travel in the query string, so a host's own access logs may record them; the API's own logs strip query strings.
- Rate limits and budgets live in one process; use a shared store if the API ever runs on several instances.
- No row-level security: isolation is the `user_id` predicate in every query (all checked). Use a non-superuser database role when deploying.
- `npx expo lint` reports older errors in files round 4 didn't touch (React rules about Reanimated shared values, and a notifications namespace import).

### App (`app/`): Expo SDK 58, RN 0.88, React 19.3, expo-router 58 (typed routes), Reanimated 4.7, TypeScript

**Folders:**
- `src/app/`: routes
  - `_layout.tsx`: fonts, `AuthProvider`, Stack with `Stack.Protected` + `redirectTo`, `SplashIntro`, and `PhoneFrame` (a 440 px column on web)
  - `(tabs)/`: index (Home), practices, sol, journey, you. The custom tab bar comes from `expo-router/js-tabs` and has Sol in the centre.
  - onboarding (round 2):
    - `welcome` is Pip's intro and the voice opt-in
    - `personalize` has 5 steps: name with mic, "what's on your mind" with mic and Pip's help, focus with Pip's picks, check-in time, and tone with previews
    - `sign-up` has Pip and the prefilled name
    - `OnboardingAnswers` now has `name`
  - other screens: welcome, personalize, sign-up, sign-in, checkin (modal), chat/[id], breathe/[pattern] (calm, box, 478), grounding, assessment/[kind] (mood, anxiety, kindness), guide/[id] (anxiety, low_mood, sleep, self_esteem, stress, mindfulness), journal/index, journal/new (modal, optional `prompt` param), reminders, memory, settings, help (public)
- `src/components/`:
  - `ui.tsx`: T, Screen (with a `tabBar` padding option), Header, Tappable (an animated Pressable that shrinks on press), Button, IconButton, Chip, Card, SectionTitle, IconBadge, Pill, ProgressBar, EmptyState, ErrorNote, inputStyle
  - also `Sol.tsx`, `SplashIntro.tsx` (now a warm sunrise), `ActivityCard.tsx`, `MoodChart.tsx`, `Garden.tsx`, `TypingDots.tsx`
  - round 2:
    - `Pip.tsx` (round 3): stages 0–10, a viewBox that gets taller as the plant grows (`TOP`), and the grow crossfade. It's an SVG in three layers (body, plant, right arm), so the plant sways around its base and the arm waves from the shoulder (via `transformOrigin`). It has a 5 s breathing sway, slow blinks, 6 moods (happy, calm, curious, listening, cheering, thinking), a talking mouth, and `pipStage()`.
    - `PipGuide.tsx`: Pip plus a speech bubble. The `stack` layout puts the bubble above Pip with a tail (welcome, the personalize steps and sign-up), and the line types out with a calm typewriter effect. It speaks each line once, only while focused (`useIsFocused`), has a mute toggle, and tapping Pip replays the line. Only the Pip whose line is playing moves its mouth (`useVoice().line`).
    - `PipTour.tsx`: the first-run Home tour; it stores `solace.tour.<userId>`. `replayTour(userId)` also resets the tips; it's called from You → "Take the tour with Pip".
    - `PipTip.tsx`: first-visit tips (`TIPS`) on Practices, Journey, the Sol tab, breathing (before starting), grounding, the journal, check-in, assessments (first question), Reminders and Memory. Each is inline, marked seen as soon as it shows (`solace.tip.<userId>.<id>`), and dismissed with "Got it".
    - `lib/pipGrowth.ts`: the level store. Home and Journey call `setPipLevel`; `usePipStage()` reads it; it's reset on sign-out and account deletion.
    - Removed: `Ray.tsx`, `RayGuide.tsx`, `RayTour.tsx`, `Garden.tsx` (Journey and Home's "Pip's garden" card now show Pip).
    - `MicButton.tsx`: tap to dictate; one active owner at a time, since recognition events are global
- `src/lib/`:
  - `api.ts`: base URL, `api()`, ApiError, 401 handler
  - `auth.tsx`: context, token in SecureStore (localStorage on web), onboarding answers stored before sign-up
  - `chatStream.ts`: SSE over POST using `expo/fetch` (global fetch on web)
  - `notifications.ts`: handler, Android channel `reminders`, permission, `syncReminders()`, `sendTestNotification()`, `useNotificationRouting()`
  - `useApi.ts`: refetches when the screen gains focus
  - `voice.ts` (round 2):
    - opt-in state via `useVoice()`, plus `speak`, `stopSpeaking` and `prefetchLine`
    - checks `/health` for `voice`, then plays `/voice/speak` with `expo-audio`; falls back to `expo-speech` after 6 s or on failure
  - `onboardingAssist.ts` (round 2): the client for `/onboarding/assist`; returns null on any error
  - `storage`, `haptics`, `confirm` (window.confirm on web, Alert on native), `format`, `types`
- `src/content/`: `activities.ts` (activity ID → title, icon, accent, route), `guides.ts`, `wellness.ts` (breathing patterns, grounding steps, emotions, journal prompts, focus areas, affirmations, help lines)
- `src/theme/index.ts`: the Hearth (light) and Evening-in (dark) palettes, including `frame`, plus `accent()`, `daylight()`, MOODS, fonts (Fraunces and Nunito), the type scale, spacing, radius, `shadow()` (warm-tinted), and `useTheme()`
- `src/theme/mode.tsx`: `ThemeModeProvider`
  - the mode is light, dark or system, stored in `solace.appearance`, default light
  - it also calls `Appearance.setColorScheme` on native so system dialogs match
  - the root layout waits for it to load before hiding the splash
- `scripts/build-apk.sh`: rsyncs the app to `~/.cache/solace-apk-build/app`, then runs `expo prebuild -p android --clean` and `gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`, and copies the APK to `builds/`
- `assets/source/*.svg`: icon sources. They were rendered to PNG with `google-chrome --headless=new --screenshot --window-size=1024,1024`.

**Notifications:**
- Local scheduled notifications only, no push server.
- Reminders are stored on the server. `syncReminders()` cancels everything and reschedules:
  - DAILY triggers for mood, breathing, self-care and custom reminders
  - 7 one-off DATE triggers for affirmations, each with a different text; today's uses the AI affirmation
- It runs on sign-in and app start, and after any reminder change or a reminder Sol creates.
- Taps go to `data.url`: mood → `/checkin`, affirmation → `/`, breathing → `/breathe/calm`, self-care → `/practices`, custom → `/sol`.
- Permission is requested once, automatically, after sign-in.

## 7. Gotchas learned the hard way

- **SDK 58 router:**
  - `Tabs` from `expo-router` is deprecated; use `expo-router/js-tabs`.
  - The custom `tabBar` gets `{ state, descriptors, emitter, navigateToTab(route.key), insets }`. There is no `navigation` prop.
  - `Stack.Protected` without `redirectTo` falls back to the first accessible route **in file order**. That sent signed-out users to `/help` until `redirectTo` was added.
  - A runtime string href needs `as Href`.
- **Reanimated 4:** use `scheduleOnRN` from `react-native-worklets`, not `runOnJS`.
- **React Compiler:** turned off in `app.json`, because shared-value `.value` writes and the compiler don't mix well.
- **Notifications:** use the synchronous `Notifications.getLastNotificationResponse()` and `clearLastNotificationResponse()`; the Async versions are deprecated. Android only shows the permission prompt after a channel exists. `setNotificationHandler` uses `shouldShowBanner` and `shouldShowList`.
- **Web:**
  - `app.json` web output is set to `"single"`, because server rendering broke `window` access.
  - Use measured widths, not `useWindowDimensions`, inside `PhoneFrame`; the welcome slides were blank before this fix.
  - `expo-blur` on web ignores the background colour, so the tab bar only blurs on iOS.
- **Tappable:** layout styles (`flex`, `alignSelf`) must be on the Pressable itself, so it's an `Animated.createAnimatedComponent(Pressable)`.
- **APK build:**
  - The space in the project path breaks Gradle, CMake and the NDK, so build from the copy.
  - rsync excludes must be anchored (`/dist`), or they strip `node_modules/*/dist`.
  - The first build took 18 minutes, including downloading NDK 27.1.
  - `usesCleartextTraffic: true` (via expo-build-properties) allows plain-HTTP LAN testing.
  - Release builds are signed with the debug key: installable, but not uploadable to the Play Store.
- **Podman:** `podman compose` needs a podman socket service that isn't running. `npm run db:up` uses `podman run` directly, and `compose.yaml` is kept for Docker users.
- **Chrome browser tools** are connected through the Claude in Chrome extension in the user's work Chrome profile. They can see only tabs Claude opens. The VS Code extension starts sessions with `--no-chrome` unless `/chrome` "Enabled by default" is on.

- **Round 2 gotchas:**
  - **Callbacks passed into effects:** a callback prop in a child's effect dependencies (`onListeningChange`) re-ran on every parent render and caused "Maximum update depth exceeded" while typing. Keep such callbacks in refs.
  - **React Native Web presses:** `element.click()` from DevTools doesn't fire a Pressable's `onPress`. Use a real click (the Chrome tool's click) when testing.
  - **Chrome throttling:** when the Chrome window isn't focused, Chrome throttles it. rAF runs at about 4 fps, animations look frozen, timers are slow, and `Page.captureScreenshot` sometimes times out. Check the DOM with JavaScript instead.
  - **zod `.catch`:** a static `.catch("none")` converts fine with `zodOutputFormat`, but a function `.catch(() => …)` throws "Dynamic catch values are not supported". That would force every AI call offline.
  - **Expo Go:** `expo-speech-recognition` needs a dev build or the APK.

- **Round 5 gotchas (Groq):**
  - **Groq's docs can list models a key can't use.** Check with `groq.models.list()` (the Llama models were listed in the docs but answered 404 `model_not_found`).
  - **Free limits are per model and per minute:** about 8K tokens a minute each. One Sol turn is roughly 3 to 4K tokens, so two quick messages fill a minute; the fallback chain and the trimmed Groq prompt (12 messages, 5,000 characters, 12 memories) keep normal-paced chat working.
  - **`groq-sdk` obeys `retry-after` with no upper bound.** Once the free daily allowance is used up, Groq can answer 429 with a wait of an hour, and the SDK would sleep that long inside a request. The client is created with `maxRetries: 0`; `withGroqRetry()` retries once, only for waits of 5 seconds or less, server errors and dropped connections.
  - **Groq rejects `messages[].name`**, and `reasoning_effort` / `include_reasoning` only apply to gpt-oss (and qwen) models; `groqReasoning(model)` sends them only there.
  - **Strict JSON Schema mode** (gpt-oss, qwen) needs every property required and `additionalProperties: false`; zod's `toJSONSchema(schema, { io: "output" })` gives that. `$schema` and `default` keys are stripped. Other models fall back to `json_object` mode with the schema in the prompt.
  - **Render:** don't set `NODE_ENV=production` in the host's environment, or `npm ci` skips the dev dependencies the TypeScript build needs (`npm start` sets it itself).

- **Round 4 gotchas:**
  - **Node 22 `IncomingMessage` `close`:** it fires once the request body has been read, not when the client leaves. Listen on the response (`res.on("close")`) to detect a client hanging up.
  - **`pgrep -f` / `pkill -f` in Claude's shell** match the shell's own command line; kill by saved PID instead.
  - **Express 5 handler types:** with extra middleware before a handler, `req.params.id` is typed `string | string[]`; wrap in `String()`.
  - **Rate limits in tests:** sign-up is limited to 20 an hour per address, so the API tests share two accounts where they can. Each test file runs in its own process (fresh limiters).

## 8. About the user

- **Developer:** Devesh. Main workspace: `~/Desktop/Trill` (a separate dating-app project, not related to Solace).
- **Communication:** prefers short, direct messages; often types quickly with typos.
- **Git:** no co-author or AI trailers on commits, ever. Commit only when asked.
