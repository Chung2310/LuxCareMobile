import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ permission: vi.fn(), enabled: vi.fn(), position: vi.fn(), fetch: vi.fn() }));
vi.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: mocks.permission,
  hasServicesEnabledAsync: mocks.enabled,
  getCurrentPositionAsync: mocks.position,
  Accuracy: { High: 4 },
}));
vi.mock("react-native", () => ({ Platform: { OS: "android", Version: 35 } }));
vi.mock("../../api/services", () => ({ api: { transport: { fetch: mocks.fetch } } }));
import { attendanceForm, currentAttendancePosition, submitAttendance } from "./checkin";
describe("native attendance submission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.permission.mockResolvedValue({ granted: true });
    mocks.enabled.mockResolvedValue(true);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("does not acquire GPS when permission is denied", async () => {
    mocks.permission.mockResolvedValue({ granted: false });
    await expect(currentAttendancePosition()).rejects.toThrow("cho phép vị trí");
    expect(mocks.position).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("requires location services and a fresh high accuracy position", async () => {
    mocks.enabled.mockResolvedValueOnce(false);
    await expect(currentAttendancePosition()).rejects.toThrow("bật dịch vụ");
    expect(mocks.position).not.toHaveBeenCalled();
    mocks.position.mockResolvedValue({ coords: { latitude: 10, longitude: 106 } });
    await expect(currentAttendancePosition()).resolves.toMatchObject({ coords: { latitude: 10 } });
    expect(mocks.position).toHaveBeenCalledWith({ accuracy: 4 });
  });
  it("bounds the wait for GPS without sending attendance", async () => {
    vi.useFakeTimers();
    mocks.position.mockReturnValue(new Promise(() => {}));
    const pending = expect(currentAttendancePosition()).rejects.toThrow("Định vị quá lâu");
    await vi.advanceTimersByTimeAsync(20000);
    await pending;
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("rejects invalid coordinates before the request", async () => {
    for (const coords of [
      [NaN, 1],
      [91, 1],
      [1, -181],
    ]) {
      await expect(submitAttendance("check-in", coords[0], coords[1])).rejects.toThrow("không hợp lệ");
    }
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each(["check-in", "check-out"] as const)(
    "sends %s as multipart without forcing the boundary or requiring a photo",
    async (action) => {
      mocks.fetch.mockResolvedValue({ json: async () => ({ success: true }) });
      await submitAttendance(action, 10, 106);
      const [url, init] = mocks.fetch.mock.calls[0];
      expect(url).toBe(`/api/v1/timekeeping/${action}`);
      expect(init.method).toBe("POST");
      expect(init.headers).toBeUndefined();
      expect(init.body.get("latitude")).toBe("10");
      expect(init.body.get("longitude")).toBe("106");
      expect(init.body.get("file")).toBeNull();
      expect(init.body.get("deviceInfo")).toBe("LuxCare Mobile android 35");
    },
  );
  it("attaches the native camera file when supplied", () => {
    const append = vi.fn();
    vi.stubGlobal(
      "FormData",
      class {
        append = append;
      },
    );
    attendanceForm(10, 106, "file:///cache/photo.jpg");
    expect(append).toHaveBeenCalledWith("file", {
      uri: "file:///cache/photo.jpg",
      name: "attendance.jpg",
      type: "image/jpeg",
    });
  });
});
