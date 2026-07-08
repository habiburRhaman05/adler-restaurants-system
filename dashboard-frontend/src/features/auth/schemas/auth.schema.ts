import { z } from 'zod';

// ─── Login Schema ──────────────────────────────────────────
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Raw User from API ─────────────────────────────────────
// The backend returns { id, email, firstName, lastName }.
// We parse those raw fields and then transform to add
// a computed `name`, default `role`, `createdAt`, etc.
const rawUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  avatar: z.string().optional(),
  role: z.string().optional(),
  createdAt: z.string().optional(),
});

/**
 * Transformed user with a computed `name` from firstName + lastName.
 * This matches what the frontend expects everywhere (user.name, user.role, etc.),
 * while accepting the actual API shape.
 */
export const userSchema = rawUserSchema.transform((u) => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName ?? null,
  lastName: u.lastName ?? null,
  /** Computed display name from firstName + lastName, falling back to email prefix. */
  name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email.split('@')[0] || '',
  avatar: u.avatar,
  role: u.role ?? 'admin',
  createdAt: u.createdAt ?? new Date().toISOString(),
}));

export type User = z.infer<typeof userSchema>;

// ─── Login Response (envelope data) ────────────────────────
export const loginResponseSchema = z.object({
  admin: userSchema,
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

// ─── Me Response (envelope data) ───────────────────────────
export const meResponseSchema = z.object({
  admin: userSchema,
});

export type MeResponse = z.infer<typeof meResponseSchema>;

// ─── Logout Response (envelope data) ───────────────────────
export const logoutResponseSchema = z.object({
  message: z.string().optional(),
});

export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
