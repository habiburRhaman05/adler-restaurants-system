import { useState } from "react";
import { CheckCircle2, XCircle, Clock, CalendarRange, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import { useLeaves, useApproveLeave, useRejectLeave } from "@/features/leaves/hooks/use-leaves";
import type { LeaveRequest } from "@/features/leaves/api/leaves.service";
import { initials } from "@/lib/utils";

const formatDate = (isoStr: string) => {
  if (!isoStr) return "";
  try {
    return format(parseISO(isoStr), "MMM d, yyyy");
  } catch (e) {
    return isoStr;
  }
};

const formatLeaveTime = (startStr: string, endStr: string) => {
  try {
    const start = parseISO(startStr);
    const end = parseISO(endStr);
    return `${format(start, "EEE, MMM d")} - ${format(end, "EEE, MMM d, yyyy")}`;
  } catch (e) {
    return "";
  }
};

export function LeavesPage() {
  const { data, isLoading, isError } = useLeaves({ status: "PENDING" });
  const approveMut = useApproveLeave();
  const rejectMut = useRejectLeave();

  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [approveTarget, setApproveTarget] = useState<LeaveRequest | null>(null);
  const [reason, setReason] = useState("");
  const [approveNote, setApproveNote] = useState("");

  const leaves = data?.data?.leaves ?? [];

  const handleApprove = () => {
    if (!approveTarget) return;
    approveMut.mutate(
      { leaveId: approveTarget.id, adminNote: approveNote },
      { onSuccess: () => { setApproveTarget(null); setApproveNote(""); } }
    );
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    rejectMut.mutate(
      { leaveId: rejectTarget.id, adminNote: reason },
      { onSuccess: () => { setRejectTarget(null); setReason(""); } }
    );
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px]">
      <header>
        <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Approvals</p>
        <h1 className="text-3xl md:text-4xl font-bold mt-1 text-slate-900 tracking-tight">Leave Requests</h1>
        <p className="text-slate-500 mt-1 font-medium">Review and manage employee leave and time-off requests.</p>
      </header>

      <div className="space-y-4 mt-6">
        {isError && <div className="py-16 text-center text-red-600 font-medium">Failed to load leave requests.</div>}
        
        {isLoading && Array.from({ length: 2 }).map((_, i) => <LeaveSkeleton key={i} />)}
        
        {!isLoading && leaves.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-slate-200 bg-white/80 backdrop-blur-sm">
            <CardContent className="py-16 text-center text-slate-400 font-medium">No pending leave requests.</CardContent>
          </Card>
        ) : leaves.map((leave) => (
          <LeaveCard 
            key={leave.id} 
            leave={leave} 
            onApprove={() => setApproveTarget(leave)} 
            onReject={() => setRejectTarget(leave)} 
            busy={approveMut.isPending || rejectMut.isPending} 
          />
        ))}
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-md rounded-2xl border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-2xl shadow-slate-900/10">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Reject Leave</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-medium text-slate-500 mt-1">Provide a reason for rejection (optional).</p>
          <div className="py-4">
            <Textarea placeholder="e.g. Too many people off this week" value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl border-slate-200 bg-slate-50/50 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 min-h-[100px] resize-none transition-all" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-semibold border-slate-200 hover:bg-slate-50" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button className="rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25 transition-all duration-200" onClick={handleReject} disabled={rejectMut.isPending}>
              {rejectMut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rejecting…</> : "Reject leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent className="max-w-md rounded-2xl border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-2xl shadow-slate-900/10">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Approve Leave</DialogTitle>
          </DialogHeader>
          <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-sm font-medium border border-blue-100 mb-2 mt-2">
            This will automatically cancel any shifts scheduled for {approveTarget?.user?.name} between {approveTarget ? formatLeaveTime(approveTarget.startDate, approveTarget.endDate) : ""}.
          </div>
          <p className="text-sm font-medium text-slate-500 mt-1">Add a note (optional).</p>
          <div className="py-4">
            <Textarea placeholder="e.g. Enjoy your time off!" value={approveNote} onChange={(e) => setApproveNote(e.target.value)} className="rounded-xl border-slate-200 bg-slate-50/50 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 min-h-[100px] resize-none transition-all" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-semibold border-slate-200 hover:bg-slate-50" onClick={() => setApproveTarget(null)}>Cancel</Button>
            <Button className="rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200" onClick={handleApprove} disabled={approveMut.isPending}>
              {approveMut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Approving…</> : "Approve leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeaveCard({ leave, onApprove, onReject, busy }: {
  leave: LeaveRequest;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  return (
    <Card className="rounded-2xl shadow-md shadow-slate-100/50 bg-white/90 backdrop-blur-sm border border-slate-200/80 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Clock className="h-3.5 w-3.5" /> Requested {formatDate(leave.createdAt)}
          </div>
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 capitalize">{leave.leaveType.replace('_', ' ')}</Badge>
        </div>

        <div className="flex items-start gap-4">
          <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-blue-500/20">
            {initials(leave.user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg text-slate-900">{leave.user.name}</p>
            <div className="flex items-center gap-2 text-sm text-slate-600 mt-1 font-medium bg-slate-50 border border-slate-100 rounded-lg p-2 inline-flex">
              <CalendarRange className="h-4 w-4 text-blue-500" />
              {formatLeaveTime(leave.startDate, leave.endDate)}
            </div>
          </div>
        </div>

        {leave.reason && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm font-medium text-slate-700">
            <span className="text-slate-400 font-bold block mb-1 uppercase tracking-wider text-xs">Reason</span>
            {leave.reason}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100 mt-4">
          <Button variant="outline" className="rounded-xl font-semibold border-slate-200 hover:bg-slate-50 transition-all" onClick={onReject} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2 text-red-500" />} Reject
          </Button>
          <Button className="rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200" onClick={onApprove} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Approve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LeaveSkeleton() {
  return (
    <Card className="rounded-2xl shadow-md shadow-slate-100/50 bg-white/80 backdrop-blur-sm border border-slate-200/80 overflow-hidden">
      <CardContent className="p-6 space-y-6">
        <Skeleton className="h-4 w-32 rounded-lg" />
        <div className="flex gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40 rounded-lg" />
            <Skeleton className="h-8 w-60 rounded-lg" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
