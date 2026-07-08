import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeUser } from "../../../middleware/auth";
import { listNotificationsQuerySchema } from "./notifications.validation";
import * as notificationController from "./notifications.controller";

const notificationRouter = Router();

// All notification routes require an authenticated staff user.
notificationRouter.use(authenticate, authorizeUser);

notificationRouter.get(
  "/",
  validateRequest(listNotificationsQuerySchema),
  asyncHandler(notificationController.listNotifications)
);

notificationRouter.patch("/read-all", asyncHandler(notificationController.markAllAsRead));

notificationRouter.patch(
  "/:notificationId/read",
  asyncHandler(notificationController.markAsRead)
);

export default notificationRouter;
