import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import { listLeavesQuerySchema, reviewLeaveSchema } from "./leaves.validation";
import * as leavesController from "./leaves.controller";

const adminLeavesRouter = Router();

// Every admin leave route is admin-only.
adminLeavesRouter.use(authenticate, authorizeAdmin);

adminLeavesRouter.get(
  "/",
  validateRequest(listLeavesQuerySchema),
  asyncHandler(leavesController.listLeaves)
);

adminLeavesRouter.post(
  "/:leaveId/approve",
  validateRequest(reviewLeaveSchema),
  asyncHandler(leavesController.approveLeave)
);

adminLeavesRouter.post(
  "/:leaveId/reject",
  validateRequest(reviewLeaveSchema),
  asyncHandler(leavesController.rejectLeave)
);

export default adminLeavesRouter;
