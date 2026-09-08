import type { Employee } from "../../../../src/types/hrContract";
export type EmployeeChoice = { value: string; label: string };
export const ALL_EMPLOYEES: EmployeeChoice = { value: "", label: "Tất cả nhân viên được phép xem" };
export function employeeFilterChoices(
  employees: Employee[],
  search: string,
  selected: EmployeeChoice,
): EmployeeChoice[] {
  const query = search.trim().toLocaleLowerCase("vi-VN");
  const choices = employees
    .filter((employee) =>
      `${employee.displayName || ""} ${employee.email || ""}`.toLocaleLowerCase("vi-VN").includes(query),
    )
    .map((employee) => ({
      value: employee._id,
      label: employee.displayName
        ? `${employee.displayName}${employee.email ? ` · ${employee.email}` : ""}`
        : employee.email || employee._id,
    }));
  if (selected.value && !choices.some((choice) => choice.value === selected.value)) choices.unshift(selected);
  return [ALL_EMPLOYEES, ...choices];
}
