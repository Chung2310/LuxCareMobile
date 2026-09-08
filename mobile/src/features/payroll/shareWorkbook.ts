import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { randomUUID } from "expo-crypto";
import { payrollWorkbookMime, type PayrollExportType } from "../../../../src/services/payrollService";
import { payroll } from "../../api/services";
export async function shareWorkbook(runId: string, type: PayrollExportType, period: string, signal: AbortSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal.aborted) cancel();
  signal.addEventListener("abort", cancel);
  const timer = setTimeout(cancel, 120000);
  const check = () => {
    if (controller.signal.aborted) throw new Error("Đã dừng tải báo cáo. Vui lòng thử lại.");
  };
  let file: File | undefined;
  let handedOff = false;
  try {
    check();
    if (!(await Sharing.isAvailableAsync())) throw new Error("Thiết bị chưa hỗ trợ chia sẻ tệp.");
    check();
    const bytes = await payroll.downloadWorkbook(runId, type, controller.signal);
    check();
    const name = period.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30) || "bao-cao";
    file = new File(Paths.cache, `${randomUUID()}-payroll-${name}-${type}.xlsx`);
    file.write(bytes);
    check();
    clearTimeout(timer);
    handedOff = true;
    await Sharing.shareAsync(file.uri, {
      mimeType: payrollWorkbookMime,
      UTI: "org.openxmlformats.spreadsheetml.sheet",
      dialogTitle: "Lưu hoặc chia sẻ báo cáo lương Excel",
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
