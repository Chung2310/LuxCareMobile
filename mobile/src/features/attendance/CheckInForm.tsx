import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { File, Paths } from "expo-file-system";
import { ATTENDANCE_FACE_CHECK_ENABLED } from "../../../../src/config/attendanceFaceCheck";
import { messageOf } from "../../auth/SessionProvider";
import { Button, ErrorText, Page, styles } from "../../ui";
import { currentAttendancePosition, submitAttendance } from "./checkin";
export function CheckInForm({
  action,
  onClose,
  setLocked,
}: {
  action: "check-in" | "check-out";
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const foregroundRef = useRef(foreground);
  const mounted = useRef(true);
  const backgroundVersion = useRef(0);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") backgroundVersion.current += 1;
      foregroundRef.current = state === "active";
      setForeground(state === "active");
      setReady(false);
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, []);
  const submit = async () => {
    if (lock.current || !foregroundRef.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    let photoUri: string | undefined;
    const version = backgroundVersion.current;
    try {
      if (ATTENDANCE_FACE_CHECK_ENABLED) {
        if (!ready || !camera.current) throw new Error("Camera chưa sẵn sàng.");
        const photo = await camera.current.takePictureAsync({ quality: 0.5, skipProcessing: false });
        if (!photo) throw new Error("Chưa chụp được ảnh.");
        photoUri = photo.uri;
        const file = new File(photoUri);
        if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("Ảnh phải nhỏ hơn 5 MB. Vui lòng chụp lại.");
      }
      const position = await currentAttendancePosition();
      if (!mounted.current || !foregroundRef.current || version !== backgroundVersion.current)
        throw new Error("Ứng dụng đã chuyển nền. Vui lòng thực hiện lại khi mở ứng dụng.");
      try {
        await submitAttendance(action, position.coords.latitude, position.coords.longitude, photoUri);
      } catch (error) {
        if (!(error && typeof error === "object" && "status" in error) || Number(error.status) >= 500) {
          if (mounted.current) setUncertain(true);
          throw new Error(
            "Chưa xác nhận kết quả chấm công. Đóng để tải lại trạng thái hôm nay trước khi thực hiện tiếp.",
          );
        }
        throw error;
      }
      if (mounted.current) setSuccess(true);
    } catch (error) {
      if (mounted.current) setError(messageOf(error));
    } finally {
      if (photoUri) {
        try {
          const file = new File(photoUri);
          if (photoUri.startsWith(Paths.cache.uri) && file.exists) file.delete();
        } catch {}
      }
      lock.current = false;
      if (mounted.current) {
        setBusy(false);
        setLocked(false);
      }
    }
  };
  return (
    <Page title={action === "check-in" ? "Chấm công vào" : "Chấm công ra"}>
      <Text style={styles.muted}>
        Ứng dụng gửi vị trí hiện tại{ATTENDANCE_FACE_CHECK_ENABLED ? " và ảnh chụp khuôn mặt" : ""} đến LuxCare để xác
        nhận chấm công tại chi nhánh.
      </Text>
      {ATTENDANCE_FACE_CHECK_ENABLED &&
        (!permission?.granted ? (
          <>
            <Button
              title="Cho phép camera"
              disabled={busy}
              onPress={() => void requestPermission().catch((error) => setError(messageOf(error)))}
            />
          </>
        ) : foreground ? (
          <View style={{ height: 320, borderRadius: 16, overflow: "hidden" }}>
            <CameraView
              ref={camera}
              style={{ flex: 1 }}
              facing="front"
              onCameraReady={() => setReady(true)}
              onMountError={() => {
                setReady(false);
                setError("Không mở được camera.");
              }}
            />
          </View>
        ) : (
          <Text style={styles.muted}>Mở lại ứng dụng để sử dụng camera.</Text>
        ))}
      <ErrorText message={error} />
      {success && <Text style={styles.text}>Đã ghi nhận chấm công thành công.</Text>}
      <Button
        title={
          busy
            ? "Đang xác nhận…"
            : ATTENDANCE_FACE_CHECK_ENABLED
              ? "Chụp ảnh và gửi chấm công"
              : "Lấy vị trí và gửi chấm công"
        }
        disabled={
          busy ||
          uncertain ||
          success ||
          !foreground ||
          (ATTENDANCE_FACE_CHECK_ENABLED && (!permission?.granted || !ready))
        }
        onPress={() => void submit()}
      />
      {error && (
        <Button
          title="Mở cài đặt quyền ứng dụng"
          disabled={busy}
          onPress={() => void Linking.openSettings().catch((error) => setError(messageOf(error)))}
        />
      )}
      <Button title="Đóng và tải lại trạng thái" disabled={busy} onPress={onClose} />
    </Page>
  );
}
