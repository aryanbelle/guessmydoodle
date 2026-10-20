const crypto = require("crypto");

const DEV_SECRET = "local-only-guess-my-doodle-secret-change-before-deploy";

function getSecret() {
  const secret = process.env.GUEST_TOKEN_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("Set GUEST_TOKEN_SECRET to a random value of at least 32 characters in production");
  }
  return secret || DEV_SECRET;
}

function sanitizeNickname(value) {
  return String(value || "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 24);
}

function signature(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest();
}

function createGuest(nickname) {
  const clean = sanitizeNickname(nickname);
  if (!clean) throw new Error("Choose a nickname before joining");
  const user = { uid: `guest-${crypto.randomUUID()}`, nickname: clean, isAnonymous: true, photoURL: null };
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString("base64url");
  const token = `guest:${payload}.${signature(payload).toString("base64url")}`;
  return { user, token };
}

function verifyGuestToken(token) {
  if (typeof token !== "string" || !token.startsWith("guest:")) throw new Error("Invalid guest token");
  const [payload, providedSignature, extra] = token.slice(6).split(".");
  if (!payload || !providedSignature || extra) throw new Error("Invalid guest token");
  const actual = signature(payload);
  let expected;
  try { expected = Buffer.from(providedSignature, "base64url"); } catch (_) { throw new Error("Invalid guest token"); }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error("Invalid guest token");
  const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!user.uid?.startsWith("guest-") || !user.nickname || user.exp < Date.now()) throw new Error("Guest session has expired");
  return { uid: user.uid, nickname: sanitizeNickname(user.nickname), isDummy: true };
}

module.exports = { createGuest, verifyGuestToken, assertGuestTokenSecret: getSecret };
