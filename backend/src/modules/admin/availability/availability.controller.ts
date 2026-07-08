import type { Request, Response } from "express";
import { adminAvailabilityServices } from "./availability.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type {
  OpenAvailabilityInput,
  AvailabilityQuery,
  NudgeInput,
} from "./availability.validation";

// ─── Open a month for availability ───────────────────────────────
export const openMonth = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as OpenAvailabilityInput;
  const result = await adminAvailabilityServices.openMonth(data);

  sendSuccess(res, {
    statusCode: 201,
    message: `Availability opened for ${result.opened} employee(s).`,
    data: result,
  });
};

// ─── Submission status ───────────────────────────────────────────
export const getMonthStatus = async (req: Request, res: Response): Promise<void> => {
  const { year, month } = req.validated as AvailabilityQuery;
  const result = await adminAvailabilityServices.getMonthStatus(year, month);

  sendSuccess(res, {
    statusCode: 200,
    message: "Availability status fetched successfully.",
    data: {
      year: result.year,
      month: result.month,
      employees: result.rows,
      notSubmitted: result.notSubmitted,
      summary: result.summary,
    },
  });
};

// ─── Full grid: all employees' availability days for a month ─────
export const getMonthGrid = async (req: Request, res: Response): Promise<void> => {
  const { year, month } = req.validated as AvailabilityQuery;
  const result = await adminAvailabilityServices.getMonthGrid(year, month);

  sendSuccess(res, {
    statusCode: 200,
    message: "Availability grid fetched successfully.",
    data: result,
  });
};

// ─── One employee's availability ─────────────────────────────────
export const getUserMonth = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;
  const { year, month } = req.validated as AvailabilityQuery;
  const availability = await adminAvailabilityServices.getUserMonth(userId, year, month);

  sendSuccess(res, {
    statusCode: 200,
    message: "Employee availability fetched successfully.",
    data: { availability },
  });
};

// ─── Nudge ───────────────────────────────────────────────────────
export const nudge = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;
  const { year, month } = req.validated as NudgeInput;
  await adminAvailabilityServices.nudge(userId, year, month);

  sendSuccess(res, {
    statusCode: 200,
    message: "Reminder sent to the employee.",
  });
};
