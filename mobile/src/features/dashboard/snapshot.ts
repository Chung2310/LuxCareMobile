import type { DashboardSummaryParams } from "../../../../src/services/dashboardService";
import type { DashboardSummary, DashboardActionItems } from "../../../../src/types/dashboard";
import type { AttendanceLog, TodayAttendance } from "../../../../src/services/attendanceService";
import type { UserProfile } from "../../../../src/types/common";

type DashboardSource = {
  getSummary(params: DashboardSummaryParams): Promise<DashboardSummary>;
  getActionItems(): Promise<DashboardActionItems>;
};

type AttendanceSource = {
  today?: () => Promise<TodayAttendance>;
  todayCompanyLogs?: (startDate: string, endDate?: string) => Promise<AttendanceLog[]>;
};

type RosterSource = {
  list?: (companyCode?: string, branchId?: string) => Promise<UserProfile[]>;
  colleagues?: () => Promise<UserProfile[]>;
};

export function attendanceDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return [part("year"), part("month"), part("day")].join("-");
}

export function currentTimekeeping(
  value: DashboardSummary["timekeeping"] | null | undefined,
  day: string,
) {
  if (!value) return null;
  // If a date string is explicitly present and doesn't match today, reject old date
  if (value.date && typeof value.date === "string" && value.date.slice(0, 10) !== day) {
    return null;
  }
  const checkedInToday = Math.max(0, Number(value.checkedInToday) || 0);
  const lateToday = Math.max(0, Number(value.lateToday) || 0);
  const rawTotal = Number(value.totalEmployees);
  const totalEmployees = Number.isFinite(rawTotal) && rawTotal >= checkedInToday
    ? rawTotal
    : Math.max(checkedInToday, 0);

  return {
    checkedInToday,
    lateToday: Math.min(lateToday, checkedInToday),
    totalEmployees,
    date: value.date || day,
  };
}

export async function loadDashboardSnapshot(
  source: DashboardSource,
  params: DashboardSummaryParams,
  now = new Date(),
  attendanceSource?: AttendanceSource,
  companyCode?: string,
  branchId?: string,
  rosterSource?: RosterSource,
) {
  const day = attendanceDay(now);
  const summaryRequest = source.getSummary(params);
  // Attendance always describes today, independent of the overview's selected range.
  const todayRequest = params.filter === "day" ? summaryRequest : source.getSummary({ filter: "day" });

  const actionRequest = source.getActionItems();
  const myTodayRequest = attendanceSource?.today ? attendanceSource.today() : Promise.resolve(null);
  const logsRequest = attendanceSource?.todayCompanyLogs ? attendanceSource.todayCompanyLogs(day) : Promise.resolve([]);
  const rosterRequest = rosterSource
    ? (rosterSource.list
        ? rosterSource.list(companyCode, branchId).catch(() => [])
        : rosterSource.colleagues
        ? rosterSource.colleagues().catch(() => [])
        : Promise.resolve([]))
    : Promise.resolve([]);

  const [summary, actions, today, myToday, companyLogs, rosterResult] = await Promise.allSettled([
    summaryRequest,
    actionRequest,
    todayRequest,
    myTodayRequest,
    logsRequest,
    rosterRequest,
  ]);

  let attendanceResult = today.status === "fulfilled"
    ? currentTimekeeping(today.value?.timekeeping, day)
    : null;

  // Aggregate real-time check-in logs from attendance API
  const logs: AttendanceLog[] =
    companyLogs.status === "fulfilled" && Array.isArray(companyLogs.value)
      ? companyLogs.value
      : [];

  const checkedInFromLogs = logs.filter((log) => {
    if (!log) return false;
    const hasCheckInTime = Boolean(log.checkIn?.time);
    const validPresentStatus = [
      "Present",
      "Late",
      "Left-Early",
      "Late-Left-Early",
      "Half-Day",
    ].includes(log.status || "");
    return hasCheckInTime || validPresentStatus;
  }).length;

  const lateFromLogs = logs.filter((log) => {
    return log?.status === "Late" || log?.status === "Late-Left-Early";
  }).length;

  // Check if current user checked in
  const myLog = myToday.status === "fulfilled" && myToday.value ? myToday.value.log : null;
  const hasMyCheckIn = Boolean(
    myLog?.checkIn?.time ||
      ["Present", "Late", "Left-Early", "Late-Left-Early", "Half-Day"].includes(myLog?.status || ""),
  );

  // Total employees from roster directory
  const rosterEmployees: UserProfile[] =
    rosterResult.status === "fulfilled" && Array.isArray(rosterResult.value)
      ? rosterResult.value
      : [];
  const rosterTotal = rosterEmployees.filter(
    (emp) => emp && emp.role !== "superadmin",
  ).length;

  if (attendanceResult || checkedInFromLogs > 0 || hasMyCheckIn || rosterTotal > 0) {
    const baseCheckedIn = attendanceResult?.checkedInToday ?? 0;
    const baseLate = attendanceResult?.lateToday ?? 0;
    const baseTotal = attendanceResult?.totalEmployees ?? 0;

    const mergedCheckedIn = Math.max(
      baseCheckedIn,
      checkedInFromLogs,
      hasMyCheckIn ? 1 : 0,
    );

    const mergedLate = Math.min(
      mergedCheckedIn,
      Math.max(baseLate, lateFromLogs),
    );

    // Ensure totalEmployees represents real total personnel
    const mergedTotal = Math.max(baseTotal, rosterTotal, mergedCheckedIn);

    attendanceResult = {
      checkedInToday: mergedCheckedIn,
      lateToday: mergedLate,
      totalEmployees: mergedTotal,
      date: attendanceResult?.date || day,
    };
  }

  return {
    summary: summary.status === "fulfilled" ? summary.value : null,
    actions: actions.status === "fulfilled" ? actions.value : null,
    attendance: attendanceResult,
    myAttendance: myToday.status === "fulfilled" ? myToday.value : null,
  };
}
