import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import {
  generateScheduleSchema,
  generateMonthSchema,
  listPlansQuerySchema,
  createShiftSchema,
  updateShiftSchema,
} from "./scheduling.validation";
import * as schedulingController from "./scheduling.controller";

const schedulingRouter = Router();

// Every scheduling route is admin-only.
schedulingRouter.use(authenticate, authorizeAdmin);

// ─── Plans ───────────────────────────────────────────────────────
schedulingRouter.get(
  "/",
  validateRequest(listPlansQuerySchema),
  asyncHandler(schedulingController.listPlans)
);

// Month-grouped plan list (schedule list page cards).
schedulingRouter.get("/months", asyncHandler(schedulingController.listMonths));

// Generate (or regenerate a DRAFT) schedule for one demand week.
schedulingRouter.post(
  "/generate",
  validateRequest(generateScheduleSchema),
  asyncHandler(schedulingController.generateSchedule)
);

// Generate every demand-backed week of a month in one go.
schedulingRouter.post(
  "/generate-month",
  validateRequest(generateMonthSchema),
  asyncHandler(schedulingController.generateMonthSchedule)
);

schedulingRouter.get("/:weekPlanId", asyncHandler(schedulingController.getSchedule));
schedulingRouter.get("/:weekPlanId/availability", asyncHandler(schedulingController.getAvailability));

schedulingRouter.post(
  "/:weekPlanId/publish",
  asyncHandler(schedulingController.publishSchedule)
);

schedulingRouter.post(
  "/:weekPlanId/unpublish",
  asyncHandler(schedulingController.unpublishSchedule)
);

// ─── Manual shift overrides within a plan ────────────────────────
schedulingRouter.post(
  "/:weekPlanId/shifts",
  validateRequest(createShiftSchema),
  asyncHandler(schedulingController.addShift)
);

schedulingRouter.patch(
  "/:weekPlanId/shifts/:shiftId",
  validateRequest(updateShiftSchema),
  asyncHandler(schedulingController.updateShift)
);

schedulingRouter.delete(
  "/:weekPlanId/shifts/:shiftId",
  asyncHandler(schedulingController.removeShift)
);

export default schedulingRouter;
