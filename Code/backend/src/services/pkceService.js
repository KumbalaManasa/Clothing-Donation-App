const crypto = require('crypto');

/**
 * Base64URL encoding (RFC 7636 standard for PKCE)
 */
function base64url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates a high-entropy cryptographically random code_verifier (43-128 chars)
 */
function generateCodeVerifier() {
  return base64url(crypto.randomBytes(32));
}

/**
 * Generates a SHA-256 code_challenge from a code_verifier (S256 method)
 */
function computeCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64url(hash);
}

/**
 * Timing-safe verification of code_verifier against expected code_challenge
 */
function verifyCodeChallenge(verifier, expectedChallenge) {
  if (!verifier || !expectedChallenge) return false;
  const computed = computeCodeChallenge(verifier);
  if (computed.length !== expectedChallenge.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expectedChallenge));
}

function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  base64url,
  generateCodeVerifier,
  computeCodeChallenge,
  verifyCodeChallenge,
  generateState,
};

