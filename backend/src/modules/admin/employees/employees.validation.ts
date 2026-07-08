import { z } from "zod";

export const createUserSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Please provide a valid email address")
    .trim()
    .toLowerCase(),
  password: z
    .string({ required_error: "Password is required" })
    .min(6, "Password must be at least 6 characters"),
  name: z.string().trim().min(1, "Name cannot be empty").optional(),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  department: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  employeeType: z.enum(["FULL_TIME", "PART_TIME"]).optional(),
  isActive: z.boolean().optional(),
  contractType: z.enum(["HOURLY", "MONTHLY_SALARY", "WORKLOAD_PERCENT"]).optional(),
  workloadPercent: z.number().min(0).max(100).optional(),
  hourlyRate: z.number().min(0).optional(),
  monthlySalary: z.number().min(0).optional(),
  contractedHoursMonthly: z.number().min(0).optional(),
  hireDate: z.string().datetime().optional(),
  // Categories (roles) this employee is qualified for.
  categoryIds: z.array(z.string().min(1)).optional(),
});

export const updateUserSchema = z.object({
  email: z
    .string()
    .email("Please provide a valid email address")
    .trim()
    .toLowerCase()
    .optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional(),
  name: z.string().trim().min(1, "Name cannot be empty").optional(),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  department: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  employeeType: z.enum(["FULL_TIME", "PART_TIME"]).optional(),
  isActive: z.boolean().optional(),
  contractType: z.enum(["HOURLY", "MONTHLY_SALARY", "WORKLOAD_PERCENT"]).optional(),
  workloadPercent: z.number().min(0).max(100).optional(),
  hourlyRate: z.number().min(0).optional(),
  monthlySalary: z.number().min(0).optional(),
  contractedHoursMonthly: z.number().min(0).optional(),
  hireDate: z.string().datetime().optional(),
  mustChangePassword: z.boolean().optional(),
  // Replaces the full set of category assignments when provided.
  categoryIds: z.array(z.string().min(1)).optional(),
});

export const userIdParamSchema = z.object({
  userId: z.string({ required_error: "User ID is required" }).min(1),
});

export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  // Opaque keyset cursor taken from a previous page's `nextCursor`.
  // Omit it to fetch the first page.
  cursor: z.string().min(1).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  search: z.string().trim().optional(),
  categoryId: z.string().min(1).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
