const express = require('express');
const router = express.Router();
const { isLoggedIn, validateCsrf } = require('../middleware/auth');
const Mood = require('../models/Mood');

router.get('/', isLoggedIn, (req, res) => {
  const entries = Mood.recent(req.user.id, 60);
  res.render('mood/index', {
    title: 'Mood log',
    entries,
    moods: Mood.VALID_MOODS,
    latest: entries[0] || null
  });
});

router.post('/', isLoggedIn, validateCsrf, (req, res) => {
  const mood = String(req.body.mood || '').toLowerCase().trim();
  const note = (req.body.note || '').trim().slice(0, 500) || null;

  if (!Mood.VALID_MOODS.includes(mood)) {
    req.session.message = { type: 'error', text: 'Pick a valid mood.' };
    return res.redirect('/mood');
  }

  try {
    Mood.log({ user_id: req.user.id, mood, note });
    req.session.message = { type: 'success', text: 'Mood logged.' };
  } catch (err) {
    req.session.message = { type: 'error', text: 'Could not log mood.' };
  }
  return res.redirect(req.body.redirect || '/mood');
});

module.exports = router;
