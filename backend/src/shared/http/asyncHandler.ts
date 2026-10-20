import { NextFunction, Request, RequestHandler, Response } from 'express';

/** Передає помилки async-контролерів в errorHandler (Express 4 не робить цього сам). */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
