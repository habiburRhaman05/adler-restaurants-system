import { prisma } from "../../../config/db";
import type { UpdateSettingsInput } from "./settings.validation";
import type { Prisma } from "../../../generated/prisma/client";

// Sensible Swiss L-GAV starting defaults, applied the first time settings are read.
const DEFAULTS = {
  maxDailyHours: 12.5,
  maxWeeklyHours: 50,
  minRestHoursBetweenShifts: 11,
  breakRequiredAfterHours: 5.5,
  minBreakMinutes: 30,
  sessionTimeoutMinutes: 30,
  swapExpiryHours: 72,
};

// Default notification toggles surfaced when none are stored yet.
const DEFAULT_NOTIFICATION_PREFS = {
  shiftPublished: true,
  swapRequests: true,
  availabilityReminders: true,
  ruleViolations: true,
  channelEmail: false,
  channelPush: true,
  channelInApp: true,
};

const settingsSelect = {
  id: true,
  maxDailyHours: true,
  maxWeeklyHours: true,
  minRestHoursBetweenShifts: true,
  breakRequiredAfterHours: true,
  minBreakMinutes: true,
  breakRules: true,
  sessionTimeoutMinutes: true,
  notificationPrefs: true,
  swapExpiryHours: true,
  defaultShiftStartTime: true,
  defaultShiftEndTime: true,
  updatedAt: true,
  updatedById: true,
} satisfies Prisma.OrgSettingsSelect;

// Always return notification prefs merged over defaults so the client sees a
// complete object regardless of what has been persisted.
const withPrefDefaults = <T extends { notificationPrefs: unknown }>(settings: T) => ({
  ...settings,
  notificationPrefs: {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...((settings.notificationPrefs as Record<string, boolean> | null) ?? {}),
  },
});

// There is a single org-wide settings row (id = 1).
const getSettings = async () => {
  const settings = await prisma.orgSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...DEFAULTS },
    update: {},
    select: settingsSelect,
  });
  return withPrefDefaults(settings);
};

const updateSettings = async (data: UpdateSettingsInput, adminId: string) => {
  // Ensure the row exists (with defaults) before applying the partial update.
  const current = await getSettings();

  const updateData: Prisma.OrgSettingsUpdateInput = { updatedById: adminId };
  if (data.maxDailyHours !== undefined) updateData.maxDailyHours = data.maxDailyHours;
  if (data.maxWeeklyHours !== undefined) updateData.maxWeeklyHours = data.maxWeeklyHours;
  if (data.minRestHoursBetweenShifts !== undefined)
    updateData.minRestHoursBetweenShifts = data.minRestHoursBetweenShifts;
  if (data.breakRequiredAfterHours !== undefined)
    updateData.breakRequiredAfterHours = data.breakRequiredAfterHours;
  if (data.minBreakMinutes !== undefined) updateData.minBreakMinutes = data.minBreakMinutes;
  if (data.sessionTimeoutMinutes !== undefined)
    updateData.sessionTimeoutMinutes = data.sessionTimeoutMinutes;
  if (data.swapExpiryHours !== undefined) updateData.swapExpiryHours = data.swapExpiryHours;
  if (data.defaultShiftStartTime !== undefined)
    updateData.defaultShiftStartTime = data.defaultShiftStartTime;
  if (data.defaultShiftEndTime !== undefined)
    updateData.defaultShiftEndTime = data.defaultShiftEndTime;

  // Notification prefs are merged over the current set so a partial update only
  // flips the toggles it names.
  if (data.notificationPrefs !== undefined) {
    const currentPrefs = current.notificationPrefs as Record<string, boolean>;
    updateData.notificationPrefs = { ...currentPrefs, ...data.notificationPrefs };
  }

  const settings = await prisma.orgSettings.update({
    where: { id: 1 },
    data: updateData,
    select: settingsSelect,
  });
  return withPrefDefaults(settings);
};

export const settingsServices = { getSettings, updateSettings };
