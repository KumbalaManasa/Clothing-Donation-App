const jwt = require('jsonwebtoken');

// Self-issued session tokens — temporary stand-in for real Firebase Auth ID
// tokens (HLD §3 / LLD §3) until a real Firebase project exists (deferred at
// task 0.11). Payload shape mirrors what a decoded Firebase ID token exposes
// (.uid) so downstream code (and requireAuth's existing tests, task 2.1) don't
// need to change when this gets swapped back to real Firebase later.

function signSessionToken(user) {
  // In Type 2: JWT contains the user identity & claims directly inside the token payload
  return jwt.sign(
    {
      uid: user.id || user.uid,
      role: user.role,
      name: user.name,
      email: user.email,
    },
    getSecret(),
    { expiresIn: '24h' }
  );
}

function verifySessionToken(token) {
  return jwt.verify(token, getSecret());
}

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

module.exports = { signSessionToken, verifySessionToken };
