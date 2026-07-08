import { z } from "zod";

// Accepts either a date-only ("2026-11-03") or a full ISO date-time string and
// guarantees it parses to a real calendar date.
const dateString = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .refine((s) => !Number.isNaN(Date.parse(s)), {
      message: `${label} must be a valid date`,
    });

const isoDateTime = (label: string) =>
  z.string({ required_error: `${label} is required` }).datetime({
    message: `${label} must be an ISO 8601 date-time string`,
  });

const planStatusEnum = z.enum(["DRAFT", "SUBMITTED", "PUBLISHED"]);

// ─── Workload weeks (WeeklyPlan containers) ──────────────────────
export const createWeekSchema = z.object({
  // The Monday (or any day) the workload week starts on; the rest of the week
  // metadata is derived from it server-side.
  weekStartDate: dateString("Week start date"),
  // Optional override; defaults to the ISO week number of weekStartDate.
  weekNumber: z.coerce.number().int().min(1).max(53).optional(),
});

export const updateWeekSchema = z.object({
  status: planStatusEnum.optional(),
  needsRenotify: z.boolean().optional(),
});

export const listWeeksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  status: planStatusEnum.optional(),
});

// ─── Staffing demands (the workload rows) ────────────────────────
const demandFields = {
  date: dateString("Demand date"),
  categoryId: z.string({ required_error: "Category is required" }).min(1, "Category is required"),
  requiredCount: z
    .number({ required_error: "Required headcount is required" })
    .int("Required headcount must be a whole number")
    .min(1, "At least one person must be required")
    .max(1000, "Required headcount is too large"),
  startTime: isoDateTime("Shift start time"),
  endTime: isoDateTime("Shift end time"),
  note: z.string().trim().max(1000).optional(),
};

const endAfterStart = (d: { startTime?: string | undefined; endTime?: string | undefined }) =>
  !(d.startTime && d.endTime) || new Date(d.endTime) > new Date(d.startTime);

export const createDemandSchema = z
  .object(demandFields)
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const bulkDemandsSchema = z.object({
  demands: z
    .array(
      z.object(demandFields).refine((d) => new Date(d.endTime) > new Date(d.startTime), {
        message: "endTime must be after startTime",
        path: ["endTime"],
      })
    )
    .min(1, "Provide at least one demand to upload")
    .max(500, "Too many demands in a single upload"),
});

export const updateDemandSchema = z
  .object({
    date: dateString("Demand date").optional(),
    categoryId: z.string().min(1).optional(),
    requiredCount: z.number().int().min(1).max(1000).optional(),
    startTime: isoDateTime("Shift start time").optional(),
    endTime: isoDateTime("Shift end time").optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine(endAfterStart, { message: "endTime must be after startTime", path: ["endTime"] });

// ─── Day / week / month view (sorting) ───────────────────────────
export const workloadViewQuerySchema = z.object({
  view: z.enum(["day", "week", "month"]).default("week"),
  date: dateString("Reference date"),
  categoryId: z.string().min(1).optional(),
});

export type CreateWeekInput = z.infer<typeof createWeekSchema>;
export type UpdateWeekInput = z.infer<typeof updateWeekSchema>;
export type ListWeeksQuery = z.infer<typeof listWeeksQuerySchema>;
export type CreateDemandInput = z.infer<typeof createDemandSchema>;
export type BulkDemandsInput = z.infer<typeof bulkDemandsSchema>;
export type UpdateDemandInput = z.infer<typeof updateDemandSchema>;
export type WorkloadViewQuery = z.infer<typeof workloadViewQuerySchema>;