const { db } = require('../config/database');

const User = {
  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  findByGoogleId(googleId) {
    return db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
  },

  create({ email, password_hash, google_id, name, account_type, avatar_url }) {
    const result = db.prepare(
      `INSERT INTO users (email, password_hash, google_id, name, account_type, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(email, password_hash || null, google_id || null, name, account_type || 'user', avatar_url || null);

    return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  },

  updateCredits(userId, amount) {
    return db.prepare(
      'UPDATE users SET credits = credits + ? WHERE id = ?'
    ).run(amount, userId);
  },

  updateProfile(userId, { name, bio, avatar_url }) {
    return db.prepare(
      'UPDATE users SET name = ?, bio = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(name, bio || null, avatar_url || null, userId);
  },

  getStats() {
    const row = db.prepare('SELECT COUNT(*) AS totalUsers FROM users').get();
    return { totalUsers: row.totalUsers };
  }
};

module.exports = User;
