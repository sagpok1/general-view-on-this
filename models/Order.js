const { db } = require('../config/database');

const Order = {
  create({ user_id, business_id, items_description, special_notes, credits_spent }) {
    const result = db.prepare(
      `INSERT INTO orders (user_id, business_id, items_description, special_notes, credits_spent)
       VALUES (?, ?, ?, ?, ?)`
    ).run(user_id, business_id, items_description, special_notes || null, credits_spent || 0);

    return db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
  },

  findById(id) {
    return db.prepare(
      `SELECT o.*, b.business_name, u.name AS user_name, u.email AS user_email
       FROM orders o
       JOIN businesses b ON o.business_id = b.id
       JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`
    ).get(id);
  },

  findByUserId(userId) {
    return db.prepare(
      `SELECT o.*, b.business_name
       FROM orders o
       JOIN businesses b ON o.business_id = b.id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC`
    ).all(userId);
  },

  findByBusinessId(businessId) {
    return db.prepare(
      `SELECT o.*, u.name AS user_name, u.email AS user_email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.business_id = ?
       ORDER BY o.created_at DESC`
    ).all(businessId);
  },

  updateStatus(id, status) {
    return db.prepare(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(status, id);
  },

  getStats() {
    const row = db.prepare('SELECT COUNT(*) AS totalOrders FROM orders').get();
    return { totalOrders: row.totalOrders };
  }
};

module.exports = Order;
