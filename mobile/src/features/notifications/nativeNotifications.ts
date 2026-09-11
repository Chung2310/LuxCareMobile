import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

// Checking before require is essential: expo-notifications has import-time side effects.
// isRunningInExpoGo distinguishes Expo Go from custom development builds.
const expoGo = isRunningInExpoGo();
export const nativeNotifications: typeof import("expo-notifications") | null =
  Platform.OS !== "web" && !expoGo ? require("expo-notifications") : null;

export const nativeNotificationsUnavailableReason = Platform.OS !== "web" && expoGo
  ? "Expo Go chỉ hỗ trợ thông báo trong ứng dụng. Thông báo nền cần bản cài riêng của LuxCare."
  : null;
