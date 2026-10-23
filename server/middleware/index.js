const { asyncHandler } = require("./asyncHandler");
const { errorHandler } = require("./errorHandler");
const { requireAdmin, JWT_SECRET } = require("./requireAdmin");
const { validate } = require("./validate");
const { loginLimiter, apiLimiter } = require("./rateLimit");
const {
  uploadProductPhotos,
  uploadCategoryPhoto,
  optimizeUploadedImages,
  filesToPublicPaths,
  publicUploadPath,
} = require("./upload");

module.exports = {
  asyncHandler,
  errorHandler,
  requireAdmin,
  JWT_SECRET,
  validate,
  loginLimiter,
  apiLimiter,
  uploadProductPhotos,
  uploadCategoryPhoto,
  optimizeUploadedImages,
  filesToPublicPaths,
  publicUploadPath,
};
