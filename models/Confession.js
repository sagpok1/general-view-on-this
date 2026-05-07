const { db } = require('../config/database');

const Confession = {
  list({ limit = 20, offset = 0, mood = null, sort = 'newest', userId = null } = {}) {
    const filters = ["c.status = 'visible'"];
    const params = [];

    if (mood && typeof mood === 'string' && mood.trim()) {
      filters.push('LOWER(c.mood_tag) = ?');
      params.push(mood.toLowerCase().trim());
    }

    if (sort === 'mine' && userId) {
      filters.push('c.user_id = ?');
      params.push(userId);
    }

    const orderBy = sort === 'hearts'
      ? '(c.hearts + c.reactions_support + c.reactions_hopeful) DESC, c.created_at DESC'
      : 'c.created_at DESC';

    const sql = `
      SELECT c.id, c.body, c.mood_tag, c.hearts,
             COALESCE(c.reactions_support, 0)  AS reactions_support,
             COALESCE(c.reactions_hopeful, 0)  AS reactions_hopeful,
             COALESCE(c.comment_count, 0)      AS comment_count,
             c.created_at, c.user_id, u.username
      FROM confessions c
      JOIN users u ON u.id = c.user_id
      WHERE ${filters.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    return db.prepare(sql).all(...params, limit, offset);
  },

  // Returns a Set of confession IDs the given user has hearted (any reaction).
  heartedIdsFor(userId) {
    const rows = db.prepare(
      'SELECT confession_id FROM confession_hearts WHERE user_id = ?'
    ).all(userId);
    return new Set(rows.map((r) => r.confession_id));
  },

  // Returns a Map of confession_id → reaction_type for the given user.
  reactionsFor(userId) {
    const rows = db.prepare(
      'SELECT confession_id, reaction_type FROM confession_hearts WHERE user_id = ?'
    ).all(userId);
    const m = new Map();
    rows.forEach((r) => m.set(r.confession_id, r.reaction_type || 'heart'));
    return m;
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

  // Reaction columns mirror reaction_type values for fast aggregate display.
  REACTION_COLUMN: {
    heart:   'hearts',
    support: 'reactions_support',
    hopeful: 'reactions_hopeful'
  },
  VALID_REACTIONS: ['heart', 'support', 'hopeful'],

  // Toggle a reaction. One reaction per (user, confession). Picking a new
  // type replaces the old one (decrements old, increments new). Picking
  // the same type again removes it.
  setReaction(user_id, confession_id, type) {
    if (!Confession.VALID_REACTIONS.includes(type)) {
      throw new Error('invalid reaction');
    }
    const newColumn = Confession.REACTION_COLUMN[type];

    const tx = db.transaction(() => {
      const existing = db.prepare(
        'SELECT id, reaction_type FROM confession_hearts WHERE user_id = ? AND confession_id = ?'
      ).get(user_id, confession_id);

      if (existing && existing.reaction_type === type) {
        // Same reaction → toggle off
        db.prepare('DELETE FROM confession_hearts WHERE id = ?').run(existing.id);
        db.prepare(`UPDATE confessions SET ${newColumn} = MAX(${newColumn} - 1, 0) WHERE id = ?`).run(confession_id);
        return null;
      }

      if (existing) {
        // Different reaction → swap
        const oldColumn = Confession.REACTION_COLUMN[existing.reaction_type] || 'hearts';
        db.prepare(`UPDATE confessions SET ${oldColumn} = MAX(${oldColumn} - 1, 0) WHERE id = ?`).run(confession_id);
        db.prepare('UPDATE confession_hearts SET reaction_type = ? WHERE id = ?').run(type, existing.id);
        db.prepare(`UPDATE confessions SET ${newColumn} = ${newColumn} + 1 WHERE id = ?`).run(confession_id);
        return type;
      }

      // No prior reaction → insert
      db.prepare(
        'INSERT INTO confession_hearts (user_id, confession_id, reaction_type) VALUES (?, ?, ?)'
      ).run(user_id, confession_id, type);
      db.prepare(`UPDATE confessions SET ${newColumn} = ${newColumn} + 1 WHERE id = ?`).run(confession_id);
      return type;
    });
    return tx();
  },

  // Backwards-compat: heart toggle keeps working as 'heart' reaction.
  toggleHeart(user_id, confession_id) {
    return Confession.setReaction(user_id, confession_id, 'heart');
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
