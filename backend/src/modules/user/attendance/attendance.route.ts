import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeUser } from "../../../middleware/auth";
import { clockInSchema, clockOutSchema, historyQuerySchema } from "./attendance.validation";
import * as attendanceController from "./attendance.controller";

const attendanceRouter = Router();

// Every attendance route is staff-only.
attendanceRouter.use(authenticate, authorizeUser);

attendanceRouter.post(
  "/clock-in",
  validateRequest(clockInSchema),
  asyncHandler(attendanceController.clockIn)
);

attendanceRouter.post(
  "/clock-out",
  validateRequest(clockOutSchema),
  asyncHandler(attendanceController.clockOut)
);

attendanceRouter.post("/break-start", asyncHandler(attendanceController.startBreak));

attendanceRouter.post("/break-end", asyncHandler(attendanceController.endBreak));

attendanceRouter.get("/current", asyncHandler(attendanceController.getCurrentStatus));

attendanceRouter.get(
  "/history",
  validateRequest(historyQuerySchema),
  asyncHandler(attendanceController.getHistory)
);

export default attendanceRouter;
