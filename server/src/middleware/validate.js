// validate({ body, params, query }) checks each part of the request with a Zod schema.
// Pass .strict() schemas so unknown keys are rejected instead of silently passing through.
export function validate(schemas) {
  return (req, res, next) => {
    for (const part of ["params", "query", "body"]) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      // The ZodError goes to errorHandler, which answers 400 VALIDATION_ERROR with field details.
      if (!result.success) return next(result.error);
      // Express 5 makes req.query a read-only getter, so parsed query values live on req.valid.
      req.valid = { ...req.valid, [part]: result.data };
      if (part === "body") req.body = result.data;
    }
    return next();
  };
}
