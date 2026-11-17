# Brick — handoff for a new Claude session

A workout log that runs as a home-screen web app (Samsung Galaxy S23). The owner is not a developer: they ask for changes in plain language, you make them, test them, publish them, and say briefly what changed and what you could not test.

## Where it lives
- Code: GitHub `potato789456/brick`, branch `main` (public). Local folder: `Documents\Brick`.
- Live app: https://potato789456.github.io/brick/ (GitHub Pages, updates about a minute after a push).

## How it is built
Plain HTML/CSS/JS, no build step, no frameworks. Scripts load in this order:
- `data.js`: equipment, plates, exercises (`EX`, keyed by permanent ids: never rename a key), days (`DAYS`), rotation, evening back routine, quotes.
- `logic.js`: loads you can actually build (`loadsFor`), progression (`suggest`), last performance lookup.
- `brick.js`: the mascot and the wall, as inline SVG.
- `cloud.js`: automatic cloud backup with a 16-character recovery code (Firebase, plain web requests, anonymous sign-in). Uses Brick's own Firebase project `brick-620c8` (anonymous sign-in on, Firestore in production mode), collection `brick_backups`. If a change needs a new collection or rule, give the owner the exact rule text to paste into Firestore > Rules, and wait until they say it is published.
- `app.js`: state, views (Home / Wall / Back / Me, plus workout, done, back-routine player), actions.

All data is in localStorage under `brick.v1` (object `S`). `normalize()` fills in missing fields. Never rename the key or break the shape of existing data.

`sw.js` is the offline cache. EVERY publish: raise the cache name by one (now `brick-v2`) and add any new file to SHELL.

## Rules the owner chose (keep them)
- Rotation, not calendar weeks: Push → Pull → Legs. Upper is a bonus day that does not move the rotation. No guilt for missed days.
- Each exercise shows what was done last time (however long ago) and a suggestion for today.
- Only suggest weights that can be built: machine (all cable/stack exercises) 20–50 kg in 5 kg steps; barbell 10 kg, EZ bar 8 kg (any plates); dumbbell handles 2 kg, both ends equal and both dumbbells equal; 5/15/20 kg plates only on bars. Plates: 2×20, 2×15, 2×5, 4×3, 8×2.5, 8×2, 8×1. Dumbbell weights are per dumbbell.
- Owner is cutting: matching last time counts as a win. Progression uses only logged reps (no effort or pain buttons, owner chose that). Missed target → same target again. Stall note after 3 sessions without improvement. No warm-up sets, weekly-sets or body-weight features (owner declined).
- Lower back: chronic low back pain with L4/L5 nerve-root irritation, positive straight-leg raise. No hamstring stretching, no squat/RDL in the default plan. MRI pending; the evening back routine should be revisited after it. Not medical advice.
- Original Hormozi-style lines spread across the app (not verbatim quotes).
