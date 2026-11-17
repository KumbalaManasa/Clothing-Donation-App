const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Forgot-password support. Two delivery methods share this module:
//   code — a short 6-digit number the user re-types on the same page.
//   link — a long random token embedded in a URL the user clicks.
// Neither secret is ever stored raw, same principle as users.password_hash —
// only its bcrypt hash lands in password_resets.secret_hash.
const RESET_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes — long enough to check email/phone, short enough to limit exposure if intercepted.

function generateCode() {
  return String(crypto.randomInt(100000, 1000000)); // always 6 digits, no leading-zero ambiguity
}

function generateLinkToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function hashSecret(secret) {
  return bcrypt.hash(secret, 10);
}

async function secretMatches(secret, hash) {
  return bcrypt.compare(secret, hash);
}

function expiryTimestamp() {
  return new Date(Date.now() + RESET_EXPIRY_MS);
}

module.exports = { generateCode, generateLinkToken, hashSecret, secretMatches, expiryTimestamp, RESET_EXPIRY_MS };
