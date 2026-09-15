type NotificationTokens = Pick<typeof import("expo-notifications"), "getDevicePushTokenAsync" | "getExpoPushTokenAsync">;

export async function getPushRegistration(platform: string, notifications: NotificationTokens, projectId?: string) {
  if (platform === "android") {
    const native = await notifications.getDevicePushTokenAsync();
    if (native.type !== "android" || typeof native.data !== "string" || !native.data) throw new Error("Invalid Firebase device token");
    return { token: native.data, provider: "fcm" as const, platform: "android" as const };
  }
  if (platform !== "ios" || !projectId) throw new Error("Missing iOS push project configuration");
  const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
  return { token, provider: "expo" as const, platform: "ios" as const };
}
