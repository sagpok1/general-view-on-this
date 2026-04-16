const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { isLoggedIn, isBusinessAccount, validateCsrf } = require('../middleware/auth');
const Business = require('../models/Business');
const Order = require('../models/Order');
const Credit = require('../models/Credit');

// GET /orders — browse businesses
router.get('/', isLoggedIn, (req, res) => {
  const { search, category } = req.query;
  let businesses;

  if (search || category) {
    businesses = Business.search(search || '', category || null);
  } else {
    businesses = Business.getAll();
  }

  res.render('orders/browse', {
    title: 'Browse Businesses',
    businesses,
    query: search || '',
    category: category || ''
  });
});

// GET /orders/my — user's orders
router.get('/my', isLoggedIn, (req, res) => {
  const orders = Order.findByUserId(req.user.id);

  res.render('orders/my-orders', {
    title: 'My Orders',
    orders
  });
});

// GET /orders/create/:businessId — order form
router.get('/create/:businessId', isLoggedIn, (req, res) => {
  const business = Business.findById(req.params.businessId);

  if (!business) {
    req.session.message = { type: 'error', text: 'Business not found.' };
    return res.redirect('/orders');
  }

  const creditBalance = Credit.getBalance(req.user.id);

  res.render('orders/create', {
    title: `Order from ${business.business_name}`,
    business,
    userCredits: creditBalance,
    errors: []
  });
});

// POST /orders — create an order
router.post('/', isLoggedIn, validateCsrf, [
  body('business_id')
    .isInt()
    .withMessage('Invalid business.'),
  body('items')
    .trim()
    .notEmpty()
    .withMessage('Please describe what you would like to order.')
    .isLength({ max: 1000 })
    .withMessage('Description must be under 1000 characters.'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Special notes must be under 500 characters.'),
  body('credits_spent')
    .isInt({ min: 1 })
    .withMessage('Credits to spend must be at least 1.')
], (req, res) => {
  const errors = validationResult(req);
  const { business_id, items, notes, credits_spent } = req.body;

  if (!errors.isEmpty()) {
    const business = Business.findById(business_id);
    const creditBalance = Credit.getBalance(req.user.id);
    return res.render('orders/create', {
      title: business ? `Order from ${business.business_name}` : 'Create Order',
      business: business || {},
      userCredits: creditBalance,
      errors: errors.array()
    });
  }

  // Check user has enough credits
  const balance = Credit.getBalance(req.user.id);
  const amount = parseInt(credits_spent, 10);

  if (balance < amount) {
    const business = Business.findById(business_id);
    return res.render('orders/create', {
      title: business ? `Order from ${business.business_name}` : 'Create Order',
      business: business || {},
      creditBalance: balance,
      errors: [{ msg: 'You do not have enough credits for this order.' }]
    });
  }

  try {
    // Deduct credits
    Credit.spendCredits(req.user.id, amount, business_id);

    // Create the order
    Order.create({
      user_id: req.user.id,
      business_id: parseInt(business_id, 10),
      items_description: items,
      special_notes: notes || null,
      credits_spent: amount
    });

    req.session.message = { type: 'success', text: 'Order placed successfully!' };
    return res.redirect('/orders/my');
  } catch (err) {
    req.session.message = { type: 'error', text: err.message || 'Failed to place order.' };
    return res.redirect(`/orders/create/${business_id}`);
  }
});

// POST /orders/:id/status — update order status (business owner only)
router.post('/:id/status', isLoggedIn, isBusinessAccount, (req, res) => {
  const order = Order.findById(req.params.id);

  if (!order) {
    req.session.message = { type: 'error', text: 'Order not found.' };
    return res.redirect('/business/orders');
  }

  // Verify the order belongs to the user's business
  const business = Business.findByUserId(req.user.id);
  if (!business || order.business_id !== business.id) {
    req.session.message = { type: 'error', text: 'You are not authorized to update this order.' };
    return res.redirect('/business/orders');
  }

  const { status } = req.body;
  const validStatuses = ['pending', 'accepted', 'ready', 'completed', 'declined'];

  if (!validStatuses.includes(status)) {
    req.session.message = { type: 'error', text: 'Invalid order status.' };
    return res.redirect('/business/orders');
  }

  Order.updateStatus(order.id, status);
  req.session.message = { type: 'success', text: `Order status updated to ${status}.` };
  return res.redirect('back');
});

module.exports = router;
