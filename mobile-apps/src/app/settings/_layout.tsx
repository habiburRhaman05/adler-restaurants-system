import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="history"
        options={{ title: 'History' }}
      />
      <Stack.Screen
        name="account"
        options={{ title: 'Account' }}
      />
    </Stack>
  );
}