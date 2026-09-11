import { describe, expect, it } from "vitest";
import { detectNotificationCategory } from "./category";

describe("detectNotificationCategory", () => {
  it("detects task / công việc notifications", () => {
    const res = detectNotificationCategory("Giao việc mới", "Kiểm tra phòng khám");
    expect(res.category).toBe("task");
    expect(res.label).toBe("Công việc");
    expect(res.color).toBe("#2563eb");
  });

  it("detects leave / nghỉ phép notifications", () => {
    const res = detectNotificationCategory("Đơn xin nghỉ phép", "Đã duyệt đơn nghỉ phép ngày 11/09");
    expect(res.category).toBe("leave");
    expect(res.label).toBe("Đơn từ");
    expect(res.color).toBe("#059669");
  });

  it("detects attendance / chấm công notifications", () => {
    const res = detectNotificationCategory("Nhắc nhở chấm công", "Bạn chưa check-out ca làm việc");
    expect(res.category).toBe("attendance");
    expect(res.label).toBe("Chấm công");
    expect(res.color).toBe("#0891b2");
  });

  it("detects payroll / lương notifications", () => {
    const res = detectNotificationCategory("Phiếu lương tháng 09", "Đã có bảng lương kỳ mới");
    expect(res.category).toBe("payroll");
    expect(res.label).toBe("Tiền lương");
    expect(res.color).toBe("#d97706");
  });

  it("detects warehouse / kho notifications", () => {
    const res = detectNotificationCategory("Cảnh báo kho", "Thiết bị y tế tồn kho dưới định mức");
    expect(res.category).toBe("warehouse");
    expect(res.label).toBe("Kho & Thiết bị");
  });

  it("detects training / đào tạo notifications", () => {
    const res = detectNotificationCategory("Khóa học mới", "Mời tham gia đào tạo kỹ năng lâm sàng");
    expect(res.category).toBe("training");
    expect(res.label).toBe("Đào tạo");
  });

  it("detects system / hệ thống notifications", () => {
    const res = detectNotificationCategory("Bảo trì hệ thống", "Hệ thống sẽ bảo trì vào 23:00");
    expect(res.category).toBe("system");
    expect(res.label).toBe("Hệ thống");
  });

  it("falls back to general notifications", () => {
    const res = detectNotificationCategory("Chào mừng bạn", "Chúc một ngày làm việc hiệu quả");
    expect(res.category).toBe("general");
    expect(res.label).toBe("Thông báo");
  });
});
