import type { Contract } from "../../../../src/types/hrContract";
import type { ExtensionInput } from "../../../../src/services/hrContractService";
export function extensionDraft(now = new Date()) {
  return { newEndDate: "", extensionDate: now.toISOString().slice(0, 10), reason: "" };
}
export function extensionPayload(draft: ReturnType<typeof extensionDraft>, contract: Contract): ExtensionInput {
  const parse = (value: string) => {
    const day = value.trim();
    const date = new Date(`${day}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day)
      throw new Error("Ngày phải tồn tại và có dạng YYYY-MM-DD.");
    return date.toISOString();
  };
  const newEndDate = parse(draft.newEndDate),
    extensionDate = parse(draft.extensionDate);
  const previous = new Date(contract.endDate).getTime();
  if (!Number.isFinite(previous)) throw new Error("Thời hạn hiện tại không hợp lệ. Tải lại hợp đồng.");
  if (new Date(newEndDate).getTime() <= previous) throw new Error("Ngày hết hạn mới phải sau ngày hết hạn hiện tại.");
  const reason = draft.reason.trim();
  if (reason.length > 1000) throw new Error("Lý do tối đa 1000 ký tự.");
  return { newEndDate, extensionDate, reason };
}
