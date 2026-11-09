# Solace AI: a wellness companion

Solace is a calm, personal mobile app that helps people understand their emotions, look after themselves and build healthier daily habits. Its AI companion, **Sol**, is a small glowing character who listens, remembers what matters, and connects conversations to things that actually help.

```
solace AI/
├── app/        React Native + Expo (SDK 58, Expo Router) mobile app
├── backend/    Node.js + Express 5 + TypeScript API
├── compose.yaml  PostgreSQL for local development
└── builds/     Built APKs (created by app/scripts/build-apk.sh)
```

## What's in the app

| Area | What it does |
|---|---|
| **Opening** | Warm sunrise splash. **Pip**, a little walking flower pot (the seedling Sol planted for you), guides onboarding with an opt-in, calm natural voice (ElevenLabs, falling back to the device voice) and a mic so people can talk instead of type. There are 5 steps: name, "what's on your mind", focus areas, check-in time, and Sol's tone. While you type, Pip quietly suggests better wording, pre-picks focus areas and previews how Sol would reply in each tone (AI, with offline fallbacks). Pip then introduces Sol with a short first-run tour of Home, and gives a one-time tip the first time you open each main screen. Pip's sprout grows with your garden level (shown on Home and Journey). |
| **Accounts** | Email + password sign-up/sign-in (bcrypt + JWT), token kept in the device keychain. Account deletion removes everything. |
| **Home** | Time-aware greeting, one-tap mood check-in where Sol's face and colour follow your mood, an **AI-written daily affirmation and focus** grounded in your recent check-ins, quick actions, "pick up where you left off", and your growing garden (XP level). |
| **Sol (AI companion)** | Streaming chat with a distinct personality and three tones (gentle / cheerful / direct). Sol knows your recent moods, check-in results, journal entries and things you've shared, and can **open activity cards** (breathing, grounding, journaling with a tailored prompt, guides…), **save memories**, and **create reminders** from inside the conversation. Every message is also read for mood and safety; crisis language brings up a support card with helplines. |
| **Chat history** | Conversations are stored, titled automatically, listed with previews, can be continued or deleted. |
| **Practices** | Calm, box and 4-7-8 breathing with an animated circle and haptics; 5-4-3-2-1 grounding; three short wellbeing check-ins (PHQ/GAD-based mood and anxiety, plus self-kindness) with **AI-personalised next steps**; six step-by-step guides; journal with rotating prompts. |
| **Journey** | Level + garden illustration, streaks with a week strip, 14-day mood chart, counts, achievements, and **Sol's weekly reflection** (AI) on patterns in your week. |
| **Reminders** | Daily mood check-in, affirmation (a different one each day), breathing and self-care reminders, plus your own. Local scheduled notifications work with the app closed, and tapping one opens the right screen. |
| **Privacy** | "What Sol remembers" lets you view/delete each memory, forget everything, or turn memory off entirely. |
| **Support** | Region-aware helplines (India: Tele-MANAS 14416; US: 988; UK & Ireland: Samaritans), Find A Helpline for everywhere else. |

Design: soft linen/lavender palette with peach, sage, sky, butter and rose accents; DM Serif Display + Nunito; full light and dark themes; spring-based press animations, layout animations and haptic feedback throughout.

## How the AI works

All AI runs on the backend. By default it uses **Groq**, which serves open models on a free tier: Sol chats on `openai/gpt-oss-120b`, and the short structured jobs run on `openai/gpt-oss-20b` (free limits are per model, so this spreads the load). Claude (Anthropic) is still supported as a paid alternative: set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`.

- **Companion chat** (`backend/src/ai/companion.ts` with one adapter per service in `ai/chatProviders.ts`): streamed with Server-Sent Events to the app. A fixed persona prompt plus a per-person context block (built fresh each request from the database, `ai/context.ts`) so memory changes take effect immediately. Three tools: `suggest_activity`, `remember`, `create_reminder`. Only the visible text of earlier turns is replayed.
- **Structured calls** (`ai/analysis.ts`, JSON checked against a schema): per-message mood + risk signal, conversation titles, daily affirmation/focus card, assessment next steps, mood check-in reply, weekly reflection, Pip's onboarding help.
- **Free-tier limits:** Groq's free models allow roughly 8,000 tokens a minute and 200,000 a day each. When one is used up, the request moves to the next free model (`qwen/qwen3.8-27b`, then `openai/gpt-oss-20b`), which roughly triples the allowance: plenty for a demo and a few testers chatting at a normal pace. If all are used up, chat says Sol is busy or resting and everything else falls back to offline content.
- **Safety first:** a message that sounds like self-harm or danger shows the help card at once, and still gets a caring reply pointing to the help lines even when the AI is off, rate limited or resting. Sol never quotes phone numbers itself; the card shows the right local ones.
- **Without an API key** everything except chat still works: the app falls back to built-in affirmations, suggestions and next steps.

## Run it locally

Prerequisites: Node 22.13+, Podman or Docker, a free Groq API key (https://console.groq.com/keys).

```bash
# 1. Database (PostgreSQL 16 on port 5433)
cd "solace AI/backend"
npm install
npm run db:up            # podman; or: docker compose -f ../compose.yaml up -d db

# 2. Backend
(umask 077; cp .env.example .env)   # then set JWT_SECRET and GROQ_API_KEY
npm run dev              # http://localhost:4000, applies migrations on start
npm test                 # API tests against the local database

# 3. App
cd ../app
npm install
npx expo start --web     # quickest preview in a browser
```

The app finds the API automatically in development (same machine as the Expo dev server, port 4000). Set `EXPO_PUBLIC_API_URL` to override.

**Local test account** (only exists in your local database, created by `npm run seed:demo`): `demo@solace.test` / `solace-demo-2026`. The seed script refuses to create it on any database that isn't local unless you set `ALLOW_DEMO_SEED=1` and a private `SEED_DEMO_PASSWORD`.

### On a phone

Expo Go may not have an SDK 58 build yet, and notifications need a real build anyway, so build the APK:

```bash
cd app
API_URL=http://<your-computer-wifi-ip>:4000 npm run build:apk   # → ../builds/Solace.apk
```

Install the APK on an Android phone on the same Wi-Fi. On Fedora, the firewall blocks port 4000 by default; allow it with `sudo firewall-cmd --add-port=4000/tcp` (add `--permanent` to keep it), or deploy the backend.

## Deploying the backend

The APK has to reach the API from any phone, so the backend runs on a public host with HTTPS. The repo includes a Render Blueprint (`render.yaml`) that creates the API and a free Postgres database in one go.

1. Get a free Groq API key at https://console.groq.com/keys.
2. Push the repo to GitHub, then in Render: **New → Blueprint**, connect the repo, and apply. When asked, paste `GROQ_API_KEY` (and `ELEVENLABS_API_KEY` if you want Pip's natural voice; leave it empty otherwise). `JWT_SECRET` is generated for you; `TRUST_PROXY=3` (Render's proxy hops) and `NODE_VERSION=22` are set.
   Pip's natural voice only uses the free characters your ElevenLabs plan includes. When they run out, Pip switches to the phone's voice until the monthly reset, so a free ElevenLabs account never costs anything.
3. When the deploy is live, open `https://<your-service>.onrender.com/health`: it should show `"ok":true` and `"ai":true`.
4. Open `https://<your-service>.onrender.com/health/ip` on your phone and compare `ip` with your public IP (search "what is my ip"). If they differ, change `TRUST_PROXY` in `render.yaml` (Render syncs it) until they match; rate limits rely on it.
5. Build the APK against it: `cd app && API_URL=https://<your-service>.onrender.com npm run build:apk`. An `https://` address builds an APK that refuses plain HTTP.

Free plan notes:
- The API sleeps after 15 minutes without requests, and the next request then waits up to a minute. To keep it awake, add a repository variable `BACKEND_URL` (GitHub → Settings → Secrets and variables → Actions → Variables) and the included workflow `.github/workflows/keep-awake.yml` pings it every 10 minutes. Render's free 750 hours a month cover one service running all month.
- Render's free Postgres expires 30 days after it's created. For one that doesn't, create a free database on Neon and set `DATABASE_URL` to its connection string (with `sslmode=require`).
- Other hosts (Railway, Fly, Koyeb) work the same way (check `/health/ip` there too and set `TRUST_PROXY` to their hop count): build `npm ci --include=dev && npm run build`, start `npm start` from `backend/`, health check `/health`, and the environment variables from `backend/.env.example`.

## Security

What the API does to keep people's data and the owner's API budget safe (details in `HANDOFF.md`):

- **Sign-in:** bcrypt passwords, rate limits per address and per account, the same timing for unknown emails, HS256-pinned tokens that sign-out and password changes revoke (`POST /auth/logout`, `POST /auth/password`).
- **Isolation:** every query is scoped to the signed-in account; limits (reminders, memories, XP caps) are checked inside a per-account database lock so parallel requests can't slip past them.
- **AI:** everything a person typed is passed to the model as tagged data, never as instructions; the memory switch keeps check-in notes, journal entries and past conversations out of prompts; a keyword check backs up the safety classifier, so a message about self-harm always gets the help card.
- **Spending:** per-account limits on chat, daily budgets for the AI service and ElevenLabs, Pip's voice limited to the ElevenLabs plan's included characters, cached voice clips that cost nothing, request timeouts with one short retry (a "come back in an hour" rate limit is never waited out).
- **Operations:** settings validated at startup, security headers, request ids and one log line per request (no bodies or query strings), database timeouts, graceful shutdown that saves half-written replies.

## API overview

`POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/password` · `GET|PATCH|DELETE /me` · `GET /home`, `GET /home/daily` · `POST|GET /moods` · `GET /assessments/catalog`, `POST|GET /assessments` · `GET|POST /conversations`, `GET|PATCH|DELETE /conversations/:id`, `POST /conversations/:id/messages` (SSE) · `GET /progress`, `GET /progress/reflection` · `POST /activities`, `GET /activities/guides` · `GET|POST /journal`, `DELETE /journal/:id` · `GET|DELETE /memories[/:id]` · `GET|POST /reminders`, `PATCH|DELETE /reminders/:id` · public: `POST /onboarding/assist`, `GET /voice/speak?text=` (audio/mpeg) · `GET /health`

## Submission checklist (from the brief)

- [ ] Deploy the backend (see "Deploying the backend") and try a few conversations (anxious, venting, ask for a reminder, mention someone important)
- [ ] Build the APK with `API_URL=https://<your-service>.onrender.com`, install it on a phone, and test notifications (Reminders → "Send a test notification")
- [ ] Record the demo video: splash → onboarding → sign-up → home check-in → chat with Sol (activity card, memory, reminder) → breathing → a check-in with next steps → journey → reminders → memory controls
- [ ] Submit the APK + video in the hackathon Telegram group

Solace is a wellbeing companion, not a medical device or a substitute for professional care.
