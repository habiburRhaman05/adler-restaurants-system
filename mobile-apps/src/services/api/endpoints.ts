/**
 * Single source of truth for every API path.
 * Every path here mirrors a route mounted in backend/src/routes/index.route.ts —
 * if the backend router changes, this is the only file that needs review
 * (besides EXPO_PUBLIC_API_URL).
 */
export const ENDPOINTS = {
  auth: {
    login: '/api/v1/auth/user/login',
    refresh: '/api/v1/auth/user/refresh',
    logout: '/api/v1/auth/user/logout',
    profile: '/api/v1/auth/user/profile',
    forgotPassword: '/api/v1/auth/user/forgot-password',
    resetPassword: '/api/v1/auth/user/reset-password',
  },
  me: {
    profile: '/api/v1/me/profile',
    shifts: '/api/v1/me/shifts',
    shiftRespond: '/api/v1/me/shifts/respond',
    shiftBatchRespond: '/api/v1/me/shifts/batch-respond',
    hours: '/api/v1/me/hours',
  },
  shifts: {
    // Published shift offers (open shifts staff can accept/decline).
    list: '/api/v1/shifts',
    detail: (id: string) => `/api/v1/shifts/${id}`,
    respond: (id: string) => `/api/v1/shifts/${id}/respond`,
  },
  // Weekly-plan shift swaps (backend module: user/schedule-swaps).
  scheduleSwaps: {
    list: '/api/v1/schedule-swaps',
    create: '/api/v1/schedule-swaps',
    search: '/api/v1/schedule-swaps/search',
    respond: (id: string) => `/api/v1/schedule-swaps/${id}/respond`,
    cancel: (id: string) => `/api/v1/schedule-swaps/${id}/cancel`,
  },
  availability: {
    list: '/api/v1/availability',
    getMonth: (year: number, month: number) => `/api/v1/availability/${year}/${month}`,
    saveDays: (year: number, month: number) => `/api/v1/availability/${year}/${month}/days`,
    submit: (year: number, month: number) => `/api/v1/availability/${year}/${month}/submit`,
  },
  attendance: {
    clockIn: '/api/v1/attendance/clock-in',
    clockOut: '/api/v1/attendance/clock-out',
    breakStart: '/api/v1/attendance/break-start',
    breakEnd: '/api/v1/attendance/break-end',
    current: '/api/v1/attendance/current',
    history: '/api/v1/attendance/history',
  },
  leaves: {
    list: '/api/v1/leaves',
    create: '/api/v1/leaves',
    cancel: (id: string) => `/api/v1/leaves/${id}/cancel`,
  },
} as const;
