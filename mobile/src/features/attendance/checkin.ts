import * as Location from "expo-location";
import { Platform } from "react-native";
import { api } from "../../api/services";
export async function currentAttendancePosition() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error("Vui lòng cho phép vị trí khi dùng ứng dụng để chấm công.");
  if (!(await Location.hasServicesEnabledAsync())) throw new Error("Vui lòng bật dịch vụ định vị trên điện thoại.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Định vị quá lâu. Vui lòng thử lại ở nơi có tín hiệu GPS tốt.")),
          20000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export function attendanceForm(latitude: number, longitude: number, photoUri?: string) {
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  )
    throw new Error("Vị trí không hợp lệ.");
  const form = new FormData();
  form.append("latitude", String(latitude));
  form.append("longitude", String(longitude));
  form.append("deviceInfo", `LuxCare Mobile ${Platform.OS} ${Platform.Version}`);
  if (photoUri) form.append("file", { uri: photoUri, name: "attendance.jpg", type: "image/jpeg" } as unknown as Blob);
  return form;
}
export async function submitAttendance(
  action: "check-in" | "check-out",
  latitude: number,
  longitude: number,
  photoUri?: string,
) {
  const response = await api.transport.fetch(`/api/v1/timekeeping/${action}`, {
    method: "POST",
    body: attendanceForm(latitude, longitude, photoUri),
  });
  return response.json();
}
