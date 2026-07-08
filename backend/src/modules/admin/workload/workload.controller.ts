import type { Request, Response } from "express";
import { workloadServices } from "./workload.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type {
  CreateWeekInput,
  UpdateWeekInput,
  ListWeeksQuery,
  CreateDemandInput,
  BulkDemandsInput,
  UpdateDemandInput,
  WorkloadViewQuery,
} from "./workload.validation";

// ─── Weeks ───────────────────────────────────────────────────────
export const createWeek = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as CreateWeekInput;

  const week = await workloadServices.createWorkloadWeek(data);

  sendSuccess(res, {
    statusCode: 201,
    message: "Workload week created successfully.",
    data: { week },
  });
};

export const listWeeks = async (req: Request, res: Response): Promise<void> => {
  const query = req.validated as ListWeeksQuery;

  const result = await workloadServices.listWorkloadWeeks(query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Workload weeks fetched successfully.",
    data: { weeks: result.weeks },
    meta: { pagination: result.pagination },
  });
};

export const getWeek = async (req: Request, res: Response): Promise<void> => {
  const planId = req.params.planId as string;

  const result = await workloadServices.getWorkloadWeek(planId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Workload week fetched successfully.",
    data: result,
  });
};

export const updateWeek = async (req: Request, res: Response): Promise<void> => {
  const planId = req.params.planId as string;
  const data = req.validated as UpdateWeekInput;

  const week = await workloadServices.updateWorkloadWeek(planId, data);

  sendSuccess(res, {
    statusCode: 200,
    message: "Workload week updated successfully.",
    data: { week },
  });
};

export const publishWeek = async (req: Request, res: Response): Promise<void> => {
  const planId = req.params.planId as string;

  const week = await workloadServices.publishWorkloadWeek(planId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Workload uploaded (published) successfully.",
    data: { week },
  });
};

export const deleteWeek = async (req: Request, res: Response): Promise<void> => {
  const planId = req.params.planId as string;

  await workloadServices.deleteWorkloadWeek(planId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Workload week deleted successfully.",
  });
};

// ─── Demands ─────────────────────────────────────────────────────
export const addDemand = async (req: Request, res: Response): Promise<void> => {
  const planId = req.params.planId as string;
  const data = req.validated as CreateDemandInput;

  const demand = await workloadServices.addDemand(planId, data);

  sendSuccess(res, {
    statusCode: 201,
    message: "Staffing demand added successfully.",
    data: { demand },
  });
};

export const bulkAddDemands = async (req: Request, res: Response): Promise<void> => {
  const planId = req.params.planId as string;
  const data = req.validated as BulkDemandsInput;

  const result = await workloadServices.bulkAddDemands(planId, data);

  sendSuccess(res, {
    statusCode: 201,
    message: `Uploaded ${result.createdCount} staffing demand(s).`,
    data: result,
  });
};

export const updateDemand = async (req: Request, res: Response): Promise<void> => {
  const demandId = req.params.demandId as string;
  const data = req.validated as UpdateDemandInput;

  const demand = await workloadServices.updateDemand(demandId, data);

  sendSuccess(res, {
    statusCode: 200,
    message: "Staffing demand updated successfully.",
    data: { demand },
  });
};

export const deleteDemand = async (req: Request, res: Response): Promise<void> => {
  const demandId = req.params.demandId as string;

  await workloadServices.deleteDemand(demandId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Staffing demand deleted successfully.",
  });
};

// ─── Day / week / month view ─────────────────────────────────────
export const getWorkloadView = async (req: Request, res: Response): Promise<void> => {
  const query = req.validated as WorkloadViewQuery;

  const result = await workloadServices.getWorkloadView(query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Workload fetched successfully.",
    data: result,
  });
};
