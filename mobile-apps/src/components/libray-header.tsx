import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

const LibraryHeader = () => {
  const router = useRouter();
  
  // Detect system theme for Light/Dark mode support
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  // Match the colors used across the app
  const colors = {
    background: isDark ? '#0f0f0f' : '#ffffff',
    text: isDark ? '#ffffff' : '#0f0f0f',
    icon: isDark ? '#ffffff' : '#0f0f0f',
  };

  return (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      
      {/* LEFT SIDE: Logo Area */}
      <View style={styles.logoContainer}>
        <Ionicons name="logo-youtube" size={32} color="#FF0000" />
        <Text style={[styles.logoText, { color: colors.text }]}>
          YouTube
        </Text>
      </View>

      {/* RIGHT SIDE: Settings Button */}
      <Pressable
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        onPress={() => {
          router.push('/settings');
        }}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        {/* Changed to 'settings-outline' and size 24 to perfectly match the Search/Bell icons */}
        <Ionicons name="settings-outline" size={24} color={colors.icon} />
      </Pressable>

    </View>
  );
};

export default LibraryHeader;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 56, // Standard header height
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Clean spacing between logo and text
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: -1, // Gives it that tight, custom brand font feel
  },
  iconButton: {
    padding: 4, // Increases touch target size for better UX
  },
  pressed: {
    opacity: 0.6, // Visual feedback when tapped
  },
});