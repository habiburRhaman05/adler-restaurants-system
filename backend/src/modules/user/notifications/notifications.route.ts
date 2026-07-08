import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeUser } from "../../../middleware/auth";
import {
  listNotificationsQuerySchema,
  registerDeviceSchema,
  unregisterDeviceSchema,
} from "./notifications.validation";
import * as notificationController from "./notifications.controller";

const notificationRouter = Router();

// All notification routes require an authenticated staff user.
notificationRouter.use(authenticate, authorizeUser);

notificationRouter.get(
  "/",
  validateRequest(listNotificationsQuerySchema),
  asyncHandler(notificationController.listNotifications)
);

// Push device registration (declared before the ":id" routes so it never
// gets captured as a notificationId).
notificationRouter.post(
  "/devices",
  validateRequest(registerDeviceSchema),
  asyncHandler(notificationController.registerDevice)
);

notificationRouter.delete(
  "/devices",
  validateRequest(unregisterDeviceSchema),
  asyncHandler(notificationController.unregisterDevice)
);

notificationRouter.patch("/read-all", asyncHandler(notificationController.markAllAsRead));

notificationRouter.patch(
  "/:notificationId/read",
  asyncHandler(notificationController.markAsRead)
);

export default notificationRouter;
