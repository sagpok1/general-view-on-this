const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { isLoggedIn, validateCsrf } = require('../middleware/auth');
const Confession = require('../models/Confession');
const Mood = require('../models/Mood');
const { checkRisk } = require('../lib/riskDetector');

router.get('/', isLoggedIn, (req, res) => {
  const confessions = Confession.list({ limit: 100 });
  const totals = Confession.totals();
  const heartedIds = new Set(
    confessions
      .filter((c) => Confession.hasHearted(req.user.id, c.id))
      .map((c) => c.id)
  );
  res.render('confessions/list', {
    title: 'Confessions',
    confessions,
    totals,
    heartedIds,
    moods: Mood.VALID_MOODS
  });
});

router.get('/new', isLoggedIn, (req, res) => {
  res.render('confessions/new', {
    title: 'New confession',
    moods: Mood.VALID_MOODS,
    errors: [],
    formData: {}
  });
});

router.post('/', isLoggedIn, validateCsrf, [
  body('body')
    .trim()
    .notEmpty().withMessage('Confessions cannot be empty.')
    .isLength({ min: 4, max: 2000 }).withMessage('Keep it between 4 and 2000 characters.'),
  body('mood_tag').optional().trim().isLength({ max: 30 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('confessions/new', {
      title: 'New confession',
      moods: Mood.VALID_MOODS,
      errors: errors.array(),
      formData: req.body
    });
  }

  const text = req.body.body.trim();
  const mood = (req.body.mood_tag || '').trim().toLowerCase() || null;

  const { score, reason } = checkRisk(text);

  if (score >= 4) {
    return res.render('confessions/crisis', {
      title: 'Are you safe right now?',
      reason,
      attemptedBody: text
    });
  }

  try {
    Confession.create({
      user_id: req.user.id,
      body: text,
      mood_tag: mood,
      risk_score: score
    });
    if (score >= 2) {
      req.session.message = {
        type: 'info',
        text: 'Your confession is up. If things feel heavy, the help button on every page is there for you.'
      };
    } else {
      req.session.message = { type: 'success', text: 'Your confession is up.' };
    }
    return res.redirect('/confessions');
  } catch (err) {
    return res.render('confessions/new', {
      title: 'New confession',
      moods: Mood.VALID_MOODS,
      errors: [{ msg: 'Could not save. Try again.' }],
      formData: req.body
    });
  }
});

router.post('/:id/heart', isLoggedIn, validateCsrf, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const confession = Confession.findById(id);
  if (!confession || confession.status !== 'visible') {
    req.session.message = { type: 'error', text: 'Confession not found.' };
    return res.redirect('/confessions');
  }
  Confession.toggleHeart(req.user.id, id);
  return res.redirect('/confessions');
});

module.exports = router;
