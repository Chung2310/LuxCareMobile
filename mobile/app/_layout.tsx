import { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../src/auth/SessionProvider";
import { NotificationProvider } from "../src/features/notifications/NotificationProvider";
import { CommunicationProvider } from "../src/features/notifications/CommunicationProvider";
import { LoadingProvider } from "../src/context/LoadingContext";
import { Button, ErrorText, Page } from "../src/ui";
import { api } from "../src/api/services";

function isSessionExpiredError(msg?: string | null): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes("phiên đăng nhập") ||
    lower.includes("thiết bị khác") ||
    lower.includes("đăng nhập lại") ||
    lower.includes("hết hạn") ||
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("token")
  );
}

function Routes() {
  const { loading, error, retry, sessionReplaced, resetSessionReplaced } = useSession();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [splashFinished, setSplashFinished] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [fontsLoaded] = useFonts({
    Inter: require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
  });

  useEffect(() => {
    // Hiển thị logo thương hiệu trong tối thiểu 1.8 giây mỗi lần mở app
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!minTimeElapsed || loading || !fontsLoaded) return;
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      setSplashFinished(true);
    });
  }, [minTimeElapsed, loading, fontsLoaded, fadeAnim]);

  if (loading || !fontsLoaded) {
    return (
      <View style={splashStyles.container}>
        <StatusBar style="dark" />
        <Image
          source={require("../public/brand-icon.png")}
          style={splashStyles.logo}
          resizeMode="contain"
        />
      </View>
    );
  }

  const isExpired = Boolean(sessionReplaced || (error && isSessionExpiredError(error)));

  if ((error || sessionReplaced) && splashFinished) {
    if (isExpired) {
      return (
        <SafeAreaView style={sessionExpiredStyles.container}>
          <StatusBar style="dark" />
          <View style={sessionExpiredStyles.content}>
            <Image
              source={require("../public/het-phien.png")}
              style={sessionExpiredStyles.image}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={sessionExpiredStyles.button}
              onPress={async () => {
                resetSessionReplaced?.();
                await api.clear().catch(() => {});
                await retry();
              }}
              activeOpacity={0.88}
            >
              <Text style={sessionExpiredStyles.buttonText}>Đăng nhập lại</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <Page title="Kết nối LuxCare">
        <ErrorText message={error} />
        <Button title="Thử lại" onPress={() => void retry()} />
      </Page>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      {!splashFinished && (
        <Animated.View
          style={[splashStyles.container, { opacity: fadeAnim }]}
          pointerEvents="none"
        >
          <StatusBar style="dark" />
          <Image
            source={require("../public/brand-icon.png")}
            style={splashStyles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      )}
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  logo: {
    width: 140,
    height: 140,
  },
});

const sessionExpiredStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  image: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 1672 / 941,
    marginBottom: 28,
  },
  button: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#059669",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter-SemiBold",
  },
});

import { ChatUnreadProvider } from "../src/context/ChatUnreadContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <NotificationProvider>
          <CommunicationProvider>
            <ChatUnreadProvider>
              <LoadingProvider>
                <StatusBar style="dark" />
                <Routes />
              </LoadingProvider>
            </ChatUnreadProvider>
          </CommunicationProvider>
        </NotificationProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
