const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { isLoggedIn, validateCsrf } = require('../middleware/auth');
const Confession = require('../models/Confession');
const Mood = require('../models/Mood');
const { checkRisk } = require('../lib/riskDetector');

const PAGE_SIZE = 20;

function parseFeedParams(query) {
  const validSorts = ['newest', 'hearts', 'mine'];
  return {
    mood: query.mood ? String(query.mood).toLowerCase().trim() : null,
    sort: validSorts.includes(query.sort) ? query.sort : 'newest',
    offset: Math.max(0, parseInt(query.offset, 10) || 0)
  };
}

router.get('/', isLoggedIn, (req, res) => {
  const { mood, sort, offset } = parseFeedParams(req.query);
  const confessions = Confession.list({
    limit: PAGE_SIZE,
    offset,
    mood,
    sort,
    userId: req.user.id
  });
  const totals = Confession.totals();
  const heartedIds = Confession.heartedIdsFor(req.user.id);
  res.render('confessions/list', {
    title: 'Confessions',
    confessions,
    totals,
    heartedIds,
    moods: Mood.VALID_MOODS,
    activeMood: mood,
    activeSort: sort,
    pageSize: PAGE_SIZE,
    offset
  });
});

// HTML fragment endpoint for infinite scroll. Returns just the card list HTML.
router.get('/page', isLoggedIn, (req, res) => {
  const { mood, sort, offset } = parseFeedParams(req.query);
  const confessions = Confession.list({
    limit: PAGE_SIZE,
    offset,
    mood,
    sort,
    userId: req.user.id
  });
  const heartedIds = Confession.heartedIdsFor(req.user.id);
  res.render('confessions/_cards', {
    confessions,
    heartedIds,
    csrfToken: res.locals.csrfToken,
    currentUser: req.user
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

  // Preserve filter/sort from where the user came from so the redirect
  // doesn't kick them back to the top of the unfiltered feed.
  let backTo = '/confessions';
  const referer = req.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      if (url.pathname === '/confessions') backTo = url.pathname + url.search;
    } catch (err) { /* ignore malformed referer */ }
  }

  if (!confession || confession.status !== 'visible') {
    req.session.message = { type: 'error', text: 'Confession not found.' };
    return res.redirect(backTo);
  }
  Confession.toggleHeart(req.user.id, id);
  return res.redirect(backTo);
});

module.exports = router;
