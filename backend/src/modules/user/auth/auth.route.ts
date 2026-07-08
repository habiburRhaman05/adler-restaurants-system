import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeUser } from "../../../middleware/auth";
import { authLimiter } from "../../../middleware/rateLimit";
import { userLoginSchema, updateUserProfileSchema } from "./auth.validation";
import * as userController from "./auth.controller";

const userAuthRouter = Router();

// Public routes — throttled to blunt brute-force / credential-stuffing.
userAuthRouter.post("/login", authLimiter, validateRequest(userLoginSchema), asyncHandler(userController.login));
userAuthRouter.post("/refresh", authLimiter, asyncHandler(userController.refreshToken));

// Protected routes
userAuthRouter.post("/logout", authenticate, asyncHandler(userController.logout));
userAuthRouter.get("/profile", authenticate, authorizeUser, asyncHandler(userController.getProfile));
userAuthRouter.patch(
  "/profile",
  authenticate,
  authorizeUser,
  validateRequest(updateUserProfileSchema),
  asyncHandler(userController.updateProfile)
);

export default userAuthRouter;
