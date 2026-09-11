import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

/** Probe the exact native module before importing its JS entry point. */
export async function saveDownloadedMedia(uri: string, kind: "image" | "video"): Promise<"saved" | "denied" | "unavailable"> {
  if (Platform.OS === "web") return "unavailable";
  const permissions: ("photo" | "video")[] = [kind === "image" ? "photo" : "video"];
  if (requireOptionalNativeModule("ExpoMediaLibrary")) {
    const library: typeof import("expo-media-library/legacy") = require("expo-media-library/legacy");
    const permission = await library.requestPermissionsAsync(true, permissions);
    if (!permission.granted && permission.status !== "granted") return "denied";
    await library.saveToLibraryAsync(uri);
    return "saved";
  }
  if (requireOptionalNativeModule("ExpoMediaLibraryNext")) {
    const library: typeof import("expo-media-library") = require("expo-media-library");
    const permission = await library.requestPermissionsAsync(true, permissions);
    if (!permission.granted && permission.status !== "granted") return "denied";
    await library.Asset.create(uri);
    return "saved";
  }
  return "unavailable";
}
