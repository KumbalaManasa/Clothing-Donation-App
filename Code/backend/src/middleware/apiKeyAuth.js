const crypto = require('crypto');
const db = require('../db');

/**
 * Type 5: API Key Authentication Middleware (Backend-to-Backend)
 *
 * 1. Checks HTTP request header `X-API-Key` (or `Authorization: ApiKey <key>`).
 * 2. Computes SHA-256 hash of the raw API key.
 * 3. Looks up the active key record in PostgreSQL `api_keys`.
 * 4. Verifies the key is active (not revoked).
 * 5. Attaches `req.apiClient = { id, name, prefix }` to the request object.
 * 6. Returns 401 Unauthorized if missing, or 403 Forbidden if invalid/revoked.
 */
async function requireApiKey(req, res, next) {
  // Check header X-API-Key or Authorization: ApiKey <key>
  let rawKey = req.headers['x-api-key'];

  if (!rawKey && req.headers['authorization']) {
    const [scheme, token] = req.headers['authorization'].split(' ');
    if (scheme === 'ApiKey' || scheme === 'Bearer') {
      rawKey = token;
    }
  }

  if (!rawKey) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'API Key missing. Please provide the X-API-Key header.',
    });
  }

  try {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const keyRecord = await db('api_keys')
      .where({ key_hash: keyHash })
      .first();

    if (!keyRecord) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Invalid API Key.',
      });
    }

    if (!keyRecord.is_active) {
      return res.status(403).json({
        error: 'KEY_REVOKED',
        message: 'This API Key has been revoked or deactivated.',
      });
    }

    // Attach verified machine client metadata
    req.apiClient = {
      id: keyRecord.id,
      name: keyRecord.name,
      prefix: keyRecord.key_prefix,
    };

    next();
  } catch (err) {
    console.error('API Key verification error:', err);
    return res.status(500).json({ message: 'Internal server error verifying API key' });
  }
}

module.exports = { requireApiKey };

