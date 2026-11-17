// Role-gating middleware — HLD §5 / LLD §3. Must run after requireAuth
// (task 2.1/2.9), which is what populates req.user.role from the session token.
function requireRole(role) {
  return function (req, res, next) {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: `Requires role: ${role}` });
    }
    next();
  };
}

module.exports = { requireRole };
