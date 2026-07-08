import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} from "./employees.validation";
import * as userManagementController from "./employees.controller";

const userManagementRouter = Router();

// All routes require admin authentication
userManagementRouter.use(authenticate, authorizeAdmin);

userManagementRouter.post(
  "/",
  validateRequest(createUserSchema),
  asyncHandler(userManagementController.createUser)
);

userManagementRouter.get(
  "/",
  validateRequest(listUsersQuerySchema),
  asyncHandler(userManagementController.getAllUsers)
);

userManagementRouter.get(
  "/:userId",
  asyncHandler(userManagementController.getUserById)
);

userManagementRouter.patch(
  "/:userId",
  validateRequest(updateUserSchema),
  asyncHandler(userManagementController.updateUser)
);

userManagementRouter.delete(
  "/:userId",
  asyncHandler(userManagementController.deleteUser)
);

userManagementRouter.patch(
  "/:userId/deactivate",
  asyncHandler(userManagementController.deactivateUser)
);

userManagementRouter.patch(
  "/:userId/activate",
  asyncHandler(userManagementController.activateUser)
);

export default userManagementRouter;
