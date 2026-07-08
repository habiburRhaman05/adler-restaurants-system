import ScreenState from '@/components/screen-state';
import { useAvailability, useSaveAvailability, useSubmitAvailability } from '@/features/availability';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatCutoff, MONTH_NAMES, MONTH_SHORT, monthKey, pad } from '@/lib/date';
import { colors } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// ---------- Types ----------
type Period = 'AM' | 'PM';
type TimeValue = { hour: number; minute: number; period: Period };
type DaySchedule = { start: TimeValue; end: TimeValue };
type ScheduleMap = Record<string, DaySchedule>;
type ViewMode = 'monthly' | 'weekly';

// ---------- Constants ----------
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DEFAULT_START: TimeValue = { hour: 9, minute: 0, period: 'AM' };
const DEFAULT_END: TimeValue = { hour: 5, minute: 0, period: 'PM' };

// ---------- Time helpers (TimeValue <-> "HH:mm") ----------
const to24 = (t: TimeValue) => {
  let h = t.hour % 12;
  if (t.period === 'PM') h += 12;
  return h * 60 + t.minute;
};
const formatTime = (t: TimeValue) => `${t.hour}:${pad(t.minute)} ${t.period}`;
const toHHMM = (t: TimeValue): string => {
  let h = t.hour % 12;
  if (t.period === 'PM') h += 12;
  return `${pad(h)}:${pad(t.minute)}`;
};
const fromHHMM = (s: string): TimeValue => {
  const [h24, m] = s.split(':').map(Number);
  return { hour: h24 % 12 === 0 ? 12 : h24 % 12, minute: m, period: h24 >= 12 ? 'PM' : 'AM' };
};

// ---------- Time Stepper ----------
function TimeStepper({ label, value, onChange }: { label: string; value: TimeValue; onChange: (v: TimeValue) => void }) {
  const changeHour = (dir: 1 | -1) => {
    let h = value.hour + dir;
    if (h > 12) h = 1;
    if (h < 1) h = 12;
    onChange({ ...value, hour: h });
  };
  const changeMinute = (dir: 1 | -1) => {
    let m = value.minute + dir * 5;
    if (m > 55) m = 0;
    if (m < 0) m = 55;
    onChange({ ...value, minute: m });
  };
  const togglePeriod = () => onChange({ ...value, period: value.period === 'AM' ? 'PM' : 'AM' });

  return (
    <View style={stepperStyles.wrap}>
      <Text style={stepperStyles.label}>{label}</Text>
      <View style={stepperStyles.row}>
        <View style={stepperStyles.unit}>
          <Pressable style={stepperStyles.arrowBtn} onPress={() => changeHour(1)} hitSlop={6}>
            <Ionicons name="chevron-up" size={16} color={colors.blue} />
          </Pressable>
          <Text style={stepperStyles.value}>{pad(value.hour)}</Text>
          <Pressable style={stepperStyles.arrowBtn} onPress={() => changeHour(-1)} hitSlop={6}>
            <Ionicons name="chevron-down" size={16} color={colors.blue} />
          </Pressable>
        </View>
        <Text style={stepperStyles.colon}>:</Text>
        <View style={stepperStyles.unit}>
          <Pressable style={stepperStyles.arrowBtn} onPress={() => changeMinute(1)} hitSlop={6}>
            <Ionicons name="chevron-up" size={16} color={colors.blue} />
          </Pressable>
          <Text style={stepperStyles.value}>{pad(value.minute)}</Text>
          <Pressable style={stepperStyles.arrowBtn} onPress={() => changeMinute(-1)} hitSlop={6}>
            <Ionicons name="chevron-down" size={16} color={colors.blue} />
          </Pressable>
        </View>
        <Pressable style={stepperStyles.periodBtn} onPress={togglePeriod}>
          <Text style={stepperStyles.periodText}>{value.period}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  wrap: { flex: 1 },
  label: { fontSize: 12, fontWeight: '700', color: colors.gray500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center' },
  unit: {
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: 12,
    paddingVertical: 4,
    width: 50,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  arrowBtn: { padding: 4 },
  value: { fontSize: 17, fontWeight: '800', color: colors.gray900, marginVertical: 2 },
  colon: { fontSize: 17, fontWeight: '800', color: colors.gray300, marginHorizontal: 5 },
  periodBtn: { marginLeft: 10, backgroundColor: colors.blueLight, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  periodText: { color: colors.blue, fontWeight: '800', fontSize: 13 },
});

// ---------- Screen ----------
export default function AvailabilityScreen() {
  const now = new Date();
  const month = useMemo(() => monthKey(now), []);
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const totalDays = new Date(year, monthIdx + 1, 0).getDate();
  const firstOffset = new Date(year, monthIdx, 1).getDay();
  const today = now.getDate();

  const query = useAvailability(month);
  const save = useSaveAvailability(month);
  const submit = useSubmitAvailability(month);

  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });

  const [schedule, setSchedule] = useState<ScheduleMap>({});
  const [note, setNote] = useState('');
  // True while the user has local edits the server hasn't confirmed yet —
  // blocks refetches from clobbering in-progress changes.
  const dirty = useRef(false);

  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [tempStart, setTempStart] = useState<TimeValue>(DEFAULT_START);
  const [tempEnd, setTempEnd] = useState<TimeValue>(DEFAULT_END);

  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);

  // ── Server state helpers ─────────────────────────────────────────

  // `availability: null` means the admin has not opened this month yet —
  // there is nothing to create or edit until they do (backend responds 404).
  const avail = query.data?.availability ?? null;
  const isNotOpened = query.data !== undefined && avail === null;

  const status = avail?.status ?? 'DRAFT';
  const cutoffAt = avail?.cutoffAt ?? '';
  const cutoffTime = cutoffAt ? new Date(cutoffAt).getTime() : Infinity;
  const cutoffPassed = cutoffTime < Date.now();
  const readOnly = isNotOpened || status !== 'DRAFT' || cutoffPassed;

  // ── Hydrate from server data (skipped while local edits are unsaved) ──

  useEffect(() => {
    if (!avail || dirty.current) return;
    const { days, times, note: savedNote } = avail;
    const map: ScheduleMap = {};
    Object.keys(days).forEach((d) => {
      const t = times[d];
      map[d] = t
        ? { start: fromHHMM(t.start), end: fromHHMM(t.end) }
        : { start: DEFAULT_START, end: DEFAULT_END };
    });
    setSchedule(map);
    setNote(savedNote);
  }, [avail]);

  // ── Payload builder ──────────────────────────────────────────────

  const buildPayload = (map: ScheduleMap, n: string) => ({
    month,
    days: Object.fromEntries(Object.keys(map).map((d) => [d, 'av' as const])),
    times: Object.fromEntries(Object.entries(map).map(([d, s]) => [d, { start: toHHMM(s.start), end: toHHMM(s.end) }])),
    note: n,
  });

  const updateSchedule = (map: ScheduleMap) => {
    dirty.current = true;
    setSchedule(map);
  };

  // ── Derived ──────────────────────────────────────────────────────

  const totalSelected = Object.keys(schedule).length;
  const totalHours = useMemo(() => {
    let mins = 0;
    Object.values(schedule).forEach((s) => {
      const diff = to24(s.end) - to24(s.start);
      mins += diff > 0 ? diff : 0;
    });
    return Math.round((mins / 60) * 10) / 10;
  }, [schedule]);

  const weekDates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  const weekInMonth = (start: Date) => {
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (d.getMonth() === monthIdx && d.getFullYear() === year) return true;
    }
    return false;
  };

  const shiftWeek = (dir: 1 | -1) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + dir * 7);
    if (weekInMonth(next)) setWeekStart(next);
  };

  const prevWeekOk = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() - 7);
    return weekInMonth(d);
  }, [weekStart]);

  const nextWeekOk = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + 7);
    return weekInMonth(d);
  }, [weekStart]);

  // ── Actions ──────────────────────────────────────────────────────

  const onDayPress = (day: number) => {
    if (readOnly || day < today) return;
    const key = String(day);
    const existing = schedule[key];
    setActiveDay(key);
    setTempStart(existing ? existing.start : DEFAULT_START);
    setTempEnd(existing ? existing.end : DEFAULT_END);
    setTimeModalVisible(true);
  };

  const saveTime = () => {
    if (!activeDay) return;
    if (to24(tempEnd) <= to24(tempStart)) {
      Alert.alert('Invalid time', 'End time must be after start time.');
      return;
    }
    updateSchedule({ ...schedule, [activeDay]: { start: tempStart, end: tempEnd } });
    setTimeModalVisible(false);
  };

  const removeDay = () => {
    if (!activeDay) return;
    const copy = { ...schedule };
    delete copy[activeDay];
    updateSchedule(copy);
    setTimeModalVisible(false);
  };

  const openApplyModal = () => {
    if (!activeDay) return;
    if (to24(tempEnd) <= to24(tempStart)) {
      Alert.alert('Invalid time', 'End time must be after start time before applying.');
      return;
    }
    setSchedule((prev) => ({ ...prev, [activeDay]: { start: tempStart, end: tempEnd } }));
    setRangeStart(Number(activeDay));
    setRangeEnd(null);
    setTimeModalVisible(false);
    setApplyModalVisible(true);
  };

  const onRangeDayPress = (day: number) => {
    if (day < today) return;
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day);
      setRangeEnd(null);
      return;
    }
    if (day < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(day);
    } else {
      setRangeEnd(day);
    }
  };

  const rangeFinalEnd = rangeEnd ?? rangeStart;
  const rangeDayCount = rangeStart && rangeFinalEnd ? rangeFinalEnd - rangeStart + 1 : 0;

  const applyToRange = () => {
    if (!rangeStart || !rangeFinalEnd) return;
    const updated = { ...schedule };
    for (let d = rangeStart; d <= rangeFinalEnd; d++) {
      if (d < today) continue;
      updated[String(d)] = { start: tempStart, end: tempEnd };
    }
    updateSchedule(updated);
    setApplyModalVisible(false);
  };

  const resetAll = () => {
    if (readOnly || totalSelected === 0) return;
    Alert.alert('Reset schedule', 'This will clear all selected days. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => updateSchedule({}) },
    ]);
  };

  const onNoteChange = (v: string) => {
    if (readOnly) return;
    dirty.current = true;
    setNote(v);
  };

  const confirmSchedule = () => {
    if (readOnly || save.isPending || submit.isPending) return; // no duplicate submissions
    if (totalSelected === 0) {
      Alert.alert('No days selected', 'Please select at least one working day.');
      return;
    }
    const invalidDay = Object.entries(schedule).find(([, s]) => to24(s.end) <= to24(s.start));
    if (invalidDay) {
      Alert.alert('Invalid time', `Day ${invalidDay[0]}: end time must be after start time.`);
      return;
    }
    Alert.alert(
      'Submit monthly schedule?',
      `${totalSelected} day${totalSelected !== 1 ? 's' : ''} · ${totalHours} hrs. Submitting is binding — you can't change your availability afterwards. You can also save a draft and keep editing until the cut-off.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save draft',
          onPress: () => {
            save.mutate(buildPayload(schedule, note), {
              onSuccess: () => {
                dirty.current = false;
              },
              onError: (e) => {
                Alert.alert('Could not save', getApiErrorMessage(e));
                query.refetch();
              },
            });
          },
        },
        {
          text: 'Submit',
          onPress: () => {
            save.mutate(buildPayload(schedule, note), {
              onSuccess: () => {
                dirty.current = false;
                submit.mutate(undefined, {
                  onSuccess: () => {
                    setSuccessModalVisible(true);
                  },
                  onError: (e) => {
                    Alert.alert('Could not submit', getApiErrorMessage(e));
                    query.refetch();
                  },
                });
              },
              onError: (e) => {
                Alert.alert('Could not save', getApiErrorMessage(e));
                query.refetch();
              },
            });
          },
        },
      ],
    );
  };

  // ── Cell renderers ───────────────────────────────────────────────

  const renderDayCell = (day: number | null, size: 'sm' | 'lg') => {
    if (day === null) return <View style={[styles.cell, size === 'lg' && styles.cellLg]} />;
    const key = String(day);
    const has = schedule[key];
    const isToday = day === today;
    const past = day < today;

    return (
      <Pressable
        key={key}
        disabled={past || readOnly}
        onPress={() => onDayPress(day)}
        style={[
          styles.cell,
          size === 'lg' && styles.cellLg,
          has && styles.cellActive,
          isToday && !has && styles.cellToday,
          past && styles.cellDisabled,
          readOnly && !past && styles.cellLocked,
        ]}
      >
        <Text style={[styles.cellDateText, !!has && styles.cellDateTextActive, past && styles.cellDateTextDisabled]}>
          {day}
        </Text>
        {has && !past && (
          <Text style={styles.cellTimeText} numberOfLines={1}>
            {formatTime(has.start)}
          </Text>
        )}
        {has && !past && <View style={styles.cellDot} />}
      </Pressable>
    );
  };

  const renderRangeCell = (day: number | null) => {
    if (day === null) return <View style={styles.cell} />;
    const past = day < today;
    const isStart = rangeStart === day;
    const isEnd = rangeFinalEnd === day;
    const inRange = rangeStart && rangeFinalEnd && day >= rangeStart && day <= rangeFinalEnd;

    return (
      <Pressable
        key={day}
        disabled={past}
        onPress={() => onRangeDayPress(day)}
        style={[styles.rangeCell, !!inRange && styles.rangeCellInBetween, past && styles.cellDisabled]}
      >
        <View style={[styles.rangeCellInner, (isStart || isEnd) && styles.rangeCellEdge]}>
          <Text style={[styles.cellDateText, (isStart || isEnd) && styles.cellDateTextActive, past && styles.cellDateTextDisabled]}>
            {day}
          </Text>
        </View>
      </Pressable>
    );
  };

  const monthCells: (number | null)[] = useMemo(() => {
    const cells: (number | null)[] = [
      ...Array.from({ length: firstOffset }, () => null),
      ...Array.from({ length: totalDays }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [firstOffset, totalDays]);

  // ── Banner message ───────────────────────────────────────────────

  const banner = useMemo(() => {
    if (isNotOpened) {
      return {
        icon: 'information-circle-outline' as const,
        color: colors.gray500,
        bgColor: colors.gray100,
        message: 'Availability for this month has not been opened yet by management.',
      };
    }
    if (status === 'SUBMITTED') {
      return {
        icon: 'hourglass-outline' as const,
        color: colors.amber,
        bgColor: colors.amberSoft,
        message: `Your availability has been submitted${cutoffAt ? ` — deadline was ${formatCutoff(cutoffAt)}` : ''}. You can no longer make changes.`,
      };
    }
    if (status === 'LOCKED') {
      return {
        icon: 'lock-closed-outline' as const,
        color: colors.gray500,
        bgColor: colors.gray100,
        message:
          'Availability can no longer be changed because scheduling for this month has been finalized by management.',
      };
    }
    if (cutoffPassed && status === 'DRAFT') {
      return {
        icon: 'time-outline' as const,
        color: colors.red,
        bgColor: colors.redSoft,
        message: `The submission deadline${cutoffAt ? ` (${formatCutoff(cutoffAt)})` : ''} has passed. Availability is now locked and can no longer be submitted.`,
      };
    }
    if (cutoffAt && status === 'DRAFT') {
      return {
        icon: 'information-circle-outline' as const,
        color: colors.blue,
        bgColor: colors.blueSoft,
        message: `Submit before ${formatCutoff(cutoffAt)}. After that, availability is locked.`,
      };
    }
    return null;
  }, [status, cutoffAt, cutoffPassed, isNotOpened]);

  // ── Render ───────────────────────────────────────────────────────

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenState loading />
      </SafeAreaView>
    );
  }

  if (query.isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenState error={query.error} onRetry={() => query.refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => {
              dirty.current = false;
              query.refetch();
            }}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Set Your Schedule</Text>
          <Text style={styles.subtitle}>Pick the days & times you&apos;re available to work this month</Text>
        </View>

        {/* Status banner */}
        {banner && (
          <View style={[styles.banner, { backgroundColor: banner.bgColor }]}>
            <Ionicons name={banner.icon} size={16} color={banner.color} />
            <Text style={[styles.bannerText, { color: colors.gray700 }]}>{banner.message}</Text>
          </View>
        )}

        {/* Monthly / Weekly toggle */}
        <View style={styles.tabSwitcher}>
          {(['monthly', 'weekly'] as ViewMode[]).map((mode) => (
            <Pressable key={mode} onPress={() => setViewMode(mode)} style={[styles.tabBtn, viewMode === mode && styles.tabBtnActive]}>
              <Ionicons
                name={mode === 'monthly' ? 'calendar-outline' : 'calendar-number-outline'}
                size={15}
                color={viewMode === mode ? colors.blue : colors.gray400}
              />
              <Text style={[styles.tabText, viewMode === mode && styles.tabTextActive]}>
                {mode === 'monthly' ? 'Monthly' : 'Weekly'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Calendar Card */}
        <View style={styles.card}>
          <View style={styles.navRow}>
            <Pressable
              onPress={() => viewMode === 'weekly' && shiftWeek(-1)}
              style={[styles.navBtn, (viewMode === 'monthly' || !prevWeekOk) && styles.navBtnDisabled]}
              hitSlop={8}
              disabled={viewMode === 'monthly' || !prevWeekOk}
            >
              <Ionicons name="chevron-back" size={20} color={viewMode === 'weekly' && prevWeekOk ? colors.blue : colors.gray300} />
            </Pressable>
            <Text style={styles.navLabel}>
              {viewMode === 'monthly'
                ? `${MONTH_NAMES[monthIdx]} ${year}`
                : `${weekDates[0].getDate()} ${MONTH_SHORT[weekDates[0].getMonth()]} – ${weekDates[6].getDate()} ${MONTH_SHORT[weekDates[6].getMonth()]}`}
            </Text>
            <Pressable
              onPress={() => viewMode === 'weekly' && shiftWeek(1)}
              style={[styles.navBtn, (viewMode === 'monthly' || !nextWeekOk) && styles.navBtnDisabled]}
              hitSlop={8}
              disabled={viewMode === 'monthly' || !nextWeekOk}
            >
              <Ionicons name="chevron-forward" size={20} color={viewMode === 'weekly' && nextWeekOk ? colors.blue : colors.gray300} />
            </Pressable>
          </View>

          <View style={styles.dayLabelRow}>
            {DAY_LABELS.map((l, i) => (
              <Text key={i} style={styles.dayLabelText}>
                {l}
              </Text>
            ))}
          </View>

          {viewMode === 'monthly' ? (
            <View style={styles.grid}>
              {monthCells.map((d, i) => (
                <View key={i} style={styles.gridItem}>
                  {renderDayCell(d, 'sm')}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.grid}>
              {weekDates.map((d, i) => {
                const inMonth = d.getMonth() === monthIdx && d.getFullYear() === year;
                return (
                  <View key={i} style={styles.gridItem}>
                    {renderDayCell(inMonth ? d.getDate() : null, 'lg')}
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.blue }]} />
              <Text style={styles.legendText}>Scheduled</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.gray200 }]} />
              <Text style={styles.legendText}>Available</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.gray100, borderWidth: 1, borderColor: colors.gray300 }]} />
              <Text style={styles.legendText}>Past</Text>
            </View>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Ionicons name="calendar-outline" size={18} color={colors.blue} />
            <Text style={styles.summaryText}>
              {totalSelected} day{totalSelected !== 1 ? 's' : ''} selected
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="time-outline" size={18} color={colors.blue} />
            <Text style={styles.summaryText}>{totalHours} hrs total</Text>
          </View>
          {(save.isPending || submit.isPending) && (
            <>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <ActivityIndicator size="small" color={colors.blue} />
                <Text style={styles.summaryText}>Saving…</Text>
              </View>
            </>
          )}
        </View>

        {/* Note to management */}
        <Text style={styles.noteLabel}>Note for management (optional)</Text>
        <TextInput
          style={[styles.noteInput, readOnly && { opacity: 0.6 }]}
          editable={!readOnly}
          multiline
          placeholder="e.g. Please keep the last weekend free — family event."
          placeholderTextColor={colors.gray400}
          value={note}
          onChangeText={onNoteChange}
        />

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <Pressable style={[styles.resetBtn, readOnly && { opacity: 0.5 }]} onPress={resetAll} disabled={readOnly}>
          <Ionicons name="refresh-outline" size={18} color={colors.red} />
          <Text style={styles.resetBtnText}>Reset All</Text>
        </Pressable>
        <Pressable
          style={[styles.confirmBtn, (totalSelected === 0 || readOnly || isNotOpened) && styles.confirmBtnDisabled]}
          onPress={confirmSchedule}
          disabled={save.isPending || submit.isPending || totalSelected === 0 || readOnly || isNotOpened}
        >
          {submit.isPending || save.isPending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Text style={styles.confirmBtnText}>
                {status === 'SUBMITTED' ? 'Submitted \u2713' : (readOnly || isNotOpened) ? 'Locked' : 'Confirm Schedule'}
              </Text>
              {!readOnly && <Ionicons name="arrow-forward" size={18} color={colors.white} />}
            </>
          )}
        </Pressable>
      </View>

      {/* ---------- Time Modal ---------- */}
      <Modal visible={timeModalVisible} transparent animationType="fade" onRequestClose={() => setTimeModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Set Working Hours</Text>
                {activeDay && (
                  <Text style={styles.modalSubtitle}>
                    {new Date(year, monthIdx, Number(activeDay)).toDateString()}
                  </Text>
                )}
              </View>
              <Pressable onPress={() => setTimeModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.gray500} />
              </Pressable>
            </View>

            <View style={styles.stepperRow}>
              <TimeStepper label="Start Time" value={tempStart} onChange={setTempStart} />
              <TimeStepper label="End Time" value={tempEnd} onChange={setTempEnd} />
            </View>

            <Pressable style={styles.applyOthersBtn} onPress={openApplyModal}>
              <Ionicons name="copy-outline" size={16} color={colors.blue} />
              <Text style={styles.applyOthersText}>Apply this time to other days</Text>
            </Pressable>

            <View style={styles.modalFooter}>
              {activeDay && schedule[activeDay] && (
                <Pressable style={styles.removeBtn} onPress={removeDay}>
                  <Ionicons name="trash-outline" size={16} color={colors.red} />
                </Pressable>
              )}
              <Pressable style={styles.cancelBtn} onPress={() => setTimeModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={saveTime}>
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------- Apply Range Modal ---------- */}
      <Modal visible={applyModalVisible} transparent animationType="fade" onRequestClose={() => setApplyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Apply to Day Range</Text>
                <View style={styles.timePreviewChip}>
                  <Ionicons name="time-outline" size={13} color={colors.blue} />
                  <Text style={styles.timePreviewText}>
                    {formatTime(tempStart)} – {formatTime(tempEnd)}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setApplyModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.gray500} />
              </Pressable>
            </View>

            <Text style={styles.rangeHint}>Tap a start day, then an end day · {MONTH_NAMES[monthIdx]} {year}</Text>

            <View style={styles.dayLabelRow}>
              {DAY_LABELS.map((l, i) => (
                <Text key={i} style={styles.dayLabelText}>
                  {l}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {monthCells.map((d, i) => (
                <View key={i} style={styles.gridItem}>
                  {renderRangeCell(d)}
                </View>
              ))}
            </View>

            {rangeStart && (
              <View style={styles.rangePreview}>
                <Ionicons name="information-circle-outline" size={16} color={colors.blue} />
                <Text style={styles.rangePreviewText}>
                  {rangeDayCount} day{rangeDayCount !== 1 ? 's' : ''} selected
                  {rangeFinalEnd ? ` · ${rangeStart}–${rangeFinalEnd} ${MONTH_SHORT[monthIdx]}` : ''}
                </Text>
                <Pressable
                  onPress={() => {
                    setRangeStart(null);
                    setRangeEnd(null);
                  }}
                  hitSlop={6}
                >
                  <Text style={styles.clearRangeText}>Clear</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.modalFooter}>
              <Pressable style={styles.cancelBtn} onPress={() => setApplyModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.saveBtn, !rangeStart && styles.saveBtnDisabled]} onPress={applyToRange} disabled={!rangeStart}>
                <Text style={styles.saveBtnText}>
                  Apply to {rangeDayCount || 0} day{rangeDayCount !== 1 ? 's' : ''}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------- Success Modal ---------- */}
      <Modal visible={successModalVisible} transparent animationType="fade" onRequestClose={() => setSuccessModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successHalo}>
              <View style={styles.successIconWrap}>
                <Ionicons name="checkmark" size={34} color={colors.white} />
              </View>
            </View>

            <Text style={styles.successTitle}>Schedule Submitted!</Text>
            <Text style={styles.successMessage}>
              Your monthly slots were sent to management. Once approved, your confirmed shifts appear on the Schedule tab.
            </Text>

            <View style={styles.successStatsRow}>
              <View style={styles.successStat}>
                <Text style={styles.successStatValue}>{totalSelected}</Text>
                <Text style={styles.successStatLabel}>Day{totalSelected !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.successStatDivider} />
              <View style={styles.successStat}>
                <Text style={styles.successStatValue}>{totalHours}</Text>
                <Text style={styles.successStatLabel}>Hours</Text>
              </View>
              <View style={styles.successStatDivider} />
              <View style={styles.successStat}>
                <Ionicons name="hourglass-outline" size={19} color={colors.amber} />
                <Text style={styles.successStatLabel}>Pending</Text>
              </View>
            </View>

            <Pressable style={styles.successDoneBtn} onPress={() => setSuccessModalVisible(false)}>
              <Text style={styles.successDoneText}>Done</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.white} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray50 },
  scrollContent: { padding: 20 },

  header: { marginBottom: 16 },
  title: { fontSize: 25, fontWeight: '800', color: colors.gray900, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: colors.gray500, marginTop: 4 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  bannerText: { flex: 1, fontSize: 12.5, lineHeight: 18 },

  tabSwitcher: { flexDirection: 'row', backgroundColor: colors.gray100, borderRadius: 16, padding: 6, marginBottom: 16 },
  tabBtn: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabBtnActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: { fontSize: 14, fontWeight: '700', color: colors.gray400 },
  tabTextActive: { color: colors.blue },

  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navBtn: { padding: 7, backgroundColor: colors.gray50, borderRadius: 10 },
  navBtnDisabled: { opacity: 0.5 },
  navLabel: { fontSize: 16, fontWeight: '800', color: colors.gray900 },

  dayLabelRow: { flexDirection: 'row', marginBottom: 6 },
  dayLabelText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.gray400 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: `${100 / 7}%`, padding: 3 },

  cell: { aspectRatio: 1, borderRadius: 12, backgroundColor: colors.gray50, alignItems: 'center', justifyContent: 'center' },
  cellLg: { aspectRatio: 0.85, backgroundColor: colors.gray50 },
  cellActive: {
    backgroundColor: colors.blue,
    shadowColor: colors.blue,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cellToday: { borderWidth: 1.5, borderColor: colors.blue },
  cellDisabled: { backgroundColor: colors.gray100, opacity: 0.45 },
  cellLocked: { opacity: 0.75 },
  cellDateText: { fontSize: 13, fontWeight: '700', color: colors.gray700 },
  cellDateTextActive: { color: colors.white },
  cellDateTextDisabled: { color: colors.gray400, textDecorationLine: 'line-through' },
  cellTimeText: { fontSize: 8, color: colors.blueLight, marginTop: 2, fontWeight: '600' },
  cellDot: { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.white },

  rangeCell: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  rangeCellInBetween: { backgroundColor: colors.blueSoft },
  rangeCellInner: { width: '100%', height: '100%', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rangeCellEdge: { backgroundColor: colors.blue },

  legendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14, gap: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.gray500, fontWeight: '600' },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blueSoft,
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  summaryDivider: { width: 1, height: 20, backgroundColor: colors.blueLight },
  summaryText: { fontSize: 13, fontWeight: '700', color: colors.gray700 },

  noteLabel: { fontSize: 12, fontWeight: '800', color: colors.gray700, marginTop: 16, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  noteInput: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.gray900,
    minHeight: 64,
    textAlignVertical: 'top',
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  resetBtnText: { color: colors.red, fontWeight: '700', fontSize: 14 },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 14,
  },
  confirmBtnDisabled: { backgroundColor: colors.gray300 },
  confirmBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.white, borderRadius: 22, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.gray900 },
  modalSubtitle: { fontSize: 12, color: colors.gray500, marginTop: 3 },

  timePreviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.blueSoft,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  timePreviewText: { fontSize: 11, color: colors.blue, fontWeight: '700' },

  rangeHint: { fontSize: 12, color: colors.gray400, marginBottom: 12, fontWeight: '600' },

  stepperRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },

  applyOthersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.blueSoft,
    borderRadius: 12,
    paddingVertical: 11,
    marginBottom: 18,
  },
  applyOthersText: { color: colors.blue, fontWeight: '700', fontSize: 13 },

  modalFooter: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  removeBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.redSoft,
    backgroundColor: colors.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.gray200, alignItems: 'center' },
  cancelBtnText: { color: colors.gray700, fontWeight: '700', fontSize: 14 },
  saveBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: colors.blue, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: colors.gray300 },
  saveBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  rangePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.blueSoft,
    padding: 10,
    borderRadius: 12,
    marginTop: 14,
    marginBottom: 4,
  },
  rangePreviewText: { fontSize: 12, color: colors.blue, fontWeight: '700', flex: 1 },
  clearRangeText: { fontSize: 12, color: colors.red, fontWeight: '700' },

  successCard: {
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  successHalo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.green,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  successTitle: { fontSize: 21, fontWeight: '800', color: colors.gray900, letterSpacing: -0.3, marginBottom: 8 },
  successMessage: {
    fontSize: 13.5,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 6,
  },
  successStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 16,
    paddingVertical: 12,
    marginTop: 20,
  },
  successStat: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 40 },
  successStatValue: { fontSize: 18, fontWeight: '800', color: colors.gray900 },
  successStatLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  successStatDivider: { width: 1, alignSelf: 'stretch', marginVertical: 4, backgroundColor: colors.gray200 },
  successDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 20,
    shadowColor: colors.blue,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  successDoneText: { color: colors.white, fontWeight: '800', fontSize: 15 },
});
