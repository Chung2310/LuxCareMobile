import { describe, it, expect, vi } from "vitest";
import { getPushRegistration } from "./pushToken";

describe("push provider selection", () => {
  it("registers Android with Firebase without an Expo project or Expo network call", async () => {
    const notifications = { getDevicePushTokenAsync: vi.fn().mockResolvedValue({ type: "android", data: "fcm-token" }), getExpoPushTokenAsync: vi.fn() };
    expect(await getPushRegistration("android", notifications)).toEqual({ token: "fcm-token", platform: "android", provider: "fcm" });
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });
  it("never registers an APNs token as an FCM token", async () => {
    const notifications = { getDevicePushTokenAsync: vi.fn().mockResolvedValue({ type: "ios", data: "apns-token" }), getExpoPushTokenAsync: vi.fn() };
    await expect(getPushRegistration("android", notifications)).rejects.toThrow("Invalid Firebase");
  });
  it("preserves existing iOS push registration", async () => {
    const notifications = { getDevicePushTokenAsync: vi.fn(), getExpoPushTokenAsync: vi.fn().mockResolvedValue({ data: "ExpoPushToken[token]" }) };
    expect((await getPushRegistration("ios", notifications, "project")).provider).toBe("expo");
    expect(notifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
  });
});
