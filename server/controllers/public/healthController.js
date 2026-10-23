const healthModel = require("../../models/healthModel");

async function check(_req, res) {
  res.json(await healthModel.ping());
}

module.exports = { check };
