const express = require('express');
const router = express.Router();
const { isLoggedIn, validateCsrf } = require('../middleware/auth');
const { verifyPhrase } = require('../lib/recoveryPhrase');
const User = require('../models/User');

router.get('/', isLoggedIn, (req, res) => {
  const user = User.findById(req.user.id);
  res.render('settings/index', {
    title: 'Settings',
    user,
    udSet: Boolean(user.ud_password_hash)
  });
});

router.post('/ud-password', isLoggedIn, validateCsrf, (req, res) => {
  const user = User.findById(req.user.id);
  const phrase = String(req.body.phrase || '');
  const newPassword = String(req.body.new_password || '');
  const confirm = String(req.body.confirm_password || '');

  if (!verifyPhrase(phrase, user.phrase_hash)) {
    req.session.message = { type: 'error', text: 'Recovery phrase did not match. Nothing changed.' };
    return res.redirect('/settings');
  }
  if (newPassword.length < 4 || newPassword.length > 200) {
    req.session.message = { type: 'error', text: 'Urgent-delete password must be 4–200 characters.' };
    return res.redirect('/settings');
  }
  if (newPassword !== confirm) {
    req.session.message = { type: 'error', text: 'The two password entries did not match.' };
    return res.redirect('/settings');
  }
  if (verifyPhrase(newPassword, user.phrase_hash)) {
    req.session.message = { type: 'error', text: 'The urgent-delete password cannot be your recovery phrase.' };
    return res.redirect('/settings');
  }

  User.setUdPassword(req.user.id, newPassword);
  req.session.message = { type: 'success', text: 'Urgent-delete password saved. Keep it somewhere only you can find.' };
  return res.redirect('/settings');
});

router.post('/ud-password/clear', isLoggedIn, validateCsrf, (req, res) => {
  const user = User.findById(req.user.id);
  const phrase = String(req.body.phrase || '');

  if (!verifyPhrase(phrase, user.phrase_hash)) {
    req.session.message = { type: 'error', text: 'Recovery phrase did not match. Nothing changed.' };
    return res.redirect('/settings');
  }

  User.clearUdPassword(req.user.id);
  req.session.message = { type: 'success', text: 'Urgent-delete password removed.' };
  return res.redirect('/settings');
});

module.exports = router;
