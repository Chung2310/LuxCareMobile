import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../src/auth/SessionProvider";
import { Button, ErrorText, Loading, Page } from "../src/ui";
function Routes() {
  const { loading, error, retry } = useSession();
  if (loading)
    return (
      <Page title="LuxCare">
        <Loading />
      </Page>
    );
  if (error)
    return (
      <Page title="Kết nối LuxCare">
        <ErrorText message={error} />
        <Button title="Thử lại" onPress={() => void retry()} />
      </Page>
    );
  return <Stack screenOptions={{ headerShown: false }} />;
}
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
