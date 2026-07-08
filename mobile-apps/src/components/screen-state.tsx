import { colors } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Shown when neither loading nor error — an empty state. */
  emptyIcon?: keyof typeof Ionicons.glyphMap;
  emptyTitle?: string;
  emptyText?: string;
};

/** Consistent loading / error / empty rendering for every tab. */
export default function ScreenState({ loading, error, onRetry, emptyIcon, emptyTitle, emptyText }: Props) {
  if (loading) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.wrap}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-offline-outline" size={30} color={colors.red} />
        </View>
        <Text style={styles.title}>Couldn’t load data</Text>
        <Text style={styles.text}>Check your connection and try again.</Text>
        {onRetry && (
          <Pressable style={styles.retryBtn} onPress={onRetry}>
            <Ionicons name="refresh" size={16} color={colors.white} />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.iconCircle, { backgroundColor: colors.blueSoft }]}>
        <Ionicons name={emptyIcon ?? 'calendar-outline'} size={30} color={colors.blue} />
      </View>
      {emptyTitle ? <Text style={styles.title}>{emptyTitle}</Text> : null}
      {emptyText ? <Text style={styles.text}>{emptyText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.gray900, marginBottom: 6, textAlign: 'center' },
  text: { fontSize: 13, color: colors.gray500, textAlign: 'center', lineHeight: 19 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.blue,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16,
  },
  retryText: { color: colors.white, fontWeight: '700', fontSize: 13 },
});
