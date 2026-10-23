const feedbackModel = require("../../models/feedbackModel");

async function list(_req, res) {
  res.json(await feedbackModel.listAll());
}

module.exports = { list };
