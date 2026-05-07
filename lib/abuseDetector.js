/**
 * Abuse / harassment detector for user-generated comments.
 *
 * Two-tier:
 *   - HARD_BLOCK: any match → block, return score 3
 *   - SOFT_FLAG:  match → score 1; 2+ matches → score 2 (block)
 *
 * Conservative — false-positives mean a polite "rephrase and try again"
 * message, not a ban. If a real attack slips through, admins can hide
 * the comment and the abuse_score is recorded for review.
 *
 * This is intentionally a small list, not exhaustive. It catches the
 * obvious patterns and explicit slurs. For deeper moderation, an admin
 * still reviews flagged content via /admin.
 */

// Direct-target attack patterns. Match anywhere in the comment.
const HARD_BLOCK_PATTERNS = [
  // "kill yourself" and variants — the single most common targeted attack
  /\b(?:kill|kys|kill\s*your\s*self|go\s*kill\s*yourself|you\s+should\s+(?:kill|die|go\s*die))\b/i,
  /\bgo\s*die\b/i,
  /\b(?:you|u)\s+should\s+(?:just\s+)?die\b/i,
  /\b(?:you|u)\s+are\s+(?:better\s+off\s+)?dead\b/i,

  // Targeted dehumanization
  /\b(?:you|u|ur|youre|you're)\s+(?:a\s+)?(?:worthless|pathetic|disgusting|garbage|trash|subhuman|scum|piece\s+of\s+(?:shit|garbage|crap))\b/i,
  /\bnobody\s+(?:will\s+ever\s+)?love\s+you\b/i,
  /\bno\s+one\s+(?:will\s+ever\s+)?love\s+you\b/i,
  /\beveryone\s+(?:hates|despises)\s+you\b/i,

  // Common slur stems (deliberately partial, regex-safe). Block on match.
  /\bn[i1]gg[ae]r?s?\b/i,
  /\bf[a@]gg?[oe]?ts?\b/i,
  /\bret[a@]rds?\b/i,
  /\btr[a@]nn[i1]es?\b/i,
  /\bsp[i1]cs?\b/i,
  /\bch[i1]nks?\b/i,
  /\bk[i1]kes?\b/i,
  /\bw[e3]tb[a@]cks?\b/i,

  // Threats
  /\b(?:i\s+(?:will|am\s+going\s+to|gonna)\s+(?:kill|hurt|find|murder)\s+(?:you|u))\b/i,
  /\bi\s+know\s+where\s+you\s+live\b/i,
  /\b(?:you|u)\s+(?:are\s+)?(?:next|gonna\s+pay)\b/i
];

// Mid-tier — bullying language that may be legit in some contexts (e.g., quoting).
const SOFT_FLAG_PATTERNS = [
  /\b(?:shut\s*up|stfu)\b/i,
  /\b(?:idiot|moron|stupid|dumb|loser)\b/i,
  /\b(?:hate|despise|loathe)\s+(?:you|u)\b/i,
  /\b(?:you|u|ur)\s+(?:are|r)\s+(?:annoying|cringe|gross|ugly|fat|weird|lame)\b/i,
  /\bcry\s*about\s*it\b/i,
  /\bcope\s+harder\b/i,
  /\b(?:get|go)\s+a\s+life\b/i
];

function checkAbuse(text) {
  const t = String(text || '').trim();
  if (!t) return { score: 0, reason: null };

  for (const re of HARD_BLOCK_PATTERNS) {
    const m = t.match(re);
    if (m) {
      return {
        score: 3,
        reason: `hard-block: '${m[0].slice(0, 40)}'`
      };
    }
  }

  let softHits = 0;
  let firstSoft = null;
  for (const re of SOFT_FLAG_PATTERNS) {
    const m = t.match(re);
    if (m) {
      softHits++;
      if (!firstSoft) firstSoft = m[0].slice(0, 40);
    }
  }

  if (softHits >= 2) return { score: 2, reason: `soft x${softHits}: '${firstSoft}'` };
  if (softHits === 1) return { score: 1, reason: `soft: '${firstSoft}'` };
  return { score: 0, reason: null };
}

module.exports = { checkAbuse };
