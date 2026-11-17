const { verifySessionToken } = require('../services/sessionToken');

// LLD §3: all endpoints require a bearer token except signup/login. LLD/HLD specify
// a Firebase Auth ID token here, but task 2.9 swapped the default wiring to our own
// self-issued JWT (src/services/sessionToken.js) since real Firebase credentials are
// still deferred (task 0.11) and Firebase Admin can't verify a password it never
// stored. createAuthMiddleware takes the token-verifying function as a parameter —
// unchanged from task 2.1 — so this swap didn't touch the tested header-parsing/401
// logic at all, and swapping back to getFirebaseAdmin().auth().verifyIdToken once a
// real Firebase project exists is a one-line change here.
function createAuthMiddleware(verifyIdToken) {
  return async function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Missing or malformed Authorization header' });
    }

    try {
      req.user = await verifyIdToken(token);
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
}

const requireAuth = createAuthMiddleware(verifySessionToken);

module.exports = { createAuthMiddleware, requireAuth };
