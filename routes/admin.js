const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin, validateCsrf } = require('../middleware/auth');
const Review = require('../models/Review');

// GET /admin/reviews — list all pending reviews
router.get('/reviews', isLoggedIn, isAdmin, (req, res) => {
  const pendingReviews = Review.findPending();

  res.render('admin/pending-reviews', {
    title: 'Pending Reviews',
    pendingReviews
  });
});

// POST /admin/reviews/:id/approve — approve a pending review
router.post('/reviews/:id/approve', isLoggedIn, isAdmin, validateCsrf, (req, res) => {
  const reviewId = parseInt(req.params.id, 10);

  try {
    const review = Review.approve(reviewId, req.user.id);

    if (!review) {
      req.session.message = { type: 'error', text: 'Review not found.' };
      return res.redirect('/admin/reviews');
    }

    req.session.message = { type: 'success', text: 'Review approved and published.' };
    return res.redirect('/admin/reviews');
  } catch (err) {
    req.session.message = { type: 'error', text: 'Failed to approve review.' };
    return res.redirect('/admin/reviews');
  }
});

// POST /admin/reviews/:id/reject — reject a pending review
router.post('/reviews/:id/reject', isLoggedIn, isAdmin, validateCsrf, (req, res) => {
  const reviewId = parseInt(req.params.id, 10);

  try {
    const review = Review.reject(reviewId, req.user.id);

    if (!review) {
      req.session.message = { type: 'error', text: 'Review not found.' };
      return res.redirect('/admin/reviews');
    }

    req.session.message = { type: 'success', text: 'Review rejected.' };
    return res.redirect('/admin/reviews');
  } catch (err) {
    req.session.message = { type: 'error', text: 'Failed to reject review.' };
    return res.redirect('/admin/reviews');
  }
});

module.exports = router;
