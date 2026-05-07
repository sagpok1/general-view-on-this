const { db } = require('../config/database');

const CompanionFacts = {
  list(user_id) {
    return db.prepare(`
      SELECT id, category, key, value, mention_count, first_seen, last_seen
      FROM companion_facts
      WHERE user_id = ?
      ORDER BY last_seen DESC, id DESC
    `).all(user_id);
  },

  count(user_id) {
    return db.prepare(
      'SELECT COUNT(*) AS c FROM companion_facts WHERE user_id = ?'
    ).get(user_id).c;
  },

  upsert(user_id, { category, key, value }) {
    db.prepare(`
      INSERT INTO companion_facts (user_id, category, key, value)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, key) DO UPDATE SET
        value = excluded.value,
        mention_count = mention_count + 1,
        last_seen = CURRENT_TIMESTAMP
    `).run(user_id, category, key, value);
  },

  upsertMany(user_id, facts) {
    if (!Array.isArray(facts) || !facts.length) return;
    const tx = db.transaction(() => {
      for (const f of facts) CompanionFacts.upsert(user_id, f);
    });
    tx();
  },

  forget(user_id, factId) {
    return db.prepare(
      'DELETE FROM companion_facts WHERE id = ? AND user_id = ?'
    ).run(factId, user_id);
  },

  forgetAll(user_id) {
    return db.prepare(
      'DELETE FROM companion_facts WHERE user_id = ?'
    ).run(user_id);
  }
};

module.exports = CompanionFacts;
