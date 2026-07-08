import ScreenState from '@/components/screen-state';
import { useMySchedule, type Shift } from '@/features/schedule';
import {
  swapUserName,
  useCancelSwap,
  useCreateSwap,
  useRespondToSwap,
  useSwaps,
  useSwapTargets,
  type SwapRequest,
  type SwapShift,
  type SwapStatus,
  type SwapTarget,
} from '@/features/swaps';
import { getApiErrorMessage } from '@/lib/apiError';
import { monthKey, pad, shiftDateParts } from '@/lib/date';
import { colors } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// ── Formatting helpers (shift datetimes are UTC-encoded wall-clock) ──

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

const fmtSwapShift = (s: SwapShift | null | undefined) => {
  if (!s) return 'Shift unavailable';
  const { dayNum, monthShort, weekday } = shiftDateParts(s.date.slice(0, 10));
  const category = s.category?.name ? `${s.category.name} · ` : '';
  return `${weekday} ${dayNum} ${monthShort} · ${category}${fmtTime(s.startTime)}–${fmtTime(s.endTime)}`;
};

const addDaysISO = (dateStr: string, delta: number) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

const STATUS_META: Record<SwapStatus, { label: string; color: string; bg: string }> = {
  PENDING_RECIPIENT: { label: 'Awaiting colleague', color: '#B45309', bg: '#FEF3C7' },
  PENDING_ADMIN_APPROVAL: { label: 'Awaiting admin', color: '#1D4ED8', bg: '#EFF6FF' },
  APPROVED: { label: 'Approved', color: '#065F46', bg: '#ECFDF5' },
  REJECTED: { label: 'Declined', color: '#B91C1C', bg: '#FEF2F2' },
  EXPIRED: { label: 'Expired', color: colors.gray500, bg: colors.gray100 },
  CANCELLED: { label: 'Cancelled', color: colors.gray500, bg: colors.gray100 },
};

// ── Swap card ────────────────────────────────────────────────────────

function SwapCard({ swap, direction, busyId, onRespond, onCancel }: {
  swap: SwapRequest;
  direction: 'incoming' | 'outgoing';
  busyId: string | null;
  onRespond?: (swap: SwapRequest, action: 'ACCEPT' | 'DECLINE') => void;
  onCancel?: (swap: SwapRequest) => void;
}) {
  const meta = STATUS_META[swap.status];
  const busy = busyId !== null;
  const isBusy = busyId === swap.id;
  const otherName =
    direction === 'incoming' ? swapUserName(swap.initiatorUser) : swapUserName(swap.recipientUser);

  // From the reader's perspective: which shift do I give, which do I get?
  const myShift = direction === 'incoming' ? swap.recipientShift : swap.initiatorShift;
  const theirShift = direction === 'incoming' ? swap.initiatorShift : swap.recipientShift;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {direction === 'incoming' ? `${otherName} wants to swap` : `Swap with ${otherName}`}
        </Text>
        <View style={[styles.statusTag, { backgroundColor: meta.bg }]}>
          <Text style={[styles.statusTagText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <View style={styles.shiftRow}>
        <Ionicons name="arrow-up-circle-outline" size={15} color={colors.red} />
        <Text style={styles.shiftLine}>You give: {fmtSwapShift(myShift)}</Text>
      </View>
      <View style={styles.shiftRow}>
        <Ionicons name="arrow-down-circle-outline" size={15} color={colors.green} />
        <Text style={styles.shiftLine}>You get: {fmtSwapShift(theirShift)}</Text>
      </View>

      {swap.ruleCheckPassed === false && swap.ruleCheckResult?.violations?.length ? (
        <View style={styles.warnBox}>
          <Ionicons name="warning-outline" size={14} color="#B45309" />
          <Text style={styles.warnText}>{swap.ruleCheckResult.violations.join('\n')}</Text>
        </View>
      ) : null}

      {swap.status === 'REJECTED' && swap.adminReason ? (
        <Text style={styles.adminReason}>Admin: {swap.adminReason}</Text>
      ) : null}

      {direction === 'incoming' && swap.status === 'PENDING_RECIPIENT' && onRespond && (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.declineBtn, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => onRespond(swap, 'DECLINE')}
          >
            <Text style={styles.declineBtnText}>Decline</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.acceptBtn, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => onRespond(swap, 'ACCEPT')}
          >
            {isBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.acceptBtnText}>Accept</Text>}
          </Pressable>
        </View>
      )}

      {direction === 'outgoing' && swap.status === 'PENDING_RECIPIENT' && onCancel && (
        <Pressable
          style={[styles.cancelLink, busy && { opacity: 0.6 }]}
          disabled={busy}
          onPress={() => onCancel(swap)}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={colors.red} />
          ) : (
            <Text style={styles.cancelLinkText}>Cancel request</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────

export default function SwapsScreen() {
  const swapsQuery = useSwaps();
  const scheduleQuery = useMySchedule(monthKey(new Date()));

  const createMut = useCreateSwap();
  const respondMut = useRespondToSwap();
  const cancelMut = useCancelSwap();
  const [busyId, setBusyId] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [myShiftId, setMyShiftId] = useState<string | null>(null);
  const [searchDate, setSearchDate] = useState<string | null>(null);
  const [target, setTarget] = useState<SwapTarget | null>(null);

  const targetsQuery = useSwapTargets(searchDate);

  const incoming = swapsQuery.data?.incoming ?? [];
  const outgoing = swapsQuery.data?.outgoing ?? [];

  // Only shifts the backend will accept as swappable: published (guaranteed
  // by /me/shifts), pending or accepted, and not ended.
  const mySwappableShifts = useMemo(
    () =>
      (scheduleQuery.data?.shifts ?? []).filter(
        (s) => (s.status === 'PENDING' || s.status === 'ACCEPTED') && !s.ended,
      ),
    [scheduleQuery.data?.shifts],
  );
  const myShift = mySwappableShifts.find((s) => s.id === myShiftId) ?? null;

  const openCreate = () => {
    setMyShiftId(null);
    setSearchDate(null);
    setTarget(null);
    setModalVisible(true);
  };

  const pickMyShift = (shift: Shift) => {
    setMyShiftId(shift.id);
    setSearchDate(shift.date);
    setTarget(null);
  };

  const shiftSearchDate = (delta: number) => {
    if (!searchDate) return;
    setSearchDate(addDaysISO(searchDate, delta));
    setTarget(null);
  };

  const handleCreate = () => {
    if (!myShift || !target || createMut.isPending) return;
    createMut.mutate(
      { initiatorShiftId: myShift.id, recipientUserId: target.userId, recipientShiftId: target.id },
      {
        onSuccess: () => {
          setModalVisible(false);
          Alert.alert('Request sent', `${swapUserName(target.user)} has been notified of your swap request.`);
        },
        onError: (e) => Alert.alert('Could not create swap', getApiErrorMessage(e)),
      },
    );
  };

  const handleRespond = (swap: SwapRequest, action: 'ACCEPT' | 'DECLINE') => {
    if (respondMut.isPending) return;
    const verb = action === 'ACCEPT' ? 'Accept' : 'Decline';
    Alert.alert(`${verb} this swap?`, action === 'ACCEPT' ? 'It will still need admin approval before shifts change.' : undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: verb,
        style: action === 'DECLINE' ? 'destructive' : 'default',
        onPress: () => {
          setBusyId(swap.id);
          respondMut.mutate(
            { swapId: swap.id, action },
            {
              onError: (e) => Alert.alert('Could not respond', getApiErrorMessage(e)),
              onSettled: () => setBusyId(null),
            },
          );
        },
      },
    ]);
  };

  const handleCancel = (swap: SwapRequest) => {
    if (cancelMut.isPending) return;
    Alert.alert('Cancel swap request?', 'The other employee will no longer be able to accept it.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: () => {
          setBusyId(swap.id);
          cancelMut.mutate(swap.id, {
            onError: (e) => Alert.alert('Could not cancel', getApiErrorMessage(e)),
            onSettled: () => setBusyId(null),
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={swapsQuery.isRefetching} onRefresh={() => swapsQuery.refetch()} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Shift Swaps</Text>
          <Text style={styles.subtitle}>Swap published shifts with colleagues — admin approves the final change</Text>
        </View>

        <Pressable style={styles.primaryBtn} onPress={openCreate}>
          <Ionicons name="swap-horizontal" size={18} color={colors.white} />
          <Text style={styles.primaryBtnText}>Request New Swap</Text>
        </Pressable>
        <View style={{ height: 20 }} />

        {swapsQuery.isLoading || swapsQuery.isError ? (
          <ScreenState loading={swapsQuery.isLoading} error={swapsQuery.error} onRetry={() => swapsQuery.refetch()} />
        ) : (
          <>
            <Text style={styles.sectionTitle}>Incoming Requests</Text>
            {incoming.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.smallMuted}>No incoming swap requests.</Text>
              </View>
            ) : (
              incoming.map((swap) => (
                <SwapCard key={swap.id} swap={swap} direction="incoming" busyId={busyId} onRespond={handleRespond} />
              ))
            )}

            <Text style={styles.sectionTitle}>My Sent Requests</Text>
            {outgoing.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.smallMuted}>No outgoing swap requests.</Text>
              </View>
            ) : (
              outgoing.map((swap) => (
                <SwapCard key={swap.id} swap={swap} direction="outgoing" busyId={busyId} onCancel={handleCancel} />
              ))
            )}
          </>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── Create-swap modal ─────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Swap</Text>
            <Pressable onPress={() => setModalVisible(false)} hitSlop={10}>
              <Ionicons name="close" size={28} color={colors.gray500} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.sectionTitle}>1. Your shift to give away</Text>
            {scheduleQuery.isLoading ? (
              <ActivityIndicator color={colors.blue} style={{ marginVertical: 20 }} />
            ) : mySwappableShifts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.smallMuted}>
                  You have no upcoming published shifts this month that can be swapped.
                </Text>
              </View>
            ) : (
              mySwappableShifts.map((s) => (
                <Pressable
                  key={s.id}
                  style={[styles.card, myShiftId === s.id && styles.cardSelected]}
                  onPress={() => pickMyShift(s)}
                >
                  <Text style={styles.cardTitle}>{s.label}</Text>
                  <Text style={styles.shiftLine}>
                    {shiftDateParts(s.date).weekday} {shiftDateParts(s.date).dayNum}{' '}
                    {shiftDateParts(s.date).monthShort} · {s.start}–{s.end}
                  </Text>
                </Pressable>
              ))
            )}

            {myShift && searchDate && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>2. Colleague&apos;s shift to take</Text>

                {/* day picker for the search */}
                <View style={styles.dayPickerRow}>
                  <Pressable style={styles.dayPickerBtn} onPress={() => shiftSearchDate(-1)} hitSlop={8}>
                    <Ionicons name="chevron-back" size={18} color={colors.blue} />
                  </Pressable>
                  <Text style={styles.dayPickerLabel}>
                    {shiftDateParts(searchDate).weekday} {shiftDateParts(searchDate).dayNum}{' '}
                    {shiftDateParts(searchDate).monthShort}
                  </Text>
                  <Pressable style={styles.dayPickerBtn} onPress={() => shiftSearchDate(1)} hitSlop={8}>
                    <Ionicons name="chevron-forward" size={18} color={colors.blue} />
                  </Pressable>
                </View>

                {targetsQuery.isLoading ? (
                  <ActivityIndicator color={colors.blue} style={{ marginVertical: 20 }} />
                ) : targetsQuery.isError ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.smallMuted}>{getApiErrorMessage(targetsQuery.error)}</Text>
                    <Pressable onPress={() => targetsQuery.refetch()}>
                      <Text style={{ color: colors.blue, fontWeight: '700', marginTop: 8 }}>Retry</Text>
                    </Pressable>
                  </View>
                ) : (targetsQuery.data?.shifts.length ?? 0) === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.smallMuted}>No swappable colleague shifts on this day. Try another date.</Text>
                  </View>
                ) : (
                  targetsQuery.data!.shifts.map((t) => (
                    <Pressable
                      key={t.id}
                      style={[styles.card, target?.id === t.id && styles.cardSelected]}
                      onPress={() => setTarget(t)}
                    >
                      <Text style={styles.cardTitle}>{swapUserName(t.user)}</Text>
                      <Text style={styles.shiftLine}>
                        {t.category?.name ? `${t.category.name} · ` : ''}
                        {fmtTime(t.startTime)}–{fmtTime(t.endTime)}
                      </Text>
                    </Pressable>
                  ))
                )}
              </>
            )}

            <Pressable
              style={[
                styles.primaryBtn,
                { marginTop: 30 },
                (!myShift || !target || createMut.isPending) && { opacity: 0.5 },
              ]}
              onPress={handleCreate}
              disabled={!myShift || !target || createMut.isPending}
            >
              {createMut.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Send Swap Request</Text>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray50 },
  scroll: { padding: 20 },
  header: { marginBottom: 14 },
  title: { fontSize: 25, fontWeight: '800', color: colors.gray900, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: colors.gray500, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.gray700, marginTop: 14, marginBottom: 8 },

  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardSelected: { borderColor: colors.blue, borderWidth: 2 },
  emptyCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.gray900, marginBottom: 3, flexShrink: 1 },

  statusTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  statusTagText: { fontSize: 11, fontWeight: '800' },

  shiftRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  shiftLine: { fontSize: 12.5, color: colors.gray500, fontVariant: ['tabular-nums'], flexShrink: 1 },

  warnBox: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  warnText: { fontSize: 12, color: '#B45309', flex: 1, lineHeight: 17 },
  adminReason: { fontSize: 12, color: colors.gray500, marginTop: 8, fontStyle: 'italic' },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  acceptBtn: { backgroundColor: colors.blue, borderColor: colors.blue },
  declineBtn: { backgroundColor: colors.white, borderColor: colors.gray200 },
  acceptBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  declineBtnText: { color: colors.gray700, fontWeight: '700', fontSize: 14 },

  cancelLink: { marginTop: 10, alignItems: 'center', paddingVertical: 6 },
  cancelLinkText: { color: colors.red, fontWeight: '700', fontSize: 13 },

  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  smallMuted: { fontSize: 12, color: colors.gray500 },

  dayPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  dayPickerBtn: { padding: 6, backgroundColor: colors.gray50, borderRadius: 10 },
  dayPickerLabel: { fontSize: 14, fontWeight: '700', color: colors.gray900 },

  modalSafe: { flex: 1, backgroundColor: colors.gray50 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.gray900 },
});
