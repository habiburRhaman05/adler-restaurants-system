import ScreenState from '@/components/screen-state';
import { addMonths, monthKey, monthLabel } from '@/lib/date';
import { colors } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMyHours } from '@/features/schedule';

export default function AnalysisScreen() {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const query = useMyHours(month);
  const data = query.data;

  // The backend already computes hours (actual when clocked, planned otherwise).
  const totalHours = data?.totalHours ?? 0;
  const shiftCount = data?.entries.length ?? 0;
  const hourlyRate = data?.hourlyRate ?? null;
  const targetHours = data?.targetHours ?? null;
  const totalEarnings = hourlyRate !== null ? totalHours * hourlyRate : null;

  const roleHours: Record<string, number> = {};
  (data?.entries ?? []).forEach((e) => {
    roleHours[e.category.name] = (roleHours[e.category.name] || 0) + e.hours;
  });

  const breakdown = Object.keys(roleHours).map((role) => ({
    label: role,
    hours: roleHours[role],
    color: '#3B82F6',
    bgColor: '#EFF6FF',
  }));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Analysis</Text>
          <Text style={styles.subtitle}>Overview of your performance</Text>
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
        ) : (
          <>
            {/* Main Stats Grid */}
            <View style={styles.statsGrid}>
              {/* Earnings - Large Card (only when the backend knows the rate) */}
              {totalEarnings !== null && (
                <View style={[styles.statCard, styles.earningsCard]}>
                  <View style={styles.statIconBox}>
                    <Ionicons name="cash" size={24} color="#10B981" />
                  </View>
                  <Text style={styles.statLabel}>Estimated Earnings</Text>
                  <Text style={styles.statValueLarge}>${totalEarnings.toFixed(2)}</Text>
                  <Text style={styles.statSubText}>Based on your ${hourlyRate}/hr rate</Text>
                </View>
              )}

              {/* Small Cards */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { flex: 1 }]}>
                  <View style={[styles.statIconBox, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="time" size={20} color="#3B82F6" />
                  </View>
                  <Text style={styles.statLabel}>Hours</Text>
                  <Text style={styles.statValue}>{totalHours.toFixed(1)}h</Text>
                  {targetHours !== null && <Text style={styles.statSubText}>of {targetHours}h contracted</Text>}
                </View>

                <View style={[styles.statCard, { flex: 1 }]}>
                  <View style={[styles.statIconBox, { backgroundColor: '#F3E8FF' }]}>
                    <Ionicons name="briefcase" size={20} color="#A855F7" />
                  </View>
                  <Text style={styles.statLabel}>Shifts</Text>
                  <Text style={styles.statValue}>{shiftCount}</Text>
                </View>
              </View>
            </View>

            {/* Role Breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hours by Role</Text>
              <View style={styles.card}>
                {breakdown.length === 0 ? (
                  <Text style={{ padding: 20, textAlign: 'center', color: colors.gray500 }}>No worked hours this month.</Text>
                ) : (
                  breakdown.map((item, index) => {
                    const widthPercentage = totalHours > 0 ? `${(item.hours / totalHours) * 100}%` : '0%';
                    return (
                      <View key={item.label} style={[styles.breakdownRow, index !== breakdown.length - 1 && styles.borderBottom]}>
                        <View style={[styles.roleIcon, { backgroundColor: item.bgColor }]}>
                          <Text style={{ fontSize: 16 }}>{item.label.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.roleHeader}>
                            <Text style={styles.roleLabel}>{item.label}</Text>
                            <Text style={styles.roleHours}>{item.hours.toFixed(1)} hrs</Text>
                          </View>
                          <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: widthPercentage as any, backgroundColor: item.color }]} />
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </>
        )}
        <View style={{ height: 40 }} />
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

  statsGrid: { gap: 12, marginBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 12 },

  statCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.gray200,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  earningsCard: {
    backgroundColor: colors.white, // Changed to white as requested
    borderColor: colors.gray200,
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ECFDF5', // Green soft
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray500,
    marginBottom: 4,
  },
  statValueLarge: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.gray900, // Changed back to dark text for light background
    letterSpacing: -1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.gray900,
  },
  statSubText: {
    fontSize: 12,
    color: '#10B981', // Green
    fontWeight: '700',
    marginTop: 8,
  },

  section: { marginTop: 8 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
  },
  roleHours: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray500,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.gray100,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
