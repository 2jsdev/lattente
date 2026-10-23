const { z } = require("zod");

const boolFromForm = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "on", "yes"].includes(normalized)) return true;
  if (["false", "0", "off", "no"].includes(normalized)) return false;
  return value;
}, z.boolean().optional());

const numberFromForm = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  return value;
}, z.coerce.number().optional());

const requiredNumberFromForm = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return value;
  return value;
}, z.coerce.number());

const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

module.exports = {
  boolFromForm,
  numberFromForm,
  requiredNumberFromForm,
  idParam,
};
