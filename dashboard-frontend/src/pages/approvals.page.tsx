import { useState } from "react";
import { ArrowLeftRight, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, CalendarRange } from "lucide-react";
import { format, parseISO } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { useSwaps, useApproveSwap, useRejectSwap } from "@/features/swaps/hooks/use-swaps";
import { useShiftApprovalsFeed, useApproveResponse, useRejectResponse } from "@/features/shifts/hooks/use-shifts";
import type { Swap } from "@/features/swaps/api/swap.service";
import type { Shift, Volunteer } from "@/features/shifts/api/shift.service";

import { initials } from "@/lib/utils";

// Helper for formatting
const formatDate = (isoStr: string) => {
  if (!isoStr) return "";
  try {
    return format(parseISO(isoStr), "MMM d, h:mm a");
  } catch (e) {
    return isoStr;
  }
};

const formatShiftTime = (startStr: string, endStr: string) => {
  try {
    const start = parseISO(startStr);
    const end = parseISO(endStr);
    return `${format(start, "EEE, MMM d")} · ${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
  } catch (e) {
    return "";
  }
};

export function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<"swaps" | "shifts">("swaps");

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px]">
      <header>
        <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Approvals</p>
        <h1 className="text-3xl md:text-4xl font-bold mt-1 text-slate-900 tracking-tight">Review Center</h1>
        <p className="text-slate-500 mt-1 font-medium">Manage employee shift swaps and open shift volunteers.</p>
      </header>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "swaps" | "shifts")} className="w-full">
        <TabsList className="bg-slate-100 p-1.5 rounded-xl h-auto">
          <TabsTrigger value="swaps" className="rounded-lg font-semibold px-5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-700 data-[state=active]:border data-[state=active]:border-blue-200">
            Shift Swaps
          </TabsTrigger>
          <TabsTrigger value="shifts" className="rounded-lg font-semibold px-5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-700 data-[state=active]:border data-[state=active]:border-blue-200">
            Open Shift Volunteers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="swaps" className="space-y-4 mt-6">
          <SwapsTabContent />
        </TabsContent>

        <TabsContent value="shifts" className="space-y-4 mt-6">
          <ShiftsTabContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── SWAPS ──────────────────────────────────────────────────────────────────

function SwapsTabContent() {
  const { data, isLoading, isError } = useSwaps({ status: "PENDING" });
  const approveMut = useApproveSwap();
  const rejectMut = useRejectSwap();

  const [rejectTarget, setRejectTarget] = useState<Swap | null>(null);
  const [reason, setReason] = useState("");

  const swaps = data?.data?.swaps ?? [];

  const handleApprove = (swap: Swap) => {
    approveMut.mutate({ swapId: swap.id });
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    rejectMut.mutate(
      { swapId: rejectTarget.id, note: reason },
      { onSuccess: () => { setRejectTarget(null); setReason(""); } }
    );
  };

  if (isError) return <div className="py-16 text-center text-red-600 font-medium">Failed to load swaps.</div>;

  return (
    <>
      {isLoading && Array.from({ length: 2 }).map((_, i) => <ApprovalSkeleton key={i} />)}
      {!isLoading && swaps.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-slate-200 bg-white/80 backdrop-blur-sm">
          <CardContent className="py-16 text-center text-slate-400 font-medium">No pending swaps.</CardContent>
        </Card>
      ) : swaps.map((swap) => (
        <SwapCard 
          key={swap.id} 
          swap={swap} 
          onApprove={() => handleApprove(swap)} 
          onReject={() => setRejectTarget(swap)} 
          busy={approveMut.isPending || rejectMut.isPending} 
        />
      ))}

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-md rounded-2xl border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-2xl shadow-slate-900/10">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Reject Swap</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-medium text-slate-500 mt-1">The employees will be notified with your reason.</p>
          <div className="py-4">
            <Textarea placeholder="e.g. Need coverage on Sunday" value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl border-slate-200 bg-slate-50/50 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 min-h-[100px] resize-none transition-all" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-semibold border-slate-200 hover:bg-slate-50" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button className="rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25 transition-all duration-200" onClick={handleReject} disabled={rejectMut.isPending}>
              {rejectMut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rejecting…</> : "Reject swap"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SwapCard({ swap, onApprove, onReject, busy }: {
  swap: Swap;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const ruleCheck = swap.ruleCheck;
  const passed = ruleCheck?.passed ?? true;
  return (
    <Card className={`rounded-2xl shadow-md shadow-slate-100/50 bg-white/90 backdrop-blur-sm border transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 ${!passed ? "border-red-200 shadow-red-100/30" : "border-slate-200/80"}`}>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Clock className="h-3.5 w-3.5" /> Requested {formatDate(swap.createdAt)}
          </div>
          <Badge variant="outline" className={`px-3 py-1 rounded-lg font-semibold ${passed ? "border-blue-200 text-blue-700 bg-blue-50 shadow-sm shadow-blue-100" : "border-red-200 text-red-700 bg-red-50 shadow-sm shadow-red-100"}`}>
            {passed ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Rules OK</> : <><AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Rule Violation</>}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] items-center">
          <ShiftBlock name={swap.initiatorUser.name} shift={swap.initiatorShift} label="Offers" />
          <div className="hidden md:flex items-center justify-center">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ArrowLeftRight className="h-4 w-4" />
            </div>
          </div>
          <ShiftBlock name={swap.recipientUser.name} shift={swap.recipientShift} label="Takes" />
        </div>

        {!passed && ruleCheck?.violations && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm font-medium text-red-600">
            <ul className="list-disc pl-4">
              {ruleCheck.violations.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="outline" className="rounded-xl font-semibold border-slate-200 hover:bg-slate-50 transition-all" onClick={onReject} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2 text-red-500" />} Reject
          </Button>
          <Button className="rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200" onClick={onApprove} disabled={!passed || busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Approve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ShiftBlock({ name, shift, label }: { name: string; shift: { jobTitle: string; startTime: string; endTime: string; category: { name: string } }; label: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50/80 to-blue-50/30 p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-md shadow-blue-500/20">
          {initials(name)}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="font-bold text-slate-900 truncate mt-0.5">{name}</p>
        </div>
      </div>
      <div className="mt-4 space-y-1 text-sm bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
        <p className="font-bold text-slate-900">{shift.jobTitle}</p>
        <p className="text-slate-500 font-medium">{formatShiftTime(shift.startTime, shift.endTime)}</p>
        <Badge variant="secondary" className="mt-2 bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold rounded-lg">{shift.category.name}</Badge>
      </div>
    </div>
  );
}

// ─── SHIFTS ─────────────────────────────────────────────────────────────────

function ShiftsTabContent() {
  const { data, isLoading, isError } = useShiftApprovalsFeed({ pendingOnly: true });
  const approveMut = useApproveResponse();
  const rejectMut = useRejectResponse();

  const shifts = data?.data?.shifts ?? [];

  if (isError) return <div className="py-16 text-center text-red-600 font-medium">Failed to load shift volunteers.</div>;

  return (
    <div className="space-y-6">
      {isLoading && Array.from({ length: 2 }).map((_, i) => <ApprovalSkeleton key={i} />)}
      {!isLoading && shifts.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-slate-200 bg-white/80 backdrop-blur-sm">
          <CardContent className="py-16 text-center text-slate-400 font-medium">No volunteers for open shifts right now.</CardContent>
        </Card>
      ) : shifts.map((shift) => (
        <ShiftVolunteersCard 
          key={shift.id} 
          shift={shift} 
          onApprove={(volId) => approveMut.mutate({ shiftId: shift.id, responseId: volId })} 
          onReject={(volId) => rejectMut.mutate({ shiftId: shift.id, responseId: volId, note: "We have enough coverage." })} 
          busy={approveMut.isPending || rejectMut.isPending} 
        />
      ))}
    </div>
  );
}

function ShiftVolunteersCard({ shift, onApprove, onReject, busy }: {
  shift: Shift & { volunteers: Volunteer[] };
  onApprove: (volId: string) => void;
  onReject: (volId: string) => void;
  busy: boolean;
}) {
  return (
    <Card className="rounded-2xl shadow-md shadow-slate-100/50 bg-white/90 backdrop-blur-sm border border-slate-200/80">
      <CardContent className="p-0">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-slate-900">{shift.jobTitle}</h3>
              <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                <CalendarRange className="h-4 w-4" />
                {formatShiftTime(shift.startTime, shift.endTime)}
              </div>
            </div>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200">{shift.category.name}</Badge>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {shift.volunteers.map((vol) => (
            <div key={vol.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                  {initials(vol.user.name)}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{vol.user.name}</p>
                  <p className="text-sm text-slate-500">{vol.user.designation} · {vol.user.department}</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" className="rounded-xl" onClick={() => onReject(vol.id)} disabled={busy}>Reject</Button>
                <Button className="rounded-xl bg-blue-600 text-white" onClick={() => onApprove(vol.id)} disabled={busy}>Approve</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── SHARED ─────────────────────────────────────────────────────────────────

function ApprovalSkeleton() {
  return (
    <Card className="rounded-2xl shadow-md shadow-slate-100/50 bg-white/80 backdrop-blur-sm border border-slate-200/80 overflow-hidden">
      <CardContent className="p-6 space-y-6">
        <Skeleton className="h-4 w-32 rounded-lg" />
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] items-center">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-full mx-auto" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}
