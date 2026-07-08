import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const COLORS = {
  blue: '#2563EB',
  blueSoft: '#EFF6FF',
  white: '#FFFFFF',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray900: '#0F172A',
};

type IconName = keyof typeof Ionicons.glyphMap;

// Route name -> icon + label mapping for this app (staff app: 4 actions + profile)
const ROUTE_META: Record<string, { icon: IconName; iconActive: IconName; label: string }> = {
  schedule: { icon: 'calendar-outline', iconActive: 'calendar', label: 'Schedule' },
  availability: { icon: 'hand-left-outline', iconActive: 'hand-left', label: 'Availability' },
  analysis: { icon: 'pie-chart-outline', iconActive: 'pie-chart', label: 'Analysis' },
  swaps: { icon: 'swap-horizontal-outline', iconActive: 'swap-horizontal', label: 'Swaps' },
  hours: { icon: 'time-outline', iconActive: 'time', label: 'Hours' },
};

const BottomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {state.routes.map((route, index) => {
          const options = descriptors[route.key].options as any;
          
          if (options.href === null) return null; // Skip hidden tabs

          const routeKey = route.name.toLowerCase();
          const meta = ROUTE_META[routeKey] ?? { icon: 'ellipse-outline', iconActive: 'ellipse', label: route.name };

          const label =
            options.tabBarLabel !== undefined
              ? (options.tabBarLabel as string)
              : options.title !== undefined
              ? options.title
              : meta.label;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
            >
              <View style={[styles.iconContainer, isFocused && styles.iconContainerActive]}>
                <Ionicons
                  name={isFocused ? meta.iconActive : meta.icon}
                  size={22}
                  color={isFocused ? COLORS.blue : COLORS.gray400}
                />
              </View>
              <Text style={[styles.label, { color: isFocused ? COLORS.blue : COLORS.gray500 }]} numberOfLines={1}>
                {label as string}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default BottomTabBar;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    paddingBottom: Platform.OS === 'ios' ? 22 : 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconContainer: {
    width: 40,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerActive: {
    backgroundColor: COLORS.blueSoft,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
  },
});
