import { useLayoutEffect } from "react";
import { Platform } from "react-native";
import { usePathname } from "expo-router";
import * as ScreenCapture from "expo-screen-capture";
import { createScreenProtection, isProtectedPath } from "./screenProtection";

const key = "luxcare-sensitive-screens";
const setProtection = createScreenProtection({
  prevent: () => ScreenCapture.preventScreenCaptureAsync(key),
  allow: () => ScreenCapture.allowScreenCaptureAsync(key),
  ...(Platform.OS === "ios" ? {
    enablePrivacy: () => ScreenCapture.enableAppSwitcherProtectionAsync(1),
    disablePrivacy: () => ScreenCapture.disableAppSwitcherProtectionAsync(),
  } : {}),
}, error => console.warn("[ScreenProtection] Unable to update native protection", error));

export function useSensitiveScreenProtection() {
  const protectedScreen = isProtectedPath(usePathname());
  useLayoutEffect(() => {
    if (Platform.OS === "android" || Platform.OS === "ios") void setProtection(protectedScreen);
  }, [protectedScreen]);

  useLayoutEffect(() => () => {
    if (Platform.OS === "android" || Platform.OS === "ios") void setProtection(false);
  }, []);
}
