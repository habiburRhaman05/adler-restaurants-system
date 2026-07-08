import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeUser } from "../../../middleware/auth";
import { createSwapSchema, listUserSwapsQuerySchema } from "./swaps.validation";
import * as userSwapController from "./swaps.controller";

const userSwapRouter = Router();

// All staff swap routes require an authenticated staff user.
userSwapRouter.use(authenticate, authorizeUser);

userSwapRouter.post(
  "/",
  validateRequest(createSwapSchema),
  asyncHandler(userSwapController.createSwap)
);

userSwapRouter.get(
  "/",
  validateRequest(listUserSwapsQuerySchema),
  asyncHandler(userSwapController.listMySwaps)
);

userSwapRouter.post("/:swapId/cancel", asyncHandler(userSwapController.cancelSwap));

export default userSwapRouter;
