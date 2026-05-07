# General View On This

A quiet place on the internet. Anonymous confessions, a grounded AI companion, a daily mood log, plus surveys, predictions and a small arcade.

No email. No password. Sign up by picking a username and saving a 7-word recovery phrase (BIP39 wordlist) — like a crypto wallet. The phrase is your only way back in.

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 4
- **Database:** SQLite via better-sqlite3 (WAL mode)
- **Auth:** Passport.js local strategy, custom 7-word phrase verification (bcrypt-hashed)
- **AI:** Anthropic SDK (Claude Sonnet 4.6) — optional, gracefully falls back to offline mode
- **Templating:** EJS
- **Styling:** Plain CSS

## What's in the app

- **Confessions** — anonymous to the public feed; risk-scanned before posting; admin can hide if needed
- **Companion** — local rule-based listener (no LLM, no API costs). Extracts durable facts from each message (name, age, location, pet, relationships, job, likes/dislikes, fears, milestones), stores them, and weaves them back into future replies. Users can see and delete every remembered fact at `/companion`. Risk-scanned every turn — high risk routes to crisis resources without composing a reply.
- **Mood log** — small daily check-in (happy, okay, sad, anxious, frustrated, numb, hopeful)
- **Surveys / Predictions / Arcade** — kept from v1, decoupled from credits
- **Crisis button** — pinned to every page (988, Samaritans, Lifeline, etc.)

## Quick start

```bash
cd localloop
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000.

On first launch, the seeder creates an `admin` account and prints its 7-word recovery phrase to stdout — copy it from the console. That phrase is shown once.

## Environment

| Variable            | Required | Default                     | Description                                        |
|---------------------|----------|------------------------------|----------------------------------------------------|
| `NODE_ENV`          | No       | `development`                | `production` in deployment                         |
| `PORT`              | No       | `3000`                        |                                                    |
| `SESSION_SECRET`    | Yes (prod) | dev fallback provided      | Cookie-signing secret                              |
| `DB_PATH`           | No       | `./generalviewonthis.db`     | SQLite file path                                   |

## Auth model

- Sign up: pick a username (3–24 chars: `[A-Za-z0-9_-]`), server generates 7 random words from the BIP39 English wordlist (~77 bits of entropy), stores `bcrypt(phrase)`. The plaintext phrase is shown only once.
- Sign in: username + 7-word phrase. Capitalisation and whitespace are normalised. Phrase must contain exactly 7 words from the BIP39 list.
- No email, no password reset, no Google OAuth. Lose the phrase → lose the account.

## Project layout

```
localloop/
├── app.js                  — Express entry point
├── config/
│   ├── database.js         — schema + seed (predictions, surveys, admin user)
│   └── passport.js         — username + phrase strategy
├── lib/
│   ├── recoveryPhrase.js   — generate/normalize/hash/verify 7-word phrase
│   └── riskDetector.js     — keyword + escalation risk scoring (port of companion's risk_detector.py)
├── data/
│   └── crisis_resources.json
├── middleware/auth.js      — isLoggedIn, isAdmin, addUserToLocals, addCsrfToken, validateCsrf
├── models/                 — User, Confession, Mood
├── routes/                 — auth, dashboard, confessions, mood, companion, surveys, predictions, games, admin
├── views/
│   ├── landing.ejs
│   ├── layout/             — header, nav, footer, crisis-button (rendered globally)
│   ├── auth/               — login, register, phrase
│   ├── dashboard/, confessions/, mood/, companion/, admin/, surveys/, predictions/, games/, errors/
└── public/
    ├── css/                — main, components, layout, animations, pages/{auth,dashboard,games,predictions,surveys-v2,surveys}
    └── js/                 — main, survey
```

## Safety notes

- Risk scanning runs before companion replies and on every new confession. Score ≥ 4 (high-risk phrase, e.g. "i want to die") routes the user to crisis resources without composing a reply.
- The crisis button is rendered on every authenticated page via `views/layout/crisis-button.ejs`.
- The companion engine is rule-based ([lib/companionEngine.js](lib/companionEngine.js)). It extracts facts conservatively (false negatives over false positives), classifies emotion by keyword count with priority tie-breaking, and composes a short reply from emotion-matched templates plus an occasional memory weave (~25%). No diagnosis, no medication advice, no roleplay — those rules are encoded in the template space, not in a system prompt.
- Reviews of users/businesses are removed entirely. Confessions are owned internally by the posting user (for moderation) but the public feed shows no usernames.

## Deploying

The app is deployed on a DigitalOcean droplet (`/opt/general-view-on-this`, PM2 process `gvot`). After pulling the new code on the server:

```bash
cd /opt/general-view-on-this
git pull
npm install --production
# Wipe the old DB once — schema is incompatible with v1
rm -f generalviewonthis.db generalviewonthis.db-shm generalviewonthis.db-wal sessions.db
pm2 restart gvot
pm2 logs gvot --lines 30   # capture the admin recovery phrase printed on first start
```

## License

MIT
