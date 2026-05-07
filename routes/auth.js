const express = require('express');
const router = express.Router();
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { generatePhrase, PHRASE_LENGTH } = require('../lib/recoveryPhrase');

const USERNAME_RE = /^[a-z0-9_-]{3,24}$/i;

router.get('/login', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Log in', errors: [], formData: {} });
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);

    if (user) {
      return req.logIn(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        req.session.message = { type: 'success', text: `Welcome back, ${user.username}.` };
        return res.redirect('/dashboard');
      });
    }

    // Phrase didn't match. Before failing, check if the input is the user's
    // urgent-delete password. If so, silently wipe the account and redirect to
    // the landing page — no message that would tip off an observer.
    const inputUsername = String(req.body.username || '').trim();
    const inputSecret = String(req.body.phrase || '');

    if (inputUsername && inputSecret) {
      const candidate = User.findByUsername(inputUsername);
      if (candidate && User.verifyUdPassword(candidate, inputSecret)) {
        try {
          User.deleteCompletely(candidate.id);
        } catch (deleteErr) {
          console.error('UD delete failed:', deleteErr);
        }
        // Drop session entirely if there's one. No flash message — landing page only.
        return req.session.destroy(() => {
          res.clearCookie('gvot.sid');
          res.redirect('/');
        });
      }
    }

    return res.render('auth/login', {
      title: 'Log in',
      errors: [{ msg: (info && info.message) || 'Username or phrase is incorrect.' }],
      formData: { username: req.body.username }
    });
  })(req, res, next);
});

router.get('/register', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Create account', errors: [], formData: {} });
});

router.post('/register', [
  body('username')
    .trim()
    .matches(USERNAME_RE)
    .withMessage('Username must be 3–24 characters: letters, numbers, underscore or hyphen.')
], (req, res) => {
  const errors = validationResult(req);
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
