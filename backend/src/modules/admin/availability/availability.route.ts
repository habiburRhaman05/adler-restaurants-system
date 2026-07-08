import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import {
  openAvailabilitySchema,
  availabilityQuerySchema,
  nudgeSchema,
} from "./availability.validation";
import * as availabilityController from "./availability.controller";

const adminAvailabilityRouter = Router();

adminAvailabilityRouter.use(authenticate, authorizeAdmin);

// Open a month for availability collection.
adminAvailabilityRouter.post(
  "/open",
  validateRequest(openAvailabilitySchema),
  asyncHandler(availabilityController.openMonth)
);

// Submission status for all staff for a month (?year=&month=).
adminAvailabilityRouter.get(
  "/",
  validateRequest(availabilityQuerySchema),
  asyncHandler(availabilityController.getMonthStatus)
);

// Full grid — every employee's availability days for a month (?year=&month=).
// Defined before "/:userId" so "grid" isn't captured as a userId.
adminAvailabilityRouter.get(
  "/grid",
  validateRequest(availabilityQuerySchema),
  asyncHandler(availabilityController.getMonthGrid)
);

// A single employee's submitted availability (?year=&month=).
adminAvailabilityRouter.get(
  "/:userId",
  validateRequest(availabilityQuerySchema),
  asyncHandler(availabilityController.getUserMonth)
);

// One-tap reminder for an employee who hasn't submitted.
adminAvailabilityRouter.post(
  "/:userId/nudge",
  validateRequest(nudgeSchema),
  asyncHandler(availabilityController.nudge)
);

export default adminAvailabilityRouter;
