const crypto = require('crypto');
const db = require('../db');

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Creates and stores a new refresh token in the database.
 * If familyId is not provided, a new family UUID is generated (new login session).
 */
async function createRefreshToken(userId, familyId = null) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const resolvedFamilyId = familyId || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_MAX_AGE_SECONDS * 1000);

  await db('refresh_tokens').insert({
    token_hash: tokenHash,
    user_id: userId,
    family_id: resolvedFamilyId,
    is_revoked: false,
    expires_at: expiresAt,
  });

  return {
    refreshToken: rawToken,
    familyId: resolvedFamilyId,
    expiresAt,
  };
}

/**
 * Rotates an existing refresh token:
 * 1. Hashes the incoming token and looks up the DB record.
 * 2. If the token was ALREADY revoked -> REUSE DETECTED!
 *    Invalidates all tokens in this family (attacker defense).
 * 3. If valid -> marks old token as revoked (used) and generates a NEW refresh token
 *    in the same family.
 */
async function rotateRefreshToken(rawToken) {
  if (!rawToken) {
    return { error: 'missing_token' };
  }

  const tokenHash = hashToken(rawToken);
  const tokenRow = await db('refresh_tokens').where({ token_hash: tokenHash }).first();

  if (!tokenRow) {
    return { error: 'invalid_token' };
  }

  // REUSE DETECTION: If this token was already used/revoked, an attacker or compromised client
  // is attempting to replay an old token. Immediately kill the entire session family!
  if (tokenRow.is_revoked) {
    await db('refresh_tokens')
      .where({ family_id: tokenRow.family_id })
      .update({ is_revoked: true });
    return { error: 'reuse_detected', familyId: tokenRow.family_id };
  }

  // Expiration check
  if (new Date(tokenRow.expires_at) < new Date()) {
    return { error: 'token_expired' };
  }

  // Consume (revoke) current token so it cannot be used again
  await db('refresh_tokens')
    .where({ id: tokenRow.id })
    .update({ is_revoked: true });

  // Issue brand new refresh token in the same family (Rotation)
  const newRefresh = await createRefreshToken(tokenRow.user_id, tokenRow.family_id);

  // Fetch user details for the new access token
  const user = await db('users').where({ id: tokenRow.user_id }).first();

  return {
    newRefreshToken: newRefresh.refreshToken,
    expiresAt: newRefresh.expiresAt,
    user,
  };
}

/**
 * Revokes a refresh token on logout.
 */
async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await db('refresh_tokens').where({ token_hash: tokenHash }).update({ is_revoked: true });
}

function buildRefreshCookie(rawToken) {
  return `${REFRESH_COOKIE_NAME}=${rawToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${REFRESH_MAX_AGE_SECONDS}`;
}

function buildClearRefreshCookie() {
  return `${REFRESH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

module.exports = {
  REFRESH_COOKIE_NAME,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  buildRefreshCookie,
  buildClearRefreshCookie,
  hashToken,
};
