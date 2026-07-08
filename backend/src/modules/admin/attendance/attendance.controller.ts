import type { Request, Response } from "express";
import { adminAttendanceServices } from "./attendance.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type { ListAttendanceQuery, ReportQuery } from "./attendance.validation";

export const listAttendance = async (req: Request, res: Response): Promise<void> => {
  const query = req.validated as ListAttendanceQuery;

  const result = await adminAttendanceServices.listAttendance(query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Attendance entries fetched successfully.",
    data: { entries: result.entries },
    meta: { pagination: result.pagination },
  });
};

export const getAttendanceReport = async (req: Request, res: Response): Promise<void> => {
  const query = req.validated as ReportQuery;

  const result = await adminAttendanceServices.getAttendanceReport(query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Attendance report generated successfully.",
    data: result,
  });
};
