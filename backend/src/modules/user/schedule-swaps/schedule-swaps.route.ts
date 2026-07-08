import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeUser } from "../../../middleware/auth";
import {
  searchSwapTargetsSchema,
  createScheduleSwapSchema,
  listMySwapsQuerySchema,
  respondSwapSchema,
} from "./schedule-swaps.validation";
import * as scheduleSwapsController from "./schedule-swaps.controller";

const scheduleSwapsRouter = Router();

// Every schedule-swap route is staff-only.
scheduleSwapsRouter.use(authenticate, authorizeUser);

// Find another employee's shift to swap with.
scheduleSwapsRouter.get(
  "/search",
  validateRequest(searchSwapTargetsSchema),
  asyncHandler(scheduleSwapsController.searchSwapTargets)
);

scheduleSwapsRouter.get(
  "/",
  validateRequest(listMySwapsQuerySchema),
  asyncHandler(scheduleSwapsController.listMySwaps)
);

scheduleSwapsRouter.post(
  "/",
  validateRequest(createScheduleSwapSchema),
  asyncHandler(scheduleSwapsController.createSwap)
);

scheduleSwapsRouter.post(
  "/:swapId/respond",
  validateRequest(respondSwapSchema),
  asyncHandler(scheduleSwapsController.respondToSwap)
);

scheduleSwapsRouter.post("/:swapId/cancel", asyncHandler(scheduleSwapsController.cancelSwap));

export default scheduleSwapsRouter;
