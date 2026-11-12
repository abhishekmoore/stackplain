# StackPlain

StackPlain reads a stack trace or application log and turns it into a short translation: the likely cause, what is certain versus what is only guessed, and the first three checks to run.

It is a small TypeScript MERN app: React, Express, MongoDB, and an OpenAI-compatible model. If you do not set a model key, it still runs. The screen is labeled as an offline pattern check, not as a model judgment.

The model is told never to invent line numbers or file names that are not in the paste. The offline checker only reports locations that appear in the text.

## What you can do

- Paste a stack trace or log (at least 20 characters).
- See a likely cause, a list of certain facts, a list of guesses, and exactly three next checks.
- If the log contains a parseable timestamp, it is shown in a clear format.
- Save the note and delete it later.

## Stack

| Piece | Choice |
| --- | --- |
| UI | React 19, TypeScript, Vite, Tailwind CSS |
| API | Express 4, TypeScript, Zod, helmet, cors |
| Data | MongoDB via Mongoose, or an in-memory store |
| Model | `openai` SDK against any compatible base URL |
| Client data | TanStack Query, axios |
| Dates | date-fns |
| Tests | `node:test` through `tsx` |

## Run it

Node 20 or newer.

```bash
cp .env.example .env
npm install
npm run dev
```

Open the Vite URL printed in the terminal (port 5173). The API is on port 4000. Vite proxies `/api` to it.

Production-style, one process:

```bash
npm run build
npm start
```

Then open port 4000. Express serves the built React app.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | API port. Default `4000`. |
| `MONGO_URI` | No | Example: `mongodb://127.0.0.1:27017/stackplain`. If empty, notes live in memory and vanish when the process stops. |
| `OPENAI_API_KEY` | No | If empty, StackPlain uses the offline pattern check. |
| `OPENAI_BASE_URL` | No | Use this for xAI, Groq, OpenRouter, or a local server. |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini`. |

Do not commit `.env`.

## API

`GET /api/health` — `{ ok, store: "memory" \| "mongo", ai: "model" \| "heuristic", model }`

`GET /api/traces?limit=20` — newest first, limit 1–50.

`POST /api/traces` — body `{ logText }`. Text must be 20–20,000 characters. Returns the saved note.

`GET /api/traces/:id`

`DELETE /api/traces/:id` — `204` when removed.

## Scripts

```bash
npm test
npm run typecheck
npm run build
```

GitHub Actions runs those three on every push.

## Limits

- The offline checker only recognizes a few common exception patterns. It will miss domain-specific errors.
- The model can still be wrong. Read the original log before you change code.
- There is no login. Anyone who can reach the server can read saved logs. Do not point this at the public internet with real production traces.

Design notes for someone changing the code are in [DEVELOPER.md](DEVELOPER.md).
