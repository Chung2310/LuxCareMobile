import type { RecruitmentStage } from "../../../../src/types/recruitment";
export const OUTCOMES = [
  { value: "", label: "Tất cả kết quả" },
  { value: "active", label: "Đang tuyển" },
  { value: "hired", label: "Đã tuyển" },
  { value: "rejected", label: "Từ chối" },
  { value: "withdrawn", label: "Rút hồ sơ" },
];
export function applicantFilters(page: number, search: string, stageId: string, outcome: string, jobId?: string) {
  return {
    page,
    limit: 20,
    search: search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    stageId,
    outcome,
    ...(jobId ? { jobId } : {}),
  };
}
export function stageChoices(stages: RecruitmentStage[], current: string) {
  return stages
    .filter((stage) => stage.isActive && stage.id !== current)
    .sort((a, b) => a.position - b.position)
    .map((stage) => ({
      value: stage.id,
      label: `${stage.name}${stage.terminalOutcome ? ` · ${OUTCOMES.find((item) => item.value === stage.terminalOutcome)?.label || stage.terminalOutcome}` : ""}`,
    }));
}
