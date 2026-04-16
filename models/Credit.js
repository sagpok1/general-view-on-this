const { db } = require('../config/database');

const Credit = {
  getBalance(userId) {
    const row = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
    return row ? row.credits : 0;
  },

  getHistory(userId) {
    return db.prepare(
      'SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId);
  },

  addTransaction({ user_id, amount, reason, reference_id }) {
    const result = db.prepare(
      `INSERT INTO credit_transactions (user_id, amount, reason, reference_id)
       VALUES (?, ?, ?, ?)`
    ).run(user_id, amount, reason, reference_id || null);

    return db.prepare('SELECT * FROM credit_transactions WHERE id = ?').get(result.lastInsertRowid);
  },

  spendCredits(userId, amount, referenceId) {
    const spend = db.transaction(() => {
      const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);

      if (!user || user.credits < amount) {
        throw new Error('Insufficient credits');
      }

      db.prepare(
        'UPDATE users SET credits = credits - ? WHERE id = ?'
      ).run(amount, userId);

      db.prepare(
        `INSERT INTO credit_transactions (user_id, amount, reason, reference_id)
         VALUES (?, ?, 'order_placed', ?)`
      ).run(userId, -amount, referenceId || null);

      const updated = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
      return updated.credits;
    });

    return spend();
  },

  earnCredits(userId, amount, reason, referenceId) {
    const earn = db.transaction(() => {
      db.prepare(
        'UPDATE users SET credits = credits + ? WHERE id = ?'
      ).run(amount, userId);

      db.prepare(
        `INSERT INTO credit_transactions (user_id, amount, reason, reference_id)
         VALUES (?, ?, ?, ?)`
      ).run(userId, amount, reason, referenceId || null);

      const updated = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
      return updated.credits;
    });

    return earn();
  }
};

module.exports = Credit;
