const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Survey = require('../models/Survey');
const Credit = require('../models/Credit');
const Business = require('../models/Business');

// GET /dashboard
router.get('/', isLoggedIn, (req, res) => {
  const userId = req.user.id;

  // Fetch credit balance
  const creditBalance = Credit.getBalance(userId);

  // Fetch recent orders (limit 5)
  const recentOrders = Order.findByUserId(userId).slice(0, 5);

  // Fetch available surveys count
  const availableSurveys = Survey.getAvailableForUser(userId);
  const availableSurveysCount = availableSurveys.length;

  // Fetch credit history
  const creditHistory = Credit.getHistory(userId);

  // Build template data
  const templateData = {
    title: 'Dashboard',
    creditBalance,
    recentOrders,
    availableSurveysCount,
    creditHistory
  };

  // If business account, fetch incoming orders count
  if (req.user.account_type === 'business') {
    const business = Business.findByUserId(userId);
    if (business) {
      const incomingOrders = Order.findByBusinessId(business.id);
      templateData.incomingOrdersCount = incomingOrders.length;
      templateData.business = business;
    } else {
      templateData.incomingOrdersCount = 0;
      templateData.business = null;
    }
  }

  res.render('dashboard/home', templateData);
});

module.exports = router;
