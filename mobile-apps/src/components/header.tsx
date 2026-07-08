import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '@/theme';
import { useNotifications } from '@/features/notifications';

const Header = () => {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const { data } = useNotifications();
  const unreadCount = data?.unreadCount ?? 0;

  const navigateToProfile = () => {
    setMenuVisible(false);
    router.push('/profile');
  };

  return (
    <>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.leftSection}>
            <View style={styles.iconBox}>
              <Ionicons name="calendar" size={18} color={colors.white} />
            </View>
            <Text style={styles.logoText}>Adler Staff</Text>
          </View>
          <View style={styles.rightSection}>
            <Pressable onPress={() => router.push('/notifications')} style={styles.bellBtn} hitSlop={8}>
              <Ionicons name="notifications-outline" size={24} color={colors.gray700} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable onPress={() => setMenuVisible(true)} style={styles.avatarBtn}>
              <Ionicons name="person-circle" size={32} color={colors.gray400} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.dropdownMenu}>
            <Pressable style={styles.menuItem} onPress={navigateToProfile}>
              <Ionicons name="person-outline" size={18} color={colors.gray700} />
              <Text style={styles.menuText}>Profile</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => setMenuVisible(false)}>
              <Ionicons name="settings-outline" size={18} color={colors.gray700} />
              <Text style={styles.menuText}>Settings</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={() => setMenuVisible(false)}>
              <Ionicons name="help-circle-outline" size={18} color={colors.gray700} />
              <Text style={styles.menuText}>Help & Support</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

export default Header;

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.white },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bellBtn: { padding: 2 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: -0.5,
  },
  avatarBtn: {
    padding: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 60, // Adjust depending on safe area
    right: 20,
    width: 200,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderRadius: 10,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray700,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginVertical: 4,
  },
});
