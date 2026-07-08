import { z } from "zod";

// Notification preference toggles (stored as JSON on OrgSettings).
export const notificationPrefsSchema = z.object({
  shiftPublished: z.boolean().optional(),
  swapRequests: z.boolean().optional(),
  availabilityReminders: z.boolean().optional(),
  ruleViolations: z.boolean().optional(),
  channelEmail: z.boolean().optional(),
  channelPush: z.boolean().optional(),
  channelInApp: z.boolean().optional(),
});

export const updateSettingsSchema = z
  .object({
    maxDailyHours: z.number().min(0).max(24).optional(),
    maxWeeklyHours: z.number().min(0).max(168).optional(),
    minRestHoursBetweenShifts: z.number().min(0).max(48).optional(),
    breakRequiredAfterHours: z.number().min(0).max(24).optional(),
    minBreakMinutes: z.number().int().min(0).max(480).optional(),
    sessionTimeoutMinutes: z.number().int().min(1).max(1440).optional(),
    swapExpiryHours: z.number().int().min(1).max(720).optional(),
    defaultShiftStartTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "defaultShiftStartTime must be HH:mm")
      .optional(),
    defaultShiftEndTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "defaultShiftEndTime must be HH:mm")
      .optional(),
    notificationPrefs: notificationPrefsSchema.optional(),
  })
  .refine(
    (d) =>
      !d.defaultShiftStartTime ||
      !d.defaultShiftEndTime ||
      d.defaultShiftEndTime > d.defaultShiftStartTime,
    { message: "defaultShiftEndTime must be after defaultShiftStartTime" }
  )
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one setting to update.",
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
