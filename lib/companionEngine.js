/**
 * Companion engine — rule-based listener.
 *
 * Two jobs:
 *   1. Extract durable facts from a user message (name, age, pet, etc.)
 *      so the companion "learns" about the user across sessions.
 *   2. Compose a short, supportive reply by detecting the user's emotion
 *      and weaving in a remembered fact when it fits.
 *
 * No LLM calls. Everything runs locally.
 */

// ─── Fact extraction ────────────────────────────────────────────────────────

// Words that look like names but aren't — guards "i'm sad" → name=sad.
const NON_NAMES = new Set([
  'sad', 'happy', 'okay', 'ok', 'fine', 'good', 'bad', 'tired',
  'anxious', 'angry', 'stressed', 'lonely', 'depressed', 'numb',
  'sorry', 'late', 'early', 'busy', 'free', 'home', 'back', 'here',
  'done', 'ready', 'sick', 'well', 'awake', 'asleep', 'lost', 'fed',
  'old', 'young', 'right', 'wrong', 'sure', 'unsure', 'in', 'out',
  'a', 'an', 'the', 'just', 'so', 'really', 'very', 'too', 'not'
]);

const PETS = ['dog', 'cat', 'puppy', 'kitten', 'hamster', 'rabbit', 'bird', 'parrot', 'fish', 'turtle', 'snake', 'lizard', 'horse'];
const RELATIONS = ['husband', 'wife', 'partner', 'spouse', 'boyfriend', 'girlfriend', 'fiance', 'fiancee', 'mom', 'mum', 'dad', 'mother', 'father', 'brother', 'sister', 'son', 'daughter', 'kid', 'child', 'friend', 'bestie', 'roommate', 'therapist'];

function titleCase(s) {
  return s.split(/\s+/).map(w => w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w).join(' ');
}

function trimTail(s) {
  return s.replace(/[.,!?;:'"\s]+$/g, '').trim();
}

function safeKey(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
}

function extractFacts(text) {
  const t = String(text || '');
  const lower = t.toLowerCase();
  const out = [];
  const seen = new Set();

  function push(category, key, value) {
    const fullKey = `${category}:${key}`;
    if (seen.has(fullKey)) return;
    seen.add(fullKey);
    out.push({ category, key: fullKey, value });
  }

  // Name. Only fire on explicit declarations to avoid "i'm sad" → name=sad.
  const namePatterns = [
    /\bmy name is\s+([a-z][a-z'\-]{1,20})/i,
    /\bcall me\s+([a-z][a-z'\-]{1,20})/i,
    /\bname'?s\s+([a-z][a-z'\-]{1,20})/i,
    /\bi go by\s+([a-z][a-z'\-]{1,20})/i
  ];
  for (const re of namePatterns) {
    const m = t.match(re);
    if (m) {
      const candidate = m[1].toLowerCase();
      if (!NON_NAMES.has(candidate)) {
        push('name', 'name', titleCase(candidate));
      }
      break;
    }
  }

  // Age. Several phrasings.
  // "i'm 27 years old" / "27 yo" / "turning 27" / "i'm 27." (plain self-id)
  // The last one is bounded so we don't grab "i'm 27 minutes late".
  const ageMatch = t.match(/\b(?:i'?m|i am)\s+(\d{1,2})\s*(?:years?\s*old|y\.?o\.?)\b/i)
    || t.match(/\bturning\s+(\d{1,2})\b/i)
    || t.match(/\b(\d{1,2})\s+years?\s+old\b/i)
    || t.match(/\b(?:i'?m|i am)\s+(\d{2})\b(?=\s*[.,!?;]|\s+(?:and|but|so|now)\b|$)/i);
  if (ageMatch) {
    const n = parseInt(ageMatch[1], 10);
    if (n >= 13 && n <= 110) push('age', 'age', String(n));
  }

  // Location.
  const locPatterns = [
    /\bi\s+(?:live|moved|reside)\s+in\s+([a-z][a-z\s'\-]{1,40}?)(?=[.,!?;]|\s+(?:and|but|so|with)\b|$)/i,
    /\bi'?m\s+from\s+([a-z][a-z\s'\-]{1,40}?)(?=[.,!?;]|\s+(?:and|but|so|originally)\b|$)/i,
    /\bi grew up in\s+([a-z][a-z\s'\-]{1,40}?)(?=[.,!?;]|\s+(?:and|but|so)\b|$)/i
  ];
  for (const re of locPatterns) {
    const m = t.match(re);
    if (m) {
      const place = trimTail(m[1]);
      if (place.length >= 2 && place.length <= 40) {
        push('location', 'location', titleCase(place));
      }
      break;
    }
  }

  // Pets. "my dog Bo", "my cat", "i have a dog named Bo".
  const petRe = new RegExp(
    `\\b(?:my|our|i have an?|we have an?)\\s+(${PETS.join('|')})(?:\\s+(?:named|called)\\s+([a-z][a-z'\\-]{1,15}))?`,
    'gi'
  );
  let petMatch;
  while ((petMatch = petRe.exec(t)) !== null) {
    const species = petMatch[1].toLowerCase();
    const name = petMatch[2];
    if (name) {
      const cleanName = titleCase(name);
      push('pet', safeKey(cleanName), `${species} named ${cleanName}`);
    } else {
      push('pet', species, species);
    }
  }

  // Relationships — store the relation type, not personal names.
  const relRe = new RegExp(`\\bmy\\s+(${RELATIONS.join('|')})\\b`, 'gi');
  let relMatch;
  while ((relMatch = relRe.exec(t)) !== null) {
    const r = relMatch[1].toLowerCase();
    push('rel', r, r);
  }

  // Job. Conservative — only "i work as", "i'm a designer/engineer/etc"
  // would be too greedy ("i'm a mess"), so require "work as".
  const jobMatch = t.match(/\bi\s+(?:work|works)\s+(?:as|in)\s+(?:an?\s+)?([a-z][a-z\s'\-]{1,30}?)(?=[.,!?;]|\s+(?:and|but|so|at)\b|$)/i);
  if (jobMatch) {
    const job = trimTail(jobMatch[1]);
    if (job.length >= 2) push('job', 'job', job.toLowerCase());
  }

  // Likes/dislikes — bounded by sentence punctuation or coordinator.
  const likeRe = /\bi\s+(?:love|adore|enjoy|really like)\s+([a-z][a-z\s'\-]{2,30}?)(?=[.,!?;]|\s+(?:and|but|so|because)\b|$)/gi;
  let likeMatch;
  while ((likeMatch = likeRe.exec(t)) !== null) {
    const v = trimTail(likeMatch[1]).toLowerCase();
    if (v.length >= 3 && v.length <= 30) push('like', safeKey(v), v);
  }

  const dislikeRe = /\bi\s+(?:hate|despise|can'?t stand|really dislike)\s+([a-z][a-z\s'\-]{2,30}?)(?=[.,!?;]|\s+(?:and|but|so|because)\b|$)/gi;
  let dislikeMatch;
  while ((dislikeMatch = dislikeRe.exec(t)) !== null) {
    const v = trimTail(dislikeMatch[1]).toLowerCase();
    if (v.length >= 3 && v.length <= 30) push('dislike', safeKey(v), v);
  }

  // Fears.
  const fearMatch = t.match(/\bi'?m\s+(?:afraid|scared|terrified)\s+of\s+([a-z][a-z\s'\-]{2,30}?)(?=[.,!?;]|\s+(?:and|but|so)\b|$)/i);
  if (fearMatch) {
    const v = trimTail(fearMatch[1]).toLowerCase();
    if (v.length >= 3) push('fear', safeKey(v), v);
  }

  // Big-life events — "i got engaged", "i got married", "i'm pregnant", "we had a baby".
  const milestonePatterns = [
    [/\bi\s+(?:got|am)\s+engaged\b/i, 'engaged'],
    [/\bi\s+got\s+married\b/i, 'married'],
    [/\bi'?m\s+pregnant\b/i, 'pregnant'],
    [/\bi\s+(?:had|have)\s+a?\s*(?:baby|newborn)\b/i, 'new baby'],
    [/\bi\s+(?:got|started)\s+a\s+new\s+job\b/i, 'started a new job'],
    [/\bi\s+(?:got|got\s+laid\s+off|was\s+fired|was\s+let\s+go)\b/i, 'lost job'],
    [/\bi\s+moved\b/i, 'moved'],
    [/\bi\s+broke\s+up\b/i, 'recent breakup'],
    [/\bwe\s+broke\s+up\b/i, 'recent breakup'],
    [/\b(?:we\s+got\s+divorced|i\s+got\s+divorced)\b/i, 'divorce'],
    [/\b(?:my|our)\s+(?:dad|mom|mother|father|grandma|grandpa|sister|brother|friend)\s+(?:died|passed away)\b/i, 'recent loss']
  ];
  for (const [re, label] of milestonePatterns) {
    if (re.test(t)) push('milestone', safeKey(label), label);
  }

  return out;
}

// ─── Emotion classifier ─────────────────────────────────────────────────────

const EMOTION_KEYWORDS = {
  sad: [
    'so sad', 'really sad', 'feeling sad', "i'm sad", 'im sad', 'depressed',
    'lonely', 'feeling lonely', 'miss them', 'i miss', 'heartbroken', 'grief',
    'empty inside', 'numb inside', 'feel empty', 'crying', 'cried',
    "can't stop crying", 'feel hopeless', 'hopeless', 'worthless', 'unloved'
  ],
  anxious: [
    'worried', 'nervous', 'anxious', 'panic', 'scared', 'afraid', 'what if',
    'dread', 'dreading', 'overthinking', "can't sleep", 'cant sleep',
    'racing thoughts', 'spiraling', 'on edge', 'restless', 'jittery'
  ],
  angry: [
    'angry', 'furious', 'hate', 'frustrated', 'unfair', 'pissed', 'mad at',
    'rage', 'annoyed', 'bitter', 'resentful', 'fed up', 'so done'
  ],
  stressed: [
    'overwhelmed', 'too much', 'pressure', 'deadline', 'exhausted',
    'burned out', 'burnt out', 'swamped', 'drowning', 'stretched thin',
    'no time', "can't keep up", 'cant keep up', "can't cope", 'cant cope',
    'stressful', 'so stressed', 'really stressed', 'stressed out'
  ],
  happy: [
    'happy', 'excited', 'grateful', 'thankful', 'great day', 'amazing',
    'wonderful', 'feeling good', 'proud', 'peaceful', 'calm', 'finally',
    'relieved', 'a good day', 'felt seen'
  ]
};

// Priority order for ties — softer/help-seeking emotions outrank anger,
// which often shows up incidentally ("i hate traffic") in non-angry text.
const EMOTION_PRIORITY = ['sad', 'anxious', 'stressed', 'angry', 'happy'];

function classifyEmotion(text) {
  const t = String(text || '').toLowerCase();
  const scores = {};
  for (const [emotion, kws] of Object.entries(EMOTION_KEYWORDS)) {
    scores[emotion] = kws.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
  }
  let best = 'neutral';
  let bestScore = 0;
  for (const e of EMOTION_PRIORITY) {
    if (scores[e] > bestScore) {
      best = e;
      bestScore = scores[e];
    }
  }
  return best;
}

// ─── Templates ──────────────────────────────────────────────────────────────

const ACK = {
  sad: [
    "That sounds heavy.",
    "I'm with you in this.",
    "That's a lot to hold.",
    "I hear you. That hurts.",
    "Yeah. That's painful."
  ],
  anxious: [
    "That worry feels real.",
    "Anxiety can take up the whole room.",
    "I hear that — the 'what ifs' are exhausting.",
    "Makes sense your body is keyed up."
  ],
  angry: [
    "That sounds frustrating.",
    "Yeah, that would get under my skin too.",
    "There's a lot of fire in that.",
    "Of course you're angry."
  ],
  stressed: [
    "That sounds like a lot.",
    "Being stretched that thin is exhausting.",
    "No wonder you're tired.",
    "That's a heavy load."
  ],
  happy: [
    "Love that.",
    "That's good to hear.",
    "Glad you have that.",
    "I'm happy for you."
  ],
  neutral: [
    "Mm.",
    "I hear you.",
    "Okay, I'm with you.",
    "Tell me more."
  ]
};

const FOLLOW = {
  sad: [
    "What part feels heaviest?",
    "Where in your body does it sit?",
    "What would 'a little less heavy' look like today?",
    "Has this been building for a while?"
  ],
  anxious: [
    "Is there one specific 'what if' on top right now?",
    "What does your body need in this moment?",
    "What would feel grounding right now?",
    "What's the worry trying to protect?"
  ],
  angry: [
    "What part stings most?",
    "What did you wish had happened instead?",
    "Whose voice comes up when you replay it?"
  ],
  stressed: [
    "What's the one thing you'd drop if you could?",
    "Who could carry a piece of this with you?",
    "What would 30 minutes of quiet look like?"
  ],
  happy: [
    "What made it work?",
    "What do you want more of?",
    "Who would you want to share this with?"
  ],
  neutral: [
    "What's been taking up the most space lately?",
    "What would you want to talk about today?",
    "How are you arriving here today?"
  ]
};

const GREETING_NEW = [
  "Hey {name}. What's on your mind?",
  "Hi {name}. Glad you're here. What's coming up for you?",
  "Hey there. What would you like to talk through today?"
];

const GREETING_KNOWN = [
  "Hey {name}. Last time you mentioned {topic} — how is that now?",
  "Welcome back, {name}. We talked about {topic} earlier. Anything new with that?",
  "Good to see you, {name}. Has anything shifted with {topic} since we last talked?"
];

const MEMORY_WEAVE = [
  "(Earlier you mentioned {topic} — does this connect at all?)",
  "(I remember {topic}. I'm holding that in mind.)",
  "(You once told me about {topic}. Curious if it's part of this.)"
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Short noun-like phrase for slotting into "Last time you mentioned X" /
// "Earlier you talked about X". Avoids clauses like "you live in Portland"
// which read awkwardly inside those templates.
function topicPhrase(fact) {
  if (!fact) return null;
  switch (fact.category) {
    case 'name':     return 'your name';
    case 'age':      return `being ${fact.value}`;
    case 'location': return fact.value;
    case 'pet': {
      const m = String(fact.value).match(/named\s+(.+)$/i);
      return m ? m[1] : `your ${fact.value}`;
    }
    case 'rel':      return `your ${fact.value}`;
    case 'job':      return 'your work';
    case 'like':     return fact.value;
    case 'dislike':  return fact.value;
    case 'fear':     return `your fear of ${fact.value}`;
    case 'milestone':return fact.value;
    default:         return fact.value;
  }
}

// Backwards-compatible alias — older code may still call describeFact.
const describeFact = topicPhrase;

function getKnownName(facts) {
  const f = facts.find((x) => x.category === 'name');
  return f ? f.value : null;
}

function pickWeaveFact(facts) {
  // Skip name/age — those are too "checklist" to recall mid-conversation.
  // Prefer pet, rel, like, milestone.
  const interesting = facts.filter((f) =>
    ['pet', 'rel', 'like', 'dislike', 'fear', 'milestone', 'job', 'location'].includes(f.category)
  );
  if (!interesting.length) return null;
  return pick(interesting);
}

// ─── Compose reply ──────────────────────────────────────────────────────────

/**
 * Build a reply.
 * @param {object} params
 * @param {string} params.text         User's message
 * @param {Array}  params.history      Prior chat messages [{role, content}]
 * @param {Array}  params.knownFacts   Facts already saved for this user
 * @returns {{ reply: string, newFacts: Array }}
 */
function composeReply({ text, history, knownFacts }) {
  const userText = String(text || '').trim();
  const newFacts = extractFacts(userText);
  const priorFacts = knownFacts || [];
  const allFacts = mergeForReply(priorFacts, newFacts);

  const isShortGreeting = /^(hi|hey|hello|sup|yo|hola|good (?:morning|evening|afternoon))\b[\s.!?]*$/i.test(userText);
  // "Last time you mentioned X" only makes sense if X was learned BEFORE this message.
  const priorWeave = pickWeaveFact(priorFacts);
  const name = getKnownName(allFacts);

  if (isShortGreeting) {
    if (priorWeave) {
      return {
        reply: pick(GREETING_KNOWN)
          .replace('{name}', name || 'friend')
          .replace('{topic}', topicPhrase(priorWeave)),
        newFacts
      };
    }
    return {
      reply: pick(GREETING_NEW).replace('{name}', name || 'friend'),
      newFacts
    };
  }

  const emotion = classifyEmotion(userText);
  const ack = pick(ACK[emotion] || ACK.neutral);
  const q = pick(FOLLOW[emotion] || FOLLOW.neutral);

  let reply = `${ack} ${q}`;

  // If they introduced themselves with a name in this turn, greet them by it.
  if (name && newFacts.some((f) => f.category === 'name')) {
    reply = `Nice to meet you, ${name}. ${reply}`;
  }

  // Weave a *prior* memory ~25% of the time. Don't replay something they just said.
  if (Math.random() < 0.25 && priorWeave) {
    reply += ` ${pick(MEMORY_WEAVE).replace('{topic}', topicPhrase(priorWeave))}`;
  }

  return { reply, newFacts };
}

// New facts may overlap with known facts; merge by key, prefer the new one.
function mergeForReply(known, fresh) {
  const map = new Map();
  for (const f of known) map.set(f.key, f);
  for (const f of fresh) {
    map.set(f.key, { category: f.category, key: f.key, value: f.value });
  }
  return Array.from(map.values());
}

module.exports = {
  composeReply,
  extractFacts,
  classifyEmotion,
  describeFact
};
