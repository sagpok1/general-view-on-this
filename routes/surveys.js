const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { isLoggedIn, validateCsrf } = require('../middleware/auth');
const Survey = require('../models/Survey');

// GET /surveys — list available and completed surveys
router.get('/', isLoggedIn, (req, res) => {
  const userId = req.user.id;
  const available = Survey.getAvailableForUser(userId);
  const completed = Survey.getCompletedByUser(userId);

  res.render('surveys/list', {
    title: 'Surveys',
    available,
    completed
  });
});

// GET /surveys/:id — take a survey
router.get('/:id', isLoggedIn, (req, res) => {
  const surveyId = parseInt(req.params.id, 10);
  const userId = req.user.id;

  // Check if already completed
  if (Survey.hasCompleted(userId, surveyId)) {
    req.session.message = { type: 'error', text: 'You have already completed this survey.' };
    return res.redirect('/surveys');
  }

  const survey = Survey.findById(surveyId);
  if (!survey) {
    req.session.message = { type: 'error', text: 'Survey not found.' };
    return res.redirect('/surveys');
  }

  const questions = Survey.getQuestions(surveyId);

  res.render('surveys/take', {
    title: survey.title,
    survey,
    questions
  });
});

// POST /surveys/:id/complete — submit survey responses
router.post('/:id/complete', isLoggedIn, validateCsrf, (req, res) => {
  const surveyId = parseInt(req.params.id, 10);
  const userId = req.user.id;

  // Check if already completed
  if (Survey.hasCompleted(userId, surveyId)) {
    req.session.message = { type: 'error', text: 'You have already completed this survey.' };
    return res.redirect('/surveys');
  }

  const survey = Survey.findById(surveyId);
  if (!survey) {
    req.session.message = { type: 'error', text: 'Survey not found.' };
    return res.redirect('/surveys');
  }

  const questions = Survey.getQuestions(surveyId);

  // Build responses array from form data
  const responses = [];
  let hasErrors = false;

  for (const question of questions) {
    const answer = req.body[`question_${question.id}`];

    if (!answer || (typeof answer === 'string' && answer.trim() === '')) {
      hasErrors = true;
      break;
    }

    responses.push({
      question_id: question.id,
      answer: typeof answer === 'string' ? answer.trim() : String(answer)
    });
  }

  if (hasErrors) {
    req.session.message = { type: 'error', text: 'Please answer all questions before submitting.' };
    return res.redirect(`/surveys/${surveyId}`);
  }

  try {
    Survey.complete(userId, surveyId, responses);
    req.session.message = {
      type: 'success',
      text: 'Survey completed! You earned 1 credit.'
    };
    return res.redirect('/surveys');
  } catch (err) {
    req.session.message = { type: 'error', text: 'Failed to submit survey. Please try again.' };
    return res.redirect(`/surveys/${surveyId}`);
  }
});

module.exports = router;
