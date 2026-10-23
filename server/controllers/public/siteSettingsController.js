const siteSettingsModel = require("../../models/siteSettingsModel");

async function getSocialLinks(_req, res) {
  res.json(await siteSettingsModel.getSocialLinks());
}

module.exports = { getSocialLinks };
