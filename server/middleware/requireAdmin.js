const { unauthorized } = require("../lib/http");
const { JWT_SECRET, verifyAdminToken } = require("../lib/auth");

function requireAdmin(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    return next(unauthorized());
  }

  try {
    const payload = verifyAdminToken(token);
    if (payload?.role !== "admin") {
      return next(unauthorized());
    }
    req.admin = payload;
    return next();
  } catch {
    return next(unauthorized());
  }
}

module.exports = { requireAdmin, JWT_SECRET };
