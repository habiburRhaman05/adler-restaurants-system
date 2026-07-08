import BottomTabBar from '@/components/bottom-tab';
import Header from '@/components/header';
import { Tabs, usePathname } from 'expo-router';
import React from 'react';

const TabLayout = () => {
  const pathname = usePathname();
  const showHeader = pathname !== '/profile';

  return (
    <>
      {showHeader && <Header />}

      <Tabs
        tabBar={(props) => <BottomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        {/* Staff app: schedule, availability, analysis, swaps (+ hidden profile) */}
        <Tabs.Screen name="index" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="schedule" options={{ title: 'Schedule', headerShown: false }} />
        <Tabs.Screen name="availability" options={{ title: 'Availability', headerShown: false }} />
        <Tabs.Screen name="analysis" options={{ title: 'Analysis', headerShown: false }} />
        <Tabs.Screen name="swaps" options={{ title: 'Swaps', headerShown: false }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', headerShown: false, href: null }} />
      </Tabs>
    </>
  );
};

export default TabLayout;


