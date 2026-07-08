import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeUser } from "../../../middleware/auth";
import { createLeaveSchema, myLeavesQuerySchema } from "./leaves.validation";
import * as leavesController from "./leaves.controller";

const leavesRouter = Router();

// Every leave route is staff-only.
leavesRouter.use(authenticate, authorizeUser);

leavesRouter.post("/", validateRequest(createLeaveSchema), asyncHandler(leavesController.createLeave));

leavesRouter.get("/", validateRequest(myLeavesQuerySchema), asyncHandler(leavesController.getMyLeaves));

leavesRouter.post("/:leaveId/cancel", asyncHandler(leavesController.cancelLeave));

export default leavesRouter;
