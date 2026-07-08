import type { Request, Response } from "express";
import { reportServices } from "./reports.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type { ReportQuery } from "./reports.validation";

const toServiceQuery = (validated: ReportQuery) => {
  const query: { year?: number; month?: number; categoryId?: string } = {};
  if (validated.year !== undefined) query.year = validated.year;
  if (validated.month !== undefined) query.month = validated.month;
  if (validated.categoryId !== undefined) query.categoryId = validated.categoryId;
  return query;
};

// ─── Report (per employee: hours, overtime, due, wage) ───────────
export const getReport = async (req: Request, res: Response): Promise<void> => {
  const validated = req.validated as ReportQuery;
  const report = await reportServices.buildReport(toServiceQuery(validated));

  sendSuccess(res, {
    statusCode: 200,
    message: "Report generated successfully.",
    data: report,
  });
};

// ─── CSV Export ──────────────────────────────────────────────────
export const exportReportCsv = async (req: Request, res: Response): Promise<void> => {
  const validated = req.validated as ReportQuery;
  const { csv, filename } = await reportServices.buildReportCsv(toServiceQuery(validated));

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(csv);
};
