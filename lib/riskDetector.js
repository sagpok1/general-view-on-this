const HIGH_RISK_KEYWORDS = [
  'kill myself', 'end my life', 'want to die', 'hurt myself', "don't want to live",
  'dont want to live', 'suicide', 'suicidal', 'no reason to live', 'better off dead',
  "can't go on", 'cant go on', 'end it all', 'i have a plan', "i won't wake up",
  'i wont wake up', 'i wish i was dead', "i'm done with everything",
  'im done with everything', 'take my life', 'killing myself', 'wanting to die',
  'ready to die', 'cut myself', 'harm myself', 'not worth living', 'end it tonight',
  'overdose', 'hang myself', 'shoot myself', 'kill someone', 'hurt someone'
];

const MODERATE_RISK_KEYWORDS = [
  "i'm exhausted of everything", 'im exhausted of everything', 'nobody cares',
  'no one cares', 'feel hopeless', 'feeling hopeless', 'so hopeless', 'hopeless',
  "what's the point", 'whats the point', "can't take it anymore",
  'cant take it anymore', 'feel empty', 'feeling empty', 'so empty',
  "i'm a burden", 'im a burden', 'so tired of life', 'hate myself',
  'give up on life', 'better off without me', 'feel worthless',
  'nothing matters anymore', 'never get better', 'never gets better',
  'everything is pointless', 'no point anymore', 'so tired of everything',
  "i can't do this anymore", 'i cant do this anymore'
];

const LOW_RISK_KEYWORDS = [
  'so sad', 'really sad', 'feeling sad', "i'm sad", 'im sad', 'depressed',
  'so lonely', 'really lonely', 'feeling lonely', 'so anxious', 'really anxious',
  'overwhelmed', 'so stressed', 'really stressed', 'falling apart', "can't cope",
  'cant cope', 'struggling a lot', 'breaking down', 'worthless', 'empty inside',
  'numb inside', 'burned out', 'burnt out'
];

const ESCALATION_THRESHOLD = 3;

function checkRisk(message, sessionHistory) {
  const text = String(message || '').toLowerCase().trim();
  const history = Array.isArray(sessionHistory) ? sessionHistory : [];

  const matchedHigh = HIGH_RISK_KEYWORDS.find((kw) => text.includes(kw));
  if (matchedHigh) {
    return { score: 4, reason: `High-risk phrase detected: '${matchedHigh}'` };
  }

  const matchedModerate = MODERATE_RISK_KEYWORDS.find((kw) => text.includes(kw));
  const currentIsModerate = Boolean(matchedModerate);

  let moderateCount = currentIsModerate ? 1 : 0;
  for (const entry of history) {
    if (!entry || entry.role !== 'user') continue;
    const past = String(entry.content || '').toLowerCase();
    if (MODERATE_RISK_KEYWORDS.some((kw) => past.includes(kw))) moderateCount++;
  }

  if (moderateCount >= ESCALATION_THRESHOLD) {
    return {
      score: 3,
      reason: `Escalation: ${moderateCount} moderate-risk messages this session`
    };
  }

  if (currentIsModerate) {
    return { score: 2, reason: `Moderate-risk phrase detected: '${matchedModerate}'` };
  }

  const matchedLow = LOW_RISK_KEYWORDS.find((kw) => text.includes(kw));
  if (matchedLow) {
    return { score: 1, reason: `Low-risk phrase detected: '${matchedLow}'` };
  }

  return { score: 0, reason: 'No risk indicators detected' };
}

function riskLabel(score) {
  return ['safe', 'low', 'moderate', 'escalated', 'critical'][score] || 'unknown';
}

module.exports = { checkRisk, riskLabel };
