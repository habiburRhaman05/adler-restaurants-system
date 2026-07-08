import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import { authLimiter } from "../../../middleware/rateLimit";
import {
  adminLoginSchema,
  updateAdminProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validation";
import * as adminController from "./auth.controller";

const adminAuthRouter = Router();

// Public routes — throttled to blunt brute-force / credential-stuffing.
adminAuthRouter.post("/login", authLimiter, validateRequest(adminLoginSchema), asyncHandler(adminController.login));
adminAuthRouter.post("/refresh", authLimiter, asyncHandler(adminController.refreshToken));
adminAuthRouter.post(
  "/forgot-password",
  authLimiter,
  validateRequest(forgotPasswordSchema),
  asyncHandler(adminController.forgotPassword)
);
adminAuthRouter.post(
  "/reset-password",
  authLimiter,
  validateRequest(resetPasswordSchema),
  asyncHandler(adminController.resetPassword)
);

// Protected routes
adminAuthRouter.post("/logout", authenticate, asyncHandler(adminController.logout));
adminAuthRouter.get("/profile", authenticate, authorizeAdmin, asyncHandler(adminController.getProfile));
adminAuthRouter.patch(
  "/profile",
  authenticate,
  authorizeAdmin,
  validateRequest(updateAdminProfileSchema),
  asyncHandler(adminController.updateProfile)
);

export default adminAuthRouter;
