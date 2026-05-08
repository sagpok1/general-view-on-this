/**
 * Display-time profanity filter.
 *
 * Replaces vulgar words with the first letter + asterisks of matching length:
 *   "fuck this shit" → "f*** this s***"
 *   "BITCH"         → "B****"
 *   "you motherfucker!" → "you m***********!"
 *
 * Notes:
 *  - Word-boundary matched (\b...\b), so "assistant", "classic", "passing"
 *    are NOT censored.
 *  - The original text stays in the database; this only affects rendering.
 *    Admins viewing /admin still see uncensored content for moderation.
 *  - Case is preserved on the surviving first character.
 *  - Single-character words are returned unchanged (no point starring "a").
 *
 * The list is deliberately conservative — common English vulgarities only.
 * Slurs and direct attacks are blocked entirely by lib/abuseDetector.js, not
 * censored here.
 */

const PROFANITY = new Set([
  // f-word family
  'fuck', 'fucks', 'fucked', 'fucker', 'fuckers', 'fucking', 'fuckin',
  'motherfucker', 'motherfuckers', 'motherfucking', 'mofo',
  // s-word
  'shit', 'shits', 'shitty', 'shittier', 'shittiest', 'shitting', 'shithole',
  'bullshit',
  // a-word
  'ass', 'asses', 'asshole', 'assholes', 'asshat', 'jackass',
  // b-word
  'bitch', 'bitches', 'bitchy', 'bitching',
  'bastard', 'bastards',
  // strong
  'cunt', 'cunts',
  // body / sex
  'dick', 'dicks', 'dickhead', 'dickheads',
  'cock', 'cocks', 'cocksucker', 'cocksuckers',
  'pussy', 'pussies',
  // sex-work
  'whore', 'whores', 'slut', 'sluts',
  // milder but commonly censored on social platforms
  'damn', 'damned', 'damnit', 'goddamn', 'goddamned', 'goddammit',
  'piss', 'pissed', 'pissing', 'pisser',
  'crap', 'crappy', 'crapped'
]);

function censorWord(word) {
  if (word.length <= 1) return word;
  return word[0] + '*'.repeat(word.length - 1);
}

/**
 * Return the input string with any profanity replaced. Word-boundary aware.
 * Handles smart quotes inside contractions ("ain't").
 */
function censor(text) {
  if (text == null) return '';
  return String(text).replace(/\b([A-Za-z]+(?:[''][A-Za-z]+)?)\b/g, (match) => {
    const lower = match.toLowerCase().replace(/['']/g, "'");
    return PROFANITY.has(lower) ? censorWord(match) : match;
  });
}

module.exports = { censor, PROFANITY };
