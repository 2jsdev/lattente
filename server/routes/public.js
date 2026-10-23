const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validate } = require("../middleware/validate");
const {
  categoriesQuery,
  productsQuery,
  categorySlugParams,
  createOrderBody,
  createFeedbackBody,
} = require("../validation/public");
const healthController = require("../controllers/public/healthController");
const categoriesController = require("../controllers/public/categoriesController");
const productsController = require("../controllers/public/productsController");
const ordersController = require("../controllers/public/ordersController");
const feedbackController = require("../controllers/public/feedbackController");

const router = express.Router();

router.get("/health", asyncHandler(healthController.check));

router.get(
  "/categories",
  validate({ query: categoriesQuery }),
  asyncHandler(categoriesController.list)
);

router.get(
  "/categories/:slug",
  validate({ params: categorySlugParams }),
  asyncHandler(categoriesController.show)
);

router.get(
  "/products",
  validate({ query: productsQuery }),
  asyncHandler(productsController.list)
);

router.post(
  "/orders",
  validate({ body: createOrderBody }),
  asyncHandler(ordersController.create)
);

router.post(
  "/feedback",
  validate({ body: createFeedbackBody }),
  asyncHandler(feedbackController.create)
);

module.exports = router;
