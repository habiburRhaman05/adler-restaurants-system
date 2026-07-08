import { z } from "zod";

const dateString = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .refine((s) => !Number.isNaN(Date.parse(s)), {
      message: `${label} must be a valid date`,
    });

export const createLeaveSchema = z
  .object({
    leaveType: z.enum(["VACATION", "SICK", "PERSONAL", "OTHER"], {
      errorMap: () => ({ message: "leaveType must be VACATION, SICK, PERSONAL or OTHER" }),
    }),
    startDate: dateString("Start date"),
    endDate: dateString("End date"),
    reason: z
      .string({ required_error: "Reason is required" })
      .trim()
      .min(10, "Please give a reason of at least 10 characters")
      .max(2000),
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const myLeavesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
});

export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;
export type MyLeavesQuery = z.infer<typeof myLeavesQuerySchema>;
