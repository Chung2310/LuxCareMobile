export const ATTENDANCE_STATUSES = [
  { value: "Present", label: "Có mặt" },
  { value: "Late", label: "Đi muộn" },
  { value: "Left-Early", label: "Về sớm" },
  { value: "Half-Day", label: "Nửa ngày" },
  { value: "Late-Left-Early", label: "Muộn và về sớm" },
  { value: "Absent", label: "Vắng" },
  { value: "Approved-Leave", label: "Nghỉ được duyệt" },
  { value: "Paid-Holiday", label: "Nghỉ lễ hưởng lương" },
  { value: "Approved-WFH", label: "Làm từ xa (WFH)" },
  { value: "Approved-Exception", label: "Ngoại lệ được duyệt" },
  { value: "Incomplete", label: "Thiếu chấm công" },
  { value: "Partial", label: "Thiếu công" },
];
export function adjustmentPayload(status: string, note: string, reason: string) {
  if (!ATTENDANCE_STATUSES.some((item) => item.value === status)) throw new Error("Chọn trạng thái công hợp lệ.");
  if (reason.trim().length < 3) throw new Error("Lý do chỉnh sửa phải có ít nhất 3 ký tự.");
  return { status, note: note.trim(), adjustmentReason: reason.trim() };
}
