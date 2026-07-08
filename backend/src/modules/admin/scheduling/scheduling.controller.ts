import type { Request, Response } from "express";
import { schedulingServices } from "./scheduling.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type {
  GenerateScheduleInput,
  GenerateMonthInput,
  ListPlansQuery,
  CreateShiftInput,
  UpdateShiftInput,
} from "./scheduling.validation";

export const listPlans = async (req: Request, res: Response): Promise<void> => {
  const query = req.validated as ListPlansQuery;

  const result = await schedulingServices.listPlans(query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Weekly plans fetched successfully.",
    data: { plans: result.plans },
    meta: { pagination: result.pagination },
  });
};

export const listMonths = async (_req: Request, res: Response): Promise<void> => {
  const result = await schedulingServices.listMonths();

  sendSuccess(res, {
    statusCode: 200,
    message: "Monthly schedules fetched successfully.",
    data: result,
  });
};

export const generateMonthSchedule = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as GenerateMonthInput;

  const result = await schedulingServices.generateMonthSchedule(data);

  sendSuccess(res, {
    statusCode: 201,
    message: `Schedule generated for ${result.generatedCount} week(s).`,
    data: result,
  });
};

export const getSchedule = async (req: Request, res: Response): Promise<void> => {
  const weekPlanId = req.params.weekPlanId as string;

  const result = await schedulingServices.getSchedule(weekPlanId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Schedule fetched successfully.",
    data: result,
  });
};

export const generateSchedule = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as GenerateScheduleInput;

  const result = await schedulingServices.generateSchedule(data);

  sendSuccess(res, {
    statusCode: 201,
    message: "Schedule generated successfully.",
    data: result,
  });
};

export const publishSchedule = async (req: Request, res: Response): Promise<void> => {
  const weekPlanId = req.params.weekPlanId as string;
  const adminId = (res.locals.auth as { userId: string }).userId;

  const result = await schedulingServices.publishSchedule(weekPlanId, adminId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Schedule published successfully. Assigned employees have been notified.",
    data: result,
  });
};

export const unpublishSchedule = async (req: Request, res: Response): Promise<void> => {
  const weekPlanId = req.params.weekPlanId as string;

  const result = await schedulingServices.unpublishSchedule(weekPlanId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Schedule unpublished. It is now a draft again.",
    data: result,
  });
};

export const addShift = async (req: Request, res: Response): Promise<void> => {
  const weekPlanId = req.params.weekPlanId as string;
  const data = req.validated as CreateShiftInput;

  const result = await schedulingServices.addShift(weekPlanId, data);

  sendSuccess(res, {
    statusCode: 201,
    message: result.rulePassed
      ? "Shift added successfully."
      : "Shift added with rule violations — review the violations panel.",
    data: result,
  });
};

export const updateShift = async (req: Request, res: Response): Promise<void> => {
  const weekPlanId = req.params.weekPlanId as string;
  const shiftId = req.params.shiftId as string;
  const data = req.validated as UpdateShiftInput;

  const result = await schedulingServices.updateShift(weekPlanId, shiftId, data);

  sendSuccess(res, {
    statusCode: 200,
    message: result.rulePassed
      ? "Shift updated successfully."
      : "Shift updated with rule violations — review the violations panel.",
    data: result,
  });
};

export const removeShift = async (req: Request, res: Response): Promise<void> => {
  const weekPlanId = req.params.weekPlanId as string;
  const shiftId = req.params.shiftId as string;

  await schedulingServices.removeShift(weekPlanId, shiftId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Shift removed successfully.",
  });
};

export const getAvailability = async (req: Request, res: Response): Promise<void> => {
  const weekPlanId = req.params.weekPlanId as string;
  
  const result = await schedulingServices.getAvailabilityForPlan(weekPlanId);
  
  sendSuccess(res, {
    statusCode: 200,
    message: "Availability fetched successfully.",
    data: result,
  });
};
