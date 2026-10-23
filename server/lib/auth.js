const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.ADMIN_SECRET ||
  "lattente-dev-secret-change-me";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "lattente-admin";
const TOKEN_TTL = process.env.JWT_EXPIRES_IN || "12h";

function passwordsMatch(input, expected) {
  const a = Buffer.from(String(input || ""));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createToken(payload = { role: "admin" }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function login(password) {
  if (!passwordsMatch(password, ADMIN_PASSWORD)) {
    return null;
  }
  return createToken({ role: "admin", sub: "admin" });
}

function verifyAdminToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  JWT_SECRET,
  createToken,
  login,
  verifyAdminToken,
};
