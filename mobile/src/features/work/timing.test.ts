import { describe, expect, it } from "vitest";
import { draftForTask, evaluateTaskKpi, taskDurationHours, taskPayload, updateTaskTiming } from "./model";

const plan = () => ({ ...draftForTask(), title: "Task", assigneeUid: "u1", description: "Test", startTime: "2026-09-10 08:00", dueDate: "2026-09-10 17:00", estTime: "9" });

describe("task timing and KPI", () => {
  it("keeps the planned budget when completion is late", () => {
    const next = updateTaskTiming(plan(), { endTime: "2026-09-10 19:00" });
    expect(next.estTime).toBe("9");
    expect(next.actualTime).toBe("11");
    expect(evaluateTaskKpi(next.estTime, next.actualTime, next.endTime, next.dueDate, next.startTime)?.status).toBe("overdue");
  });
  it("preserves manually estimated hours when only completion changes", () => {
    expect(updateTaskTiming({ ...plan(), estTime: "4" }, { endTime: "2026-09-10 13:00" }).estTime).toBe("4");
  });
  it("recalculates planned hours only for start or deadline changes", () => {
    expect(updateTaskTiming(plan(), { dueDate: "2026-09-10 18:00" }).estTime).toBe("10");
    expect(updateTaskTiming(plan(), { startTime: "2026-09-10 09:00" }).estTime).toBe("8");
    expect(updateTaskTiming(plan(), { startTime: "" }).estTime).toBe("");
  });
  it("clears stale actual hours and handles zero-duration tasks", () => {
    const draft = { ...plan(), endTime: "2026-09-10 10:00", actualTime: "2" };
    expect(updateTaskTiming(draft, { endTime: "" }).actualTime).toBe("");
    expect(updateTaskTiming(draft, { endTime: "2026-09-10 07:00" }).actualTime).toBe("");
    expect(updateTaskTiming(draft, { endTime: draft.startTime }).actualTime).toBe("0");
  });
  it("uses elapsed timestamps instead of inconsistent reported hours", () => {
    expect(evaluateTaskKpi(9, 1, "2026-09-10 19:00", "2026-09-10 17:00", "2026-09-10 08:00")?.status).toBe("overdue");
    expect(evaluateTaskKpi(9, 100, "2026-09-10 12:00", "", "2026-09-10 08:00")?.status).toBe("ontime");
    expect(taskPayload({ ...plan(), endTime: "2026-09-10 19:00", actualTime: "1" }, true, false).actualTime).toBe(11);
  });
  it("respects timezone offsets and does not round away brief overruns", () => {
    expect(taskDurationHours("2026-09-10T08:00:00+07:00", "2026-09-10T02:00:00Z")).toBe(1);
    expect(evaluateTaskKpi(1, 1, "2026-09-10T02:01:00Z", "", "2026-09-10T08:00:00+07:00")?.status).toBe("overdue");
    expect(evaluateTaskKpi(1, 0, "2026-09-10T08:00:00+07:00", "", "2026-09-10T08:00:00+07:00")?.status).toBe("ontime");
  });
  it("does not grade missing, reversed or invalid time data", () => {
    expect(evaluateTaskKpi(9, 9, "", "", plan().startTime)).toBeNull();
    expect(evaluateTaskKpi(9, 9, "2026-09-10 07:00", "", plan().startTime)).toBeNull();
    expect(evaluateTaskKpi(Infinity, 9, "2026-09-10 17:00", "", plan().startTime)).toBeNull();
    expect(taskDurationHours("2026-02-30 08:00", "2026-03-01 08:00")).toBeNull();
  });
});