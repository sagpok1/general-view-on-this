const { db } = require('../config/database');

const Prediction = {
  findAll() {
    return db.prepare(
      'SELECT * FROM predictions ORDER BY status ASC, close_date ASC, id DESC'
    ).all();
  },

  findById(id) {
    return db.prepare('SELECT * FROM predictions WHERE id = ?').get(id);
  },

  getOptions(predictionId) {
    return db.prepare(
      'SELECT * FROM prediction_options WHERE prediction_id = ? ORDER BY order_index'
    ).all(predictionId);
  },

  getOptionsWithCounts(predictionId) {
    return db.prepare(`
      SELECT po.id, po.label, po.order_index,
             (SELECT COUNT(*) FROM prediction_votes pv WHERE pv.option_id = po.id) AS vote_count
      FROM prediction_options po
      WHERE po.prediction_id = ?
      ORDER BY po.order_index
    `).all(predictionId);
  },

  getTotalVotes(predictionId) {
    return db.prepare(
      'SELECT COUNT(*) AS c FROM prediction_votes WHERE prediction_id = ?'
    ).get(predictionId).c;
  },

  getUserVote(userId, predictionId) {
    return db.prepare(
      'SELECT option_id FROM prediction_votes WHERE user_id = ? AND prediction_id = ?'
    ).get(userId, predictionId);
  },

  vote(userId, predictionId, optionId) {
    // Verify option belongs to this prediction.
    const opt = db.prepare(
      'SELECT id FROM prediction_options WHERE id = ? AND prediction_id = ?'
    ).get(optionId, predictionId);
    if (!opt) throw new Error('Invalid option for this prediction.');

    db.prepare(`
      INSERT INTO prediction_votes (user_id, prediction_id, option_id)
      VALUES (?, ?, ?)
    `).run(userId, predictionId, optionId);
  },

  listWithSummary(userId) {
    const rows = db.prepare(`
      SELECT p.*,
             (SELECT COUNT(*) FROM prediction_votes v WHERE v.prediction_id = p.id) AS total_votes,
             (SELECT option_id FROM prediction_votes v WHERE v.prediction_id = p.id AND v.user_id = ?) AS my_option_id
      FROM predictions p
      ORDER BY CASE WHEN p.status = 'open' THEN 0 ELSE 1 END, p.close_date ASC, p.id DESC
    `).all(userId);

    const getLead = db.prepare(`
      SELECT po.id, po.label,
             (SELECT COUNT(*) FROM prediction_votes v WHERE v.option_id = po.id) AS c
      FROM prediction_options po
      WHERE po.prediction_id = ?
      ORDER BY c DESC, po.order_index ASC
      LIMIT 1
    `);

    for (const r of rows) {
      const lead = getLead.get(r.id);
      r.leading_label = lead ? lead.label : null;
      r.leading_pct = lead && r.total_votes > 0 ? Math.round((lead.c / r.total_votes) * 100) : 0;
    }
    return rows;
  }
};

module.exports = Prediction;
