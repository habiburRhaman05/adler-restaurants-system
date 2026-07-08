import "../../global.css";
import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/features/auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, Redirect, useSegments, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { colors } from "@/theme";

function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (status === "checking") return;

    const inLogin = segments[0] === "login";

    if (status === "unauthenticated" && !inLogin) {
      router.replace("/login");
    } else if (status === "authenticated" && inLogin) {
      router.replace("/");
    }
  }, [status, segments, router]);

  if (status === "checking") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="leaves" />
      <Stack.Screen name="attendance" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
    </QueryClientProvider>
  );
}