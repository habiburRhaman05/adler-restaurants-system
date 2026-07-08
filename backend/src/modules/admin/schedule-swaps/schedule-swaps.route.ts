import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import {
  listScheduleSwapsQuerySchema,
  reviewScheduleSwapSchema,
} from "./schedule-swaps.validation";
import * as scheduleSwapsController from "./schedule-swaps.controller";

const adminScheduleSwapsRouter = Router();

// Every admin schedule-swap route is admin-only.
adminScheduleSwapsRouter.use(authenticate, authorizeAdmin);

adminScheduleSwapsRouter.get(
  "/",
  validateRequest(listScheduleSwapsQuerySchema),
  asyncHandler(scheduleSwapsController.listSwaps)
);

adminScheduleSwapsRouter.post(
  "/:swapId/approve",
  validateRequest(reviewScheduleSwapSchema),
  asyncHandler(scheduleSwapsController.approveSwap)
);

adminScheduleSwapsRouter.post(
  "/:swapId/reject",
  validateRequest(reviewScheduleSwapSchema),
  asyncHandler(scheduleSwapsController.rejectSwap)
);

export default adminScheduleSwapsRouter;
