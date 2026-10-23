const path = require("path");
const { publicDir } = require("../config/paths");

const PAGE_MAP = {
  "/": "index.html",
  "/menu": "menu.html",
  "/orders": "orders.html",
  "/feedback": "feedback.html",
  "/admin": "admin.html",
};

function hasPage(route) {
  return Boolean(PAGE_MAP[route]);
}

function renderPage(res, route) {
  const file = PAGE_MAP[route];
  if (!file) {
    return false;
  }
  res.sendFile(path.join(publicDir, file));
  return true;
}

function queryString(url) {
  return url.includes("?") ? url.slice(url.indexOf("?")) : "";
}

module.exports = {
  PAGE_MAP,
  hasPage,
  renderPage,
  queryString,
};
