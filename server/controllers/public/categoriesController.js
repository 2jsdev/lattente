const categoryModel = require("../../models/categoryModel");
const { notFound } = require("../../lib/http");

async function list(req, res) {
  const { group, home } = req.query;
  res.json(await categoryModel.listPublic({ group, home }));
}

async function show(req, res) {
  const category = await categoryModel.findBySlugWithProducts(req.params.slug);
  if (!category) {
    throw notFound("Categoría no encontrada");
  }
  res.json(category);
}

module.exports = { list, show };
