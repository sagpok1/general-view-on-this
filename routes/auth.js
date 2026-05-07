const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { db } = require('../config/database');
const { generatePhrase, PHRASE_LENGTH, verifyPhrase, isValidPhrase } = require('../lib/recoveryPhrase');

const USERNAME_RE = /^[a-z0-9_-]{3,24}$/i;

router.get('/login', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Log in', errors: [], formData: {} });
});

router.post('/login', (req, res, next) => {
  const input = String(req.body.phrase || '');

  if (!input.trim()) {
    return res.render('auth/login', {
      title: 'Log in',
      errors: [{ msg: 'Recovery phrase is required.' }],
      formData: {}
    });
  }

  // Phrase-only login. We don't have an indexed lookup (the phrase is
  // bcrypt-hashed, no plaintext stored), so we iterate every user and
  // bcrypt-compare. Fine for our scale; if user count grows past a few
  // thousand we'd add a fast SHA-256 fingerprint column for O(1) lookup.
  const allUsers = db.prepare('SELECT * FROM users').all();

  // 1) Try as a recovery phrase.
  for (const u of allUsers) {
    if (verifyPhrase(input, u.phrase_hash)) {
      return req.logIn(u, (loginErr) => {
        if (loginErr) return next(loginErr);
        req.session.message = { type: 'success', text: `Welcome back, ${u.username}.` };
        return res.redirect('/dashboard');
      });
    }
  }

  // 2) Try as an urgent-delete password. Match → silently wipe + redirect
  //    to the landing page. No flash, no error — looks identical to a
  //    rejected attempt to anyone watching over a shoulder.
  for (const u of allUsers) {
    if (User.verifyUdPassword(u, input)) {
      try {
        User.deleteCompletely(u.id);
      } catch (deleteErr) {
        console.error('UD delete failed:', deleteErr);
      }
      return req.session.destroy(() => {
        res.clearCookie('gvot.sid');
        res.redirect('/');
      });
    }
  }

  return res.render('auth/login', {
    title: 'Log in',
    errors: [{ msg: 'Recovery phrase is incorrect.' }],
    formData: {}
  });
});

router.get('/register', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Create account', errors: [], formData: {} });
});

const REQUIRED_CONSENTS = ['c_age', 'c_not_therapy', 'c_safety', 'c_conduct', 'c_terms'];

router.post('/register', [
  body('username')
    .trim()
    .matches(USERNAME_RE)
    .withMessage('Username must be 3–24 characters: letters, numbers, underscore or hyphen.')
], (req, res) => {
  const errors = validationResult(req);

  // All five consent boxes must be ticked. Server-side check; the
  // client-side disabled-button is a UX nicety, not security.
  const missingConsent = REQUIRED_CONSENTS.some((k) => !req.body[k]);
  if (missingConsent) {
    errors.errors.push({ msg: 'Please read and accept all five terms before continuing.' });
  }

  if (!errors.isEmpty()) {
    return res.render('auth/register', {
      title: 'Create account',
      errors: errors.array(),
      formData: req.body
    });
  }

  const username = req.body.username.trim();
  if (User.findByUsername(username)) {
    return res.render('auth/register', {
      title: 'Create account',
      errors: [{ msg: 'That username is taken. Try another one.' }],
      formData: req.body
    });
  }

  const phrase = generatePhrase();
  try {
    const user = User.create({ username, phrase });
    User.markConsented(user.id);
    req.login(user, (err) => {
      if (err) {
        req.session.message = { type: 'error', text: 'Account created. Please log in.' };
        return res.redirect('/auth/login');
      }
      return res.render('auth/phrase', {
        title: 'Save your recovery phrase',
        username: user.username,
        phrase,
        phraseLength: PHRASE_LENGTH
      });
    });
  } catch (err) {
    return res.render('auth/register', {
      title: 'Create account',
      errors: [{ msg: 'Something went wrong creating your account. Try again.' }],
      formData: req.body
    });
  }
});

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      req.session.message = { type: 'error', text: 'Error logging out.' };
      return res.redirect('/dashboard');
    }
    req.session.destroy(() => {
      res.clearCookie('gvot.sid');
      res.redirect('/');
    });
  });
});

module.exports = router;
