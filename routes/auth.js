const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Business = require('../models/Business');

// GET /auth/login
router.get('/login', (req, res) => {
  res.render('auth/login', {
    title: 'Log In',
    errors: []
  });
});

// POST /auth/login
router.post('/login', [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required.')
], (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.render('auth/login', {
      title: 'Log In',
      errors: errors.array(),
      email: req.body.email
    });
  }

  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      req.session.message = { type: 'error', text: info.message || 'Login failed.' };
      return res.redirect('/auth/login');
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return next(loginErr);
      }
      req.session.message = { type: 'success', text: 'Welcome back!' };
      return res.redirect('/dashboard');
    });
  })(req, res, next);
});

// GET /auth/register
router.get('/register', (req, res) => {
  res.render('auth/register', {
    title: 'Create Account',
    errors: [],
    formData: {}
  });
});

// POST /auth/register
router.post('/register', [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters.'),
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long.'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match.');
      }
      return true;
    }),
  body('account_type')
    .optional()
    .isIn(['personal', 'business'])
    .withMessage('Invalid account type.'),
  body('business_name')
    .if(body('account_type').equals('business'))
    .trim()
    .notEmpty()
    .withMessage('Business name is required for business accounts.'),
  body('category')
    .if(body('account_type').equals('business'))
    .optional()
    .trim()
], (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.render('auth/register', {
      title: 'Create Account',
      errors: errors.array(),
      formData: req.body
    });
  }

  const { name, email, password, account_type, business_name, category, address, phone, description } = req.body;

  // Check if email already exists
  const existingUser = User.findByEmail(email);
  if (existingUser) {
    return res.render('auth/register', {
      title: 'Create Account',
      errors: [{ msg: 'An account with this email already exists.' }],
      formData: req.body
    });
  }

  try {
    const password_hash = bcrypt.hashSync(password, 10);
    const user = User.create({
      email,
      password_hash,
      name,
      account_type: account_type || 'personal'
    });

    // If business account, create the business profile
    if (account_type === 'business' && business_name) {
      Business.create({
        user_id: user.id,
        business_name,
        category: category || null,
        address: address || null,
        phone: phone || null,
        description: description || null
      });
    }

    // Log the user in automatically
    req.login(user, (err) => {
      if (err) {
        req.session.message = { type: 'error', text: 'Account created but login failed. Please log in manually.' };
        return res.redirect('/auth/login');
      }
      req.session.message = { type: 'success', text: 'Account created successfully! Welcome to General View On This.' };
      return res.redirect('/dashboard');
    });
  } catch (err) {
    return res.render('auth/register', {
      title: 'Create Account',
      errors: [{ msg: 'An error occurred during registration. Please try again.' }],
      formData: req.body
    });
  }
});

// GET /auth/google
router.get('/google', (req, res, next) => {
  if (!passport._strategy('google')) {
    req.session.message = { type: 'error', text: 'Google sign-in is not configured. Please use email login.' };
    return res.redirect('/auth/login');
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// GET /auth/google/callback
router.get('/google/callback', (req, res, next) => {
  if (!passport._strategy('google')) {
    return res.redirect('/auth/login');
  }
  passport.authenticate('google', {
    failureRedirect: '/auth/login',
    failureMessage: true
  })(req, res, () => {
    req.session.message = { type: 'success', text: 'Signed in with Google successfully!' };
    res.redirect('/dashboard');
  });
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      req.session.message = { type: 'error', text: 'Error logging out.' };
      return res.redirect('/dashboard');
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error('Session destroy error:', destroyErr);
      }
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });
});

module.exports = router;
