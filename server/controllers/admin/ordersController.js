const orderModel = require("../../models/orderModel");

async function list(_req, res) {
  res.json(await orderModel.listAll());
}

async function updateStatus(req, res) {
  res.json(await orderModel.updateStatus(req.params.id, req.body.status));
}

module.exports = { list, updateStatus };
