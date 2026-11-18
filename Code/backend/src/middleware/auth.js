const { verifySessionToken } = require('../services/sessionToken');
const { parseCookies, JWT_COOKIE_NAME } = require('../services/sessionStore');

/**
 * Type 3: JWT in HttpOnly Cookie Authentication Middleware
 *
 * 1. Checks HTTP request cookies for `jwt_token`.
 * 2. Falls back to `Authorization: Bearer <token>` if no cookie is present (for curl/CLI/tests).
 * 3. Cryptographically verifies the JWT signature with JWT_SECRET (Stateless — 0 DB lookups).
 * 4. Populates req.user = { uid, role, name, email } directly from token payload.
 * 5. Returns 401 Unauthorized if missing, expired, or tampered.
 */
function createAuthMiddleware(verifyTokenFn) {
  return async function requireAuth(req, res, next) {
    // 1. Primary: HttpOnly Cookie sent automatically by the browser
    const cookies = parseCookies(req);
    let token = cookies[JWT_COOKIE_NAME];

    // 2. Fallback: Authorization header (for backward compatibility with tests & curl)
    if (!token) {
      const authHeader = req.headers['authorization'] || '';
      const [scheme, bearerToken] = authHeader.split(' ');
      if (scheme === 'Bearer' && bearerToken) {
        token = bearerToken;
      }
    }

    if (!token) {
      return res.status(401).json({ message: 'Missing authentication (HttpOnly JWT cookie not present)' });
    }

    try {
      const decoded = await verifyTokenFn(token);
      req.user = decoded;
      return next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'JWT token has expired' });
      }
      return res.status(401).json({ message: 'Invalid or forged JWT token' });
    }
  };
}

const requireAuth = createAuthMiddleware(verifySessionToken);

module.exports = { requireAuth, createAuthMiddleware };
