const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const {
  computeCodeChallenge,
  verifyCodeChallenge,
  generateState,
  generateCodeVerifier,
} = require('../services/pkceService');
const { signSessionToken } = require('../services/sessionToken');
const { createRefreshToken, buildRefreshCookie } = require('../services/refreshTokenService');

const router = express.Router();

/**
 * 1. GET /auth/oauth/google/init
 * Starts the OAuth 2.0 PKCE flow.
 * Client sends: ?code_challenge=<challenge>&state=<state>
 * Returns the authorization URL or redirect.
 */
router.get('/google/init', async (req, res) => {
  const { code_challenge, code_challenge_method = 'S256', state, return_url } = req.query;

  if (!code_challenge) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      message: 'PKCE code_challenge is required',
    });
  }

  const oauthState = state || generateState();

  // Save state in a secure HttpOnly cookie for CSRF validation upon return
  res.setHeader('Set-Cookie', `oauth_state=${oauthState}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);

  // Directs to the Google Consent page, preserving return_url
  const returnParam = return_url ? `&return_url=${encodeURIComponent(return_url)}` : '';
  const consentUrl = `/api/auth/oauth/google/consent?state=${oauthState}&code_challenge=${encodeURIComponent(code_challenge)}${returnParam}`;

  return res.status(200).json({
    authUrl: consentUrl,
    state: oauthState,
    code_challenge,
    code_challenge_method,
  });
});

/**
 * 2. GET /auth/oauth/google/consent
 * Simulation of Google's Consent Screen.
 */
router.get('/google/consent', async (req, res) => {
  const { state, code_challenge, return_url } = req.query;
  const returnParam = return_url ? `&return_url=${encodeURIComponent(return_url)}` : '';

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Sign in with Google</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0f2f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      .card { background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); width: 420px; padding: 32px; text-align: center; }
      .logo { width: 48px; height: 48px; margin-bottom: 12px; }
      h2 { margin: 8px 0; color: #202124; font-size: 20px; }
      p { color: #5f6368; font-size: 14px; margin-bottom: 24px; }
      .user-option { display: flex; align-items: center; padding: 12px 16px; border: 1px solid #dadce0; border-radius: 8px; margin-bottom: 12px; cursor: pointer; text-decoration: none; color: inherit; transition: background 0.15s, border-color 0.15s; }
      .user-option:hover { background: #f8f9fa; border-color: #1a73e8; }
      .avatar { width: 36px; height: 36px; border-radius: 50%; background: #e8f0fe; color: #1a73e8; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px; font-size: 16px; }
      .info { text-align: left; }
      .name { font-weight: 600; font-size: 14px; color: #3c4043; }
      .email { font-size: 12px; color: #70757a; }
      .tag { margin-left: auto; font-size: 11px; background: #e6f4ea; color: #137333; padding: 2px 8px; border-radius: 12px; font-weight: 500; }
      .footer-info { margin-top: 24px; padding: 10px; background: #f8f9fa; border-radius: 6px; font-size: 12px; color: #5f6368; }
    </style>
  </head>
  <body>
    <div class="card">
      <svg class="logo" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      <h2>Sign in with Google</h2>
      <p>to continue to <strong>WearForward Donation App</strong></p>

      <!-- Option 1: Donor account -->
      <a class="user-option" href="/api/auth/oauth/google/consent-select?account=donor&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(code_challenge)}${returnParam}">
        <div class="avatar">D</div>
        <div class="info">
          <div class="name">Google Donor Account</div>
          <div class="email">donor.google@gmail.com</div>
        </div>
        <span class="tag">Donor</span>
      </a>

      <!-- Option 2: NGO account -->
      <a class="user-option" href="/api/auth/oauth/google/consent-select?account=ngo&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(code_challenge)}${returnParam}">
        <div class="avatar">N</div>
        <div class="info">
          <div class="name">Google NGO Partner</div>
          <div class="email">ngo.google@gmail.com</div>
        </div>
        <span class="tag">NGO</span>
      </a>

      <div class="footer-info">
        🔒 Fast & secure single sign-on powered by Google
      </div>
    </div>
  </body>
  </html>
  `;

  return res.status(200).send(html);
});

/**
 * 3. GET /auth/oauth/google/consent-select
 * User selected an account on the consent screen.
 * Issues a single-use authorization code tied to this PKCE challenge and redirects back to app.
 */
router.get('/google/consent-select', async (req, res) => {
  const { account, state, code_challenge, return_url } = req.query;

  const authCode = 'code_' + crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  const profile = account === 'ngo'
    ? {
        google_id: 'goog_ngo_987654321',
        email: 'ngo.google@gmail.com',
        name: 'Google NGO Partner',
        role: 'ngo',
        org_name: 'Google Community Charity',
        registration_number: 'APPROVED-NGO-GOOGLE',
        verification_status: 'verified',
      }
    : {
        google_id: 'goog_donor_123456789',
        email: 'donor.google@gmail.com',
        name: 'Google Donor Account',
        role: 'donor',
      };

  await db('oauth_codes').insert({
    code: authCode,
    code_challenge: code_challenge,
    code_challenge_method: 'S256',
    state: state,
    profile_payload: JSON.stringify(profile),
    is_used: false,
    expires_at: expiresAt,
  });

  // Redirect back to return_url or fallback
  const fallbackUrl = process.env.FRONTEND_BASE_URL || (account === 'ngo' ? '/ngo' : '/donor');
  const targetBase = return_url || fallbackUrl;
  const delimiter = targetBase.includes('?') ? '&' : '?';
  return res.redirect(`${targetBase}${delimiter}code=${authCode}&state=${encodeURIComponent(state)}`);
});

/**
 * 4. POST /auth/oauth/google/token
 * PKCE Token Exchange:
 * 1. Checks that the code exists, is unexpired, and unused.
 * 2. Compares the presented code_verifier against the stored code_challenge (S256).
 *    -> If verifier doesn't match challenge: REJECTS (Prevents stolen authorization code attack!).
 * 3. Provisions or updates the user in the PostgreSQL users table.
 * 4. Issues the user a legitimate session/access token + refresh token!
 */
router.post('/google/token', async (req, res) => {
  const { code, code_verifier, state } = req.body || {};

  if (!code || !code_verifier) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      message: 'Both authorization code and PKCE code_verifier are required',
    });
  }

  const codeRow = await db('oauth_codes').where({ code }).first();

  if (!codeRow) {
    return res.status(400).json({ error: 'INVALID_GRANT', message: 'Unknown authorization code' });
  }

  if (codeRow.is_used) {
    return res.status(400).json({ error: 'INVALID_GRANT', message: 'Authorization code already used' });
  }

  if (new Date(codeRow.expires_at) < new Date()) {
    return res.status(400).json({ error: 'INVALID_GRANT', message: 'Authorization code has expired' });
  }

  // PKCE VERIFICATION:
  // Hash the presented code_verifier with SHA-256 and base64url-encode it
  const isPkceValid = verifyCodeChallenge(code_verifier, codeRow.code_challenge);

  if (!isPkceValid) {
    return res.status(403).json({
      error: 'PKCE_VERIFICATION_FAILED',
      message: 'PKCE verification failed: code_verifier does not match code_challenge!',
    });
  }

  // Mark code as used immediately (one-time use)
  await db('oauth_codes').where({ code }).update({ is_used: true });

  const profile = typeof codeRow.profile_payload === 'string'
    ? JSON.parse(codeRow.profile_payload)
    : codeRow.profile_payload;

  // Find or provision user in PostgreSQL
  let user = await db('users').where({ email: profile.email }).first();

  if (!user) {
    const [createdUser] = await db('users')
      .insert({
        name: profile.name,
        email: profile.email,
        phone: '+10000000000',
        role: profile.role,
        google_id: profile.google_id,
        org_name: profile.org_name || null,
        registration_number: profile.registration_number || null,
        verification_status: profile.verification_status || null,
      })
      .returning('*');
    user = createdUser;
  } else if (!user.google_id) {
    await db('users').where({ id: user.id }).update({ google_id: profile.google_id });
    user.google_id = profile.google_id;
  }

  // Issue tokens: Access Token + Refresh Token
  const accessToken = signSessionToken(user, '15m');
  const { refreshToken } = await createRefreshToken(user.id);

  // Set HttpOnly refresh token cookie
  res.setHeader('Set-Cookie', buildRefreshCookie(refreshToken));

  // OIDC ID Token: a signed JWT asserting the user's identity
  const idToken = signSessionToken({
    id: user.id,
    sub: profile.google_id,
    email: user.email,
    name: user.name,
    role: user.role,
    iss: 'https://accounts.google.com',
  }, '1h');

  return res.status(200).json({
    accessToken,
    token: accessToken,
    idToken, // OIDC identity token
    tokenType: 'Bearer',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      google_id: user.google_id,
      org_name: user.org_name,
      verification_status: user.verification_status,
    },
  });
});

module.exports = router;

