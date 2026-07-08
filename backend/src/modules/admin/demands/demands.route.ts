import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import {
  listDemandsQuerySchema,
  createWeekSchema,
  saveGridSchema,
  upsertCellSchema,
} from "./demands.validation";
import * as demandController from "./demands.controller";

const demandRouter = Router();

// Every demands route is admin-only.
demandRouter.use(authenticate, authorizeAdmin);

// ─── Grid view (weekly / monthly / upcoming) ─────────────────────
demandRouter.get(
  "/",
  validateRequest(listDemandsQuerySchema),
  asyncHandler(demandController.getDemands)
);

// ─── Week plans ──────────────────────────────────────────────────
demandRouter.get("/weeks", asyncHandler(demandController.listWeeks));

demandRouter.post(
  "/weeks",
  validateRequest(createWeekSchema),
  asyncHandler(demandController.createWeek)
);

demandRouter.get("/weeks/:weekId", asyncHandler(demandController.getWeek));

// Save the whole grid (per-week "Save" button).
demandRouter.put(
  "/weeks/:weekId",
  validateRequest(saveGridSchema),
  asyncHandler(demandController.saveGrid)
);

// Update a single cell (stepper +/-).
demandRouter.put(
  "/weeks/:weekId/cell",
  validateRequest(upsertCellSchema),
  asyncHandler(demandController.upsertCell)
);

demandRouter.post("/weeks/:weekId/publish", asyncHandler(demandController.publishWeek));

demandRouter.delete("/weeks/:weekId", asyncHandler(demandController.deleteWeek));

export default demandRouter;
