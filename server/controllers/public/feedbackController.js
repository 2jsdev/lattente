const feedbackModel = require("../../models/feedbackModel");

async function create(req, res) {
  const { email, rating, comment } = req.body;
  const feedback = await feedbackModel.create({ email, rating, comment });
  res.status(201).json({ ok: true, feedback });
}

module.exports = { create };
