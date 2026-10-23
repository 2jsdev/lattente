const { login } = require("../../lib/auth");
const { unauthorized } = require("../../lib/http");

async function loginAdmin(req, res) {
  const token = login(req.body.password);
  if (!token) {
    throw unauthorized("Contraseña incorrecta");
  }
  res.json({ ok: true, token, token_type: "Bearer" });
}

function me(req, res) {
  res.json({ ok: true, role: "admin", admin: req.admin });
}

module.exports = { loginAdmin, me };
