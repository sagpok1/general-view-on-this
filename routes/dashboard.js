const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const { db } = require('../config/database');
const Confession = require('../models/Confession');
const Mood = require('../models/Mood');

router.get('/', isLoggedIn, (req, res) => {
  const userId = req.user.id;

  const myConfessionCount = Confession.countByUser(userId);
  const totals = Confession.totals();
  const latestMood = Mood.latest(userId);
  const moodCount = Mood.countByUser(userId);
  const recentMoods = Mood.recent(userId, 7);

  const surveysAvailable = db.prepare(`
    SELECT COUNT(*) AS c FROM surveys s
    WHERE is_active = 1
      AND NOT EXISTS (SELECT 1 FROM survey_completions sc WHERE sc.user_id = ? AND sc.survey_id = s.id)
  `).get(userId).c;

  const surveysCompleted = db.prepare(
    'SELECT COUNT(*) AS c FROM survey_completions WHERE user_id = ?'
  ).get(userId).c;

  res.render('dashboard/home', {
    title: 'Dashboard',
    myConfessionCount,
    totals,
    latestMood,
    moodCount,
    recentMoods,
    surveysAvailable,
    surveysCompleted,
    moods: Mood.VALID_MOODS
  });
});

module.exports = router;
