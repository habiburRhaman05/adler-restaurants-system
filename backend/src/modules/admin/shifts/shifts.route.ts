import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import {
  createShiftSchema,
  updateShiftSchema,
  listShiftsQuerySchema,
  rejectResponseSchema,
  listApprovalsQuerySchema,
} from "./shifts.validation";
import * as shiftController from "./shifts.controller";

const shiftRouter = Router();

// All shift management routes require admin authentication.
shiftRouter.use(authenticate, authorizeAdmin);

shiftRouter.post(
  "/",
  validateRequest(createShiftSchema),
  asyncHandler(shiftController.createShift)
);

shiftRouter.get(
  "/",
  validateRequest(listShiftsQuerySchema),
  asyncHandler(shiftController.getAllShifts)
);

// Shift Approvals feed — published shifts that have volunteers awaiting a decision.
shiftRouter.get(
  "/approvals",
  validateRequest(listApprovalsQuerySchema),
  asyncHandler(shiftController.getShiftsForApproval)
);

shiftRouter.get("/:shiftId", asyncHandler(shiftController.getShiftById));

shiftRouter.get("/:shiftId/responses", asyncHandler(shiftController.getShiftResponses));

// Approve / reject a specific employee's acceptance of a shift.
shiftRouter.post(
  "/:shiftId/responses/:responseId/approve",
  asyncHandler(shiftController.approveResponse)
);

shiftRouter.post(
  "/:shiftId/responses/:responseId/reject",
  validateRequest(rejectResponseSchema),
  asyncHandler(shiftController.rejectResponse)
);

shiftRouter.patch(
  "/:shiftId",
  validateRequest(updateShiftSchema),
  asyncHandler(shiftController.updateShift)
);

shiftRouter.delete("/:shiftId", asyncHandler(shiftController.deleteShift));

// One-click notify: sends the shift to every active employee.
shiftRouter.post("/:shiftId/notify", asyncHandler(shiftController.notifyShift));

export default shiftRouter;
