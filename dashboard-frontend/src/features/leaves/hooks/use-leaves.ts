import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { leavesService } from "../api/leaves.service";

export const leavesKeys = {
  all: ["leaves"] as const,
  list: (params: { page?: number; limit?: number; status?: string; userId?: string }) => ["leaves", "list", params] as const,
};

export function useLeaves(params: { page?: number; limit?: number; status?: string; userId?: string }) {
  return useQuery({
    queryKey: leavesKeys.list(params),
    queryFn: () => leavesService.getLeaves(params),
  });
}

export function useApproveLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leaveId, adminNote }: { leaveId: string; adminNote?: string }) => 
      leavesService.approveLeave(leaveId, { adminNote }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: leavesKeys.all });
      toast.success(data.message || "Leave approved.");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || "Failed to approve leave.");
    },
  });
}

export function useRejectLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leaveId, adminNote }: { leaveId: string; adminNote?: string }) => 
      leavesService.rejectLeave(leaveId, { adminNote }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: leavesKeys.all });
      toast.success(data.message || "Leave rejected.");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || "Failed to reject leave.");
    },
  });
}
