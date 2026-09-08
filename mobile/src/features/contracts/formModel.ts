import type { Contract, Employee } from "../../../../src/types/hrContract";
import type { ContractInput } from "../../../../src/services/hrContractService";
const day = (value?: string) => (value ? new Date(value).toISOString().slice(0, 10) : "");
export function contractDraft(contract?: Contract) {
  return {
    contractType: contract?.contractType || "Hợp đồng xác định thời hạn",
    employeeId: contract?.employeeId || "",
    startDate: day(contract?.startDate),
    endDate: day(contract?.endDate),
    status: contract?.status || "draft",
    note: contract?.note || "",
  };
}
export function contractPayload(
  draft: ReturnType<typeof contractDraft>,
  employees: Employee[],
  original?: Contract,
): ContractInput {
  const contractType = draft.contractType.trim(),
    note = draft.note.trim();
  if (!contractType || contractType.length > 100) throw new Error("Loại hợp đồng cần từ 1 đến 100 ký tự.");
  if (note.length > 1000) throw new Error("Ghi chú tối đa 1000 ký tự.");
  if (
    !/^[a-f\d]{24}$/i.test(draft.employeeId) ||
    (draft.employeeId !== original?.employeeId && !employees.some((employee) => employee._id === draft.employeeId))
  )
    throw new Error("Chọn nhân viên trong danh sách của phạm vi hiện tại.");
  if (!["draft", "active", "expired", "terminated"].includes(draft.status)) throw new Error("Trạng thái không hợp lệ.");
  const parse = (value: string, old?: string) => {
    const clean = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) throw new Error("Ngày phải có dạng YYYY-MM-DD.");
    const date = new Date(`${clean}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || day(date.toISOString()) !== clean) throw new Error("Ngày không tồn tại.");
    return old && day(old) === clean ? old : date.toISOString();
  };
  const startDate = parse(draft.startDate, original?.startDate),
    endDate = parse(draft.endDate, original?.endDate);
  if (new Date(endDate) < new Date(startDate)) throw new Error("Ngày hết hạn không được trước ngày bắt đầu.");
  return { contractType, employeeId: draft.employeeId, startDate, endDate, status: draft.status, note };
}
export function contractChanges(value: ContractInput, original: Contract): Partial<ContractInput> {
  return Object.fromEntries(
    Object.entries(value).filter(([key, item]) => item !== (original[key as keyof ContractInput] ?? "")),
  );
}
