import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { z } from 'zod';
import { apiEnvelope } from '../../shared/schema';

// Mirrors backend/src/modules/user/leaves (LeaveRequest + leaveSelect).

export const leaveTypeSchema = z.enum(['VACATION', 'SICK', 'PERSONAL', 'OTHER']);
export type LeaveType = z.infer<typeof leaveTypeSchema>;

export const leaveStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
export type LeaveStatus = z.infer<typeof leaveStatusSchema>;

export const leaveRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  leaveType: leaveTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string(),
  status: leaveStatusSchema,
  adminNote: z.string().nullish(),
  reviewedAt: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LeaveRequest = z.infer<typeof leaveRequestSchema>;

/** POST /api/v1/leaves body — reason must be at least 10 characters. */
export type CreateLeavePayload = {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
};

const leavesEnvelope = apiEnvelope(z.object({ leaves: z.array(leaveRequestSchema) }));
const leaveEnvelope = apiEnvelope(z.object({ leave: leaveRequestSchema }));

export async function fetchMyLeaves(): Promise<LeaveRequest[]> {
  const { data } = await apiClient.get(ENDPOINTS.leaves.list, { params: { limit: 100 } });
  return leavesEnvelope.parse(data).data.leaves;
}

export async function createLeave(payload: CreateLeavePayload): Promise<LeaveRequest> {
  const { data } = await apiClient.post(ENDPOINTS.leaves.create, payload);
  return leaveEnvelope.parse(data).data.leave;
}

/** Only PENDING requests can be cancelled (backend enforces this with 409). */
export async function cancelLeave(id: string): Promise<LeaveRequest> {
  const { data } = await apiClient.post(ENDPOINTS.leaves.cancel(id));
  return leaveEnvelope.parse(data).data.leave;
}
