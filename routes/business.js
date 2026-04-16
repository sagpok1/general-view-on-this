const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { isLoggedIn, isBusinessAccount, validateCsrf } = require('../middleware/auth');
const Business = require('../models/Business');
const Order = require('../models/Order');
const Credit = require('../models/Credit');
const User = require('../models/User');
const Review = require('../models/Review');

// GET /business/dashboard — business owner dashboard
router.get('/dashboard', isLoggedIn, isBusinessAccount, (req, res) => {
  const business = Business.findByUserId(req.user.id);

  if (!business) {
    req.session.message = { type: 'error', text: 'Business profile not found. Please contact support.' };
    return res.redirect('/dashboard');
  }

  // Get incoming orders, sorted with pending first
  const allOrders = Order.findByBusinessId(business.id);
  const pendingOrders = allOrders.filter(o => o.status === 'pending');
  const otherOrders = allOrders.filter(o => o.status !== 'pending');
  const incomingOrders = [...pendingOrders, ...otherOrders];

  // Get credit info
  const creditBalance = Credit.getBalance(req.user.id);
  const creditHistory = Credit.getHistory(req.user.id);

  res.render('business/dashboard', {
    title: 'Business Dashboard',
    business,
    incomingOrders,
    creditBalance,
    creditHistory
  });
});

// GET /business/orders — all orders for this business
router.get('/orders', isLoggedIn, isBusinessAccount, (req, res) => {
  const business = Business.findByUserId(req.user.id);

  if (!business) {
    req.session.message = { type: 'error', text: 'Business profile not found.' };
    return res.redirect('/dashboard');
  }

  const orders = Order.findByBusinessId(business.id);

  res.render('business/orders', {
    title: 'Business Orders',
    business,
    orders
  });
});

// POST /business/orders/:id — update order status
router.post('/orders/:id', isLoggedIn, isBusinessAccount, validateCsrf, (req, res) => {
  const order = Order.findById(req.params.id);

  if (!order) {
    req.session.message = { type: 'error', text: 'Order not found.' };
    return res.redirect('/business/orders');
  }

  // Verify order belongs to this business
  const business = Business.findByUserId(req.user.id);
  if (!business || order.business_id !== business.id) {
    req.session.message = { type: 'error', text: 'You are not authorized to update this order.' };
    return res.redirect('/business/orders');
  }

  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];

  if (!validStatuses.includes(status)) {
    req.session.message = { type: 'error', text: 'Invalid order status.' };
    return res.redirect('/business/orders');
  }

  Order.updateStatus(order.id, status);
  req.session.message = { type: 'success', text: `Order #${order.id} status updated to ${status}.` };
  return res.redirect('back');
});

// GET /business/review-customer/:userId — form to review a customer
router.get('/review-customer/:userId', isLoggedIn, isBusinessAccount, (req, res) => {
  const targetUserId = parseInt(req.params.userId, 10);
  const customer = User.findById(targetUserId);

  if (!customer) {
    req.session.message = { type: 'error', text: 'Customer not found.' };
    return res.redirect('/business/orders');
  }

  res.render('business/review-customer', {
    title: `Review Customer: ${customer.name}`,
    customer,
    errors: []
  });
});

// POST /business/review-customer/:userId — submit customer review
router.post('/review-customer/:userId', isLoggedIn, isBusinessAccount, validateCsrf, [
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
    const customer = User.findById(targetUserId);
    return res.render('business/review-customer', {
      title: customer ? `Review Customer: ${customer.name}` : 'Review Customer',
      customer: customer || {},
      errors: errors.array()
    });
  }

  const targetUser = User.findById(targetUserId);
  if (!targetUser) {
    req.session.message = { type: 'error', text: 'Customer not found.' };
    return res.redirect('/business/orders');
  }

  const business = Business.findByUserId(req.user.id);
  if (!business) {
    req.session.message = { type: 'error', text: 'Business profile not found.' };
    return res.redirect('/dashboard');
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
    return res.redirect('/business/orders');
  } catch (err) {
    req.session.message = { type: 'error', text: 'Failed to submit review. Please try again.' };
    return res.redirect(`/business/review-customer/${targetUserId}`);
  }
});

module.exports = router;
