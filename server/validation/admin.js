const { z } = require("zod");
const {
  boolFromForm,
  numberFromForm,
  requiredNumberFromForm,
  idParam,
} = require("./helpers");

const loginBody = z.object({
  password: z.string().min(1, "password es requerido"),
});

const productBody = z.object({
  category_id: requiredNumberFromForm,
  name: z.string().trim().min(1, "name es requerido"),
  description: z.string().trim().optional().nullable(),
  price: requiredNumberFromForm,
  currency: z.string().trim().optional().default("Bs."),
  images: z.string().optional(),
  image_url: z.string().trim().optional().nullable(),
  featured: boolFromForm.default(false),
  active: boolFromForm.default(true),
  sort_order: numberFromForm.default(0),
});

const productUpdateBody = productBody.partial().extend({
  name: z.string().trim().min(1).optional(),
  category_id: numberFromForm,
  price: numberFromForm,
});

const categoryBody = z.object({
  name: z.string().trim().min(1, "name es requerido"),
  slug: z.string().trim().optional(),
  image_url: z.string().trim().optional().nullable(),
  menu_group: z.string().trim().optional().default("comida"),
  show_on_home: boolFromForm.default(true),
  sort_order: numberFromForm.default(0),
});

const categoryUpdateBody = categoryBody.partial().extend({
  name: z.string().trim().min(1).optional(),
});

const orderStatusBody = z.object({
  status: z.enum(["pending", "confirmed", "done", "cancelled"]),
});

module.exports = {
  loginBody,
  productBody,
  productUpdateBody,
  categoryBody,
  categoryUpdateBody,
  orderStatusBody,
  idParam,
};
