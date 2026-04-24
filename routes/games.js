const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const { db } = require('../config/database');

const GAMES = [
  {
    slug: 'flappy',
    name: 'Flappy Flight',
    tagline: 'Tap to flap. Dodge the pipes.',
    color: 'var(--gradient-cool)'
  },
  {
    slug: 'slicer',
    name: 'Fruit Slicer',
    tagline: 'Slash the fruit, dodge the bombs.',
    color: 'var(--gradient-warm)'
  },
  {
    slug: 'race',
    name: 'Lane Racer',
    tagline: 'Weave through traffic. Don\'t crash.',
    color: 'var(--gradient-fresh)'
  }
];

function topScore(game) {
  const row = db.prepare(
    'SELECT MAX(score) AS s FROM game_scores WHERE game = ?'
  ).get(game);
  return row && row.s ? row.s : 0;
}

function myBest(userId, game) {
  const row = db.prepare(
    'SELECT MAX(score) AS s FROM game_scores WHERE game = ? AND user_id = ?'
  ).get(game, userId);
  return row && row.s ? row.s : 0;
}

router.get('/', isLoggedIn, (req, res) => {
  const games = GAMES.map(g => ({
    ...g,
    topScore: topScore(g.slug),
    myBest: myBest(req.user.id, g.slug)
  }));
  res.render('games/index', { title: 'Games', games });
});

router.get('/flappy', isLoggedIn, (req, res) => {
  res.render('games/flappy', {
    title: 'Flappy Flight',
    topScore: topScore('flappy'),
    myBest: myBest(req.user.id, 'flappy')
  });
});

router.get('/slicer', isLoggedIn, (req, res) => {
  res.render('games/slicer', {
    title: 'Fruit Slicer',
    topScore: topScore('slicer'),
    myBest: myBest(req.user.id, 'slicer')
  });
});

router.get('/race', isLoggedIn, (req, res) => {
  res.render('games/race', {
    title: 'Lane Racer',
    topScore: topScore('race'),
    myBest: myBest(req.user.id, 'race')
  });
});

// POST /games/score — submit a run's score
router.post('/score', isLoggedIn, express.json(), (req, res) => {
  const game = String(req.body.game || '');
  const score = parseInt(req.body.score, 10);

  if (!['flappy', 'slicer', 'race'].includes(game)) {
    return res.status(400).json({ ok: false, error: 'Invalid game.' });
  }
  if (!Number.isFinite(score) || score < 0 || score > 1000000) {
    return res.status(400).json({ ok: false, error: 'Invalid score.' });
  }

  db.prepare(
    'INSERT INTO game_scores (user_id, game, score) VALUES (?, ?, ?)'
  ).run(req.user.id, game, score);

  return res.json({
    ok: true,
    myBest: myBest(req.user.id, game),
    topScore: topScore(game)
  });
});

module.exports = router;
