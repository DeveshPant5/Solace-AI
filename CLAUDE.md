# Solace AI

Hackathon project: an AI wellness companion app (Expo app in `app/`, Node API in `backend/`, Postgres).

**Before doing anything, read `HANDOFF.md`.** It has the brief, current status, next steps, decisions already made, how to run everything, the architecture, and gotchas. `README.md` has setup and feature details.

Rules:
- This is not part of the Trill workspace; Trill's rules don't apply here, except the user's general ones below.
- Don't commit or push unless the user asks. Never add Co-Authored-By or other AI trailers to commits.
- Never print or commit `backend/.env` (holds `JWT_SECRET` and `ANTHROPIC_API_KEY`).
- Expo SDK 58: check the versioned docs before using Expo/React Native APIs (see `app/AGENTS.md`). Use `npx expo install` for packages.
- Run `npx tsc --noEmit` in both `app/` and `backend/` before saying work is done.
- Don't change system or firewall settings; tell the user the command instead.
