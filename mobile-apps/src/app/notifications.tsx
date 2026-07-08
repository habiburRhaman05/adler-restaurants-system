import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { colors } from '@/theme/colors';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification,
} from '@/features/notifications';

// Icon + accent per notification type. Unknown types fall back to a bell.
const VISUALS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  WEEKLY_SHIFTS_PUBLISHED: { icon: 'calendar', color: colors.blue, bg: colors.blueSoft },
  SHIFT_CHANGED: { icon: 'swap-horizontal', color: colors.amber, bg: colors.amberSoft },
  SHIFT_OFFER_PUBLISHED: { icon: 'megaphone', color: colors.blue, bg: colors.blueSoft },
  SWAP_REQUEST_RECEIVED: { icon: 'git-compare', color: colors.blue, bg: colors.blueSoft },
  SWAP_PENDING_ADMIN_APPROVAL: { icon: 'hourglass', color: colors.amber, bg: colors.amberSoft },
  SWAP_REQUEST_RESULT: { icon: 'checkmark-done', color: colors.green, bg: colors.greenSoft },
  LEAVE_REQUEST_RESULT: { icon: 'airplane', color: colors.green, bg: colors.greenSoft },
  AVAILABILITY_REMINDER: { icon: 'time', color: colors.amber, bg: colors.amberSoft },
  RULE_VIOLATION: { icon: 'warning', color: colors.red, bg: colors.redSoft },
  GENERAL: { icon: 'notifications', color: colors.gray500, bg: colors.gray100 },
};

function routeForType(type: string): string | null {
  if (type.startsWith('SWAP')) return '/(tabs)/swaps';
  if (type === 'WEEKLY_SHIFTS_PUBLISHED' || type === 'SHIFT_CHANGED' || type === 'SHIFT_OFFER_PUBLISHED') {
    return '/(tabs)/schedule';
  }
  if (type === 'AVAILABILITY_REMINDER') return '/(tabs)/availability';
  if (type === 'LEAVE_REQUEST_RESULT') return '/leaves';
  return null;
}

const relativeTime = (iso: string): string => {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return '';
  }
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { data, isLoading, isRefetching, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const onPressNotification = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    const route = routeForType(n.type);
    if (route) router.push(route as never);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ flex: 1 }} />
        {unreadCount > 0 && (
          <Pressable
            onPress={() => markAll.mutate()}
            style={styles.markAllBtn}
            disabled={markAll.isPending}
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.blue} style={{ marginTop: 48 }} />
        ) : notifications.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={40} color={colors.gray300} />
            </View>
            <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
            <Text style={styles.emptySub}>Schedule updates and swap requests will show up here.</Text>
          </View>
        ) : (
          notifications.map((n) => {
            const v = VISUALS[n.type] ?? VISUALS.GENERAL;
            const unread = !n.readAt;
            return (
              <Pressable
                key={n.id}
                onPress={() => onPressNotification(n)}
                style={[styles.card, unread && styles.cardUnread]}
              >
                <View style={[styles.cardIcon, { backgroundColor: v.bg }]}>
                  <Ionicons name={v.icon} size={20} color={v.color} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.cardTitle, unread && styles.cardTitleUnread]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    {unread && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.cardMessage}>{n.body}</Text>
                  <Text style={styles.cardTime}>{relativeTime(n.createdAt)}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray50,paddingTop: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.gray900, marginLeft: 8 },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.blueSoft },
  markAllText: { color: colors.blue, fontWeight: '700', fontSize: 12 },

  content: { padding: 16, gap: 10 },

  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  cardUnread: { borderColor: colors.blueLight, backgroundColor: '#FBFDFF' },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.gray700 },
  cardTitleUnread: { color: colors.gray900 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue },
  cardMessage: { fontSize: 13, color: colors.gray500, lineHeight: 18 },
  cardTime: { fontSize: 11, color: colors.gray400, fontWeight: '600', marginTop: 2 },

  emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.gray900, marginBottom: 6 },
  emptySub: { fontSize: 13, color: colors.gray500, textAlign: 'center', lineHeight: 19 },
});
