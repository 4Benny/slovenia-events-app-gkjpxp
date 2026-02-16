
import "react-native-reanimated";
import React, { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme, View, StyleSheet } from "react-native";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";
import * as Brand from "@/constants/Colors";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from "react-native-reanimated";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    console.log("[Layout] Auth state - user:", user?.id || "anonymous", "segments:", segments);

    const inVerifyOTP = segments[0] === "verify-otp";
    const inAuth = segments[0] === "auth";
    const inOnboarding = segments[0] === "onboarding";
    const inProtectedRoute = segments[0] === "organizer";

    // CRITICAL: Do NOT redirect during OTP verification
    // OTP verification is a BLOCKING screen - user must complete it
    if (inVerifyOTP) {
      console.log("[Layout] User in OTP verification, allowing access");
      return;
    }

    // If user is authenticated but in auth screens (not OTP), redirect to events
    if (user && inAuth) {
      console.log("[Layout] Authenticated user in auth screen, redirecting to events");
      router.replace("/(tabs)/(home)/" as any);
      return;
    }

    // If user is not authenticated and trying to access protected routes, redirect to events
    if (!user && (inProtectedRoute || inOnboarding)) {
      console.log("[Layout] Unauthenticated user accessing protected route, redirecting to events");
      router.replace("/(tabs)/(home)/" as any);
      return;
    }

    // Anonymous users can access events feed - no redirect needed
  }, [user, loading, segments, router]);

  if (loading) {
    return <SplashAnimation />;
  }

  return (
    <Stack
      screenOptions={{
        animation: "fade",
        animationDuration: 200,
        headerBackTitle: "",
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false, animation: "slide_from_bottom" }} />
      <Stack.Screen name="verify-otp" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen
        name="event/[id]"
        options={{
          headerShown: true,
          title: "",
          headerBackTitleVisible: false,
          headerBackTitle: "",
          animation: "slide_from_right",
        } as any}
      />
      <Stack.Screen
        name="organizer/create"
        options={{
          headerShown: true,
          title: "Ustvari dogodek",
          headerBackTitleVisible: false,
          headerBackTitle: "",
          animation: "slide_from_bottom",
        } as any}
      />
      <Stack.Screen
        name="organizer/edit/[id]"
        options={{
          headerShown: true,
          title: "",
          headerBackTitleVisible: false,
          headerBackTitle: "",
          animation: "slide_from_right",
        } as any}
      />
      <Stack.Screen
        name="organizer/profile/[id]"
        options={{
          headerShown: true,
          title: "",
          headerBackTitleVisible: false,
          headerBackTitle: "",
          animation: "slide_from_right",
        } as any}
      />
      <Stack.Screen
        name="event/attendees/[id]"
        options={{
          headerShown: true,
          title: "",
          headerBackTitleVisible: false,
          headerBackTitle: "",
          animation: "slide_from_right",
        } as any}
      />
    </Stack>
  );
}

function SplashAnimation() {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Logo scale + fade animation
    scale.value = withDelay(
      200,
      withSequence(
        withTiming(1.1, { duration: 400, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 200, easing: Easing.inOut(Easing.cubic) })
      )
    );
    opacity.value = withDelay(
      200,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
    );
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={loadingStyles.container}>
      <Animated.Image
        source={require("../assets/images/logo.png")}
        style={[loadingStyles.logo, animatedStyle]}
      />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  // KjeDogaja brand theme - dark-first nightlife theme
  const CustomTheme: Theme = {
    ...DarkTheme,
    dark: true,
    colors: {
      ...DarkTheme.colors,
      primary: Brand.accentOrange,
      background: Brand.primaryGradientStart,
      card: Brand.surfaceDark,
      text: Brand.textPrimary,
      border: Brand.borderSubtle,
      notification: Brand.accentOrange,
    },
  };

  return (
    <>
      <StatusBar style="auto" animated />
      <ThemeProvider
        value={CustomTheme}
      >
        <AuthProvider>
          <NotificationsProvider>
            <WidgetProvider>
              <GestureHandlerRootView>
                <RootLayoutNav />
                <SystemBars style={"auto"} />
              </GestureHandlerRootView>
            </WidgetProvider>
          </NotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Brand.primaryGradientStart,
  },
  logo: {
    width: 200,
    height: 200,
  },
});
