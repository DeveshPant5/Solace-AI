# UI refresh plan: calmer and more professional

Status: partly done (2026-11-09). Written after the user said the app "looks a little bit gimmicky" and the fonts should look more professional.

**Done, following the user's answers:**
- Fonts: **Newsreader** for headings and the daily affirmation (italic), **Figtree** for everything else (the user wanted a "human touch", so a humanist pair instead of Inter). Fraunces and Nunito removed.
- Icons: every icon tile, focus chip, Settings appearance option and grounding step now uses Solace's own hand-drawn icons (`src/components/HandIcon.tsx`): slightly uneven strokes, a faint pencil second line, a watercolour wash off the line, on hand-cut pebble shapes. Feather stays only for small functional glyphs (chevrons, buttons).
- Achievements: stitched patches with their own drawings (sprout, growing sprouts, sun, wind, footprints, notebook, speech bubble with a heart, compass).
- Sol has little arms, mitten hands and feet on larger sizes; when joyful it waves.
- **Kept, per the user:** Sol's face on the centre tab button, and the overall layout and colours ("it is pretty good").

The rest of this plan (neutral cards, fewer Sol faces, XP labels) is on hold unless the user asks for it.

## What makes it feel gimmicky today

Looked at Home, Practices, Journey and the Sol tab on the web preview:

1. **Fonts.** Headings use Fraunces, a soft, quirky serif; everything else uses Nunito, a rounded font. Together they read as playful and toy-like.
2. **Too many faces.** Sol's face appears in the Home hero, five times in the mood picker, in the Today's focus card, in Sol's reflection, and as the centre tab button. Pip adds a tip bubble on several screens. The characters stop feeling special.
3. **Rainbow cards.** Cards use a different pastel per category (blue, lilac, peach, pink), on a warm gradient background. It's busy rather than calm.
4. **Game cues.** "+2 XP per question · +20 bonus" with a star on every check, "New" pills, and XP in several places push it towards a game.
5. **Uneven details.** Mixed corner radii and shadows, uppercase letter-spaced captions, and quotes and headings in the same decorative serif.

## Direction

Quiet, credible and warm, like a good journal: one clear typeface, a mostly neutral palette with one main colour, and the characters used as moments rather than decoration. Keep the "calm by design" rules (slow motion, gentle words, nothing that pressures).

## 1. Typography (the biggest change)

Two options; **A is recommended**.

| | Option A (recommended) | Option B |
|---|---|---|
| Interface text | **Inter** 400 / 500 / 600 | **Inter** 400 / 500 / 600 |
| Headings | Inter 600, slightly tighter letter-spacing | Inter 600 |
| Affirmation quote, splash wordmark | **Newsreader** (calm editorial serif), used only here | Inter, no serif at all |
| Feel | Warm but professional | Most minimal and "product-like" |

Both are free Google fonts available as `@expo-google-fonts/inter` and `@expo-google-fonts/newsreader` (install with `npx expo install`). Remove Fraunces and Nunito afterwards.

New type scale (in `src/theme/index.ts`, `type`):

| Style | Size / line height | Weight |
|---|---|---|
| hero | 30 / 36 | 600, letter-spacing -0.4 |
| title | 24 / 30 | 600, -0.3 |
| heading | 19 / 26 | 600, -0.1 |
| subheading | 16 / 22 | 600 |
| body | 16 / 24 | 400 |
| bodyStrong | 16 / 24 | 500 |
| small | 14 / 20 | 400 |
| caption | 12 / 16 | 500, sentence case (no uppercase tracking) |
| quote (A only) | 22 / 30 | Newsreader 500, italic optional |

Also: respect the phone's text size setting (cap at about 1.3x for layout safety), and use tabular numbers for streaks and XP.

## 2. Colour and surfaces

- **One main colour** (keep sage `#4F7D5F`) for buttons, links and the active tab. One warm accent (apricot) for highlights such as the streak.
- **Neutral cards.** Warm white cards on the cream background, all with the same 16 px radius, a hairline border and one soft shadow. Category colour moves to a small icon tile on the card, not the whole card.
- **Background.** Plain cream. Keep the time-of-day gradient only behind the Home greeting, and lighter.
- Check text contrast (WCAG AA) in light and dark mode after the change.

## 3. The characters

- **Sol** stays on: the splash, the Sol tab hero, and the chat avatar. Remove it from the mood picker, the focus card and the reflection card.
- **Mood picker:** five simple, consistent face icons (line style) with labels, or five soft colour dots with labels, instead of five Sol faces.
- **Centre tab button:** a clean chat icon in the sage circle instead of Sol's face.
- **Pip** stays where it has a job: onboarding, the first-run tour, Journey (it shows growth), and first-visit tips. Make tips smaller and lighter (a slim inline note with a small Pip), shown once as today.

## 4. Gamification tone

- Remove "+2 XP per question · +20 bonus" and stars from the check cards; show XP only on Journey and as a small "+10 XP" confirmation after an action.
- Replace "New" pills with nothing, or a small dot.
- Keep streaks and levels, worded gently (already the case).

## 5. Components (one pass in `src/components/ui.tsx`)

- **Spacing:** a 4 / 8 px grid; consistent 20 px screen padding and 12 / 16 px gaps.
- **Buttons:** 48 px tall, 14 px radius (not full pills), Inter 600. Primary sage; secondary with a hairline border; text buttons for low emphasis.
- **Cards and list rows:** one card style, one row style with a chevron; remove nested cards (e.g. the activity card inside Today's focus becomes a row).
- **Chips:** smaller, hairline border, no fill until selected.
- **Inputs:** 48 px, 12 px radius, clear focus ring in sage.
- **Headers:** title left-aligned at `title` size; subtitle in `small`.
- **Icons:** keep Feather throughout (same stroke width), 20 px in rows, 18 px in chips.
- **Tab bar:** flat, hairline top border, labels in `caption`, no floating pill.

## 6. Screen by screen

| Screen | Changes |
|---|---|
| Splash | Wordmark in Newsreader (A) or Inter; Sol smaller; shorter. |
| Welcome and onboarding | Keep Pip and the window scene (they work); swap fonts; buttons per the new style. |
| Home | Greeting plus date; mood picker without Sol faces; affirmation as a quiet card with the quote style; Today's focus as one card with an action row; quick start as a 2 x 2 grid of neutral tiles with icon tiles. |
| Practices | Neutral cards with coloured icon tiles; remove XP lines and "New" pills; horizontal breathing cards become a simple list or uniform tiles. |
| Sol tab | Keep the Sol hero; starter prompts as neat rows; conversation list as rows with time and preview. |
| Chat | Bubbles with 18 px radius; user bubble sage, Sol bubble white with hairline; activity cards as compact rows. |
| Journey | Pip and level card stays (it's the growth story); streak and mood chart in neutral cards; tighter numbers. |
| You, Settings, Reminders, Memory | Grouped list rows (iOS-settings style), consistent switches. |

## 7. Order of work

1. Fonts and the type scale (theme only) and check every screen still lays out, about half a day.
2. Colour and surface tokens, card, button, chip and input components, about half a day.
3. Mood picker icons, tab bar, and removing extra Sol faces, a few hours.
4. Screen-by-screen pass (Home, Practices, Sol, Chat, Journey, You), about a day.
5. Check on a real Android phone (fonts render differently from the web), dark mode, large text, and reduced motion; rebuild the APK.

Each step is a separate commit, so any step can be reviewed or rolled back on its own.

## Decisions needed from the user

1. Option A (Inter plus a little Newsreader) or Option B (Inter only)?
2. Mood picker: simple face icons or colour dots?
3. Keep Sol's face on the centre tab button, or use a chat icon?
