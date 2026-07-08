import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeUser } from "../../../middleware/auth";
import { setDaysSchema } from "./availability.validation";
import * as availabilityController from "./availability.controller";

const userAvailabilityRouter = Router();

userAvailabilityRouter.use(authenticate, authorizeUser);

// My availability months — which are open / editable / submitted.
userAvailabilityRouter.get("/", asyncHandler(availabilityController.listMyMonths));

// My availability for a month.
userAvailabilityRouter.get("/:year/:month", asyncHandler(availabilityController.getMyMonth));

// Save my day entries (full replace).
userAvailabilityRouter.put(
  "/:year/:month/days",
  validateRequest(setDaysSchema),
  asyncHandler(availabilityController.setDays)
);

// Submit bindingly.
userAvailabilityRouter.post("/:year/:month/submit", asyncHandler(availabilityController.submit));

export default userAvailabilityRouter;
