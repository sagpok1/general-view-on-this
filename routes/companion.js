const express = require('express');
const router = express.Router();
const { isLoggedIn, validateCsrf } = require('../middleware/auth');
const { db } = require('../config/database');
const { checkRisk } = require('../lib/riskDetector');
const { composeReply } = require('../lib/companionEngine');
const CompanionFacts = require('../models/CompanionFacts');

const RECENT_TURNS = 12;

router.get('/', isLoggedIn, (req, res) => {
  const messages = db.prepare(`
    SELECT id, role, content, risk_score, created_at
    FROM chat_messages
    WHERE user_id = ?
    ORDER BY created_at ASC
    LIMIT 200
  `).all(req.user.id);

  const facts = CompanionFacts.list(req.user.id);

  res.render('companion/chat', {
    title: 'Companion',
    messages,
    facts,
    crisisMode: req.session.companionCrisis || false
  });
});

router.post('/clear', isLoggedIn, validateCsrf, (req, res) => {
  db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(req.user.id);
  req.session.companionCrisis = false;
  req.session.message = { type: 'success', text: 'Chat cleared.' };
  return res.redirect('/companion');
});

router.post('/send', isLoggedIn, validateCsrf, (req, res) => {
  const userText = String(req.body.message || '').trim();
  if (!userText) return res.redirect('/companion');

  const recentRows = db.prepare(`
    SELECT role, content
    FROM chat_messages
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(req.user.id, RECENT_TURNS);
  const recent = recentRows.reverse();

  const { score } = checkRisk(userText, recent);

  db.prepare(`
    INSERT INTO chat_messages (user_id, role, content, risk_score)
    VALUES (?, 'user', ?, ?)
  `).run(req.user.id, userText, score);

  if (score >= 3) {
    req.session.companionCrisis = true;
    return res.redirect('/companion');
  }

  const knownFacts = CompanionFacts.list(req.user.id);
  const { reply, newFacts } = composeReply({
    text: userText,
    history: recent,
    knownFacts
  });

  if (Array.isArray(newFacts) && newFacts.length) {
    try {
      CompanionFacts.upsertMany(req.user.id, newFacts);
    } catch (err) {
      console.error('Fact upsert failed:', err.message);
    }
  }

  db.prepare(`
    INSERT INTO chat_messages (user_id, role, content, risk_score)
    VALUES (?, 'assistant', ?, 0)
  `).run(req.user.id, reply);

  return res.redirect('/companion');
});

router.post('/dismiss-crisis', isLoggedIn, validateCsrf, (req, res) => {
  req.session.companionCrisis = false;
  return res.redirect('/companion');
});

router.post('/forget/:id', isLoggedIn, validateCsrf, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isFinite(id)) CompanionFacts.forget(req.user.id, id);
  req.session.message = { type: 'success', text: 'Forgotten.' };
  return res.redirect('/companion');
});

router.post('/forget-all', isLoggedIn, validateCsrf, (req, res) => {
  CompanionFacts.forgetAll(req.user.id);
  req.session.message = { type: 'success', text: 'All facts forgotten.' };
  return res.redirect('/companion');
});

module.exports = router;
