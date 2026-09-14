import { describe, it, expect } from "vitest";
import {
  parseTaskAction,
  formatHistoryUser,
  formatHistoryTime,
  lookupStatusBadge,
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

  it("parses status transition with hyphenated in-progress", () => {
    const res = parseTaskAction("status: todo -> in-progress");
    expect(res.category).toBe("status");
    expect(res.fromBadge?.label).toBe("Chưa bắt đầu");
    expect(res.toBadge?.label).toBe("Đang làm");
  });

  it("parses status transition from in_progress to done", () => {
    const res = parseTaskAction("status: in_progress -> done");
    expect(res.category).toBe("status");
    expect(res.fromBadge?.label).toBe("Đang làm");
    expect(res.toBadge?.label).toBe("Hoàn thành");
  });

  it("parses status transition with Not Started and Review/Testing", () => {
    const res = parseTaskAction("Status: Not Started -> Review/Testing");
    expect(res.category).toBe("status");
    expect(res.fromBadge?.label).toBe("Chưa bắt đầu");
    expect(res.toBadge?.label).toBe("Chờ kiểm tra");
  });

  it("parses English 'changed status from X to Y'", () => {
    const res = parseTaskAction("changed status from todo to doing");
    expect(res.category).toBe("status");
    expect(res.fromBadge?.label).toBe("Chưa bắt đầu");
    expect(res.toBadge?.label).toBe("Đang làm");
  });

  it("parses raw status arrow without status keyword", () => {
    const res = parseTaskAction("todo -> done");
    expect(res.category).toBe("status");
    expect(res.fromBadge?.label).toBe("Chưa bắt đầu");
    expect(res.toBadge?.label).toBe("Hoàn thành");
  });

  it("parses status transition with Review/Testing -> Done", () => {
    const res = parseTaskAction("Review/Testing -> Done");
    expect(res.category).toBe("status");
    expect(res.fromBadge?.label).toBe("Chờ kiểm tra");
    expect(res.toBadge?.label).toBe("Hoàn thành");
  });

  it("parses single status update in English", () => {
    const res = parseTaskAction("Status: archived");
    expect(res.category).toBe("status");
    expect(res.toBadge?.label).toBe("Lưu trữ");

    const res2 = parseTaskAction("Status: cancelled");
    expect(res2.category).toBe("status");
    expect(res2.toBadge?.label).toBe("Đã hủy");

    const res3 = parseTaskAction("Status: on hold");
    expect(res3.category).toBe("status");
    expect(res3.toBadge?.label).toBe("Tạm dừng");
  });

  it("parses Vietnamese status transition", () => {
    const res = parseTaskAction("Đổi trạng thái: Chưa bắt đầu sang Đang làm");
    expect(res.category).toBe("status");
    expect(res.fromBadge?.label).toBe("Chưa bắt đầu");
    expect(res.toBadge?.label).toBe("Đang làm");
  });

  it("parses Vietnamese single status update", () => {
    const res = parseTaskAction("Chuyển trạng thái sang Hoàn thành");
    expect(res.category).toBe("status");
    expect(res.toBadge?.label).toBe("Hoàn thành");
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

describe("lookupStatusBadge", () => {
  it("never returns raw English status names", () => {
    const englishStatuses = [
      "todo",
      "to-do",
      "to do",
      "not started",
      "not-started",
      "not_started",
      "doing",
      "in progress",
      "in_progress",
      "in-progress",
      "review",
      "testing",
      "review/testing",
      "done",
      "completed",
      "complete",
      "finished",
      "closed",
      "archived",
      "cancelled",
      "canceled",
      "blocked",
      "on hold",
      "on_hold",
      "pending",
      "backlog",
      "reopened",
    ];

    for (const st of englishStatuses) {
      const badge = lookupStatusBadge(st);
      expect(badge.label).not.toBe(st);
      expect(badge.label).toMatch(
        /^(Chưa bắt đầu|Đang làm|Chờ kiểm tra|Hoàn thành|Lưu trữ|Đã hủy|Tạm dừng|Mở lại)$/,
      );
    }
  });

  it("handles messy punctuation and extra spacing", () => {
    expect(lookupStatusBadge(" 'in_progress' ").label).toBe("Đang làm");
    expect(lookupStatusBadge("[review/testing]").label).toBe("Chờ kiểm tra");
    expect(lookupStatusBadge("\"done\":").label).toBe("Hoàn thành");
  });
});

