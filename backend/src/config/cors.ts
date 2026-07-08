import { envConfig } from "./env";

// Explicit origin allow-list: the configured client plus the local dev server.
// Credentialed requests (cookies) require an exact origin — never a wildcard.
const allowedOrigins = [...new Set([envConfig.CLIENT_URL, "http://localhost:5173","http://localhost:8081"].filter(Boolean))];

export const corsConfig = {
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
};


