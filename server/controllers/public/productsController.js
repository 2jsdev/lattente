const productModel = require("../../models/productModel");

async function list(req, res) {
  const { category, featured } = req.query;
  res.json(await productModel.listActive({ category, featured }));
}

module.exports = { list };
