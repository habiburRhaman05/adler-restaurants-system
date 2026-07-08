import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import hpp from "hpp";
import { corsConfig } from "../config/cors";
import { httpLogger } from "../utils/logger";
import { apiLimiter } from "./rateLimit";

export const applyMiddleware = (app: Express): void => {
  // Security headers (HSTS, no-sniff, frameguard, hides x-powered-by, …).
  app.use(helmet());

  // CORS with an explicit allow-list + credentials (see config/cors.ts).
  app.use(cors(corsConfig));

  app.use(compression());
  app.use(cookieParser());

  // Cap the JSON body size to blunt oversized-payload abuse. The raw body is
  // preserved for the Stripe webhook so its signature can be verified.
  app.use(
    express.json({
      limit: "1mb",
      verify: (req: any, _res, buf) => {
        if (req.originalUrl.includes("/stripe/webhook")) {
          req.rawBody = buf;
        }
      },
    })
  );

  // Guard against HTTP Parameter Pollution (must run after the body/query
  // parsers so duplicate params are collapsed to a single value).
  app.use(hpp());

  // Structured request logging (auth/cookie headers are redacted — see logger).
  app.use(httpLogger);

  // Global per-IP rate limit (health probe exempt).
  app.use(apiLimiter);
};
