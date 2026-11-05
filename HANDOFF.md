# Solace AI: project handoff

Everything a new session needs to pick up this project. Last updated **2026-11-05** (round 2: warm light UI, voice, AI onboarding; round 3: Pip replaces Ray, screen tips, calm-by-design). Read this first, then `README.md` for setup and feature details.

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
- **Release APK** built: `builds/Solace.apk` (41 MB, arm64-v8a, package `com.solace.companion`). It is hard-wired to `http://192.168.29.213:4000`, the user's Wi-Fi IP on 2026-11-05.

### Not yet tested
- **Everything that calls Claude**, because no `ANTHROPIC_API_KEY` existed on the machine:
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
- Backend-only changes don't need a rebuild: the offline weekly reflection, the `.catch("none")` on AI activity fields, and the demo seed.

## 3. Next steps (in order)

0. The user adds `ELEVENLABS_API_KEY=…` to `backend/.env` (the line already exists, empty). Then:
   - restart the backend
   - check `/health` shows `voice:true`
   - open the welcome screen, choose "Yes, talk me through it" and listen to Pip
   - if ElevenLabs answers 402, or the voice doesn't feel calm enough, set `PIP_VOICE_ID` to another voice from the ElevenLabs library (pick a soft, warm one)
   - generated clips are cached in `backend/.cache/voice/`; delete them after changing the voice
1. The user adds `ANTHROPIC_API_KEY=…` to `backend/.env` and restarts the backend (`tsx watch` doesn't reload on `.env` changes). Then test chat properly:
   - venting, anxiety, asking for a reminder, mentioning a person or event (should be remembered)
   - a crisis phrase (should show the safety card)
   - a check-in, an assessment, the Home daily card, the Journey reflection
   - fix whatever the real API returns, such as model or parameter errors
2. Rebuild the APK and test on an Android phone on the same Wi-Fi:
   - Fedora's firewall blocks port 4000; the user runs `sudo firewall-cmd --add-port=4000/tcp` (Claude must not change system settings)
   - test notifications with Reminders → "Send a test notification", the daily ones, and tapping each one
3. Optional but better for judges: deploy the backend (Render/Railway + Neon/Supabase Postgres), then rebuild the APK with `API_URL=https://…` so it works anywhere.
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

- **AI provider:** Claude, via the Anthropic API (user's choice).
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

- **`backend/.env`** exists, with a generated `JWT_SECRET` and an empty `ANTHROPIC_API_KEY`. It's gitignored; never print it.
- **Local test account:** `demo@solace.test` / `solace-demo-2026`. It only exists in the local database; the seed script recreates its data.
- **API base URL in the app** (`src/lib/api.ts`): it uses `EXPO_PUBLIC_API_URL` if set. Otherwise web uses `http://<page host>:4000` and native uses the Expo dev server's host on port 4000.
- **Expo Go:** an SDK 58 build may not be in the stores yet, so use the APK or a dev build on a phone.

## 6. Architecture

### Backend (`backend/`): Express 5, TypeScript (tsc 7), ESM, `pg`, zod 4, bcryptjs, jsonwebtoken

| File | Role |
|---|---|
| `src/index.ts` | Runs migrations, then listens on `PORT` |
| `src/app.ts` | Routes; everything except `/auth` and `/health` sits behind `requireAuth` |
| `src/config.ts` | Env vars; `aiEnabled = !!ANTHROPIC_API_KEY` |
| `src/db.ts` | Pool. DATE columns come back as `YYYY-MM-DD` strings; int8 and numeric as numbers |
| `src/migrate.ts`, `migrations/001_init.sql` | Tables: users, mood_entries, assessments, conversations, messages, memories, activities (all XP), journal_entries, reminders, daily_cache |
| `src/auth.ts` | JWT (30 days), `requireAuth`, `currentUser(req)`, `safeTimezone` |
| `src/routes/*` | auth, me (GET/PATCH/DELETE account), home (+`/home/daily`), moods, assessments (+`/catalog`), conversations (SSE), progress (+`/reflection`), misc.ts (activities, journal, memories, reminders) |
| `src/lib/progress.ts` | XP values, levels, streaks computed in the user's time zone |
| `src/content/assessments.ts` | Question sets, scoring bands, offline "moves" |
| `src/content/catalog.ts` | Activity IDs the AI may suggest, plus offline affirmations |
| `src/ai/client.ts` | Anthropic client; `structured()` helper (`messages.parse` + `zodOutputFormat`, effort low; returns null on a refusal or error) |
| `src/ai/context.ts` | `buildUserContext(user)` builds a text block: name, local time, tone, focus areas, progress, last 6 moods, latest results, and, if memory is on, memories, 2 journal entries and recent chat titles |
| `src/ai/companion.ts` | Sol's persona, 3 tools, and the streaming loop |
| `src/ai/analysis.ts` | Per-message signal (mood/emotions/risk), title, daily card, assessment moves, check-in reply, weekly reflection |
| `src/seed-demo.ts` | Demo data |
| `src/routes/onboarding.ts`, `src/ai/onboarding.ts` | Public `POST /onboarding/assist`: Pip's rephrasings (persona: soft, unhurried, calming), focus picks and tone previews. Structured output, offline fallback, concern detection (AI flag OR keywords), and output clean-up for speech (no emoji or dashes, word caps). Stateless; logs no text. |
| `src/routes/voice.ts` | Public `GET /voice/speak?text=` (1–300 chars). Proxies ElevenLabs streaming TTS and writes a disk cache at `backend/.cache/voice/<sha256>.mp3` (gitignored). Supports Range requests for Safari; returns 503 `voice_off` without a key and 502 `voice_failed` on upstream errors. |
| `src/lib/rateLimit.ts` | In-memory per-IP limiter: assist 30, voice 80 per 10 minutes. With `trust proxy 1` and no proxy in front, a client can spoof `X-Forwarded-For` to get around it. |

**XP:**
- mood check-in 10; assessment 2 per question + 20 bonus
- breathing and grounding 15 each, at most 5 times a day
- guide step 5, once per step; journal 15; first chat of the day 10

**Levels:** Seed 0, Sprout 60, Seedling 150, Bud 300, Bloom 500, Blossom 800, Grove 1200, Garden 1800, Sanctuary 2600. The streak counts any activity on consecutive local days.

**Chat** (`POST /conversations/:id/messages`):
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

**Daily card:** generated once per user per day and cached in `daily_cache`. A new mood check-in or assessment deletes it so it regenerates. `/home` returns the cache only and starts generation in the background; the app then calls `/home/daily`.

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
- **Chrome browser tools** are connected through the Claude in Chrome extension in the user's "Work" (trillmatching.com) Chrome profile. They can see only tabs Claude opens. The VS Code extension starts sessions with `--no-chrome` unless `/chrome` "Enabled by default" is on.

- **Round 2 gotchas:**
  - **Callbacks passed into effects:** a callback prop in a child's effect dependencies (`onListeningChange`) re-ran on every parent render and caused "Maximum update depth exceeded" while typing. Keep such callbacks in refs.
  - **React Native Web presses:** `element.click()` from DevTools doesn't fire a Pressable's `onPress`. Use a real click (the Chrome tool's click) when testing.
  - **Chrome throttling:** when the Chrome window isn't focused, Chrome throttles it. rAF runs at about 4 fps, animations look frozen, timers are slow, and `Page.captureScreenshot` sometimes times out. Check the DOM with JavaScript instead.
  - **zod `.catch`:** a static `.catch("none")` converts fine with `zodOutputFormat`, but a function `.catch(() => …)` throws "Dynamic catch values are not supported". That would force every AI call offline.
  - **Expo Go:** `expo-speech-recognition` needs a dev build or the APK.

## 8. About the user

- **Developer:** Devesh. Main workspace: `~/Desktop/Trill` (a separate dating-app project, not related to Solace).
- **Communication:** prefers short, direct messages; often types quickly with typos.
- **Git:** no co-author or AI trailers on commits, ever. Commit only when asked.
