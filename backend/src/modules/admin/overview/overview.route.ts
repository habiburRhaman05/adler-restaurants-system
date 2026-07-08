import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import * as overviewController from "./overview.controller";

const overviewRouter = Router();

overviewRouter.use(authenticate, authorizeAdmin);

overviewRouter.get("/", asyncHandler(overviewController.getOverview));

export default overviewRouter;
