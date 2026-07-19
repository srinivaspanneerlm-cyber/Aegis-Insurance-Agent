import type { Request, RequestHandler } from "express";
import AppError from "../utils/appError";

type SchemaFn = (data: Record<string, unknown>) => string[] | null;

// Build a validator for a given part of the request. Keeps body/params/query
// validation identical in behaviour (400 VALIDATION_ERROR with field detail),
// stopping invalid data before it reaches a service.
const makeValidator = (pick: (req: Request) => Record<string, unknown>) =>
  (schemaFn: SchemaFn): RequestHandler =>
    (req, res, next) => {
      const errors = schemaFn(pick(req));
      if (errors) {
        return next(new AppError(`Validation error: ${errors.join(" | ")}`, 400, "VALIDATION_ERROR"));
      }
      next();
    };

export const validateBody = makeValidator((req) => req.body as Record<string, unknown>);
export const validateParams = makeValidator((req) => req.params as Record<string, unknown>);
export const validateQuery = makeValidator((req) => req.query as Record<string, unknown>);
