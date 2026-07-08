import {
  useBreakEnd,
  useBreakStart,
  useClockIn,
  useClockOut,
  useCurrentAttendance,
  type ClockOutSummary,
} from '@/features/attendance';
import { getApiErrorMessage } from '@/lib/apiError';
import { colors } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtDuration = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${pad2(h)}:${pad2(m)}:${pad2(s % 60)}`;
};

export default function AttendanceScreen() {
  const router = useRouter();
  const { shiftId, shiftTitle, shiftTime } = useLocalSearchParams<{
    shiftId?: string;
    shiftTitle?: string;
    shiftTime?: string;
  }>();

  const query = useCurrentAttendance();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const breakStart = useBreakStart();
  const breakEnd = useBreakEnd();

  // Shown after a successful clock-out (the backend has no "current" entry then).
  const [summary, setSummary] = useState<ClockOutSummary | null>(null);

  const entry = query.data?.entry ?? null;
  const status = summary ? 'COMPLETED' : (entry?.status ?? 'NONE');
  const isBusy = clockIn.isPending || clockOut.isPending || breakStart.isPending || breakEnd.isPending;

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Live worked time: elapsed since clock-in minus completed breaks (a running
  // break keeps counting until it's ended — mirrors the backend's math).
  const workedSeconds = entry
    ? (now.getTime() - new Date(entry.clockInAt).getTime()) / 1000 -
      entry.breakMinutes * 60 -
      (entry.status === 'ON_BREAK' && entry.breakStartedAt
        ? (now.getTime() - new Date(entry.breakStartedAt).getTime()) / 1000
        : 0)
    : 0;

  const fail = (title: string) => (e: unknown) => Alert.alert(title, getApiErrorMessage(e));

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.gray900} />
          </Pressable>
          <Text style={styles.headerTitle}>Attendance</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.blue} />
        </View>
      </SafeAreaView>
    );
  }

  if (query.isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.gray900} />
          </Pressable>
          <Text style={styles.headerTitle}>Attendance</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 }}>
          <Text style={{ color: colors.gray700, textAlign: 'center', marginBottom: 16 }}>
            {getApiErrorMessage(query.error)}
          </Text>
          <Pressable style={[styles.mainBtn, styles.clockInBtn, { paddingHorizontal: 30 }]} onPress={() => query.refetch()}>
            <Text style={styles.mainBtnText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>Attendance</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.shiftCard}>
          <Text style={styles.shiftTitle}>{shiftTitle || "Today's Shift"}</Text>
          <Text style={styles.shiftTime}>{shiftTime || 'Scheduled Time'}</Text>
        </View>

        <View style={styles.timeBox}>
          <Text style={styles.timeLabel}>{status === 'NONE' || status === 'COMPLETED' ? 'Current Time' : 'Worked Time'}</Text>
          <Text style={styles.timeText}>
            {status === 'NONE' || status === 'COMPLETED' ? format(now, 'h:mm:ss a') : fmtDuration(workedSeconds)}
          </Text>
          {entry && (
            <Text style={styles.statusText}>
              Clocked in at {format(new Date(entry.clockInAt), 'h:mm a')}
              {entry.status === 'ON_BREAK' ? ' · on break' : ''}
              {entry.breakMinutes > 0 ? ` · ${entry.breakMinutes} min break so far` : ''}
            </Text>
          )}
        </View>

        <View style={styles.actionContainer}>
          {status === 'NONE' && (
            <Pressable
              style={[styles.mainBtn, styles.clockInBtn, isBusy && { opacity: 0.6 }]}
              onPress={() =>
                clockIn.mutate(shiftId ? { shiftId } : {}, { onError: fail('Could not clock in') })
              }
              disabled={isBusy}
            >
              <Ionicons name="log-in-outline" size={24} color={colors.white} />
              <Text style={styles.mainBtnText}>Clock In</Text>
            </Pressable>
          )}

          {status === 'ACTIVE' && (
            <>
              <Pressable
                style={[styles.mainBtn, styles.breakBtn, isBusy && { opacity: 0.6 }]}
                onPress={() => breakStart.mutate(undefined, { onError: fail('Could not start break') })}
                disabled={isBusy}
              >
                <Ionicons name="cafe-outline" size={24} color={colors.gray900} />
                <Text style={[styles.mainBtnText, { color: colors.gray900 }]}>Start Break</Text>
              </Pressable>

              <Pressable
                style={[styles.mainBtn, styles.clockOutBtn, isBusy && { opacity: 0.6 }]}
                onPress={() =>
                  clockOut.mutate(undefined, {
                    onSuccess: (res) => setSummary(res.summary),
                    onError: fail('Could not clock out'),
                  })
                }
                disabled={isBusy}
              >
                <Ionicons name="log-out-outline" size={24} color={colors.white} />
                <Text style={styles.mainBtnText}>Clock Out</Text>
              </Pressable>
            </>
          )}

          {status === 'ON_BREAK' && (
            <Pressable
              style={[styles.mainBtn, { backgroundColor: colors.blue }, isBusy && { opacity: 0.6 }]}
              onPress={() => breakEnd.mutate(undefined, { onError: fail('Could not end break') })}
              disabled={isBusy}
            >
              <Ionicons name="play-outline" size={24} color={colors.white} />
              <Text style={styles.mainBtnText}>End Break & Resume</Text>
            </Pressable>
          )}

          {status === 'COMPLETED' && summary && (
            <View style={styles.completedBox}>
              <Ionicons name="checkmark-circle" size={48} color={colors.green} />
              <Text style={styles.completedTitle}>Shift Completed</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{summary.workedHours.toFixed(2)}h</Text>
                  <Text style={styles.summaryLabel}>Worked</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{summary.breakMinutes}m</Text>
                  <Text style={styles.summaryLabel}>Break</Text>
                </View>
                {summary.lateMinutes > 0 && (
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: colors.red }]}>{summary.lateMinutes}m</Text>
                    <Text style={styles.summaryLabel}>Late</Text>
                  </View>
                )}
                {summary.overtimeMinutes > 0 && (
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: colors.blue }]}>{summary.overtimeMinutes}m</Text>
                    <Text style={styles.summaryLabel}>Overtime</Text>
                  </View>
                )}
              </View>
              <Text style={styles.completedText}>You have clocked out. Have a good rest!</Text>
            </View>
          )}

          {isBusy && <ActivityIndicator style={{ marginTop: 20 }} color={colors.blue} />}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.gray900 },

  content: { padding: 20, flex: 1 },

  shiftCard: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    marginBottom: 24,
    alignItems: 'center',
  },
  shiftTitle: { fontSize: 20, fontWeight: '800', color: colors.gray900, textTransform: 'capitalize' },
  shiftTime: { fontSize: 15, color: colors.gray500, marginTop: 4 },

  timeBox: { alignItems: 'center', marginBottom: 40 },
  timeLabel: { fontSize: 14, fontWeight: '700', color: colors.gray400, textTransform: 'uppercase', letterSpacing: 1 },
  timeText: { fontSize: 48, fontWeight: '800', color: colors.gray900, marginTop: 8, fontVariant: ['tabular-nums'] },
  statusText: { fontSize: 15, fontWeight: '600', color: colors.blue, marginTop: 8, textAlign: 'center' },

  actionContainer: { gap: 16 },
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
  },
  clockInBtn: { backgroundColor: colors.blue },
  clockOutBtn: { backgroundColor: colors.red },
  breakBtn: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200 },
  mainBtnText: { fontSize: 18, fontWeight: '800', color: colors.white },

  completedBox: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.greenSoft,
  },
  completedTitle: { fontSize: 20, fontWeight: '800', color: colors.gray900, marginTop: 16 },
  completedText: { fontSize: 15, color: colors.gray500, marginTop: 16, textAlign: 'center' },
  summaryGrid: { flexDirection: 'row', gap: 24, marginTop: 20 },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: colors.gray900, fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: colors.gray400, textTransform: 'uppercase', marginTop: 4 },
});
