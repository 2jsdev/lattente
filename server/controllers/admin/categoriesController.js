const categoryModel = require("../../models/categoryModel");
const { publicUploadPath } = require("../../middleware/upload");

async function list(_req, res) {
  res.json(await categoryModel.listAll());
}

async function create(req, res) {
  const uploaded = req.file ? publicUploadPath(req.file.filename) : null;
  res.status(201).json(await categoryModel.create(req.body, uploaded));
}

async function update(req, res) {
  const uploaded = req.file ? publicUploadPath(req.file.filename) : null;
  res.json(await categoryModel.update(req.params.id, req.body, uploaded));
}

async function remove(req, res) {
  res.json(await categoryModel.remove(req.params.id));
}

module.exports = { list, create, update, remove };
