import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScheduleAPI, type ScheduleState } from "../api/schedule-api";

export * from "../api/schedule-api"; // re-export types and registries

// ─── Month-grouped schedules (list page) ─────────────────────────
export function useScheduleMonths() {
  return useQuery({
    queryKey: ["schedule-months"],
    queryFn: ScheduleAPI.listMonths,
  });
}

export function useDemandWeeks() {
  return useQuery({
    queryKey: ["schedule-demand-weeks"],
    queryFn: ScheduleAPI.listDemandWeeks,
  });
}

export function useGenerateMonth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      ScheduleAPI.generateMonth(year, month),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["schedule-months"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-plans"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-detail"] });
      toast.success(
        `Schedule generated for ${result.generatedCount} week(s)` +
          (result.skippedPublishedCount > 0
            ? ` — ${result.skippedPublishedCount} already-published week(s) untouched`
            : "")
      );
      if (result.weeksWithoutDemand.length > 0) {
        toast.warning(
          `${result.weeksWithoutDemand.length} week(s) of this month have no demand yet and were skipped. Set their demand on the Demand page, then generate again.`
        );
      }
    },
    onError: (err: any) =>
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to generate month schedule"
      ),
  });
}

export function useSchedulePlanner(year: number, month: number, weekRange: number) {
  const queryClient = useQueryClient();
  const queryKey = ["schedule", year, month, weekRange];

  const { data: state, isLoading } = useQuery({
    queryKey,
    queryFn: () => ScheduleAPI.getSchedule(year, month, weekRange),
  });

  // Mutations need the freshest loaded state (weekPlanId, weekStart, ...).
  const currentState = (): ScheduleState => {
    const s = queryClient.getQueryData<ScheduleState | null>(queryKey);
    if (!s) throw new Error("Schedule not loaded yet.");
    return s;
  };

  const apiMessage = (err: any, fallback: string) =>
    err?.response?.data?.message || err?.message || fallback;

  const generateMutation = useMutation({
    mutationFn: async (override?: { month: number; weekRange: number }) => {
      const m = override?.month ?? month;
      const w = override?.weekRange ?? weekRange;
      const newState = await ScheduleAPI.generateSchedule(year, m, w);
      return { newState, m, w };
    },
    onSuccess: ({ newState, m, w }) => {
      queryClient.setQueryData(["schedule", year, m, w], newState);
      toast.success("Schedule generated successfully");
    },
    onError: (err: any) => toast.error(apiMessage(err, "Failed to generate schedule")),
  });

  const approveMutation = useMutation({
    mutationFn: () => ScheduleAPI.approveSchedule(currentState()),
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
      toast.success("Schedule published — staff have been notified.");
    },
    onError: (err: any) => toast.error(apiMessage(err, "Failed to publish")),
  });

  const removeShiftMutation = useMutation({
    mutationFn: ({ shiftId }: { staffId: string; dayIdx: number; shiftId: string }) =>
      ScheduleAPI.removeShift(currentState(), shiftId),
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
      toast.success("Shift removed.");
    },
    onError: (err: any) => toast.error(apiMessage(err, "Failed to remove shift")),
  });

  const editShiftTimeMutation = useMutation({
    mutationFn: ({ dayIdx, shiftId, newTm }: { staffId: string; dayIdx: number; shiftId: string; newTm: string }) =>
      ScheduleAPI.editShiftTime(currentState(), dayIdx, shiftId, newTm),
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
      toast.success("Shift time updated.");
    },
    onError: (err: any) => toast.error(apiMessage(err, "Failed to update time")),
  });

  const assignSlotMutation = useMutation({
    mutationFn: ({ violId, staffName, dayIdx, fnKey, tm, compOption }: { violId: string | null; staffName: string; dayIdx: number; fnKey: string; tm: string; compOption?: "overtime" | "reduce-future" }) =>
      ScheduleAPI.assignSlot(currentState(), violId, staffName, dayIdx, fnKey, tm, compOption),
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
      toast.success("Assigned successfully ✓");
    },
    onError: (err: any) => toast.error(apiMessage(err, "Failed to assign")),
  });

  const applyFixMutation = useMutation({
    mutationFn: (violId: string) => ScheduleAPI.applyFix(currentState(), violId),
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
      toast.success("Fixed — rule now passes ✓");
    },
    onError: (err: any) => toast.error(apiMessage(err, "Failed to apply fix")),
  });

  return {
    state,
    isLoading,
    generateSchedule: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    approveSchedule: approveMutation.mutateAsync,
    removeShift: removeShiftMutation.mutateAsync,
    editShiftTime: editShiftTimeMutation.mutateAsync,
    assignSlot: assignSlotMutation.mutateAsync,
    applyFix: applyFixMutation.mutateAsync,
  };
}

export function useSchedulePlannerById(weekPlanId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["schedule-detail", weekPlanId];

  const { data: state, isLoading } = useQuery({
    queryKey,
    queryFn: () => ScheduleAPI.getScheduleById(weekPlanId),
  });

  const currentState = (): ScheduleState => {
    const s = queryClient.getQueryData<ScheduleState | null>(queryKey);
    if (!s) throw new Error("Schedule not loaded yet.");
    return s;
  };

  const apiMessage = (err: any, fallback: string) =>
    err?.response?.data?.message || err?.message || fallback;

  const approveMutation = useMutation({
    mutationFn: () => ScheduleAPI.approveSchedule(currentState()),
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
      toast.success("Schedule published — staff have been notified.");
    },
    onError: (err: any) => toast.error(apiMessage(err, "Failed to publish")),
  });

  const removeShiftMutation = useMutation({
    mutationFn: ({ shiftId }: { staffId: string; dayIdx: number; shiftId: string }) =>
      ScheduleAPI.removeShift(currentState(), shiftId),
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
      toast.success("Shift removed.");
    },
    onError: (err: any) => toast.error(apiMessage(err, "Failed to remove shift")),
  });

  const editShiftTimeMutation = useMutation({
    mutationFn: ({ dayIdx, shiftId, newTm }: { staffId: string; dayIdx: number; shiftId: string; newTm: string }) =>
      ScheduleAPI.editShiftTime(currentState(), dayIdx, shiftId, newTm),
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
      toast.success("Shift time updated.");
    },
    onError: (err: any) => toast.error(apiMessage(err, "Failed to update time")),
  });

  const assignSlotMutation = useMutation({
    mutationFn: ({ violId, staffName, dayIdx, fnKey, tm, compOption }: { violId: string | null; staffName: string; dayIdx: number; fnKey: string; tm: string; compOption?: "overtime" | "reduce-future" }) =>
      ScheduleAPI.assignSlot(currentState(), violId, staffName, dayIdx, fnKey, tm, compOption),
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
      toast.success("Assigned successfully ✓");
    },
    onError: (err: any) => toast.error(apiMessage(err, "Failed to assign")),
  });

  const applyFixMutation = useMutation({
    mutationFn: (violId: string) => ScheduleAPI.applyFix(currentState(), violId),
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
      toast.success("Fixed — rule now passes ✓");
    },
    onError: (err: any) => toast.error(apiMessage(err, "Failed to apply fix")),
  });

  const generateMutation = useMutation({
    mutationFn: () => ScheduleAPI.generateScheduleById(weekPlanId, new Date(`${currentState().weekStart}T00:00:00.000Z`)),
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
      toast.success("Schedule generated successfully");
    },
    onError: (err: any) => toast.error(apiMessage(err, "Failed to generate schedule")),
  });

  return {
    state,
    isLoading,
    generateSchedule: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    approveSchedule: approveMutation.mutateAsync,
    removeShift: removeShiftMutation.mutateAsync,
    editShiftTime: editShiftTimeMutation.mutateAsync,
    assignSlot: assignSlotMutation.mutateAsync,
    applyFix: applyFixMutation.mutateAsync,
  };
}
