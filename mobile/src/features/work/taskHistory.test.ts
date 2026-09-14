import { describe, it, expect } from "vitest";
import {
  parseTaskAction,
  formatHistoryUser,
  formatHistoryTime,
} from "./taskHistoryModel";

describe("parseTaskAction", () => {
  it("parses creation actions", () => {
    const res = parseTaskAction("Tạo công việc");
    expect(res.category).toBe("create");
    expect(res.title).toBe("Khởi tạo công việc");
  });

  it("parses completion actions", () => {
    const res = parseTaskAction("Hoàn thành công việc");
    expect(res.category).toBe("complete");
    expect(res.title).toBe("Hoàn thành công việc");
  });

  it("parses status transition with ->", () => {
    const res = parseTaskAction("status: todo -> in_progress");
    expect(res.category).toBe("status");
    expect(res.fromBadge?.label).toBe("Chưa bắt đầu");
    expect(res.toBadge?.label).toBe("Đang làm");
  });

  it("parses Vietnamese status transition", () => {
    const res = parseTaskAction("Đổi trạng thái: Chưa bắt đầu sang Đang làm");
    expect(res.category).toBe("status");
    expect(res.fromBadge?.label).toBe("Chưa bắt đầu");
    expect(res.toBadge?.label).toBe("Đang làm");
  });

  it("parses priority transition", () => {
    const res = parseTaskAction("priority: Low -> High");
    expect(res.category).toBe("priority");
    expect(res.fromBadge?.label).toBe("Thấp");
    expect(res.toBadge?.label).toBe("Cao");
  });

  it("parses assignment", () => {
    const res = parseTaskAction("Giao việc cho: Nguyễn Văn A");
    expect(res.category).toBe("assignee");
    expect(res.description).toContain("Nguyễn Văn A");
  });

  it("parses fallback action", () => {
    const res = parseTaskAction("Chỉnh sửa mô tả chi tiết");
    expect(res.category).toBe("general");
    expect(res.description).toBe("Chỉnh sửa mô tả chi tiết");
  });
});

describe("formatHistoryUser", () => {
  it("formats admin", () => {
    const u = formatHistoryUser("admin");
    expect(u.name).toBe("Quản trị viên (Admin)");
    expect(u.initial).toBe("AD");
  });

  it("formats email", () => {
    const u = formatHistoryUser("tranmai@luxcare.vn");
    expect(u.name).toBe("tranmai");
    expect(u.initial).toBe("TR");
  });

  it("formats full name", () => {
    const u = formatHistoryUser("Lê Văn Hùng");
    expect(u.name).toBe("Lê Văn Hùng");
    expect(u.initial).toBe("LH");
  });

  it("formats empty or missing user", () => {
    const u = formatHistoryUser("");
    expect(u.name).toBe("Người dùng");
    expect(u.initial).toBe("U");
  });
});

describe("formatHistoryTime", () => {
  it("formats empty string", () => {
    expect(formatHistoryTime("").relative).toBe("--");
  });

  it("formats valid ISO timestamp", () => {
    const now = new Date().toISOString();
    const res = formatHistoryTime(now);
    expect(res.relative).toBe("Vừa xong");
  });
});
