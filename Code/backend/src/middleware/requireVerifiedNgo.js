const db = require('../db');

// LLD §7 / §3.3: only government-verified NGOs may claim/browse/distribute.
// verification_status can change after a token was issued (e.g. via reverify,
// task 2.8), so this checks the current DB row rather than trusting anything
// baked into the token itself — the token only carries role (task 2.10).
async function requireVerifiedNgo(req, res, next) {
  if (!req.user || req.user.role !== 'ngo') {
    return res.status(403).json({ message: 'Requires a verified NGO account' });
  }

  const user = await db('users').where({ id: req.user.uid }).first();
  if (!user || user.verification_status !== 'verified') {
    return res.status(403).json({ message: 'Requires a verified NGO account' });
  }

  next();
}

module.exports = { requireVerifiedNgo };
