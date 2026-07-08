import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { z } from 'zod';
import { apiEnvelope } from '../../shared/schema';
import {
  searchTargetsResponseSchema,
  swapRequestSchema,
  type CreateSwapPayload,
  type RespondSwapAction,
  type SearchTargetsResponse,
  type SwapRequest,
  type SwapsResponse,
} from '../schema';

const swapsListEnvelope = apiEnvelope(z.object({ swaps: z.array(swapRequestSchema) }));
const swapEnvelope = apiEnvelope(z.object({ swap: swapRequestSchema }));

/** GET /api/v1/schedule-swaps — my swaps, split by my role in them. */
export async function fetchSwaps(): Promise<SwapsResponse> {
  const [incomingRes, outgoingRes] = await Promise.all([
    apiClient.get(ENDPOINTS.scheduleSwaps.list, { params: { role: 'received', limit: 100 } }),
    apiClient.get(ENDPOINTS.scheduleSwaps.list, { params: { role: 'initiated', limit: 100 } }),
  ]);
  return {
    incoming: swapsListEnvelope.parse(incomingRes.data).data.swaps,
    outgoing: swapsListEnvelope.parse(outgoingRes.data).data.swaps,
  };
}

/** GET /api/v1/schedule-swaps/search?date=YYYY-MM-DD — colleagues' swappable shifts. */
export async function searchSwapTargets(date: string, categoryId?: string): Promise<SearchTargetsResponse> {
  const { data } = await apiClient.get(ENDPOINTS.scheduleSwaps.search, {
    params: { date, ...(categoryId ? { categoryId } : {}) },
  });
  return apiEnvelope(searchTargetsResponseSchema).parse(data).data;
}

/** POST /api/v1/schedule-swaps — request a swap; recipient gets notified. */
export async function createSwap(payload: CreateSwapPayload): Promise<SwapRequest> {
  const { data } = await apiClient.post(ENDPOINTS.scheduleSwaps.create, payload);
  return swapEnvelope.parse(data).data.swap;
}

/** POST /api/v1/schedule-swaps/:id/respond — recipient accepts or declines. */
export async function respondToSwap(swapId: string, action: RespondSwapAction): Promise<SwapRequest> {
  const { data } = await apiClient.post(ENDPOINTS.scheduleSwaps.respond(swapId), { action });
  return swapEnvelope.parse(data).data.swap;
}

/** POST /api/v1/schedule-swaps/:id/cancel — initiator withdraws a pending swap. */
export async function cancelSwap(swapId: string): Promise<SwapRequest> {
  const { data } = await apiClient.post(ENDPOINTS.scheduleSwaps.cancel(swapId));
  return swapEnvelope.parse(data).data.swap;
}
