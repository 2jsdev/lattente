const { renderPage, hasPage, queryString } = require("../views/pages");

function home(req, res) {
  renderPage(res, "/");
}

function menu(req, res) {
  renderPage(res, "/menu");
}

function orders(req, res) {
  renderPage(res, "/orders");
}

function feedback(req, res) {
  renderPage(res, "/feedback");
}

function admin(req, res) {
  renderPage(res, "/admin");
}

function creationsRedirect(req, res) {
  res.redirect(301, `/menu${queryString(req.url)}`);
}

function htmlRedirect(req, res, next) {
  const name = req.params[0];
  const qs = queryString(req.url);

  if (name === "index") {
    return res.redirect(301, `/${qs}`);
  }
  if (name === "creations") {
    return res.redirect(301, `/menu${qs}`);
  }

  const clean = `/${name}`;
  if (hasPage(clean)) {
    return res.redirect(301, `${clean}${qs}`);
  }
  return next();
}

module.exports = {
  home,
  menu,
  orders,
  feedback,
  admin,
  creationsRedirect,
  htmlRedirect,
};
