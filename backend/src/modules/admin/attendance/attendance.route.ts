import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import { listAttendanceQuerySchema, reportQuerySchema } from "./attendance.validation";
import * as attendanceController from "./attendance.controller";

const adminAttendanceRouter = Router();

// Every admin attendance route is admin-only.
adminAttendanceRouter.use(authenticate, authorizeAdmin);

adminAttendanceRouter.get(
  "/",
  validateRequest(listAttendanceQuerySchema),
  asyncHandler(attendanceController.listAttendance)
);

adminAttendanceRouter.get(
  "/report",
  validateRequest(reportQuerySchema),
  asyncHandler(attendanceController.getAttendanceReport)
);

export default adminAttendanceRouter;
