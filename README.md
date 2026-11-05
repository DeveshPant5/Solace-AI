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
| **Opening** | Warm sunrise splash. **Pip**, a little walking flower pot (the seedling Sol planted for you), guides onboarding with an opt-in, calm natural voice (ElevenLabs, falling back to the device voice) and a mic so people can talk instead of type. There are 5 steps: name, "what's on your mind", focus areas, check-in time, and Sol's tone. While you type, Pip quietly suggests better wording, pre-picks focus areas and previews how Sol would reply in each tone (Claude, with offline fallbacks). Pip then introduces Sol with a short first-run tour of Home, and gives a one-time tip the first time you open each main screen. Pip's sprout grows with your garden level (shown on Home and Journey). |
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

All AI runs on the backend with the official Anthropic SDK (`@anthropic-ai/sdk`), default model **Claude Opus 5.5** (`claude-opus-5-5`, change with `CLAUDE_MODEL`).

- **Companion chat** (`backend/src/ai/companion.ts`): streamed with Server-Sent Events to the app. A fixed persona prompt plus a per-person context block (built fresh each request from the database, `ai/context.ts`) so memory changes take effect immediately. Three tools: `suggest_activity`, `remember`, `create_reminder`. The server-side `fallbacks: "default"` option is enabled so a declined request is retried on Anthropic's recommended fallback model; any remaining refusal is handled with a gentle message. Only the visible text of earlier turns is replayed.
- **Structured calls** (`ai/analysis.ts`, JSON via structured outputs at low effort): per-message mood + risk signal, conversation titles, daily affirmation/focus card, assessment next steps, mood check-in reply, weekly reflection.
- **Without an API key** everything except chat still works: the app falls back to built-in affirmations, suggestions and next steps.

## Run it locally

Prerequisites: Node 22.13+, Podman or Docker, an Anthropic API key.

```bash
# 1. Database (PostgreSQL 16 on port 5433)
cd "solace AI/backend"
npm install
npm run db:up            # podman; or: docker compose -f ../compose.yaml up -d db

# 2. Backend
cp .env.example .env     # then set JWT_SECRET and ANTHROPIC_API_KEY
npm run dev              # http://localhost:4000, applies migrations on start

# 3. App
cd ../app
npm install
npx expo start --web     # quickest preview in a browser
```

The app finds the API automatically in development (same machine as the Expo dev server, port 4000). Set `EXPO_PUBLIC_API_URL` to override.

**Local test account** (only exists in your local database): `demo@solace.test` / `solace-demo-2026`.

### On a phone

Expo Go may not have an SDK 58 build yet, and notifications need a real build anyway, so build the APK:

```bash
cd app
API_URL=http://<your-computer-wifi-ip>:4000 npm run build:apk   # → ../builds/Solace.apk
```

Install the APK on an Android phone on the same Wi-Fi. On Fedora, the firewall blocks port 4000 by default; allow it with `sudo firewall-cmd --add-port=4000/tcp` (add `--permanent` to keep it), or deploy the backend.

## Deploying the backend

Any Node host works (Render, Railway, Fly.io) with a hosted Postgres (Neon or Supabase free tiers):

- Build `npm run build`, start `npm start`.
- Env: `DATABASE_URL`, `JWT_SECRET` (long random), `ANTHROPIC_API_KEY`, `NODE_ENV=production`. Optional: `ELEVENLABS_API_KEY` for Pip's spoken voice (`PIP_VOICE_ID` and `ELEVENLABS_MODEL` override the default voice and model; see `backend/.env.example`).
- Then rebuild the APK with `API_URL=https://your-backend.example.com`.

## API overview

`POST /auth/signup`, `POST /auth/login` · `GET|PATCH|DELETE /me` · `GET /home`, `GET /home/daily` · `POST|GET /moods` · `GET /assessments/catalog`, `POST|GET /assessments` · `GET|POST /conversations`, `GET|PATCH|DELETE /conversations/:id`, `POST /conversations/:id/messages` (SSE) · `GET /progress`, `GET /progress/reflection` · `POST /activities`, `GET /activities/guides` · `GET|POST /journal`, `DELETE /journal/:id` · `GET|DELETE /memories[/:id]` · `GET|POST /reminders`, `PATCH|DELETE /reminders/:id` · public: `POST /onboarding/assist`, `GET /voice/speak?text=` (audio/mpeg) · `GET /health`

## Submission checklist (from the brief)

- [ ] Add `ANTHROPIC_API_KEY` and try a few conversations (anxious, venting, ask for a reminder, mention someone important)
- [ ] Build the APK and install it on a phone; test notifications (Reminders → "Send a test notification")
- [ ] Record the demo video: splash → onboarding → sign-up → home check-in → chat with Sol (activity card, memory, reminder) → breathing → a check-in with next steps → journey → reminders → memory controls
- [ ] Submit the APK + video in the hackathon Telegram group

Solace is a wellbeing companion, not a medical device or a substitute for professional care.
