const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { hashPhrase } = require('../lib/recoveryPhrase');

const User = {
  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  create({ username, phrase }) {
    const phrase_hash = hashPhrase(phrase);
    const result = db.prepare(
      'INSERT INTO users (username, phrase_hash) VALUES (?, ?)'
    ).run(username, phrase_hash);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  },

  count() {
    return db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  },

  setUdPassword(userId, password) {
    const hash = bcrypt.hashSync(String(password), 10);
    db.prepare('UPDATE users SET ud_password_hash = ? WHERE id = ?').run(hash, userId);
  },

  clearUdPassword(userId) {
    db.prepare('UPDATE users SET ud_password_hash = NULL WHERE id = ?').run(userId);
  },

  verifyUdPassword(user, password) {
    if (!user || !user.ud_password_hash || !password) return false;
    try {
      return bcrypt.compareSync(String(password), user.ud_password_hash);
    } catch (err) {
      return false;
    }
  },

  // Wipe everything tied to a user, then the user row itself. Atomic.
  deleteCompletely(userId) {
    const tx = db.transaction(() => {
      db.prepare(`
        DELETE FROM confession_hearts
        WHERE confession_id IN (SELECT id FROM confessions WHERE user_id = ?)
      `).run(userId);
      db.prepare('DELETE FROM confession_hearts WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM confessions WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM mood_entries WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM companion_facts WHERE user_id = ?').run(userId);
      db.prepare(`
        DELETE FROM survey_responses
        WHERE completion_id IN (SELECT id FROM survey_completions WHERE user_id = ?)
      `).run(userId);
      db.prepare('DELETE FROM survey_completions WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM prediction_votes WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM game_scores WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    });
    tx();
  }
};

module.exports = User;
