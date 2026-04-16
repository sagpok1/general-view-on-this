const { db } = require('../config/database');

const Review = {
  create({ reviewer_id, business_id, rating, title, body, review_type, target_user_id }) {
    const status = review_type === 'business_to_user' ? 'pending_verification' : 'published';

    const result = db.prepare(
      `INSERT INTO reviews (reviewer_id, business_id, rating, title, body, review_type, target_user_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      reviewer_id,
      business_id || null,
      rating,
      title || null,
      body,
      review_type,
      target_user_id || null,
      status
    );

    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid);

    if (review_type === 'user_to_business' && status === 'published' && business_id) {
      const Business = require('./Business');
      Business.updateRating(business_id);
    }

    return review;
  },

  findByBusinessId(businessId) {
    return db.prepare(
      `SELECT r.*, u.name AS reviewer_name
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.business_id = ? AND r.status = 'published'
       ORDER BY r.created_at DESC`
    ).all(businessId);
  },

  findByUserId(userId) {
    return db.prepare(
      `SELECT r.*, u.name AS reviewer_name
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.target_user_id = ? AND r.status = 'published'
       ORDER BY r.created_at DESC`
    ).all(userId);
  },

  findPending() {
    return db.prepare(
      `SELECT r.*,
              reviewer.name AS reviewer_name,
              target.name AS target_user_name
       FROM reviews r
       JOIN users reviewer ON r.reviewer_id = reviewer.id
       LEFT JOIN users target ON r.target_user_id = target.id
       WHERE r.status = 'pending_verification'
       ORDER BY r.created_at DESC`
    ).all();
  },

  approve(reviewId, adminId) {
    db.prepare(
      `UPDATE reviews
       SET status = 'published', verified_at = CURRENT_TIMESTAMP, verified_by = ?
       WHERE id = ?`
    ).run(adminId, reviewId);

    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);

    if (review && review.business_id) {
      const Business = require('./Business');
      Business.updateRating(review.business_id);
    }

    return review;
  },

  reject(reviewId, adminId) {
    db.prepare(
      `UPDATE reviews
       SET status = 'rejected', verified_at = CURRENT_TIMESTAMP, verified_by = ?
       WHERE id = ?`
    ).run(adminId, reviewId);

    return db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
  },

  getBusinessRating(businessId) {
    const result = db.prepare(
      `SELECT AVG(rating) AS avg, COUNT(*) AS count
       FROM reviews
       WHERE business_id = ? AND status = 'published' AND review_type = 'user_to_business'`
    ).get(businessId);

    return {
      avg: result.avg ? Math.round(result.avg * 100) / 100 : 0,
      count: result.count || 0
    };
  }
};

module.exports = Review;
