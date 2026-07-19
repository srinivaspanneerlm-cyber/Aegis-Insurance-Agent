import type { RequestHandler } from "express";
import AppError from "../utils/appError";

type SchemaFn = (data: Record<string, unknown>) => string[] | null;

export const validateBody = (schemaFn: SchemaFn): RequestHandler => {
  return (req, res, next) => {
    const errors = schemaFn(req.body);
    if (errors) {
      return next(new AppError(`Validation error: ${errors.join(" | ")}`, 400, "VALIDATION_ERROR"));
    }
    next();
  };
};
