const path = require("path");

const rootDir = path.join(__dirname, "..", "..");
const publicDir = path.join(rootDir, "public");
const sqlDir = path.join(rootDir, "db");

// Uploads live in their own directory so production can back them with a
// persistent volume (see the Dockerfile's UPLOAD_DIR). Locally they stay
// inside public/ so the dev server serves them straight from disk.
const uploadsDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(publicDir, "uploads");

module.exports = {
  rootDir,
  publicDir,
  uploadsDir,
  sqlDir,
};
