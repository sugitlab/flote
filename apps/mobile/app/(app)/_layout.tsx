import { Stack } from "expo-router";
import { useTheme } from "../../src/theme";

export default function AppLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="notes" />
      <Stack.Screen name="tasks" />
    </Stack>
  );
}
