import type { RecruitmentStage } from "../../../../src/types/recruitment";
export function pipelinePayload(stages: RecruitmentStage[]) {
  if (!stages.length || !stages.some((stage) => stage.isActive))
    throw new Error("Cần ít nhất một giai đoạn đang hoạt động.");
  if (new Set(stages.map((stage) => stage.id)).size !== stages.length) throw new Error("Mã giai đoạn bị trùng.");
  return stages.map((stage, position) => {
    const name = stage.name.trim(),
      color = stage.color.trim();
    if (!stage.id || !name) throw new Error("Nhập tên cho mỗi giai đoạn.");
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Màu phải có dạng #RRGGBB.");
    if (stage.terminalOutcome && !["hired", "rejected", "withdrawn"].includes(stage.terminalOutcome))
      throw new Error("Kết quả tuyển dụng không hợp lệ.");
    return {
      id: stage.id,
      name,
      color,
      position,
      isActive: stage.isActive,
      terminalOutcome: stage.terminalOutcome || null,
    };
  });
}
export function moveStage(stages: RecruitmentStage[], index: number, direction: number) {
  const target = index + direction;
  if (target < 0 || target >= stages.length) return stages;
  const result = [...stages];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}
