import { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../src/auth/SessionProvider";
import { Button, ErrorText, Page } from "../src/ui";

function Routes() {
  const { loading, error, retry } = useSession();
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

  if ((!splashFinished && loading) || !fontsLoaded) {
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

  if (error && splashFinished) {
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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Routes />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
