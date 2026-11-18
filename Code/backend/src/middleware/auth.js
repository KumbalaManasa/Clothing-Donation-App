const {
  SESSION_COOKIE_NAME,
  parseCookies,
  getSession,
} = require('../services/sessionStore');
const { verifySessionToken } = require('../services/sessionToken');

/**
 * Session-based authentication middleware (Type 1: Cookie + Session ID)
 *
 * 1. Checks HTTP Cookie header for `sid` (Session ID).
 * 2. If present, looks up the session in PostgreSQL `sessions` table.
 * 3. Falls back to Bearer token verification if present for backward compatibility with tests.
 * 4. Populates req.user = { uid, role, ... } on success, or 401 Unauthorized on failure.
 */
async function requireAuth(req, res, next) {
  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE_NAME];

  // 1. Primary: Session-based auth via HttpOnly Cookie (or Authorization: Session <sid>)
  if (sessionId) {
    try {
      const session = await getSession(sessionId);
      if (session) {
        req.user = {
          uid: session.user_id,
          role: session.role,
          name: session.name,
          email: session.email,
        };
        req.session = session;
        return next();
      }
      return res.status(401).json({ message: 'Invalid or expired session' });
    } catch (err) {
      console.error('Session lookup error:', err);
      return res.status(500).json({ message: 'Internal server error checking session' });
    }
  }

  // 2. Fallback: Authorization header (Session <id> or Bearer <token>)
  const authHeader = req.headers['authorization'] || '';
  if (authHeader) {
    const [scheme, token] = authHeader.split(' ');
    if (scheme === 'Session' && token) {
      const session = await getSession(token);
      if (session) {
        req.user = {
          uid: session.user_id,
          role: session.role,
          name: session.name,
          email: session.email,
        };
        req.session = session;
        return next();
      }
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    if (scheme === 'Bearer' && token) {
      // First try session lookup with this token
      const session = await getSession(token);
      if (session) {
        req.user = {
          uid: session.user_id,
          role: session.role,
          name: session.name,
          email: session.email,
        };
        req.session = session;
        return next();
      }

      // If not in sessions table, check if it's a signed JWT token
      try {
        const decoded = verifySessionToken(token);
        if (decoded) {
          req.user = decoded;
          return next();
        }
      } catch {
        // Not a valid JWT either
      }
      return res.status(401).json({ message: 'Invalid or expired session' });
    }
  }

  return res.status(401).json({ message: 'No active session (session cookie missing)' });
}

function createAuthMiddleware(verifyIdToken) {
  return async function (req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Missing or malformed Authorization header' });
    }

    try {
      req.user = await verifyIdToken(token);
      next();
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
}

module.exports = { requireAuth, createAuthMiddleware };
