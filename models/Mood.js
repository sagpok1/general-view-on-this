const { db } = require('../config/database');

const VALID_MOODS = ['happy', 'okay', 'sad', 'anxious', 'frustrated', 'numb', 'hopeful'];

const Mood = {
  VALID_MOODS,

  log({ user_id, mood, note }) {
    if (!VALID_MOODS.includes(mood)) {
      throw new Error('Invalid mood');
    }
    const result = db.prepare(`
      INSERT INTO mood_entries (user_id, mood, note) VALUES (?, ?, ?)
    `).run(user_id, mood, note || null);
    return db.prepare('SELECT * FROM mood_entries WHERE id = ?').get(result.lastInsertRowid);
  },

  recent(user_id, limit = 30) {
    return db.prepare(`
      SELECT id, mood, note, created_at
      FROM mood_entries
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(user_id, limit);
  },

  latest(user_id) {
    return db.prepare(`
      SELECT id, mood, note, created_at
      FROM mood_entries
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(user_id);
  },

  countByUser(user_id) {
    return db.prepare(
      'SELECT COUNT(*) AS c FROM mood_entries WHERE user_id = ?'
    ).get(user_id).c;
  }
};

module.exports = Mood;
