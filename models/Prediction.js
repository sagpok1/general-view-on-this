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

    const getAllOptions = db.prepare(`
      SELECT po.id, po.label, po.order_index,
             (SELECT COUNT(*) FROM prediction_votes v WHERE v.option_id = po.id) AS c
      FROM prediction_options po
      WHERE po.prediction_id = ?
      ORDER BY c DESC, po.order_index ASC
    `);

    for (const r of rows) {
      const all = getAllOptions.all(r.id);
      r.option_count = all.length;
      r.top_options = all.slice(0, 2).map(function(o) {
        return {
          id: o.id,
          label: o.label,
          count: o.c,
          pct: r.total_votes > 0 ? Math.round((o.c / r.total_votes) * 100) : 0,
          is_mine: o.id === r.my_option_id
        };
      });
      r.leading_label = all[0] ? all[0].label : null;
      r.leading_pct = all[0] && r.total_votes > 0 ? Math.round((all[0].c / r.total_votes) * 100) : 0;
    }
    return rows;
  },

  getOverallStats() {
    const t = db.prepare('SELECT COUNT(*) AS c FROM predictions').get().c;
    const v = db.prepare('SELECT COUNT(*) AS c FROM prediction_votes').get().c;
    const u = db.prepare('SELECT COUNT(DISTINCT user_id) AS c FROM prediction_votes').get().c;
    return { totalPredictions: t, totalVotes: v, uniqueVoters: u };
  }
};

module.exports = Prediction;
