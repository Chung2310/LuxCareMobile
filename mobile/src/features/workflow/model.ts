import type { WorkflowEdge, WorkflowStep } from "../../../../src/types/hr";
import type { WorkflowInput } from "../../../../src/services/workflowService";

export function newWorkflowStep(index: number): WorkflowStep {
  return {
    id: `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: `Bước ${index + 1}`,
    description: "",
    assigneeUid: "",
    assignee: "",
    estDays: 1,
    deliverable: "",
    note: "",
    subTasks: [],
  };
}

export function moveWorkflowStep(steps: WorkflowStep[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= steps.length) return steps;
  const result = [...steps];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

export function pruneWorkflowEdges(edges: WorkflowEdge[], steps: WorkflowStep[]) {
  const ids = new Set(steps.map((step) => step.id));
  return edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
}

function validateEdges(edges: WorkflowEdge[], steps: WorkflowStep[]) {
  const ids = new Set(steps.map((step) => step.id));
  const seenIds = new Set<string>();
  const outcomesBySource = new Set<string>();
  const defaultsBySource = new Set<string>();
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    if (!edge.id || seenIds.has(edge.id)) throw new Error("Mỗi hướng xử lý cần có mã riêng.");
    if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target)
      throw new Error("Hướng xử lý phải trỏ tới một bước khác trong quy trình.");
    const label = String(edge.label || "").trim();
    const outcome = String(edge.outcomeKey || "").trim();
    if (!label || !outcome) throw new Error("Mỗi hướng xử lý cần có tên điều kiện.");
    const outcomeKey = `${edge.source}:${outcome}`;
    if (outcomesBySource.has(outcomeKey)) throw new Error("Điều kiện của cùng một bước không được trùng nhau.");
    if (edge.isDefault && defaultsBySource.has(edge.source))
      throw new Error("Mỗi bước chỉ có một hướng mặc định.");
    seenIds.add(edge.id);
    outcomesBySource.add(outcomeKey);
    if (edge.isDefault) defaultsBySource.add(edge.source);
    adjacency.set(edge.source, [...(adjacency.get(edge.source) || []), edge.target]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error("Các hướng xử lý không được tạo thành vòng lặp.");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const target of adjacency.get(id) || []) visit(target);
    visiting.delete(id);
    visited.add(id);
  };
  for (const step of steps) visit(step.id);
}

export function workflowPayload(
  name: string,
  category: string,
  description: string,
  steps: WorkflowStep[],
  edges: WorkflowEdge[] = [],
): WorkflowInput {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("Vui lòng nhập tên quy trình.");
  if (!steps.length) throw new Error("Hãy thêm ít nhất một bước công việc.");

  const ids = new Set<string>();
  const normalizedSteps = steps.map((step) => {
    const id = step.id.trim();
    const title = step.title.trim();
    if (!id || ids.has(id)) throw new Error("Mã bước quy trình bị trùng hoặc không hợp lệ.");
    if (!title) throw new Error("Mỗi bước cần có tên.");
    ids.add(id);
    return {
      ...step,
      id,
      title,
      description: step.description?.trim() || "",
      deliverable: step.deliverable?.trim() || "",
      note: step.note?.trim() || "",
      subTasks: (step.subTasks || []).filter((task) => task.title.trim()).map((task) => ({
        ...task,
        title: task.title.trim(),
      })),
    };
  });
  validateEdges(edges, normalizedSteps);
  return {
    name: normalizedName,
    category: category.trim(),
    description: description.trim(),
    steps: normalizedSteps,
    edges: edges.map((edge) => ({
      ...edge,
      source: edge.source.trim(),
      target: edge.target.trim(),
      label: String(edge.label || "").trim(),
      outcomeKey: String(edge.outcomeKey || "").trim(),
    })),
  };
}
