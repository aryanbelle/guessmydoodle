const admin = require("firebase-admin");

function getAdminApp() {
  if (admin.apps.length) return admin.app();

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (_) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON");
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return admin.app();
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    return admin.app();
  }

  throw new Error("Configure FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS to enable Firebase sign-in");
}

async function verifyIdToken(idToken) {
  return getAdminApp().auth().verifyIdToken(idToken);
}

module.exports = verifyIdToken;
