const express = require('express');
const router = express.Router();
const { isLoggedIn, validateCsrf } = require('../middleware/auth');
const Prediction = require('../models/Prediction');

// GET /predictions — list all predictions with summary
router.get('/', isLoggedIn, (req, res) => {
  const predictions = Prediction.listWithSummary(req.user.id);
  const stats = Prediction.getOverallStats();

  // Group by category for filter pills
  const categories = Array.from(new Set(predictions.map(p => p.category).filter(Boolean)));

  res.render('predictions/list', {
    title: 'Predictions',
    predictions,
    categories,
    stats
  });
});

// GET /predictions/:id — detail view
router.get('/:id', isLoggedIn, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const prediction = Prediction.findById(id);
  if (!prediction) {
    req.session.message = { type: 'error', text: 'Prediction not found.' };
    return res.redirect('/predictions');
  }

  const options = Prediction.getOptionsWithCounts(id);
  const totalVotes = Prediction.getTotalVotes(id);
  const myVote = Prediction.getUserVote(req.user.id, id);

  res.render('predictions/detail', {
    title: prediction.title,
    prediction,
    options,
    totalVotes,
    myOptionId: myVote ? myVote.option_id : null
  });
});

// POST /predictions/:id/vote — cast a vote
router.post('/:id/vote', isLoggedIn, validateCsrf, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const optionId = parseInt(req.body.option_id, 10);

  const prediction = Prediction.findById(id);
  if (!prediction) {
    req.session.message = { type: 'error', text: 'Prediction not found.' };
    return res.redirect('/predictions');
  }
  if (prediction.status !== 'open') {
    req.session.message = { type: 'error', text: 'This prediction is closed.' };
    return res.redirect(`/predictions/${id}`);
  }
  if (Prediction.getUserVote(req.user.id, id)) {
    req.session.message = { type: 'error', text: 'You have already voted on this prediction.' };
    return res.redirect(`/predictions/${id}`);
  }
  if (!optionId) {
    req.session.message = { type: 'error', text: 'Please choose an option.' };
    return res.redirect(`/predictions/${id}`);
  }

  try {
    Prediction.vote(req.user.id, id, optionId);
    req.session.message = { type: 'success', text: 'Your prediction is in!' };
  } catch (err) {
    req.session.message = { type: 'error', text: 'Could not record your vote.' };
  }
  return res.redirect(`/predictions/${id}`);
});

module.exports = router;
