const { z } = require("zod");

const categoriesQuery = z.object({
  group: z.string().trim().optional(),
  home: z.enum(["true", "false"]).optional(),
});

const productsQuery = z.object({
  category: z.string().trim().optional(),
  featured: z.enum(["true", "false"]).optional(),
});

const categorySlugParams = z.object({
  slug: z.string().trim().min(1),
});

const orderItem = z.object({
  productId: z.coerce.number().int().positive().optional().nullable(),
  name: z.string().trim().optional(),
  price: z.coerce.number().optional(),
  quantity: z.coerce.number().int().positive().default(1),
});

const createOrderBody = z.object({
  email: z.string().trim().email("email inválido"),
  address: z.string().trim().min(1, "address es requerido"),
  quantity: z.coerce.number().int().positive().default(1),
  notes: z.string().trim().optional().nullable(),
  items: z.array(orderItem).min(1, "Selecciona al menos un producto"),
});

const createFeedbackBody = z.object({
  email: z.string().trim().email("email inválido"),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().optional().nullable(),
});

module.exports = {
  categoriesQuery,
  productsQuery,
  categorySlugParams,
  createOrderBody,
  createFeedbackBody,
};
