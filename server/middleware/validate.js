const { ZodError } = require("zod");
const { badRequest } = require("../lib/http");

function formatZodError(err) {
  return err.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "body";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function validate(schemas = {}) {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body ?? {});
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query ?? {});
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params ?? {});
      }
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(badRequest(formatZodError(err)));
      }
      return next(err);
    }
  };
}

module.exports = { validate, formatZodError };
