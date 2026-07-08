import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeUser } from "../../../middleware/auth";
import {
  myShiftsQuerySchema,
  respondShiftSchema,
  batchRespondSchema,
  myHoursQuerySchema,
  updateMyProfileSchema,
} from "./me.validation";
import * as meController from "./me.controller";

const meRouter = Router();

// Every /me route is staff-only.
meRouter.use(authenticate, authorizeUser);

// My roster (published weeks only).
meRouter.get("/shifts", validateRequest(myShiftsQuerySchema), asyncHandler(meController.getMyShifts));

// Accept / reject an assigned shift.
meRouter.post(
  "/shifts/respond",
  validateRequest(respondShiftSchema),
  asyncHandler(meController.respondToShift)
);

meRouter.post(
  "/shifts/batch-respond",
  validateRequest(batchRespondSchema),
  asyncHandler(meController.batchRespond)
);

// My worked/planned hours for the Analysis tab.
meRouter.get("/hours", validateRequest(myHoursQuerySchema), asyncHandler(meController.getMyHours));

// Update my own profile details (name, phone, address)
meRouter.patch("/profile", validateRequest(updateMyProfileSchema), asyncHandler(meController.updateProfile));

export default meRouter;
