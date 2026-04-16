const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { isLoggedIn, isBusinessAccount, validateCsrf } = require('../middleware/auth');
const Business = require('../models/Business');
const Review = require('../models/Review');
const User = require('../models/User');

// GET /reviews — search businesses to review
router.get('/', (req, res) => {
  const { search } = req.query;
  let businesses = [];

  if (search && search.trim()) {
    businesses = Business.search(search.trim());
  }

  res.render('reviews/search', {
    title: 'Reviews',
    businesses,
    query: search || ''
  });
});

// GET /reviews/business/:id — view business profile with reviews
router.get('/business/:id', (req, res) => {
  const businessId = parseInt(req.params.id, 10);
  const business = Business.findById(businessId);

  if (!business) {
    req.session.message = { type: 'error', text: 'Business not found.' };
    return res.redirect('/reviews');
  }

  const reviews = Review.findByBusinessId(businessId);
  const rating = Review.getBusinessRating(businessId);

  res.render('reviews/business-profile', {
    title: business.business_name,
    business,
    reviews,
    rating
  });
});

// POST /reviews/business/:id — submit a review for a business
router.post('/business/:id', isLoggedIn, validateCsrf, [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5.'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Review title is required.')
    .isLength({ max: 200 })
    .withMessage('Title must be under 200 characters.'),
  body('body')
    .trim()
    .notEmpty()
    .withMessage('Review body is required.')
    .isLength({ max: 2000 })
    .withMessage('Review must be under 2000 characters.')
], (req, res) => {
  const businessId = parseInt(req.params.id, 10);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const business = Business.findById(businessId);
    const reviews = Review.findByBusinessId(businessId);
    const rating = Review.getBusinessRating(businessId);

    return res.render('reviews/business-profile', {
      title: business ? business.business_name : 'Business',
      business: business || {},
      reviews,
      rating,
      errors: errors.array(),
      formData: req.body
    });
  }

  const business = Business.findById(businessId);
  if (!business) {
    req.session.message = { type: 'error', text: 'Business not found.' };
    return res.redirect('/reviews');
  }

  try {
    Review.create({
      reviewer_id: req.user.id,
      business_id: businessId,
      rating: parseInt(req.body.rating, 10),
      title: req.body.title.trim(),
      body: req.body.body.trim(),
      review_type: 'user_to_business'
    });

    req.session.message = { type: 'success', text: 'Review submitted successfully!' };
    return res.redirect(`/reviews/business/${businessId}`);
  } catch (err) {
    req.session.message = { type: 'error', text: 'Failed to submit review. Please try again.' };
    return res.redirect(`/reviews/business/${businessId}`);
  }
});

// POST /reviews/customer/:userId — business reviews a customer (pending admin approval)
router.post('/customer/:userId', isLoggedIn, isBusinessAccount, validateCsrf, [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5.'),
  body('title')
    .trim()
    .optional()
    .isLength({ max: 200 })
    .withMessage('Title must be under 200 characters.'),
  body('body')
    .trim()
    .notEmpty()
    .withMessage('Review body is required.')
    .isLength({ max: 2000 })
    .withMessage('Review must be under 2000 characters.')
], (req, res) => {
  const targetUserId = parseInt(req.params.userId, 10);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    req.session.message = { type: 'error', text: errors.array()[0].msg };
    return res.redirect('back');
  }

  const targetUser = User.findById(targetUserId);
  if (!targetUser) {
    req.session.message = { type: 'error', text: 'Customer not found.' };
    return res.redirect('/business/dashboard');
  }

  const business = Business.findByUserId(req.user.id);
  if (!business) {
    req.session.message = { type: 'error', text: 'Business profile not found.' };
    return res.redirect('/business/dashboard');
  }

  try {
    Review.create({
      reviewer_id: req.user.id,
      business_id: business.id,
      rating: parseInt(req.body.rating, 10),
      title: req.body.title ? req.body.title.trim() : null,
      body: req.body.body.trim(),
      review_type: 'business_to_user',
      target_user_id: targetUserId
    });

    req.session.message = {
      type: 'success',
      text: 'Customer review submitted. It is pending admin approval before it will be visible.'
    };
    return res.redirect('back');
  } catch (err) {
    req.session.message = { type: 'error', text: 'Failed to submit review. Please try again.' };
    return res.redirect('back');
  }
});

module.exports = router;
