# Clean Sweep: Chore Speedruns with an AI Commentator

Hackyard Yard #4 entry. Solo build, one week. Kickoff Mon Oct 5, 2026, 11:00 AM PDT.
Builder: Codex (not the Hermes coder bot). Stack: Next.js + TypeScript + Neon Postgres + OpenAI + Deepgram TTS.

## The concept

Speedrunning, but for chores. Pick a chore, hit start, race your personal best while an
AI commentator calls the run like it's esports. Finish and you get your split, your
delta vs PB, XP, and a streak update.

The hook that makes it a game instead of a timer: the commentator. It knows your PB,
your par time, and whether you're on pace, and it reacts. That is the whole product.
Everything else is scaffolding around that moment.

## Game loop

1. **Pick a chore.** Kitchen clean, bathroom reset, laundry fold, vacuum the living room,
   dishes. Each has a par time (a sane target, seeded) and your PB (empty at first).
2. **Hit START.** Commentator does a 3-2-1 countdown and a hype intro naming the chore,
   the par, and your PB.
3. **Run the chore.** Timer counts up. Commentary fires at fixed events (see below).
   Big mute button always visible. Text captions mirror every voice line.
4. **Hit FINISH.** Commentator reacts based on the result: new PB gets a celebration,
   a miss gets a light roast plus encouragement, first-ever run gets a "baseline set" call.
5. **Results screen.** Final time, delta vs previous PB, XP earned, level progress,
   streak day count. One-tap "run it back" button.

## Commentary events (the core mechanic)

Commentary is event-driven, not continuous. Live play-by-play every 10 seconds would be
expensive and annoying. These five events are the whole design:

| Event | Trigger | Commentator job |
|---|---|---|
| `run_start` | Timer starts | Countdown, hype intro, state the stakes (par, PB) |
| `halfway` | Elapsed passes 50% of par | Pace check: ahead/behind, encouragement or urgency |
| `final_push` | 30 seconds remain before par | Urgency ramp, crowd-energy |
| `finish_pb` | Finish and new PB | Celebration, name the new record |
| `finish_miss` | Finish, no PB | Light roast, encouragement, gap to PB |
| `streak_milestone` | 3/7/14/30 day streak | Special callout at run start |

Text generation: OpenAI, fast small model, persona system prompt + run context
(chore name, par, PB, current pace, streak). Keep prompts tight: 1-2 sentences per line,
spoken cadence, no stage directions in the output.

Voice: Deepgram TTS (credits already available). Generate audio per line at event time,
play immediately. Every line also renders as a caption so mute still works.
Fallback: if TTS fails, text-only mode, no crash.

Personas (seed 3, unlock by level): Hype Caster (default), Golf Whisper (quiet, dry),
Drill Sergeant (unlock level 3). Each persona is a row: name, system prompt, voice id,
unlock level.

## Data model (Neon Postgres)

Connect with `DATABASE_URL` in `.env.local`. All queries run in Next.js API routes
(server-side only); the key never touches the client.

```sql
-- Chores: the arenas
create table chores (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- 'Kitchen clean'
  room text not null,                 -- 'Kitchen'
  par_seconds int not null,           -- 720
  icon text not null default 'sparkles',
  sort_order int not null default 0
);

-- Every run ever
create table runs (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid references chores(id) not null,
  duration_seconds int not null,
  started_at timestamptz not null default now(),
  beat_pb boolean not null default false,
  xp_earned int not null default 0
);

-- One row per chore, updated on PB
create table personal_bests (
  chore_id uuid primary key references chores(id),
  best_seconds int not null,
  run_id uuid references runs(id),
  achieved_at timestamptz not null default now()
);

-- Single player profile (no auth in v1, one row)
create table profile (
  id int primary key default 1 check (id = 1),
  display_name text not null default 'Player 1',
  total_xp int not null default 0,
  level int not null default 1,
  current_streak_days int not null default 0,
  longest_streak_days int not null default 0,
  last_run_date date
);

-- Commentator personas
create table personas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text not null,
  system_prompt text not null,
  voice_id text not null,             -- Deepgram voice id
  unlock_level int not null default 1,
  is_default boolean not null default false
);
```

XP rules (keep simple, tune later):
- Finish a run: 50 XP
- New PB: +50 XP
- Streak day (first run of the day): +25 XP
- Level thresholds: L1 0, L2 200, L3 500, L4 1000, L5 1750, L6 2750 (roughly quadratic)

Streak: `last_run_date` vs today. Same day = no change. Yesterday = +1. Older = reset to 1.

## API routes (Next.js)

- `GET /api/chores` -> chores with current PB joined
- `POST /api/runs/start` -> creates run row at start (or keep in memory, persist on finish; simpler: persist on finish only)
- `POST /api/runs/finish` -> { chore_id, duration_seconds } -> computes beat_pb, xp, streak, level-up; returns everything the results screen needs
- `POST /api/commentary` -> { event, persona_id, context } -> { text, audio_url } ; generate text via OpenAI, TTS via Deepgram, return audio as data URL or short-lived storage object
- `GET /api/profile` -> profile + unlocked personas

Decision: persist the run only on finish. A run with no finish is not a run. Simpler and honest.

## Mobile-first design

This is a phone-on-the-counter app. Design for a phone held or propped up mid-chore,
not a desk.

- Run screen: giant timer, giant FINISH button (thumb reachable, min 72px target),
  captions large enough to read at arm's length.
- Keep the screen awake during a run (Wake Lock API) so the timer doesn't sleep
  mid-chore. Release it on finish.
- Audio-first: the commentator should carry the experience, since the user is often
  not looking at the screen. Captions are the fallback, not the primary channel.
- Pace indicator as color + a single word ("AHEAD" / "BEHIND"), glanceable in under
  a second. No fine print mid-run.
- Mobile web is fine for v1, but make it installable: manifest + apple-touch-icon so
  it feels like an app from the home screen. No app store, no native wrapper.

## UI screens (4 total, keep it tight)

1. **Home / chore select.** Chore cards: name, par, your PB, "best split" delta. Profile header: level, XP bar, streak flame.
2. **Run screen.** Big timer, chore name, live pace indicator (ahead/behind par as a color, no numbers needed mid-run), commentary caption feed, mute toggle, giant FINISH button. This screen should feel like a broadcast.
3. **Results screen.** Time, delta vs old PB, NEW PB badge if earned, XP breakdown, streak update, Run It Back button.
4. **Personas screen.** Locked/unlocked commentator cards, select active voice.

No auth, no settings page, no history page in v1. History is a stretch goal.

## Codex build order

Day 1 (Mon): Scaffold Next.js + Tailwind, create the Neon project, run the SQL above, seed 5 chores
with pars and 3 personas. Get `/api/chores` and the home screen rendering real data.
Day 2 (Tue): Timer + run screen + `POST /api/runs/finish` with PB/XP/streak/level logic.
Results screen. The game is playable with text commentary by end of day.
Day 3 (Wed): `POST /api/commentary` with OpenAI text generation wired to all events.
Captions on the run screen. Tune prompts until the lines sound like a caster, not a robot.
Day 4 (Thu): Deepgram TTS wired in, mute toggle, audio preloading on run start so the
countdown has zero lag. Personas screen.
Day 5 (Fri): Polish the run screen broadcast feel (pace colors, transitions, PB badge
animation). Playtest for real: actually clean your kitchen on camera.
Day 6 (Sat): Demo video. Record 2-3 real runs, keep the best 90 seconds. Write the
submission blurb from the actual footage, not from the plan.
Day 7 (Sun): Buffer. Fix whatever broke on Saturday. Submit.

## Explicit scope cuts (do not build these)

- No auth, no multiplayer, no leaderboards. Solo game, one player.
- No photo verification of chore completion. Honor system; the game is against yourself.
- No run history page. PBs and streaks are the only memory the game needs.
- No live continuous commentary. Five events, that's the design.
- No native app. Mobile web is fine; the timer runs in the browser.

## Demo notes

The demo is one real chore, start to finish, with the commentator audible. Record the
screen with system audio. The PB celebration moment is the clip. Before you record or
present, do two checks with the sound on: confirm the commentary actually plays at every
event, and confirm the captions alone still carry the demo if you mute mid-run. If the
TTS misbehaves live, the captions carry it.
