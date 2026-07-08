import { z } from "zod";

// Accepts a date-only ("2026-07-05") or a full ISO date-time string and
// guarantees it parses to a real calendar date.
const dateString = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .refine((s) => !Number.isNaN(Date.parse(s)), {
      message: `${label} must be a valid date`,
    });

const requiredCount = z
  .number({ required_error: "Required headcount is required" })
  .int("Required headcount must be a whole number")
  .min(0, "Required headcount cannot be negative")
  .max(1000, "Required headcount is too large");

// ─── List / scope view ───────────────────────────────────────────
export const listDemandsQuerySchema = z.object({
  // weekly = the single week containing `date`; monthly = every week in that
  // month; upcoming = the current week plus all future weeks (default).
  scope: z.enum(["week", "month", "upcoming"]).default("upcoming"),
  date: dateString("Reference date").optional(),
});

// ─── Create a week plan (the "Create week plan" modal) ───────────
export const createWeekSchema = z.object({
  // Any day inside the target week — the server snaps it to that week's Sunday.
  weekStartDate: dateString("Week start date"),
  // Optional: seed the new week by copying an existing week's demands
  // (mapped day-for-day by weekday).
  copyFromWeekId: z.string().min(1).optional(),
});

// ─── Save the whole grid (per-week "Save" button) ────────────────
export const saveGridSchema = z.object({
  demands: z
    .array(
      z.object({
        categoryId: z.string({ required_error: "Category is required" }).min(1, "Category is required"),
        date: dateString("Demand date"),
        requiredCount,
      })
    )
    .min(1, "Provide at least one cell to save")
    .max(700, "Too many cells in a single save"),
});

// ─── Update a single cell (stepper +/-) ──────────────────────────
export const upsertCellSchema = z.object({
  categoryId: z.string({ required_error: "Category is required" }).min(1, "Category is required"),
  date: dateString("Demand date"),
  requiredCount,
});

export type ListDemandsQuery = z.infer<typeof listDemandsQuerySchema>;
export type CreateWeekInput = z.infer<typeof createWeekSchema>;
export type SaveGridInput = z.infer<typeof saveGridSchema>;
export type UpsertCellInput = z.infer<typeof upsertCellSchema>;
