declare global {
  namespace Express {
    interface Locals {
      auth?: {
        userId: string;
        email: string;
        role: "ADMIN" | "USER";
      };
    }
    interface Request {
      validated?: Record<string, any>;
    }
  }
}

export {};