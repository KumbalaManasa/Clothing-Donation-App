const crypto = require('crypto');
const db = require('../db');

const SESSION_COOKIE_NAME = 'sid';
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Parses raw Cookie header string into a key-value dictionary.
 * Example: "sid=abc123xyz; other=value" -> { sid: "abc123xyz", other: "value" }
 */
function parseCookies(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return {};

  const cookies = {};
  cookieHeader.split(';').forEach((cookieStr) => {
    const [rawName, ...rawVal] = cookieStr.split('=');
    if (rawName) {
      cookies[rawName.trim()] = decodeURIComponent(rawVal.join('=').trim());
    }
  });
  return cookies;
}

/**
 * Creates a new session in the database:
 * 1. Generates a cryptographically strong 64-char random string (Session ID).
 * 2. Saves (sessionId -> userId, expires_at) into the PostgreSQL `sessions` table.
 * 3. Returns the new sessionId string.
 */
async function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db('sessions').insert({
    id: sessionId,
    user_id: userId,
    expires_at: expiresAt,
  });

  return { sessionId, expiresAt };
}

/**
 * Looks up an active session from the database:
 * 1. Checks if sessionId exists and expires_at > now().
 * 2. Joins with `users` to attach user data (name, email, role).
 */
async function getSession(sessionId) {
  if (!sessionId) return null;

  const session = await db('sessions as s')
    .join('users as u', 'u.id', 's.user_id')
    .where('s.id', sessionId)
    .where('s.expires_at', '>', db.fn.now())
    .select(
      's.id as session_id',
      's.user_id',
      's.expires_at',
      'u.name',
      'u.email',
      'u.phone',
      'u.role',
      'u.org_name',
      'u.registration_number',
      'u.verification_status'
    )
    .first();

  return session || null;
}

/**
 * Deletes a session from the database (used on logout).
 */
async function deleteSession(sessionId) {
  if (!sessionId) return;
  await db('sessions').where({ id: sessionId }).delete();
}

/**
 * Helper to build the Set-Cookie header string.
 */
function buildSessionCookie(sessionId, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function buildClearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

module.exports = {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  parseCookies,
  createSession,
  getSession,
  deleteSession,
  buildSessionCookie,
  buildClearSessionCookie,
};

