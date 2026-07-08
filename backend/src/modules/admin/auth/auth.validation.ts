import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Please provide a valid email address")
    .trim()
    .toLowerCase(),
  password: z
    .string({ required_error: "Password is required" })
    .min(6, "Password must be at least 6 characters"),
});

export const updateAdminProfileSchema = z
  .object({
    name: z.string().trim().min(1, "Name cannot be empty").max(120).optional(),
    firstName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    email: z
      .string()
      .email("Please provide a valid email address")
      .trim()
      .toLowerCase()
      .optional(),
    currentPassword: z.string().min(1, "Current password is required").optional(),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Provide at least one field to update.",
  })
  // A password change needs both fields together.
  .refine((d) => !(d.newPassword && !d.currentPassword), {
    message: "Current password is required to set a new password.",
    path: ["currentPassword"],
  })
  .refine((d) => !(d.currentPassword && !d.newPassword), {
    message: "New password is required when providing the current password.",
    path: ["newPassword"],
  });

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type UpdateAdminProfileInput = z.infer<typeof updateAdminProfileSchema>;
