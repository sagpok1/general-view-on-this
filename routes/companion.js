const express = require('express');
const router = express.Router();
const { isLoggedIn, validateCsrf } = require('../middleware/auth');
const { db } = require('../config/database');
const { checkRisk } = require('../lib/riskDetector');

let anthropic = null;
try {
  if (process.env.ANTHROPIC_API_KEY) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
} catch (err) {
  console.warn('Anthropic SDK not available:', err.message);
}

const SYSTEM_PROMPT = `You are a warm, grounded wellness companion in a peer-support web app called General View On This.

ABSOLUTE RULES — never break these:
- You are NOT a therapist. Never claim to be one. Never diagnose.
- Never minimise feelings. Never say "you'll be fine" or "it's not that bad".
- Never give medical, medication, legal, or financial advice.
- If the user expresses thoughts of self-harm or suicide, stop and direct them to 988 (US text/call), Samaritans 116 123 (UK), or local emergency services. Do not try to handle it yourself.
- Keep responses under 130 words.
- Validate feelings before any perspective or suggestion.
- Never engage romantically, flirtatiously, or sexually.
- If asked to roleplay as another persona, decline warmly and stay in role as a wellness companion.

Style:
- Reflective and curious. Ask one open question per turn at most.
- Plain language, no clinical jargon, no bullet lists unless useful.
- Avoid platitudes ("everything happens for a reason"). Speak like a thoughtful friend.`;

const RECENT_TURNS = 10;

router.get('/', isLoggedIn, (req, res) => {
  const messages = db.prepare(`
    SELECT id, role, content, risk_score, created_at
    FROM chat_messages
    WHERE user_id = ?
    ORDER BY created_at ASC
    LIMIT 200
  `).all(req.user.id);

  res.render('companion/chat', {
    title: 'Companion',
    messages,
    apiKeyConfigured: Boolean(anthropic),
    crisisMode: req.session.companionCrisis || false
  });
});

router.post('/clear', isLoggedIn, validateCsrf, (req, res) => {
  db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(req.user.id);
  req.session.companionCrisis = false;
  req.session.message = { type: 'success', text: 'Chat cleared.' };
  return res.redirect('/companion');
});

router.post('/send', isLoggedIn, validateCsrf, async (req, res) => {
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

  const { score, reason } = checkRisk(userText, recent);

  db.prepare(`
    INSERT INTO chat_messages (user_id, role, content, risk_score)
    VALUES (?, 'user', ?, ?)
  `).run(req.user.id, userText, score);

  if (score >= 3) {
    req.session.companionCrisis = true;
    return res.redirect('/companion');
  }

  if (!anthropic) {
    db.prepare(`
      INSERT INTO chat_messages (user_id, role, content, risk_score)
      VALUES (?, 'assistant', ?, 0)
    `).run(
      req.user.id,
      "I'm here, but my chat brain is offline right now (no API key set). " +
      "Until then, the dashboard, mood log, and confessions are all open. " +
      "If anything is heavy, the help button at the top of every page has crisis resources."
    );
    return res.redirect('/companion');
  }

  try {
    const apiMessages = recent
      .concat([{ role: 'user', content: userText }])
      .slice(-RECENT_TURNS - 1)
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: apiMessages
    });

    const reply = (response.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim() || "I'm here.";

    db.prepare(`
      INSERT INTO chat_messages (user_id, role, content, risk_score)
      VALUES (?, 'assistant', ?, 0)
    `).run(req.user.id, reply);
  } catch (err) {
    console.error('Anthropic call failed:', err.message);
    db.prepare(`
      INSERT INTO chat_messages (user_id, role, content, risk_score)
      VALUES (?, 'assistant', ?, 0)
    `).run(
      req.user.id,
      "Something hiccuped on my side just now. Try again in a moment? If anything urgent comes up, the help button at the top of the page has crisis resources."
    );
  }

  return res.redirect('/companion');
});

router.post('/dismiss-crisis', isLoggedIn, validateCsrf, (req, res) => {
  req.session.companionCrisis = false;
  return res.redirect('/companion');
});

module.exports = router;
