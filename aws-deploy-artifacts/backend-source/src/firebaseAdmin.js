const admin = require('firebase-admin');

// Lazy init: only touches env vars / initializes the SDK on first real use,
// so requiring this module doesn't fail before FIREBASE_* is configured
// (LLD §3: all endpoints expect a Firebase Auth bearer token).
let app;

function getFirebaseAdmin() {
  if (!app) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  }
  return app;
}

module.exports = { getFirebaseAdmin };
