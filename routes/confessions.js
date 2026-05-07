const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { isLoggedIn, validateCsrf } = require('../middleware/auth');
const Confession = require('../models/Confession');
const ConfessionComment = require('../models/ConfessionComment');
const Mood = require('../models/Mood');
const { checkRisk } = require('../lib/riskDetector');
const { checkAbuse } = require('../lib/abuseDetector');

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
  const reactionsMap = Confession.reactionsFor(req.user.id);
  res.render('confessions/list', {
    title: 'Confessions',
    confessions,
    totals,
    reactionsMap,
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
  const reactionsMap = Confession.reactionsFor(req.user.id);
  res.render('confessions/_cards', {
    confessions,
    reactionsMap,
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

function backToFeed(req) {
  const referer = req.get('referer');
  if (!referer) return '/confessions';
  try {
    const url = new URL(referer);
    if (url.pathname === '/confessions') return url.pathname + url.search;
    if (url.pathname.startsWith('/confessions/')) return url.pathname;
  } catch (err) { /* ignore */ }
  return '/confessions';
}

router.post('/:id/heart', isLoggedIn, validateCsrf, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const confession = Confession.findById(id);
  const backTo = backToFeed(req);
  if (!confession || confession.status !== 'visible') {
    req.session.message = { type: 'error', text: 'Confession not found.' };
    return res.redirect(backTo);
  }
  Confession.setReaction(req.user.id, id, 'heart');
  return res.redirect(backTo);
});

// Multi-reaction endpoint: type is one of heart | support | hopeful.
router.post('/:id/react', isLoggedIn, validateCsrf, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const type = String(req.body.type || '').trim();
  const backTo = backToFeed(req);
  if (!Confession.VALID_REACTIONS.includes(type)) {
    req.session.message = { type: 'error', text: 'Invalid reaction.' };
    return res.redirect(backTo);
  }
  const confession = Confession.findById(id);
  if (!confession || confession.status !== 'visible') {
    req.session.message = { type: 'error', text: 'Confession not found.' };
    return res.redirect(backTo);
  }
  Confession.setReaction(req.user.id, id, type);
  return res.redirect(backTo);
});

// ─── Comments ────────────────────────────────────────────────────────

router.post('/:id/comments', isLoggedIn, validateCsrf, [
  body('body')
    .trim()
    .isLength({ min: 2, max: 800 })
    .withMessage('Comment must be 2–800 characters.')
], (req, res) => {
  const id = parseInt(req.params.id, 10);
  const backTo = `/confessions/${id}#comments`;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.session.message = { type: 'error', text: errors.array()[0].msg };
    return res.redirect(backTo);
  }

  const confession = Confession.findById(id);
  if (!confession || confession.status !== 'visible') {
    req.session.message = { type: 'error', text: 'Confession not found.' };
    return res.redirect('/confessions');
  }

  const text = req.body.body.trim();
  const { score, reason } = checkAbuse(text);

  if (score >= 2) {
    // Block. Don't save. Show a polite-but-firm note.
    req.session.message = {
      type: 'error',
      text: "That comment doesn't meet our community rules — it reads as targeting or attacking someone. Try rephrasing."
    };
    return res.redirect(backTo);
  }

  try {
    ConfessionComment.create({
      confession_id: id,
      user_id: req.user.id,
      body: text,
      abuse_score: score
    });
    if (score >= 1) {
      req.session.message = {
        type: 'info',
        text: "Comment posted, but worth re-reading. Be kind — confessions are vulnerable."
      };
    }
    return res.redirect(backTo);
  } catch (err) {
    console.error('Comment save failed:', err);
    req.session.message = { type: 'error', text: 'Could not post comment. Try again.' };
    return res.redirect(backTo);
  }
});

// Detail view of a single confession with its comments.
router.get('/:id', isLoggedIn, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.redirect('/confessions');
  const confession = Confession.findById(id);
  if (!confession || confession.status !== 'visible') {
    req.session.message = { type: 'error', text: 'Confession not found.' };
    return res.redirect('/confessions');
  }
  const comments = ConfessionComment.list(id);
  const reactions = Confession.reactionsFor(req.user.id);
  const myReaction = reactions.get(id) || null;
  res.render('confessions/detail', {
    title: 'Confession',
    confession,
    comments,
    myReaction
  });
});

module.exports = router;
