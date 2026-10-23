const fs = require("fs");
const path = require("path");
const multer = require("multer");
const sharp = require("sharp");
const { asyncHandler } = require("./asyncHandler");
const { logger } = require("../lib/logger");
const { uploadsDir } = require("../config/paths");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
      ? ext
      : ".jpg";
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${safeExt}`);
  },
});

function imageFileFilter(_req, file, cb) {
  if (!file.mimetype?.startsWith("image/")) {
    return cb(new Error("Solo se permiten imágenes"));
  }
  cb(null, true);
}

const uploader = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 8,
  },
});

const uploadProductPhotos = uploader.array("photos", 8);
const uploadCategoryPhoto = uploader.single("photo");

function publicUploadPath(filename) {
  return `/uploads/${filename}`;
}

function filesToPublicPaths(files = []) {
  return files.map((file) => publicUploadPath(file.filename));
}

function collectedUploadFiles(req) {
  const files = [];
  if (Array.isArray(req.files)) files.push(...req.files);
  if (req.file) files.push(req.file);
  return files;
}

const optimizeUploadedImages = asyncHandler(async (req, _res, next) => {
  const files = collectedUploadFiles(req);
  if (!files.length) return next();

  for (const file of files) {
    const base = path.basename(file.filename, path.extname(file.filename));
    const outName = `${base}.webp`;
    const outPath = path.join(uploadsDir, outName);

    try {
      await sharp(file.path)
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toFile(outPath);

      if (outPath !== file.path) {
        fs.unlink(file.path, (err) => {
          if (err) {
            logger.warn({ err, file: file.path }, "No se pudo borrar original");
          }
        });
      }

      file.filename = outName;
      file.path = outPath;
      file.mimetype = "image/webp";
    } catch (err) {
      logger.warn(
        { err, file: file.filename },
        "No se pudo optimizar imagen; se conserva el original"
      );
    }
  }

  next();
});

module.exports = {
  uploadsDir,
  uploadProductPhotos,
  uploadCategoryPhoto,
  optimizeUploadedImages,
  publicUploadPath,
  filesToPublicPaths,
};
