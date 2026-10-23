class HttpError extends Error {
  constructor(status, message, extras = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.extras = extras;
  }
}

function ensureHttpError(err) {
  if (err instanceof HttpError) return err;
  if (err?.status && Number.isInteger(err.status)) {
    return new HttpError(err.status, err.message);
  }
  return err;
}

function notFound(message) {
  return new HttpError(404, message);
}

function badRequest(message) {
  return new HttpError(400, message);
}

function conflict(message) {
  return new HttpError(409, message);
}

function unauthorized(message = "No autorizado") {
  return new HttpError(401, message);
}

module.exports = {
  HttpError,
  ensureHttpError,
  notFound,
  badRequest,
  conflict,
  unauthorized,
};
