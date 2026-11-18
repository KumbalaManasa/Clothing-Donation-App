const { verifySessionToken } = require('../services/sessionToken');

/**
 * Type 2: JWT Bearer Token Authentication Middleware
 *
 * 1. Reads the HTTP `Authorization` request header sent by the client.
 * 2. Validates format: `Bearer <jwt-token>`.
 * 3. Cryptographically verifies the signature and expiration using JWT_SECRET.
 * 4. Populates req.user = { uid, role, name, email } directly from token payload.
 *    (Stateless — 0 database lookups required!).
 * 5. Rejects missing, malformed, expired, or tampered tokens with 401 Unauthorized.
 */
function createAuthMiddleware(verifyTokenFn) {
  return async function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || '';

    if (!authHeader) {
      return res.status(401).json({ message: 'Missing Authorization header' });
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Invalid Authorization header format. Expected Bearer <token>' });
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
