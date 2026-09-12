import { describe, expect, it, vi } from "vitest";
import type { DashboardSummary } from "../../../../src/types/dashboard";
import { attendanceDay, currentTimekeeping, loadDashboardSnapshot } from "./snapshot";

const now = new Date("2026-09-12T03:00:00Z");
const timekeeping = { checkedInToday: 8, lateToday: 2, totalEmployees: 10, date: "2026-09-12" };
const summary = (counts = timekeeping) => ({ timekeeping: counts }) as DashboardSummary;
const actions = { overdueTasks: [], pendingApprovals: [] };

describe("home attendance summary", () => {
  it("uses the Vietnam working date across UTC midnight", () => {
    expect(attendanceDay(new Date("2026-09-11T16:59:59Z"))).toBe("2026-09-11");
    expect(attendanceDay(new Date("2026-09-11T17:00:00Z"))).toBe("2026-09-12");
  });

  it("shares the daily overview request for the attendance card", async () => {
    const source = {
      getSummary: vi.fn().mockResolvedValue(summary()),
      getActionItems: vi.fn().mockResolvedValue(actions),
    };
    const result = await loadDashboardSnapshot(source, { filter: "day" }, now);
    expect(source.getSummary).toHaveBeenCalledExactlyOnceWith({ filter: "day" });
    expect(result.attendance).toEqual(timekeeping);
    expect(result.actions).toEqual(actions);
  });

  it("keeps today's attendance independent from the selected overview range", async () => {
    const weekly = summary({ ...timekeeping, checkedInToday: 10 });
    const source = {
      getSummary: vi.fn().mockResolvedValueOnce(weekly).mockResolvedValueOnce(summary()),
      getActionItems: vi.fn().mockResolvedValue(actions),
    };
    const result = await loadDashboardSnapshot(source, { filter: "week" }, now);
    expect(source.getSummary.mock.calls).toEqual([[{ filter: "week" }], [{ filter: "day" }]]);
    expect(result.summary).toEqual(weekly);
    expect(result.attendance?.checkedInToday).toBe(8);
  });

  it("does not turn a failed request into zero attendance or reuse old counts", async () => {
    const source = {
      getSummary: vi.fn().mockResolvedValueOnce(summary()).mockRejectedValueOnce(new Error("offline")),
      getActionItems: vi.fn().mockResolvedValue(actions),
    };
    expect((await loadDashboardSnapshot(source, { filter: "day" }, now)).attendance).toEqual(timekeeping);
    expect(await loadDashboardSnapshot(source, { filter: "day" }, now)).toEqual({
      summary: null,
      attendance: null,
      actions,
      myAttendance: null,
    });
  });

  it("retains attendance if action items cannot be loaded", async () => {
    const source = {
      getSummary: vi.fn().mockResolvedValue(summary()),
      getActionItems: vi.fn().mockRejectedValue(new Error("forbidden")),
    };
    const result = await loadDashboardSnapshot(source, { filter: "day" }, now);
    expect(result.attendance).toEqual(timekeeping);
    expect(result.actions).toBeNull();
  });

  it("does not label yesterday's data as today's attendance", () => {
    expect(currentTimekeeping({ ...timekeeping, date: "2026-09-11" }, "2026-09-12")).toBeNull();
  });

  it("preserves a genuine zero rather than treating it as missing data", () => {
    const zero = { ...timekeeping, checkedInToday: 0, lateToday: 0 };
    expect(currentTimekeeping(zero, "2026-09-12")).toEqual(zero);
  });

  it("handles summary without date field smoothly", () => {
    const noDate = { checkedInToday: 5, lateToday: 1, totalEmployees: 12 } as any;
    const result = currentTimekeeping(noDate, "2026-09-12");
    expect(result).not.toBeNull();
    expect(result?.checkedInToday).toBe(5);
    expect(result?.totalEmployees).toBe(12);
  });

  it("merges real-time employee check-in when dashboard summary returns 0", async () => {
    const emptySummary = summary({ checkedInToday: 0, lateToday: 0, totalEmployees: 5, date: "2026-09-12" });
    const source = {
      getSummary: vi.fn().mockResolvedValue(emptySummary),
      getActionItems: vi.fn().mockResolvedValue(actions),
    };
    const attendanceSource = {
      today: vi.fn().mockResolvedValue({
        log: {
          uid: "emp-1",
          date: "2026-09-12",
          status: "Present",
          checkIn: { time: "2026-09-12T08:15:00.000Z" },
        },
        workCalendar: { date: "2026-09-12", isWorkingDay: true },
      }),
      todayCompanyLogs: vi.fn().mockResolvedValue([
        {
          uid: "emp-1",
          date: "2026-09-12",
          status: "Present",
          checkIn: { time: "2026-09-12T08:15:00.000Z" },
        },
      ]),
    };

    const result = await loadDashboardSnapshot(source, { filter: "day" }, now, attendanceSource);
    expect(result.attendance?.checkedInToday).toBe(1);
    expect(result.myAttendance?.log?.status).toBe("Present");
  });

  it("uses roster count for total personnel when comparing checked in against total", async () => {
    const emptySummary = summary({ checkedInToday: 0, lateToday: 0, totalEmployees: 0, date: "2026-09-12" });
    const source = {
      getSummary: vi.fn().mockResolvedValue(emptySummary),
      getActionItems: vi.fn().mockResolvedValue(actions),
    };
    const attendanceSource = {
      today: vi.fn().mockResolvedValue({
        log: {
          uid: "emp-1",
          date: "2026-09-12",
          status: "Present",
          checkIn: { time: "2026-09-12T08:15:00.000Z" },
        },
      }),
    };
    const rosterSource = {
      list: vi.fn().mockResolvedValue([
        { uid: "emp-1", role: "user" },
        { uid: "emp-2", role: "user" },
        { uid: "emp-3", role: "user" },
      ]),
    };
    const result = await loadDashboardSnapshot(
      source,
      { filter: "day" },
      now,
      attendanceSource,
      "comp-1",
      "branch-1",
      rosterSource,
    );
    expect(result.attendance?.checkedInToday).toBe(1);
    expect(result.attendance?.totalEmployees).toBe(3);
  });
});
