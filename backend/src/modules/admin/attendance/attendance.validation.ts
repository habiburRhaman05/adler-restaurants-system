import { z } from "zod";

const dateString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((s) => !Number.isNaN(Date.parse(s)), {
      message: `${label} must be a valid date`,
    });

export const listAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().min(1).optional(),
  date: dateString("Date").optional(),
  status: z.enum(["ACTIVE", "ON_BREAK", "COMPLETED"]).optional(),
});

export const reportQuerySchema = z
  .object({
    from: dateString("From date").optional(),
    to: dateString("To date").optional(),
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be in YYYY-MM format")
      .optional(),
    userId: z.string().min(1).optional(),
  })
  .refine((q) => !(q.from && !q.to) && !(q.to && !q.from), {
    message: "Provide both from and to, or neither",
    path: ["to"],
  });

export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
