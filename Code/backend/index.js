const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const fs = require('fs');
const https = require('https');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/auth');
const ngoRoutes = require('./src/routes/ngo');
const listingsRoutes = require('./src/routes/listings');
const claimsRoutes = require('./src/routes/claims');
const notificationsRoutes = require('./src/routes/notifications');
const adminRoutes = require('./src/routes/admin');
const dashboardRoutes = require('./src/routes/dashboard');
const partnerRoutes = require('./src/routes/partner');

const app = express();
app.use((req, res, next) => {
  const currentPort = process.env.PORT || 4000;
  res.setHeader('X-Served-By', String(currentPort));
  console.log(`Handled by port ${currentPort} (pid ${process.pid}): ${req.method} ${req.url}`);
  next();
});

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Keep the permissive local setup for development and tests. In production,
    // browser requests must come from an explicitly configured frontend origin.
    if (process.env.NODE_ENV !== 'production' || !origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
}));
// 8mb: photos are sent as base64 JSON (~33% larger than the binary), and the
// local image driver's own 5MB-per-file cap (src/services/localImageStorage.js)
// needs headroom under this to ever be reached — express's 100kb default would
// reject a real phone photo before it got anywhere near that check.
app.use(express.json({ limit: '8mb' }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', port: process.env.PORT || 4000, pid: process.pid });
});
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', port: process.env.PORT || 4000, pid: process.pid });
});

// Task 13A — serves files written by src/services/localImageStorage.js.
// Read-only static serving of server-generated filenames only; the production
// driver (Cloudinary, task 13B) returns absolute HTTPS URLs instead and never
// touches this route.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/ngo', ngoRoutes);
app.use('/api/ngo', ngoRoutes);
app.use('/listings', listingsRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/claims', claimsRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/admin', adminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/partner', partnerRoutes);
app.use('/api/partner', partnerRoutes);

// Global error handler — defense in depth. Route-level validation should
// catch expected bad input before this ever fires, but any unexpected error
// (a DB constraint violation slipping through, a bug, etc.) must never leak
// a raw HTML stack-trace page to the client the way Express's own default
// handler does. Registered after every route; the 4-arg signature is what
// tells Express this is an error handler, not a normal route/middleware —
// Express 5's routers already forward a rejected async handler's error here
// automatically, no per-route try/catch needed.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

// Local development uses HTTP by default so the browser doesn't need to
// accept a self-signed certificate for the API origin. Set DEV_HTTPS=1 to
// opt in to the per-machine certificate. Production TLS is provided by the
// deployment's HTTPS terminator; this local certificate is never used there.
const CERT_DIR = path.join(__dirname, '..', 'certs');
const CERT_PATH = path.join(CERT_DIR, 'dev-cert.pem');
const KEY_PATH = path.join(CERT_DIR, 'dev-key.pem');

if (require.main === module) {
  // HTTPS is an explicit local opt-in, and the development certificate is
  // never used in production.
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_HTTPS === '1' && fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    const httpsOptions = {
      key: fs.readFileSync(KEY_PATH),
      cert: fs.readFileSync(CERT_PATH),
    };
    https.createServer(httpsOptions, app).listen(PORT, () => {
      console.log(`Backend listening on https://localhost:${PORT} (self-signed dev cert)`);
    });
  } else {
    app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });
  }
}

module.exports = app;
