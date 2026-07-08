import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useProfile, useLogout } from '@/features/auth';
import { colors } from '@/theme';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { isLoading: profileLoading } = useProfile();
  const logout = useLogout();

  const initials = user
    ? [user.firstName, user.lastName].filter(Boolean).map((n) => n?.charAt(0).toUpperCase()).join('') ||
      user.email.charAt(0).toUpperCase()
    : '?';

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0]
    : '';

  const handleLogout = () => {
    logout.mutate();
  };

  const menuItems: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = [
    { icon: 'calendar-outline', label: 'My Schedule', onPress: () => {} },
    { icon: 'bar-chart-outline', label: 'Analysis', onPress: () => {} },
    { icon: 'airplane-outline', label: 'Leave Requests', onPress: () => router.push('/leaves') },
    { icon: 'person-outline', label: 'Edit Profile', onPress: () => router.push('/edit-profile') },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => {} },
    { icon: 'settings-outline', label: 'Settings', onPress: () => {} },
    { icon: 'help-circle-outline', label: 'Help & Support', onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topNav}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colors.gray900} />
          </Pressable>
        </View>
        <View style={styles.headerBg}>
          <View style={styles.avatarWrap}>
            {profileLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <Text style={styles.name}>{displayName}</Text>
          {user?.email && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{user.email}</Text>
            </View>
          )}
        </View>

        {user?.mustChangePassword && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={16} color="#D97706" />
            <Text style={styles.warningText}>Please change your password.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuCard}>
          {menuItems.map((item, i) => (
            <Pressable
              key={item.label}
              style={[styles.menuRow, i !== menuItems.length - 1 && styles.menuRowBorder]}
              onPress={item.onPress}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIconWrap}>
                  <Ionicons name={item.icon} size={17} color={colors.gray700} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
            </Pressable>
          ))}
        </View>

        <Pressable
          style={styles.logoutBtn}
          onPress={handleLogout}
          disabled={logout.isPending}
        >
          {logout.isPending ? (
            <ActivityIndicator color={colors.red} size="small" />
          ) : (
            <Ionicons name="log-out-outline" size={18} color={colors.red} />
          )}
          <Text style={styles.logoutText}>{logout.isPending ? 'Signing out...' : 'Log Out'}</Text>
        </Pressable>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray50,paddingTop: 20 },
  scrollContent: { padding: 20 },

  topNav: { marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: colors.gray900, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },

  headerBg: { alignItems: 'center', paddingVertical: 24, marginBottom: 8 },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: colors.blue,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: colors.white },
  name: { fontSize: 22, fontWeight: '800', color: colors.gray900 },
  badge: { backgroundColor: colors.blueSoft, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginTop: 8 },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.blue },

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  warningText: { color: '#D97706', fontSize: 13, fontWeight: '600', flex: 1 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.gray500, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  menuCard: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.gray100, marginBottom: 18 },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.gray50, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 14, fontWeight: '600', color: colors.gray900 },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.redSoft,
    borderRadius: 14,
    paddingVertical: 14,
  },
  logoutText: { color: colors.red, fontWeight: '800', fontSize: 14 },
});
