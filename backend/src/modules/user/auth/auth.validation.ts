import { z } from "zod";

export const userLoginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Please provide a valid email address")
    .trim()
    .toLowerCase(),
  password: z
    .string({ required_error: "Password is required" })
    .min(6, "Password must be at least 6 characters"),
});

// Edit own account — change email and/or password. A password change requires
// the current password. At least one editable field must be provided.
export const updateUserProfileSchema = z
  .object({
    email: z
      .string()
      .email("Please provide a valid email address")
      .trim()
      .toLowerCase()
      .optional(),
    currentPassword: z.string().min(1, "Current password is required").optional(),
    newPassword: z.string().min(6, "New password must be at least 6 characters").optional(),
  })
  .refine((d) => d.email !== undefined || d.newPassword !== undefined, {
    message: "Provide an email and/or a new password to update.",
  })
  .refine((d) => !d.newPassword || !!d.currentPassword, {
    message: "currentPassword is required to change the password.",
    path: ["currentPassword"],
  });

export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
