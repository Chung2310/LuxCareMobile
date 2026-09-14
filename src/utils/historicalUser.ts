export function historicalUserLabel(
  name: string | undefined | null,
  deleted?: boolean,
  fallback = "Người dùng",
) {
  const label = name?.trim();
  if (!deleted) return label || fallback;
  return !label || label === "Tài khoản đã xóa"
    ? "Tài khoản đã xóa"
    : label + " · Tài khoản đã xóa";
}

export function historicalEmployeeLabel(
  employees:
    | { employeeId: string; employeeName?: string; employeeDeleted?: boolean }[]
    | undefined,
  id: string,
) {
  const employee = employees?.find((item) => item.employeeId === id);
  return historicalUserLabel(
    employee?.employeeName,
    employee?.employeeDeleted,
    id,
  );
}
