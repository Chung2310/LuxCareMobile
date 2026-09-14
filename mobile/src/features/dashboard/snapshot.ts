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

type EquipmentSource = {
  getSummary?: () => Promise<any>;
  list?: (params?: any) => Promise<{ items: any[]; total?: number }>;
};

type ResourceSource = {
  list?: (parentIdOrCompanyCode?: string | null, sectionOrSearch?: string, currentUserName?: string) => Promise<any[]>;
};

export async function loadDashboardSnapshot(
  source: DashboardSource,
  params: DashboardSummaryParams,
  now = new Date(),
  attendanceSource?: AttendanceSource,
  companyCode?: string,
  branchId?: string,
  rosterSource?: RosterSource,
  equipmentSource?: EquipmentSource,
  resourceSource?: ResourceSource,
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

  const equipmentRequest = equipmentSource
    ? (equipmentSource.getSummary
        ? equipmentSource.getSummary().catch(() => null)
        : Promise.resolve(null))
    : Promise.resolve(null);

  const equipmentListRequest = equipmentSource?.list
    ? equipmentSource.list({ limit: 100 }).catch(() => null)
    : Promise.resolve(null);

  const resourceRequest = resourceSource?.list
    ? resourceSource.list().catch(() => null)
    : Promise.resolve(null);

  const [summary, actions, today, myToday, companyLogs, rosterResult, equipmentResult, equipmentListResult, resourceResult] = await Promise.allSettled([
    summaryRequest,
    actionRequest,
    todayRequest,
    myTodayRequest,
    logsRequest,
    rosterRequest,
    equipmentRequest,
    equipmentListRequest,
    resourceRequest,
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

  let summaryValue = summary.status === "fulfilled" && summary.value ? { ...summary.value } : null;

  // Merge equipment
  const eqSum = equipmentResult.status === "fulfilled" ? equipmentResult.value : null;
  const eqList = equipmentListResult.status === "fulfilled" ? equipmentListResult.value : null;

  if (eqSum || eqList) {
    const listItems: any[] = Array.isArray(eqList?.items)
      ? eqList.items
      : Array.isArray(eqList)
      ? eqList
      : [];
    const listTotal = typeof eqList?.total === "number" ? eqList.total : listItems.length;

    const countStatus = (...kw: string[]) =>
      listItems.filter((i) => {
        const s = (i.status || "").toLowerCase();
        return kw.some((k) => s.includes(k.toLowerCase()));
      }).length;

    const listReady = countStatus("sẵn", "ready", "avail", "available");
    const listUsing = countStatus("dùng", "using", "in_use", "in-use");
    const listMaintenance = countStatus("trì", "maint", "repair");
    const listBooked = countStatus("đơn", "booked", "order", "request", "mượn");

    const sumTotal = typeof eqSum?.total === "number" ? eqSum.total : 0;
    const resolvedTotal = Math.max(
      summaryValue?.equipment?.total ?? 0,
      sumTotal,
      listTotal,
      listReady + listUsing + listMaintenance + listBooked,
    );

    const resolvedReady = Math.max(
      (summaryValue?.equipment as any)?.ready ?? 0,
      eqSum?.ready ?? 0,
      listReady,
    );
    const resolvedUsing = Math.max(
      (summaryValue?.equipment as any)?.using ?? 0,
      eqSum?.using ?? 0,
      listUsing,
    );
    const resolvedMaintenance = Math.max(
      (summaryValue?.equipment as any)?.maintenance ?? 0,
      eqSum?.maintenance ?? 0,
      listMaintenance,
    );
    const resolvedBooked = Math.max(
      (summaryValue?.equipment as any)?.booked ?? 0,
      eqSum?.booked ?? 0,
      listBooked,
    );

    const byStatus =
      Array.isArray(summaryValue?.equipment?.byStatus) && summaryValue.equipment.byStatus.length > 0
        ? summaryValue.equipment.byStatus
        : Array.isArray(eqSum?.byStatus) && eqSum.byStatus.length > 0
        ? eqSum.byStatus
        : [
            { status: "ready", count: resolvedReady },
            { status: "using", count: resolvedUsing },
            { status: "maintenance", count: resolvedMaintenance },
            { status: "booked", count: resolvedBooked },
          ].filter((s) => s.count > 0);

    const mergedEquipment = {
      total: resolvedTotal,
      byStatus,
      ready: resolvedReady,
      using: resolvedUsing,
      maintenance: resolvedMaintenance,
      booked: resolvedBooked,
    };

    if (summaryValue) {
      summaryValue.equipment = mergedEquipment;
    }
  }

  // Merge resources
  const resItems = resourceResult.status === "fulfilled" && Array.isArray(resourceResult.value)
    ? resourceResult.value
    : [];

  if (resItems.length > 0 && summaryValue) {
    const totalFiles = resItems.filter((i) => i && i.type !== "folder").length;
    let totalBytes = 0;
    for (const file of resItems) {
      if (typeof file.size === "number") {
        totalBytes += file.size;
      } else if (typeof file.size === "string") {
        const m = file.size.match(/([\d.]+)\s*(GB|MB|KB|B)/i);
        if (m) {
          const val = parseFloat(m[1]);
          const unit = m[2].toUpperCase();
          if (unit === "GB") totalBytes += val * 1024 * 1024 * 1024;
          else if (unit === "MB") totalBytes += val * 1024 * 1024;
          else if (unit === "KB") totalBytes += val * 1024;
          else totalBytes += val;
        }
      }
    }

    const currentFiles = summaryValue?.resources?.fileCount ?? 0;
    const currentSize = summaryValue?.resources?.totalSize ?? 0;

    summaryValue.resources = {
      fileCount: Math.max(currentFiles, totalFiles || resItems.length),
      recentUploads: summaryValue?.resources?.recentUploads ?? 0,
      totalSize: Math.max(currentSize, Math.round(totalBytes)),
    };
  }

  return {
    summary: summaryValue,
    actions: actions.status === "fulfilled" ? actions.value : null,
    attendance: attendanceResult,
    myAttendance: myToday.status === "fulfilled" ? myToday.value : null,
  };
}
