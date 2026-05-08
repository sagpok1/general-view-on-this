const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const Confession = require('../models/Confession');
const Mood = require('../models/Mood');

router.get('/', isLoggedIn, (req, res) => {
  const userId = req.user.id;

  const myConfessionCount = Confession.countByUser(userId);
  const totals = Confession.totals();
  const latestMood = Mood.latest(userId);
  const moodCount = Mood.countByUser(userId);
  const recentMoods = Mood.recent(userId, 7);

  res.render('dashboard/home', {
    title: 'Dashboard',
    myConfessionCount,
    totals,
    latestMood,
    moodCount,
    recentMoods,
    moods: Mood.VALID_MOODS
  });
});

module.exports = router;
