const { ZodError } = require("zod");
const { HttpError } = require("../lib/http");
const { formatZodError } = require("./validate");
const { logger } = require("../lib/logger");

function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extras });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ error: formatZodError(err) });
  }

  if (err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError") {
    return res.status(401).json({ error: "No autorizado" });
  }

  if (err?.code === "LIMIT_FILE_SIZE") {
    return res
      .status(400)
      .json({ error: "La imagen supera el tamaño máximo (5 MB)" });
  }

  if (err?.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ error: "Campo de archivo no permitido" });
  }

  if (err?.message?.includes("Solo se permiten imágenes")) {
    return res.status(400).json({ error: err.message });
  }

  if (err?.code === "23505") {
    return res.status(409).json({ error: "Registro duplicado" });
  }

  logger.error({ err }, "Unhandled error");
  return res.status(500).json({ error: err.message || "Error interno" });
}

module.exports = { errorHandler };
