import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import {
  createWeekSchema,
  updateWeekSchema,
  listWeeksQuerySchema,
  createDemandSchema,
  bulkDemandsSchema,
  updateDemandSchema,
  workloadViewQuerySchema,
} from "./workload.validation";
import * as workloadController from "./workload.controller";

const workloadRouter = Router();

// Every workload route is admin-only.
workloadRouter.use(authenticate, authorizeAdmin);

// ─── Day / week / month view (sortable workload) ─────────────────
workloadRouter.get(
  "/",
  validateRequest(workloadViewQuerySchema),
  asyncHandler(workloadController.getWorkloadView)
);

// ─── Weeks (workload containers) ─────────────────────────────────
workloadRouter.post(
  "/weeks",
  validateRequest(createWeekSchema),
  asyncHandler(workloadController.createWeek)
);

workloadRouter.get(
  "/weeks",
  validateRequest(listWeeksQuerySchema),
  asyncHandler(workloadController.listWeeks)
);

workloadRouter.get("/weeks/:planId", asyncHandler(workloadController.getWeek));

workloadRouter.patch(
  "/weeks/:planId",
  validateRequest(updateWeekSchema),
  asyncHandler(workloadController.updateWeek)
);

// Upload / publish the week's workload.
workloadRouter.post("/weeks/:planId/publish", asyncHandler(workloadController.publishWeek));

workloadRouter.delete("/weeks/:planId", asyncHandler(workloadController.deleteWeek));

// ─── Demands within a week ───────────────────────────────────────
workloadRouter.post(
  "/weeks/:planId/demands/bulk",
  validateRequest(bulkDemandsSchema),
  asyncHandler(workloadController.bulkAddDemands)
);

workloadRouter.post(
  "/weeks/:planId/demands",
  validateRequest(createDemandSchema),
  asyncHandler(workloadController.addDemand)
);

workloadRouter.patch(
  "/demands/:demandId",
  validateRequest(updateDemandSchema),
  asyncHandler(workloadController.updateDemand)
);

workloadRouter.delete("/demands/:demandId", asyncHandler(workloadController.deleteDemand));

export default workloadRouter;
