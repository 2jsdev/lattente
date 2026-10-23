const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const { errorHandler } = require("../middleware/errorHandler");
const { requireAdmin } = require("../middleware/requireAdmin");
const { validate } = require("../middleware/validate");
const { loginLimiter } = require("../middleware/rateLimit");
const {
  uploadProductPhotos,
  uploadCategoryPhoto,
  optimizeUploadedImages,
} = require("../middleware/upload");
const {
  loginBody,
  productBody,
  productUpdateBody,
  categoryBody,
  categoryUpdateBody,
  orderStatusBody,
  socialLinksBody,
  idParam,
} = require("../validation/admin");
const authController = require("../controllers/admin/authController");
const productsController = require("../controllers/admin/productsController");
const categoriesController = require("../controllers/admin/categoriesController");
const ordersController = require("../controllers/admin/ordersController");
const feedbackController = require("../controllers/admin/feedbackController");
const siteSettingsController = require("../controllers/admin/siteSettingsController");

const router = express.Router();

router.post(
  "/login",
  loginLimiter,
  validate({ body: loginBody }),
  asyncHandler(authController.loginAdmin)
);

router.use(requireAdmin);

router.get("/me", authController.me);

router.get("/products", asyncHandler(productsController.list));
router.post(
  "/products",
  uploadProductPhotos,
  optimizeUploadedImages,
  validate({ body: productBody }),
  asyncHandler(productsController.create)
);
router.put(
  "/products/:id",
  uploadProductPhotos,
  optimizeUploadedImages,
  validate({ params: idParam, body: productUpdateBody }),
  asyncHandler(productsController.update)
);
router.delete(
  "/products/:id",
  validate({ params: idParam }),
  asyncHandler(productsController.remove)
);

router.get("/categories", asyncHandler(categoriesController.list));
router.post(
  "/categories",
  uploadCategoryPhoto,
  optimizeUploadedImages,
  validate({ body: categoryBody }),
  asyncHandler(categoriesController.create)
);
router.put(
  "/categories/:id",
  uploadCategoryPhoto,
  optimizeUploadedImages,
  validate({ params: idParam, body: categoryUpdateBody }),
  asyncHandler(categoriesController.update)
);
router.delete(
  "/categories/:id",
  validate({ params: idParam }),
  asyncHandler(categoriesController.remove)
);

router.get("/orders", asyncHandler(ordersController.list));
router.patch(
  "/orders/:id",
  validate({ params: idParam, body: orderStatusBody }),
  asyncHandler(ordersController.updateStatus)
);

router.get("/feedback", asyncHandler(feedbackController.list));

router.get("/site-settings/social-links", asyncHandler(siteSettingsController.getSocialLinks));
router.put(
  "/site-settings/social-links",
  validate({ body: socialLinksBody }),
  asyncHandler(siteSettingsController.saveSocialLinks)
);

router.use(errorHandler);

module.exports = router;
