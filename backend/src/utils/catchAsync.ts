import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

const catchAsync = (fn: AsyncHandler): RequestHandler => {
  // Return the promise so the handler is awaitable (Express ignores the return
  // value of middleware, so this is backward-compatible). Rejections are
  // forwarded to the global error handler via `next`.
  return (req, res, next) => {
    return fn(req, res, next).catch(next);
  };
};

export = catchAsync;
