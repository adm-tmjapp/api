import { NextFunction, Request, Response } from "express";

export type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next?: NextFunction,
) => Promise<unknown> | unknown;

export function asyncHandler(fn: AsyncRouteHandler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}
