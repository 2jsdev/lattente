const productModel = require("../../models/productModel");
const { filesToPublicPaths } = require("../../middleware/upload");

async function list(_req, res) {
  res.json(await productModel.listAll());
}

async function create(req, res) {
  const uploaded = filesToPublicPaths(req.files || []);
  res.status(201).json(await productModel.create(req.body, uploaded));
}

async function update(req, res) {
  const uploaded = filesToPublicPaths(req.files || []);
  res.json(await productModel.update(req.params.id, req.body, uploaded));
}

async function remove(req, res) {
  res.json(await productModel.remove(req.params.id));
}

module.exports = { list, create, update, remove };
