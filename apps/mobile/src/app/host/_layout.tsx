import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { colors } from "@/theme";

/** Host area: requires a signed-in host. */
export default function HostLayout() {
  const { token } = useAuth();
  if (!token) return <Redirect href="/login" />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ presentation: "card" }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
