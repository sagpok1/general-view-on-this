const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'generalviewonthis.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function ensureUserColumn(name, sql) {
  const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!cols.includes(name)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${name} ${sql}`);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    phrase_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS confessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    mood_tag TEXT,
    risk_score INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'visible',
    hearts INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_confessions_status_created
    ON confessions (status, created_at DESC);

  CREATE TABLE IF NOT EXISTS confession_hearts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    confession_id INTEGER NOT NULL REFERENCES confessions(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, confession_id)
  );

  CREATE TABLE IF NOT EXISTS mood_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    mood TEXT NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_mood_entries_user_created
    ON mood_entries (user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    risk_score INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
    ON chat_messages (user_id, created_at);

  CREATE TABLE IF NOT EXISTS companion_facts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    mention_count INTEGER NOT NULL DEFAULT 1,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, key)
  );
  CREATE INDEX IF NOT EXISTS idx_facts_user_seen
    ON companion_facts (user_id, last_seen DESC);

  CREATE TABLE IF NOT EXISTS surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS survey_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id INTEGER NOT NULL REFERENCES surveys(id),
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL,
    options TEXT,
    order_index INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS survey_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    survey_id INTEGER NOT NULL REFERENCES surveys(id),
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, survey_id)
  );

  CREATE TABLE IF NOT EXISTS survey_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    completion_id INTEGER NOT NULL REFERENCES survey_completions(id),
    question_id INTEGER NOT NULL REFERENCES survey_questions(id),
    response_text TEXT
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    close_date TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS prediction_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prediction_id INTEGER NOT NULL REFERENCES predictions(id),
    label TEXT NOT NULL,
    order_index INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS prediction_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    prediction_id INTEGER NOT NULL REFERENCES predictions(id),
    option_id INTEGER NOT NULL REFERENCES prediction_options(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, prediction_id)
  );

  CREATE TABLE IF NOT EXISTS game_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    game TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

ensureUserColumn('ud_password_hash', 'TEXT');

function seedPredictions() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM predictions').get();
  if (row.c > 0) return;

  const insertPrediction = db.prepare(`
    INSERT INTO predictions (title, description, category, close_date, status)
    VALUES (?, ?, ?, ?, 'open')
  `);
  const insertOption = db.prepare(`
    INSERT INTO prediction_options (prediction_id, label, order_index)
    VALUES (?, ?, ?)
  `);

  const seeds = [
    {
      title: 'Will the world feel kinder a year from now?',
      description: 'Community gut-check on whether the next 12 months bring more compassion or less.',
      category: 'community',
      close_date: '2027-05-07',
      options: ['Kinder', 'About the same', 'Less kind']
    },
    {
      title: "What's the most healing thing for a hard week?",
      description: 'A vibe check on what people actually find restorative.',
      category: 'wellness',
      close_date: '2026-12-31',
      options: ['Rest and quiet', 'Time with people who get me', 'Nature', 'Creative work', 'A hard workout']
    },
    {
      title: 'Will remote work stay above 30% of jobs in 2026?',
      description: 'Share of remote/hybrid jobs through end of year.',
      category: 'work',
      close_date: '2026-12-31',
      options: ['Yes, stays above 30%', 'No, drops below']
    },
    {
      title: 'Which platform will Gen Z use most by year-end?',
      description: 'Pick the platform with the largest under-25 share by December.',
      category: 'tech',
      close_date: '2026-12-31',
      options: ['TikTok', 'Instagram', 'YouTube', 'Snapchat', 'Something new']
    },
    {
      title: "Will it be easier or harder to make new friends as an adult by 2027?",
      description: 'Predict the trend in adult friendships over the next year.',
      category: 'community',
      close_date: '2027-05-07',
      options: ['Easier', 'About the same', 'Harder']
    },
    {
      title: 'Which streaming service will gain the most subscribers in 2026?',
      description: 'Predict the biggest streaming winner among US viewers.',
      category: 'entertainment',
      close_date: '2026-12-31',
      options: ['Netflix', 'Disney+', 'Max', 'Apple TV+', 'Amazon Prime']
    },
    {
      title: 'Will AI make us more or less lonely by 2027?',
      description: 'A community read on AI and human connection.',
      category: 'tech',
      close_date: '2027-05-07',
      options: ['Less lonely', 'Same', 'More lonely']
    }
  ];

  const tx = db.transaction(() => {
    for (const p of seeds) {
      const r = insertPrediction.run(p.title, p.description, p.category, p.close_date);
      const pid = r.lastInsertRowid;
      p.options.forEach((label, i) => insertOption.run(pid, label, i));
    }
  });
  tx();
  console.log(`Seeded ${seeds.length} predictions.`);
}

function seedSurveys() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM surveys').get();
  if (row.c > 0) return;

  const insertSurvey = db.prepare(`
    INSERT INTO surveys (title, description, category, is_active)
    VALUES (?, ?, ?, 1)
  `);
  const insertQuestion = db.prepare(`
    INSERT INTO survey_questions (survey_id, question_text, question_type, options, order_index)
    VALUES (?, ?, ?, ?, ?)
  `);

  const seeds = [
    {
      title: 'How are you really doing this week?',
      description: 'A quick weekly check-in. No right or wrong answers.',
      category: 'wellness',
      questions: [
        { text: 'Overall, how would you rate this week?', type: 'rating', options: null },
        { text: 'Which feeling has been loudest?', type: 'multiple_choice', options: JSON.stringify(['Calm', 'Tired', 'Anxious', 'Sad', 'Hopeful', 'Numb']) },
        { text: 'Did you do something kind for yourself this week?', type: 'multiple_choice', options: JSON.stringify(['Yes, often', 'Once or twice', 'Tried to', 'Not really']) },
        { text: 'What is one small thing that made this week a little lighter?', type: 'text', options: null }
      ]
    },
    {
      title: 'What helps you when things get heavy?',
      description: 'Share what works for you so others can learn from it.',
      category: 'wellness',
      questions: [
        { text: 'When you feel overwhelmed, what helps most?', type: 'multiple_choice', options: JSON.stringify(['Walking outside', 'Talking to someone', 'Quiet time alone', 'Music', 'Movement / exercise', 'Writing']) },
        { text: 'Rate how supported you feel by people around you.', type: 'rating', options: null },
        { text: 'Have you tried any grounding or breathing techniques?', type: 'multiple_choice', options: JSON.stringify(['Yes, regularly', 'A few times', 'Once', 'Never', 'What is that?']) },
        { text: 'What would you tell someone going through what you went through?', type: 'text', options: null }
      ]
    },
    {
      title: 'Sleep, energy, and rest',
      description: 'How is your relationship with rest right now?',
      category: 'wellness',
      questions: [
        { text: 'Roughly how many hours of sleep do you get most nights?', type: 'multiple_choice', options: JSON.stringify(['Under 5', '5–6', '7–8', '9+']) },
        { text: 'Rate the quality of your sleep this past week.', type: 'rating', options: null },
        { text: 'What gets in the way of rest most?', type: 'multiple_choice', options: JSON.stringify(['Overthinking at night', 'Phone/screens', 'Work or school stress', 'Caffeine', 'Nothing — I sleep well']) },
        { text: 'What does a perfect day of rest look like for you?', type: 'text', options: null }
      ]
    },
    {
      title: 'Friendships and feeling seen',
      description: 'Connection check-in.',
      category: 'community',
      questions: [
        { text: 'Roughly how many people in your life truly "get" you?', type: 'multiple_choice', options: JSON.stringify(['None right now', '1', '2–3', '4–6', '7+']) },
        { text: 'Rate how often you feel lonely in an average week.', type: 'rating', options: null },
        { text: 'When did you last feel really seen by someone?', type: 'text', options: null }
      ]
    },
    {
      title: 'What you want from a confession space',
      description: 'Help shape what this place becomes.',
      category: 'meta',
      questions: [
        { text: 'What do you most want from a place like this?', type: 'multiple_choice', options: JSON.stringify(['To get something off my chest', 'To know I am not alone', 'To listen and support others', 'To track how I feel over time', 'Just to read and observe']) },
        { text: 'Rate how comfortable you feel sharing here so far.', type: 'rating', options: null },
        { text: 'What would make this feel safer or kinder?', type: 'text', options: null }
      ]
    }
  ];

  const tx = db.transaction(() => {
    for (const s of seeds) {
      const r = insertSurvey.run(s.title, s.description, s.category);
      const sid = r.lastInsertRowid;
      s.questions.forEach((q, i) => insertQuestion.run(sid, q.text, q.type, q.options, i + 1));
    }
  });
  tx();
  console.log(`Seeded ${seeds.length} surveys.`);
}

function seedAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (existing) return;

  const { generatePhrase, hashPhrase } = require('../lib/recoveryPhrase');
  const phrase = generatePhrase();
  const phrase_hash = hashPhrase(phrase);

  db.prepare(
    'INSERT INTO users (username, phrase_hash, is_admin) VALUES (?, ?, 1)'
  ).run('admin', phrase_hash);

  console.log('');
  console.log('  ╭───────────────────────────────────────────────────────────╮');
  console.log('  │  ADMIN ACCOUNT CREATED                                    │');
  console.log('  │  Username: admin                                          │');
  console.log(`  │  Phrase:   ${phrase.padEnd(46)} │`);
  console.log('  │  Save this — it is shown only once.                       │');
  console.log('  ╰───────────────────────────────────────────────────────────╯');
  console.log('');
}

function seedData() {
  seedPredictions();
  seedSurveys();
  seedAdmin();
}

module.exports = { db, seedData };
