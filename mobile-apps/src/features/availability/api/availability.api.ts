import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { pad } from '@/lib/date';
import { AxiosError } from 'axios';
import { z } from 'zod';
import { apiEnvelope } from '../../shared/schema';
import {
  backendAvailabilitySchema,
  type Availability,
  type AvailabilityResponse,
  type BackendAvailability,
  type BackendDayStatus,
  type DayState,
  type SaveAvailabilityPayload,
  type SaveDayEntry,
} from '../schema';

// ── Mapping helpers ─────────────────────────────────────────────────
// Backend day dates and preferred times are UTC-encoded, so every read
// MUST use the UTC accessors — local getters shift the day in western
// timezones and would corrupt the calendar.

const BACKEND_DAY_MAP: Record<BackendDayStatus, DayState> = {
  AVAILABLE: 'av',
  UNAVAILABLE: 'no',
  WISH: 'wi',
};

const FRONTEND_DAY_MAP: Record<DayState, BackendDayStatus> = {
  av: 'AVAILABLE',
  no: 'UNAVAILABLE',
  wi: 'WISH',
};

const availabilityEnvelope = apiEnvelope(z.object({ availability: backendAvailabilitySchema }));

function backendToFrontend(backend: BackendAvailability): Availability {
  const days: Record<string, DayState> = {};
  const times: Record<string, { start: string; end: string }> = {};
  let note = '';

  for (const d of backend.days) {
    const dayStr = String(new Date(d.date).getUTCDate());
    days[dayStr] = BACKEND_DAY_MAP[d.status];

    if (d.preferredStartTime && d.preferredEndTime) {
      const startD = new Date(d.preferredStartTime);
      const endD = new Date(d.preferredEndTime);
      times[dayStr] = {
        start: `${pad(startD.getUTCHours())}:${pad(startD.getUTCMinutes())}`,
        end: `${pad(endD.getUTCHours())}:${pad(endD.getUTCMinutes())}`,
      };
    }

    // The month-level note is stored on each day entry; surface the first one.
    if (!note && d.note) {
      note = d.note;
    }
  }

  return {
    id: backend.id,
    month: `${backend.year}-${pad(backend.month)}`,
    days,
    times,
    note,
    status: backend.status,
    cutoffAt: backend.cutoffAt,
    submittedAt: backend.submittedAt,
  };
}

function frontendToBackendDays(year: number, month: number, payload: SaveAvailabilityPayload): SaveDayEntry[] {
  return Object.keys(payload.days).map((dayStr) => {
    const state = payload.days[dayStr];
    const time = payload.times[dayStr];

    let preferredStartTime: string | undefined;
    let preferredEndTime: string | undefined;
    if (time) {
      const [startH, startM] = time.start.split(':').map(Number);
      const [endH, endM] = time.end.split(':').map(Number);
      preferredStartTime = new Date(Date.UTC(year, month - 1, Number(dayStr), startH, startM)).toISOString();
      preferredEndTime = new Date(Date.UTC(year, month - 1, Number(dayStr), endH, endM)).toISOString();
    }

    return {
      date: `${year}-${pad(month)}-${pad(Number(dayStr))}`,
      status: FRONTEND_DAY_MAP[state],
      ...(payload.note ? { note: payload.note } : {}),
      ...(preferredStartTime ? { preferredStartTime } : {}),
      ...(preferredEndTime ? { preferredEndTime } : {}),
    };
  });
}

// ── API functions ───────────────────────────────────────────────────

/**
 * GET /api/v1/availability/:year/:month
 * 404 means the admin has not opened this month for availability yet —
 * surfaced as `availability: null` so the UI can render the locked state.
 */
export async function fetchAvailability(monthStr: string): Promise<AvailabilityResponse> {
  const [year, month] = monthStr.split('-').map(Number);

  try {
    const { data } = await apiClient.get(ENDPOINTS.availability.getMonth(year, month));
    return { availability: backendToFrontend(availabilityEnvelope.parse(data).data.availability) };
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return { availability: null };
    }
    throw error;
  }
}

/**
 * PUT /api/v1/availability/:year/:month/days — full replace of day entries.
 * Backend rejects it once the month is submitted/locked or past its cut-off.
 */
export async function saveAvailability(payload: SaveAvailabilityPayload): Promise<Availability> {
  const [year, month] = payload.month.split('-').map(Number);
  const days = frontendToBackendDays(year, month, payload);

  const { data } = await apiClient.put(ENDPOINTS.availability.saveDays(year, month), { days });
  return backendToFrontend(availabilityEnvelope.parse(data).data.availability);
}

/** POST /api/v1/availability/:year/:month/submit — binding, irreversible. */
export async function submitAvailability(monthStr: string): Promise<Availability> {
  const [year, month] = monthStr.split('-').map(Number);
  const { data } = await apiClient.post(ENDPOINTS.availability.submit(year, month));
  return backendToFrontend(availabilityEnvelope.parse(data).data.availability);
}
