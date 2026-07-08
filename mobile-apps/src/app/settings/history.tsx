import ScreenState from '@/components/screen-state';
import { useAttendanceHistory, type TimeEntry } from '@/features/attendance';
import { addMonths, monthKey, monthLabel, shiftDateParts } from '@/lib/date';
import { colors } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import React, { useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

function EntryCard({ entry }: { entry: TimeEntry }) {
  const day = shiftDateParts(entry.clockInAt.slice(0, 10));
  const workedMinutes = entry.workedMinutes ?? 0;
  const hours = Math.floor(workedMinutes / 60);
  const mins = workedMinutes % 60;

  return (
    <View style={styles.card}>
      <View style={styles.dateBox}>
        <Text style={styles.dateNum}>{day.dayNum}</Text>
        <Text style={styles.dateMeta}>
          {day.monthShort} · {day.weekday}
        </Text>
      </View>
      <View style={{ flex: 1, paddingLeft: 12 }}>
        <Text style={styles.cardTitle}>
          {format(new Date(entry.clockInAt), 'h:mm a')}
          {entry.clockOutAt ? ` – ${format(new Date(entry.clockOutAt), 'h:mm a')}` : ''}
        </Text>
        <Text style={styles.cardSub}>
          Worked {hours}h {mins}m · Break {entry.breakMinutes}m
          {(entry.lateMinutes ?? 0) > 0 ? ` · ${entry.lateMinutes}m late` : ''}
          {(entry.overtimeMinutes ?? 0) > 0 ? ` · ${entry.overtimeMinutes}m overtime` : ''}
        </Text>
        {entry.shift?.category?.name ? <Text style={styles.cardCategory}>{entry.shift.category.name}</Text> : null}
      </View>
    </View>
  );
}

export default function HistoryPage() {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const query = useAttendanceHistory(month);
  const data = query.data;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
      >
        <Text style={styles.title}>Attendance History</Text>

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
        ) : data && data.entries.length === 0 ? (
          <ScreenState
            emptyIcon="time-outline"
            emptyTitle="No completed shifts"
            emptyText={`You have no attendance records for ${monthLabel(month)}.`}
          />
        ) : data ? (
          <>
            <View style={styles.totalsCard}>
              <View style={styles.totalsItem}>
                <Text style={styles.totalsValue}>{data.totals.workedHours.toFixed(1)}h</Text>
                <Text style={styles.totalsLabel}>Worked</Text>
              </View>
              <View style={styles.totalsDivider} />
              <View style={styles.totalsItem}>
                <Text style={styles.totalsValue}>{data.entries.length}</Text>
                <Text style={styles.totalsLabel}>Shifts</Text>
              </View>
              <View style={styles.totalsDivider} />
              <View style={styles.totalsItem}>
                <Text style={styles.totalsValue}>{data.totals.lateCount}</Text>
                <Text style={styles.totalsLabel}>Late days</Text>
              </View>
            </View>

            {data.entries.map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </>
        ) : null}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray50 },
  scroll: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.gray900, marginBottom: 16 },

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
    marginBottom: 16,
  },
  monthBtn: { padding: 8, backgroundColor: colors.gray50, borderRadius: 12 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.gray900 },

  totalsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blueSoft,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  totalsItem: { flex: 1, alignItems: 'center' },
  totalsDivider: { width: 1, height: 24, backgroundColor: colors.blueLight },
  totalsValue: { fontSize: 18, fontWeight: '800', color: colors.gray900 },
  totalsLabel: { fontSize: 11, fontWeight: '700', color: colors.gray500, textTransform: 'uppercase', marginTop: 2 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  dateBox: { width: 54, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.gray100, paddingRight: 10 },
  dateNum: { fontSize: 20, fontWeight: '800', color: colors.gray900 },
  dateMeta: { fontSize: 10, fontWeight: '700', color: colors.gray500, textTransform: 'uppercase', marginTop: 2, textAlign: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.gray900, fontVariant: ['tabular-nums'] },
  cardSub: { fontSize: 12, color: colors.gray500, marginTop: 3 },
  cardCategory: { fontSize: 11, color: colors.blue, fontWeight: '700', marginTop: 3 },
});
