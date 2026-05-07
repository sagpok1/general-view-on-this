const { db } = require('../config/database');

const Confession = {
  list({ limit = 50, offset = 0 } = {}) {
    return db.prepare(`
      SELECT c.id, c.body, c.mood_tag, c.hearts, c.created_at, c.user_id, u.username
      FROM confessions c
      JOIN users u ON u.id = c.user_id
      WHERE c.status = 'visible'
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  },

  findById(id) {
    return db.prepare(`
      SELECT c.id, c.body, c.mood_tag, c.hearts, c.status, c.created_at, c.user_id, u.username
      FROM confessions c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
    `).get(id);
  },

  create({ user_id, body, mood_tag, risk_score }) {
    const result = db.prepare(`
      INSERT INTO confessions (user_id, body, mood_tag, risk_score)
      VALUES (?, ?, ?, ?)
    `).run(user_id, body, mood_tag || null, risk_score || 0);
    return Confession.findById(result.lastInsertRowid);
  },

  countByUser(user_id) {
    return db.prepare(
      'SELECT COUNT(*) AS c FROM confessions WHERE user_id = ?'
    ).get(user_id).c;
  },

  hasHearted(user_id, confession_id) {
    return Boolean(db.prepare(
      'SELECT 1 FROM confession_hearts WHERE user_id = ? AND confession_id = ?'
    ).get(user_id, confession_id));
  },

  toggleHeart(user_id, confession_id) {
    const existing = db.prepare(
      'SELECT id FROM confession_hearts WHERE user_id = ? AND confession_id = ?'
    ).get(user_id, confession_id);

    const tx = db.transaction(() => {
      if (existing) {
        db.prepare('DELETE FROM confession_hearts WHERE id = ?').run(existing.id);
        db.prepare('UPDATE confessions SET hearts = MAX(hearts - 1, 0) WHERE id = ?').run(confession_id);
        return false;
      } else {
        db.prepare(
          'INSERT INTO confession_hearts (user_id, confession_id) VALUES (?, ?)'
        ).run(user_id, confession_id);
        db.prepare('UPDATE confessions SET hearts = hearts + 1 WHERE id = ?').run(confession_id);
        return true;
      }
    });
    return tx();
  },

  hide(id) {
    return db.prepare("UPDATE confessions SET status = 'hidden' WHERE id = ?").run(id);
  },

  restore(id) {
    return db.prepare("UPDATE confessions SET status = 'visible' WHERE id = ?").run(id);
  },

  listFlagged({ limit = 100 } = {}) {
    return db.prepare(`
      SELECT c.id, c.body, c.mood_tag, c.risk_score, c.status, c.created_at, c.user_id, u.username
      FROM confessions c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.risk_score >= 2 OR c.status = 'hidden'
      ORDER BY c.risk_score DESC, c.created_at DESC
      LIMIT ?
    `).all(limit);
  },

  totals() {
    const total = db.prepare("SELECT COUNT(*) AS c FROM confessions WHERE status='visible'").get().c;
    const hearts = db.prepare("SELECT COALESCE(SUM(hearts),0) AS s FROM confessions WHERE status='visible'").get().s;
    return { total, hearts };
  }
};

module.exports = Confession;
