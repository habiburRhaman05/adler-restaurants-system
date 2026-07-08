import ScreenState from '@/components/screen-state';
import { useAuthStore } from '@/features/auth';
import { useMySchedule, useRespondToShift, type ScheduleWeek, type Shift, type ShiftStatus } from '@/features/schedule';
import { getApiErrorMessage } from '@/lib/apiError';
import { addMonths, formatDateRange, monthKey, monthLabel, shiftDateParts } from '@/lib/date';
import { colors } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const STATUS_META: Record<ShiftStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: '#B45309', bg: '#FEF3C7' },
  ACCEPTED: { label: 'Accepted', color: '#065F46', bg: '#ECFDF5' },
  REJECTED: { label: 'Declined', color: '#B91C1C', bg: '#FEF2F2' },
  CANCELLED: { label: 'Cancelled', color: colors.gray500, bg: colors.gray100 },
  SWAPPED_OUT: { label: 'Swapped', color: colors.gray500, bg: colors.gray100 },
};

function ShiftCard({ shift, respondingId, onRespond }: {
  shift: Shift;
  respondingId: string | null;
  onRespond: (shift: Shift, action: 'ACCEPT' | 'REJECT') => void;
}) {
  const router = useRouter();
  const { dayNum, monthShort, weekday } = shiftDateParts(shift.date);
  const statusMeta = STATUS_META[shift.status];

  const isResponding = respondingId === shift.id;
  const anyResponding = respondingId !== null;
  const canRespond = shift.status === 'PENDING' && !shift.ended;

  const handlePress = () => {
    if (shift.status !== 'ACCEPTED') return;
    const today = new Date().toISOString().split('T')[0];
    if (shift.date === today) {
      router.push({
        pathname: '/attendance',
        params: { shiftId: shift.id, shiftTitle: shift.label, shiftTime: `${shift.start} - ${shift.end}` },
      });
    } else {
      Alert.alert('Not today', 'You can only clock into a shift on the day it is scheduled.');
    }
  };

  return (
    <View style={styles.shiftCardWrapper}>
      <Pressable
        onPress={handlePress}
        style={[styles.shiftCard, shift.status === 'REJECTED' && { opacity: 0.55 }, shift.status === 'ACCEPTED' && { borderColor: colors.blue }]}
      >
        <View style={styles.dateBox}>
          <Text style={styles.dateNum}>{dayNum}</Text>
          <Text style={styles.dateMeta}>
            {monthShort} · {weekday}
          </Text>
        </View>
        <View style={{ flex: 1, paddingLeft: 12 }}>
          <Text
            style={[styles.shiftLabel, shift.status === 'REJECTED' && { textDecorationLine: 'line-through', color: colors.gray400 }]}
            numberOfLines={1}
          >
            {shift.label}
          </Text>
          <Text style={styles.shiftTime}>
            {shift.start}–{shift.end}
          </Text>
          <View style={styles.categoryChip}>
            <Ionicons name="pricetag-outline" size={11} color={colors.blue} />
            <Text style={styles.categoryChipText}>{shift.categoryName}</Text>
          </View>
        </View>
        <View style={[styles.statusTag, { backgroundColor: statusMeta.bg }]}>
          <Text style={[styles.statusTagText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>
      </Pressable>

      {shift.status === 'REJECTED' && shift.rejectionReason ? (
        <Text style={styles.rejectionReason}>Reason: {shift.rejectionReason}</Text>
      ) : null}

      {canRespond && (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.rejectBtn, anyResponding && { opacity: 0.6 }]}
            onPress={() => onRespond(shift, 'REJECT')}
            disabled={anyResponding}
          >
            <Text style={styles.rejectBtnText}>Decline</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.acceptBtn, anyResponding && { opacity: 0.6 }]}
            onPress={() => onRespond(shift, 'ACCEPT')}
            disabled={anyResponding}
          >
            {isResponding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.acceptBtnText}>Accept</Text>}
          </Pressable>
        </View>
      )}
    </View>
  );
}

function WeekSection({ week, respondingId, onRespond }: {
  week: ScheduleWeek;
  respondingId: string | null;
  onRespond: (shift: Shift, action: 'ACCEPT' | 'REJECT') => void;
}) {
  return (
    <View style={styles.weekSection}>
      <View style={styles.weekHeader}>
        <Ionicons name="calendar-clear-outline" size={14} color={colors.gray500} />
        <Text style={styles.weekTitle}>Week {formatDateRange(week.weekStart, week.weekEnd)}</Text>
        <Text style={styles.weekCount}>
          {week.shifts.length} shift{week.shifts.length !== 1 ? 's' : ''}
        </Text>
      </View>
      {week.shifts.map((s) => (
        <ShiftCard key={s.id} shift={s} respondingId={respondingId} onRespond={onRespond} />
      ))}
    </View>
  );
}

export default function ScheduleScreen() {
  const user = useAuthStore((s) => s.user);
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const query = useMySchedule(month);
  const respondMut = useRespondToShift();
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const data = query.data;

  const handleRespond = (shift: Shift, action: 'ACCEPT' | 'REJECT') => {
    if (respondMut.isPending) return; // no duplicate submissions
    const verb = action === 'ACCEPT' ? 'Accept' : 'Decline';
    Alert.alert(`${verb} this shift?`, `${shift.label} · ${shift.start}–${shift.end} on ${shift.date}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: verb,
        style: action === 'REJECT' ? 'destructive' : 'default',
        onPress: () => {
          setRespondingId(shift.id);
          respondMut.mutate(
            { shiftId: shift.id, action },
            {
              onError: (e) => Alert.alert('Could not respond', getApiErrorMessage(e)),
              onSettled: () => setRespondingId(null),
            },
          );
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>My Schedule</Text>
          <Text style={styles.subtitle}>
            {user?.firstName ? `Hi ${user.firstName} · ` : ''}
            Your approved shifts, week by week
          </Text>
        </View>

        {/* month switcher */}
        <View style={styles.monthRow}>
          <Pressable style={styles.monthBtn} onPress={() => setMonth((m) => addMonths(m, -1))} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.blue} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
          <Pressable style={styles.monthBtn} onPress={() => setMonth((m) => addMonths(m, 1))} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={colors.blue} />
          </Pressable>
        </View>

        {query.isLoading || query.isError ? (
          <ScreenState loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} />
        ) : data && data.shifts.length === 0 ? (
          data.hasUnpublishedPlan ? (
            <ScreenState
              emptyIcon="time-outline"
              emptyTitle={`${monthLabel(month)} isn't published yet`}
              emptyText="Management is still finalizing the schedule. Your shifts will appear here as soon as the plan is approved and published."
            />
          ) : (
            <ScreenState
              emptyIcon="calendar-outline"
              emptyTitle="No published shifts"
              emptyText={`There is no approved schedule for ${monthLabel(month)} yet. Pull down to refresh at any time.`}
            />
          )
        ) : data ? (
          <View style={styles.outerContainer}>
            <View style={styles.publishedBanner}>
              <View style={styles.publishedBannerIconBox}>
                <Ionicons name="checkmark" size={14} color={colors.white} />
              </View>
              <Text style={styles.publishedText}>Published & approved · {monthLabel(month)}</Text>
            </View>

            {data.weeks.map((week) => (
              <WeekSection key={week.key} week={week} respondingId={respondingId} onRespond={handleRespond} />
            ))}
          </View>
        ) : null}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20 },

  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: colors.gray900, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.gray500, marginTop: 4 },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  monthBtn: { padding: 8, backgroundColor: colors.gray50, borderRadius: 12 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.gray900 },

  outerContainer: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  publishedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  publishedBannerIconBox: {
    backgroundColor: colors.green,
    borderRadius: 4,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishedText: { fontSize: 13, fontWeight: '600', color: '#065F46' },

  weekSection: { marginBottom: 14 },
  weekHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginLeft: 2 },
  weekTitle: { fontSize: 14, fontWeight: '700', color: colors.gray700, flex: 1 },
  weekCount: { fontSize: 12, fontWeight: '600', color: colors.gray400 },

  shiftCardWrapper: { marginBottom: 12 },
  shiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 16,
    padding: 16,
  },
  dateBox: { width: 56, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.gray100, paddingRight: 12 },
  dateNum: { fontSize: 22, fontWeight: '800', color: colors.gray900 },
  dateMeta: { fontSize: 11, fontWeight: '700', color: colors.gray500, textTransform: 'uppercase', marginTop: 2, textAlign: 'center' },
  shiftLabel: { fontSize: 15, fontWeight: '700', color: colors.gray900, textTransform: 'capitalize' },
  shiftTime: { fontSize: 13, color: colors.gray500, marginTop: 3, fontVariant: ['tabular-nums'] },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.blueSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    marginTop: 6,
  },
  categoryChipText: { fontSize: 11, fontWeight: '700', color: colors.blue },

  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, marginLeft: 8 },
  statusTagText: { fontSize: 11, fontWeight: '800' },

  rejectionReason: { fontSize: 12, color: colors.gray500, marginTop: 6, marginLeft: 4, fontStyle: 'italic' },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  acceptBtn: { backgroundColor: colors.blue, borderColor: colors.blue },
  rejectBtn: { backgroundColor: colors.white, borderColor: colors.gray200 },
  acceptBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  rejectBtnText: { color: colors.gray700, fontWeight: '700', fontSize: 14 },
});
