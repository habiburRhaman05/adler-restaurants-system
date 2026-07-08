import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import { reportQuerySchema } from "./reports.validation";
import * as reportController from "./reports.controller";

const reportRouter = Router();

reportRouter.use(authenticate, authorizeAdmin);

reportRouter.get(
  "/",
  validateRequest(reportQuerySchema),
  asyncHandler(reportController.getReport)
);

reportRouter.get(
  "/export",
  validateRequest(reportQuerySchema),
  asyncHandler(reportController.exportReportCsv)
);

export default reportRouter;
