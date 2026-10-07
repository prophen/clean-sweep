# Clean Sweep

Chore speedruns with an AI commentator. Built with Next.js, TypeScript, Postgres, OpenAI text generation, and Deepgram speech.

## Try it locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. Without credentials, practice mode persists records and XP in `.data/game.json` and uses persona-specific caption commentary. It works across page reloads. Local file storage is development-only; production requires Postgres.

## Connect the services

Copy `.env.example` to `.env.local`, then add:

- `DATABASE_URL`: your Neon pooled Postgres connection string (including its SSL parameters).
- `OPENAI_API_KEY`: enables generated commentary; `OPENAI_MODEL` defaults to `gpt-4.1-mini`.
- `DEEPGRAM_API_KEY`: enables spoken commentary. TTS failures retain captions.

```sh
npm run db:setup
npm run dev
```

Database setup is repeatable and preserves records. The app does not create a Neon account or project. Keys stay in server routes. Local practice records are separate from Postgres records.

## The game

Choose one of five chores. The caster introduces the stakes, a visual 3–2–1 countdown starts the timer, and event commentary fires at halfway to par and 30 seconds before par. Finish to save your split, set or beat a PB, earn XP, and update your local-calendar-day streak. The timer measures wall time, including time in another tab. Wake lock is requested when supported and reacquired after returning to the page.

The first run sets a baseline (75 XP on the first day). Later PBs earn a 50 XP bonus. Same-day runs do not increase the streak or earn the daily bonus. Finish requests use a per-attempt UUID for safe retries. Postgres saves run, PB and profile in one transaction, locking the profile for concurrent requests.

Hype Caster and Golf Whisper are available immediately; Drill Sergeant unlocks at level 3. Selection persists in the browser. Pace compares elapsed time to PB (or par before a baseline); it does not estimate actual chore progress. Commentary never measures work completed.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

## Current limits

This is the spec’s single shared player with no authentication. Anyone able to access a deployed instance can change that player’s progress and invoke paid commentary APIs. Keep initial previews private; add request controls before opening it to broad public traffic. Provider audio, Neon persistence, and phone wake lock need testing with your credentials and device. Home-screen installation is supported with a manifest and icons; offline play is not implemented.

Personas and their voice prompts are seeded in Postgres. No history, photo verification, multiplayer, or submission assets are included.

API documentation: [OpenAI chat completions](https://developers.openai.com/api/reference/resources/chat) and [Deepgram single text request](https://developers.deepgram.com/reference/text-to-speech/speak-request).
