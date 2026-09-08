import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { randomUUID } from "expo-crypto";
import { payroll } from "../../api/services";
export async function sharePayslip(runId: string, employeeId: string, period: string, signal: AbortSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal.aborted) cancel();
  signal.addEventListener("abort", cancel);
  const timer = setTimeout(cancel, 120000);
  const check = () => {
    if (controller.signal.aborted) throw new Error("Đã dừng tải phiếu lương. Vui lòng thử lại.");
  };
  let file: File | undefined;
  let handedOff = false;
  try {
    check();
    if (!(await Sharing.isAvailableAsync())) throw new Error("Thiết bị chưa hỗ trợ chia sẻ tệp.");
    check();
    const bytes = await payroll.downloadPayslip(runId, employeeId, controller.signal);
    check();
    const name = period.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30) || "ca-nhan";
    file = new File(Paths.cache, `${randomUUID()}-phieu-luong-${name}.html`);
    file.write(bytes);
    check();
    clearTimeout(timer);
    handedOff = true;
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/html",
      UTI: "public.html",
      dialogTitle: "Lưu hoặc chia sẻ phiếu lương",
    });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
    if (file && !handedOff) {
      try {
        if (file.exists) file.delete();
      } catch {}
    }
  }
}
