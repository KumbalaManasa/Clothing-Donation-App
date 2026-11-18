const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { verifyNgo } = require('../services/verifyNgo');
const { signSessionToken } = require('../services/sessionToken');
const {
  createSession,
  deleteSession,
  buildSessionCookie,
  buildClearSessionCookie,
  parseCookies,
} = require('../services/sessionStore');
const { requireAuth } = require('../middleware/auth');
const {
  generateCode,
  generateLinkToken,
  hashSecret,
  secretMatches,
  expiryTimestamp,
} = require('../services/passwordReset');
const { sendMessage } = require('../services/messageDelivery');

const router = express.Router();

// POST /auth/signup/donor — LLD §3.1: public, creates a users row with role=donor.
// Password is hashed here (never stored or returned in plaintext); password_hash
// is left out of the response on purpose.
router.post('/signup/donor', async (req, res) => {
  const { name, email, phone, password } = req.body || {};

  if (!name || !email || !phone || !password) {
    return res.status(400).json({ message: 'name, email, phone, and password are required' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const [user] = await db('users')
      .insert({
        name,
        email,
        phone,
        password_hash: passwordHash,
        role: 'donor',
      })
      .returning(['id', 'name', 'email', 'phone', 'role', 'created_at']);

    return res.status(201).json(user);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Email already in use' });
    }
    throw err;
  }
});

// POST /auth/signup/ngo — LLD §3.1: public, creates a users row with role=ngo.
// verifyNgo() is called synchronously here (spec.md §6.3 steps 2-4): the
// government lookup completes before the response is sent, and its result is
// persisted directly — there is no 'pending' state (LLD §1.1).
router.post('/signup/ngo', async (req, res) => {
  const { name, email, phone, password, org_name, registration_number } = req.body || {};

  if (!name || !email || !phone || !password) {
    return res.status(400).json({ message: 'name, email, phone, and password are required' });
  }
  if (!org_name) {
    return res.status(400).json({ message: 'org_name is required' });
  }
  if (!registration_number) {
    return res.status(400).json({ message: 'registration_number is required' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const verification = await verifyNgo(registration_number);

  try {
    const [user] = await db('users')
      .insert({
        name,
        email,
        phone,
        password_hash: passwordHash,
        role: 'ngo',
        org_name,
        registration_number,
        verification_status: verification.status,
        verification_checked_at: db.fn.now(),
        verification_source_ref: verification.source_ref,
      })
      .returning([
        'id',
        'name',
        'email',
        'phone',
        'role',
        'org_name',
        'registration_number',
        'verification_status',
        'verification_checked_at',
        'verification_source_ref',
        'created_at',
      ]);

    return res.status(201).json(user);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Email or registration number already in use' });
    }
    throw err;
  }
});

// POST /auth/login — Type 2: JWT Bearer Token (stored in localStorage)
// Verifies user credentials and generates a signed, self-contained JWT token.
// No session is written to PostgreSQL (stateless). No session cookies are set.
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const user = await db('users').where({ email }).first();
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash || '');
  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  // Generate self-contained signed JWT token (claims stored directly inside payload)
  const token = signSessionToken(user);

  // Clear any existing cookie from Type 1 so browser tests don't fall back to cookies
  res.setHeader('Set-Cookie', buildClearSessionCookie());

  return res.status(200).json({
    token, // Client will store this in localStorage and send as "Authorization: Bearer <token>"
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      org_name: user.org_name,
      registration_number: user.registration_number,
      verification_status: user.verification_status,
    },
  });
});

// POST /auth/logout — Type 2: Stateless JWT logout
// Since stateless JWTs have no server-side database record, logout is handled
// client-side by deleting the token from localStorage. We also clear any old cookie.
router.post('/logout', async (req, res) => {
  res.setHeader('Set-Cookie', buildClearSessionCookie());
  return res.status(200).json({
    message: 'Logged out successfully (token deleted from client localStorage)',
  });
});

// GET /auth/me — Returns currently authenticated user claims decoded from the JWT
router.get('/me', requireAuth, async (req, res) => {
  return res.status(200).json({
    user: req.user,
    authType: 'Bearer JWT (localStorage)',
  });
});

// POST /auth/forgot-password — public. Two delivery methods, matching a
// donor/NGO/admin's registered email + phone from signup:
//   method: 'code' — a 6-digit code, re-entered on the same page.
//   method: 'link' — a one-click reset link.
// Both are "sent" to the account's email AND phone (src/services/messageDelivery.js
// — a console-log dev stub locally; see that file for why). The response is
// deliberately identical whether or not the email exists (same principle as
// POST /auth/login never revealing that), so this can't be used to enumerate
// registered accounts. In non-production, the raw code/link is also included
// in the response so the whole flow is testable through the browser alone,
// without needing backend console access.
router.post('/forgot-password', async (req, res) => {
  const { email, method } = req.body || {};

  if (!email || !method) {
    return res.status(400).json({ message: 'email and method are required' });
  }
  if (!['code', 'link'].includes(method)) {
    return res.status(400).json({ message: "method must be 'code' or 'link'" });
  }

  const user = await db('users').where({ email }).first();
  const genericResponse = {
    message: 'If an account exists for that email, a reset code or link has been sent to the registered email and phone number.',
  };

  if (!user) {
    return res.status(200).json(genericResponse);
  }

  // A fresh request supersedes any earlier outstanding one for this user —
  // otherwise an old, still-valid code/link would keep working alongside the
  // new one.
  await db('password_resets').where({ user_id: user.id, used: false }).delete();

  const isCode = method === 'code';
  const secret = isCode ? generateCode() : generateLinkToken();
  const secretHash = await hashSecret(secret);

  await db('password_resets').insert({
    user_id: user.id,
    method,
    secret_hash: secretHash,
    expires_at: expiryTimestamp(),
  });

  const body = isCode
    ? `Your password reset code is ${secret}. It expires in 15 minutes.`
    : `Reset your password using this link: ${process.env.FRONTEND_BASE_URL}/reset-password?token=${secret}\nThis link expires in 15 minutes.`;

  sendMessage({ to: user.email, channel: 'email', subject: 'Password reset request', body });
  sendMessage({ to: user.phone, channel: 'sms', subject: 'Password reset request', body });

  const devReveal = process.env.NODE_ENV !== 'production';
  return res.status(200).json({
    ...genericResponse,
    ...(devReveal && isCode ? { dev_code: secret } : {}),
    ...(devReveal && !isCode ? { dev_reset_link: `${process.env.FRONTEND_BASE_URL}/reset-password?token=${secret}` } : {}),
  });
});

// POST /auth/reset-password/code — public. Pairs with the 'code' method
// above: email identifies the account (codes are short, so scoping the
// lookup to one user before comparing avoids a slow full-table bcrypt scan),
// code is compared against the stored hash, and — same generic-error
// philosophy as login/forgot-password — any failure (wrong code, expired,
// already used, unknown email) returns the identical message.
router.post('/reset-password/code', async (req, res) => {
  const { email, code, new_password: newPassword } = req.body || {};

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'email, code, and new_password are required' });
  }

  const genericError = { message: 'Invalid or expired code' };

  const user = await db('users').where({ email }).first();
  if (!user) {
    return res.status(400).json(genericError);
  }

  const resetRow = await db('password_resets')
    .where({ user_id: user.id, method: 'code', used: false })
    .andWhere('expires_at', '>', db.fn.now())
    .orderBy('created_at', 'desc')
    .first();

  if (!resetRow || !(await secretMatches(code, resetRow.secret_hash))) {
    return res.status(400).json(genericError);
  }

  await db.transaction(async (trx) => {
    await trx('password_resets').where({ id: resetRow.id }).update({ used: true });
    await trx('users').where({ id: user.id }).update({ password_hash: await bcrypt.hash(newPassword, 10) });
  });

  return res.status(200).json({ message: 'Password has been reset. You can now log in.' });
});

// POST /auth/reset-password/link — public. Pairs with the 'link' method: the
// token alone identifies both the account and the request (that's the point
// of a link — no separate email re-entry), so every outstanding unused,
// unexpired link-reset row across all users is checked against it. Local-app
// scale makes that linear scan fine; same generic-error philosophy applies.
router.post('/reset-password/link', async (req, res) => {
  const { token, new_password: newPassword } = req.body || {};

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'token and new_password are required' });
  }

  const genericError = { message: 'Invalid or expired link' };

  const candidates = await db('password_resets')
    .where({ method: 'link', used: false })
    .andWhere('expires_at', '>', db.fn.now());

  let matched = null;
  for (const candidate of candidates) {
    if (await secretMatches(token, candidate.secret_hash)) {
      matched = candidate;
      break;
    }
  }

  if (!matched) {
    return res.status(400).json(genericError);
  }

  await db.transaction(async (trx) => {
    await trx('password_resets').where({ id: matched.id }).update({ used: true });
    await trx('users').where({ id: matched.user_id }).update({ password_hash: await bcrypt.hash(newPassword, 10) });
  });

  return res.status(200).json({ message: 'Password has been reset. You can now log in.' });
});

module.exports = router;
