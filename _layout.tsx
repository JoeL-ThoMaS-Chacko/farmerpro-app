import { Stack } from "expo-router";

export default function RootLayout() {
  return  ( <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />  {/* This is your HomeScreen */}
      <Stack.Screen name="croppred" />  {/* This is your CropPredictionScreen */}
    </Stack>
  );
}