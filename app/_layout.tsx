import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  useEffect(() => {
    const timer = setTimeout(checkAuthStatus, 150);
    return () => clearTimeout(timer);
  }, []);

  const checkAuthStatus = async () => {
    try {
      const loggedIn = await AsyncStorage.getItem("userLoggedIn");
      if (!loggedIn) {
        router.replace("/loginpg");
      }
    } catch (e) {
      console.warn("Auth check failed:", e);
      router.replace("/loginpg");
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="loginpg" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="community" />
        <Stack.Screen name="croppred" />
        <Stack.Screen name="govpol" />
      </Stack>
    </GestureHandlerRootView>
  );
}
