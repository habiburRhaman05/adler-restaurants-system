import { z } from "zod";

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

// ─── Generate / regenerate a schedule for a workload week ────────
export const generateScheduleSchema = z.object({
  weekPlanId: z
    .string({ required_error: "weekPlanId is required" })
    .min(1, "weekPlanId is required"),
});

// ─── Generate a month: every demand-backed week in one go ────────
export const generateMonthSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

// ─── List generated plans ────────────────────────────────────────
export const listPlansQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  status: planStatusEnum.optional(),
});

// ─── Manual shift add (admin override, advisory rule check) ──────
export const createShiftSchema = z
  .object({
    userId: z.string({ required_error: "userId is required" }).min(1, "userId is required"),
    categoryId: z
      .string({ required_error: "categoryId is required" })
      .min(1, "categoryId is required"),
    date: dateString("Shift date"),
    startTime: isoDateTime("Shift start time"),
    endTime: isoDateTime("Shift end time"),
    // Owner rule for manually filling an open slot: also reduce the same
    // weekday/category demand of next week and consume the employee's
    // availability entry for this date.
    reduceNextWeekDemand: z.boolean().optional().default(false),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

// ─── Manual shift time edit ──────────────────────────────────────
export const updateShiftSchema = z
  .object({
    startTime: isoDateTime("Shift start time"),
    endTime: isoDateTime("Shift end time"),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export type GenerateScheduleInput = z.infer<typeof generateScheduleSchema>;
export type GenerateMonthInput = z.infer<typeof generateMonthSchema>;
export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>;
export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
