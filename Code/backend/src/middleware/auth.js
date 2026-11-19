const { verifySessionToken } = require('../services/sessionToken');
const { parseCookies, JWT_COOKIE_NAME } = require('../services/sessionStore');

/**
 * Type 4: Access Token Verification Middleware
 *
 * 1. Checks `Authorization: Bearer <accessToken>`.
 * 2. Cryptographically verifies the short-lived access token with JWT_SECRET (stateless).
 * 3. If expired, returns 401 with { code: 'TOKEN_EXPIRED' } so the client can trigger silent refresh.
 * 4. If valid, attaches req.user and proceeds.
 */
function createAuthMiddleware(verifyTokenFn) {
  return async function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    let token = null;

    if (authHeader) {
      const [scheme, bearerToken] = authHeader.split(' ');
      if (scheme === 'Bearer' && bearerToken) {
        token = bearerToken;
      }
    }

    // Fallback: check cookie if someone passed token via cookie
    if (!token) {
      const cookies = parseCookies(req);
      token = cookies[JWT_COOKIE_NAME];
    }

    if (!token) {
      return res.status(401).json({ code: 'TOKEN_MISSING', message: 'Missing Authorization header' });
    }

    try {
      const decoded = await verifyTokenFn(token);
      req.user = decoded;
      return next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired. Use /auth/refresh to obtain a new one.',
        });
      }
      return res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid or forged token' });
    }
  };
}

const requireAuth = createAuthMiddleware(verifySessionToken);

module.exports = { requireAuth, createAuthMiddleware };
