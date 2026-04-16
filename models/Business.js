const { db } = require('../config/database');

const Business = {
  findById(id) {
    return db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
  },

  findByUserId(userId) {
    return db.prepare('SELECT * FROM businesses WHERE user_id = ?').get(userId);
  },

  create({ user_id, business_name, category, address, phone, description }) {
    const result = db.prepare(
      `INSERT INTO businesses (user_id, business_name, category, address, phone, description)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(user_id, business_name, category || null, address || null, phone || null, description || null);

    return db.prepare('SELECT * FROM businesses WHERE id = ?').get(result.lastInsertRowid);
  },

  update(id, fields) {
    const allowed = ['business_name', 'category', 'address', 'phone', 'description'];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }

    if (updates.length === 0) return this.findById(id);

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(
      `UPDATE businesses SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values);

    return this.findById(id);
  },

  search(query, category) {
    let sql = 'SELECT * FROM businesses WHERE business_name LIKE ?';
    const params = [`%${query}%`];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    return db.prepare(sql).all(...params);
  },

  getAll() {
    return db.prepare('SELECT * FROM businesses').all();
  },

  updateRating(businessId) {
    const stats = db.prepare(
      `SELECT AVG(rating) AS avg_rating, COUNT(*) AS review_count
       FROM reviews
       WHERE business_id = ? AND status = 'published' AND review_type = 'user_to_business'`
    ).get(businessId);

    db.prepare(
      'UPDATE businesses SET avg_rating = ?, review_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(
      stats.avg_rating ? Math.round(stats.avg_rating * 100) / 100 : 0,
      stats.review_count || 0,
      businessId
    );
  },

  getStats() {
    const row = db.prepare('SELECT COUNT(*) AS totalBusinesses FROM businesses').get();
    return { totalBusinesses: row.totalBusinesses };
  }
};

module.exports = Business;
