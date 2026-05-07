const { db } = require('../config/database');

const ConfessionComment = {
  list(confession_id) {
    return db.prepare(`
      SELECT cc.id, cc.body, cc.status, cc.created_at, cc.user_id, u.username
      FROM confession_comments cc
      JOIN users u ON u.id = cc.user_id
      WHERE cc.confession_id = ? AND cc.status = 'visible'
      ORDER BY cc.created_at ASC
    `).all(confession_id);
  },

  count(confession_id) {
    return db.prepare(
      "SELECT COUNT(*) AS c FROM confession_comments WHERE confession_id = ? AND status = 'visible'"
    ).get(confession_id).c;
  },

  create({ confession_id, user_id, body, abuse_score = 0, status = 'visible' }) {
    const tx = db.transaction(() => {
      const r = db.prepare(`
        INSERT INTO confession_comments (confession_id, user_id, body, abuse_score, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(confession_id, user_id, body, abuse_score, status);

      if (status === 'visible') {
        db.prepare(
          'UPDATE confessions SET comment_count = comment_count + 1 WHERE id = ?'
        ).run(confession_id);
      }
      return r.lastInsertRowid;
    });
    return tx();
  },

  hide(commentId) {
    const row = db.prepare('SELECT confession_id, status FROM confession_comments WHERE id = ?').get(commentId);
    if (!row || row.status !== 'visible') return;
    const tx = db.transaction(() => {
      db.prepare("UPDATE confession_comments SET status = 'hidden' WHERE id = ?").run(commentId);
      db.prepare('UPDATE confessions SET comment_count = MAX(0, comment_count - 1) WHERE id = ?').run(row.confession_id);
    });
    tx();
  },

  flagged({ limit = 100 } = {}) {
    return db.prepare(`
      SELECT cc.id, cc.body, cc.status, cc.abuse_score, cc.created_at,
             cc.confession_id, cc.user_id, u.username
      FROM confession_comments cc
      LEFT JOIN users u ON u.id = cc.user_id
      WHERE cc.abuse_score >= 2 OR cc.status = 'hidden'
      ORDER BY cc.abuse_score DESC, cc.created_at DESC
      LIMIT ?
    `).all(limit);
  }
};

module.exports = ConfessionComment;
