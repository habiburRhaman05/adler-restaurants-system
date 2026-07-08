import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import { updateSettingsSchema } from "./settings.validation";
import * as settingsController from "./settings.controller";

const settingsRouter = Router();

settingsRouter.use(authenticate, authorizeAdmin);

settingsRouter.get("/", asyncHandler(settingsController.getSettings));

settingsRouter.patch(
  "/",
  validateRequest(updateSettingsSchema),
  asyncHandler(settingsController.updateSettings)
);

export default settingsRouter;
