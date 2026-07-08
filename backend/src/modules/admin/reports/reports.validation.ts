import { z } from "zod";

export const reportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  categoryId: z.string().min(1).optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
