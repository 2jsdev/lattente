const siteSettingsModel = require("../../models/siteSettingsModel");

async function getSocialLinks(_req, res) {
  res.json(await siteSettingsModel.getSocialLinks());
}

async function saveSocialLinks(req, res) {
  res.json(await siteSettingsModel.saveSocialLinks(req.body));
}

module.exports = { getSocialLinks, saveSocialLinks };
