const orderModel = require("../../models/orderModel");

async function create(req, res) {
  const { email, address, quantity, items, notes } = req.body;
  const order = await orderModel.createWithItems({
    email,
    address,
    quantity,
    items,
    notes,
  });
  res.status(201).json({ ok: true, order });
}

module.exports = { create };
