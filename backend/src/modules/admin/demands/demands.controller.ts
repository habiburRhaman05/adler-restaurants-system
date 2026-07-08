import type { Request, Response } from "express";
import { demandServices } from "./demands.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type {
  ListDemandsQuery,
  CreateWeekInput,
  SaveGridInput,
  UpsertCellInput,
} from "./demands.validation";

// ─── List demands by scope (weekly / monthly / upcoming) ─────────
export const getDemands = async (req: Request, res: Response): Promise<void> => {
  const query = req.validated as ListDemandsQuery;

  const result = await demandServices.getDemands(query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Demands fetched successfully.",
    data: result,
  });
};

// ─── List week plans (for the copy-from dropdown) ────────────────
export const listWeeks = async (_req: Request, res: Response): Promise<void> => {
  const weeks = await demandServices.listWeeks();

  sendSuccess(res, {
    statusCode: 200,
    message: "Week plans fetched successfully.",
    data: { weeks },
  });
};

// ─── Get one week plan (full grid) ───────────────────────────────
export const getWeek = async (req: Request, res: Response): Promise<void> => {
  const weekId = req.params.weekId as string;

  const week = await demandServices.getWeek(weekId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Week plan fetched successfully.",
    data: { week },
  });
};

// ─── Create a week plan ──────────────────────────────────────────
export const createWeek = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as CreateWeekInput;

  const week = await demandServices.createWeek(data);

  sendSuccess(res, {
    statusCode: 201,
    message: "Week plan created successfully.",
    data: { week },
  });
};

// ─── Save the whole grid ─────────────────────────────────────────
export const saveGrid = async (req: Request, res: Response): Promise<void> => {
  const weekId = req.params.weekId as string;
  const data = req.validated as SaveGridInput;

  const week = await demandServices.saveGrid(weekId, data);

  sendSuccess(res, {
    statusCode: 200,
    message: "Demands saved successfully.",
    data: { week },
  });
};

// ─── Update a single cell (stepper) ──────────────────────────────
export const upsertCell = async (req: Request, res: Response): Promise<void> => {
  const weekId = req.params.weekId as string;
  const data = req.validated as UpsertCellInput;

  const demand = await demandServices.upsertCell(weekId, data);

  sendSuccess(res, {
    statusCode: 200,
    message: "Demand updated successfully.",
    data: { demand },
  });
};

// ─── Publish a week plan ─────────────────────────────────────────
export const publishWeek = async (req: Request, res: Response): Promise<void> => {
  const weekId = req.params.weekId as string;

  const week = await demandServices.publishWeek(weekId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Week plan published successfully.",
    data: { week },
  });
};

// ─── Delete a week plan ──────────────────────────────────────────
export const deleteWeek = async (req: Request, res: Response): Promise<void> => {
  const weekId = req.params.weekId as string;

  await demandServices.deleteWeek(weekId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Week plan deleted successfully.",
  });
};
