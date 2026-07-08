import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import { listSwapsQuerySchema, reviewSwapSchema } from "./swaps.validation";
import * as swapController from "./swaps.controller";

const adminSwapRouter = Router();

adminSwapRouter.use(authenticate, authorizeAdmin);

adminSwapRouter.get(
  "/",
  validateRequest(listSwapsQuerySchema),
  asyncHandler(swapController.listSwaps)
);

adminSwapRouter.post(
  "/:swapId/approve",
  validateRequest(reviewSwapSchema),
  asyncHandler(swapController.approveSwap)
);

adminSwapRouter.post(
  "/:swapId/reject",
  validateRequest(reviewSwapSchema),
  asyncHandler(swapController.rejectSwap)
);

export default adminSwapRouter;
