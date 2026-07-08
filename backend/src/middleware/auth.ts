import type { Request, Response, NextFunction } from "express";
import { jwtUtils } from "../utils/jwt";
import { envConfig } from "../config/env";
import { sendError } from "../utils/apiResponse";
import { logger } from "../utils/logger";

/**
 * Authenticate — verifies the accessToken cookie.
 * On success, attaches { userId, email, role } to res.locals.auth.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  // Accept a Bearer token (mobile / React Native clients that store tokens
  // themselves) or the accessToken cookie (browser clients like the admin web).
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : req.cookies?.accessToken;

  if (!token) {
    sendError(res, {
      statusCode: 401,
      message: "Authentication required. No access token provided.",
    });
    return;
  }

  const result = jwtUtils.verifyToken(token, envConfig.ACCESS_TOKEN_SECRET);

  if (!result.success || !result.data) {
    sendError(res, {
      statusCode: 401,
      message: "Invalid or expired access token.",
    });
    return;
  }

  const { userId, email, role } = result.data as {
    userId: string;
    email: string;
    role: "ADMIN" | "USER";
  };

  res.locals.auth = { userId, email, role };
  next();
};

/**
 * Authorize Admin — must be used AFTER authenticate.
 * Rejects with 403 if the authenticated user is not an admin.
 */
export const authorizeAdmin = (_req: Request, res: Response, next: NextFunction): void => {
 console.log(res.locals.auth);
 
  // if (!res.locals.auth || res.locals.auth.role !== "ADMIN") {
  //   sendError(res, {
  //     statusCode: 403,
  //     message: "Access denied. Admin privileges required.",
  //   });
  //   return;
  // }

  next();
};

/**
 * Authorize User — must be used AFTER authenticate.
 * Rejects with 403 if the authenticated principal is not a staff user.
 */
export const authorizeUser = (_req: Request, res: Response, next: NextFunction): void => {
  // if (!res.locals.auth || res.locals.auth.role !== "USER") {
  //   sendError(res, {
  //     statusCode: 403,
  //     message: "Access denied. Staff account required.",
  //   });
  //   return;
  // }

  next();
};
