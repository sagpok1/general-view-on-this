const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const wordlist = require('bip39/src/wordlists/english.json');

const PHRASE_LENGTH = 7;
const WORDLIST_SIZE = wordlist.length;

function generatePhrase() {
  const words = [];
  for (let i = 0; i < PHRASE_LENGTH; i++) {
    const idx = crypto.randomInt(0, WORDLIST_SIZE);
    words.push(wordlist[idx]);
  }
  return words.join(' ');
}

function normalizePhrase(input) {
  if (!input) return '';
  return String(input)
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

function isValidPhrase(input) {
  const normalized = normalizePhrase(input);
  const words = normalized.split(' ');
  if (words.length !== PHRASE_LENGTH) return false;
  return words.every((w) => wordlist.includes(w));
}

function hashPhrase(phrase) {
  return bcrypt.hashSync(normalizePhrase(phrase), 10);
}

function verifyPhrase(phrase, hash) {
  return bcrypt.compareSync(normalizePhrase(phrase), hash);
}

module.exports = {
  PHRASE_LENGTH,
  generatePhrase,
  normalizePhrase,
  isValidPhrase,
  hashPhrase,
  verifyPhrase,
  wordlist
};
