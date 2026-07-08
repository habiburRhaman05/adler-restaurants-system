import type { Request, Response } from "express";
import { attendanceServices } from "./attendance.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type { ClockInInput, ClockOutInput, HistoryQuery } from "./attendance.validation";

const authUserId = (res: Response) => (res.locals.auth as { userId: string }).userId;

export const clockIn = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as ClockInInput;

  const entry = await attendanceServices.clockIn(authUserId(res), data);

  sendSuccess(res, {
    statusCode: 201,
    message: "Clocked in successfully.",
    data: { entry },
  });
};

export const clockOut = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as ClockOutInput;

  const result = await attendanceServices.clockOut(authUserId(res), data);

  sendSuccess(res, {
    statusCode: 200,
    message: "Clocked out successfully.",
    data: result,
  });
};

export const startBreak = async (_req: Request, res: Response): Promise<void> => {
  const entry = await attendanceServices.startBreak(authUserId(res));

  sendSuccess(res, {
    statusCode: 200,
    message: "Break started.",
    data: { entry },
  });
};

export const endBreak = async (_req: Request, res: Response): Promise<void> => {
  const entry = await attendanceServices.endBreak(authUserId(res));

  sendSuccess(res, {
    statusCode: 200,
    message: "Break ended.",
    data: { entry },
  });
};

export const getCurrentStatus = async (_req: Request, res: Response): Promise<void> => {
  const result = await attendanceServices.getCurrentStatus(authUserId(res));

  sendSuccess(res, {
    statusCode: 200,
    message: "Attendance status fetched successfully.",
    data: result,
  });
};

export const getHistory = async (req: Request, res: Response): Promise<void> => {
  const query = req.validated as HistoryQuery;

  const result = await attendanceServices.getHistory(authUserId(res), query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Attendance history fetched successfully.",
    data: { entries: result.entries, totals: result.totals },
    meta: { pagination: result.pagination },
  });
};
