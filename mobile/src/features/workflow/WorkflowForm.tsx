import { useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { Workflow, WorkflowEdge, WorkflowStep, WorkflowSubTask } from "../../../../src/types/hr";
import { workflow } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Page, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { moveWorkflowStep, newWorkflowStep, pruneWorkflowEdges, workflowPayload } from "./model";

export function WorkflowForm({
  initialWorkflow,
  onClose,
  onSaved,
  setLocked,
}: {
  initialWorkflow?: Workflow;
  onClose: () => void;
  onSaved: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [name, setName] = useState(initialWorkflow?.name || "Quy trình mới");
  const [category, setCategory] = useState(initialWorkflow?.category || "");
  const [description, setDescription] = useState(initialWorkflow?.description || "");
  const [steps, setSteps] = useState<WorkflowStep[]>(() =>
    (initialWorkflow?.steps || []).map((step) => ({
      ...step,
      subTasks: (step.subTasks || []).map((task) => ({ ...task })),
      attachments: (step.attachments || []).map((attachment) => ({ ...attachment })),
    })),
  );
  const [edges, setEdges] = useState<WorkflowEdge[]>(() => (initialWorkflow?.edges || []).map((edge) => ({ ...edge })));
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const openNewStep = () => {
    const step = newWorkflowStep(steps.length);
    setSteps((current) => [...current, step]);
    setEditingStep(step);
  };

  const deleteStep = (step: WorkflowStep) => {
    Alert.alert("Xóa bước?", `Bạn có chắc muốn xóa “${step.title}”?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => {
          const nextSteps = steps.filter((item) => item.id !== step.id);
          setSteps(nextSteps);
          setEdges((current) => pruneWorkflowEdges(current, nextSteps));
          if (editingStep?.id === step.id) setEditingStep(null);
        },
      },
    ]);
  };

  const saveStep = (updated: WorkflowStep, outgoingEdges: WorkflowEdge[]) => {
    setSteps((current) => current.map((step) => (step.id === updated.id ? updated : step)));
    setEdges((current) => [...current.filter((edge) => edge.source !== updated.id), ...outgoingEdges]);
    setEditingStep(null);
  };

  const save = async () => {
    if (lock.current) return;
    setError(null);
    let payload;
    try {
      payload = workflowPayload(name, category, description, steps, edges);
    } catch (validationError) {
      setError(messageOf(validationError));
      return;
    }

    lock.current = true;
    setBusy(true);
    setLocked(true);
    let saved = false;
    try {
      if (initialWorkflow?.id) await workflow.update(initialWorkflow.id, payload);
      else await workflow.create(payload);
      saved = true;
    } catch (saveError) {
      setError(messageOf(saveError));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
    if (saved) onSaved();
  };

  return (
    <>
      <Page title={initialWorkflow ? "Sửa quy trình" : "Tạo quy trình mới"}>
        <Text style={styles.muted}>
          Khai báo thông tin chung, sau đó thêm các bước theo đúng thứ tự thực hiện. Có thể thiết lập hướng xử lý khi một bước có nhiều kết quả.
        </Text>
        <Field label="Tên quy trình *" value={name} editable={!busy} onChangeText={setName} placeholder="Ví dụ: Hướng dẫn nhân viên mới" />
        <Field label="Nhóm / phân loại" value={category} editable={!busy} onChangeText={setCategory} placeholder="Ví dụ: Nhân sự, Vận hành" />
        <Field
          label="Ghi chú / mô tả quy trình"
          value={description}
          editable={!busy}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          placeholder="Mục tiêu, phạm vi áp dụng, lưu ý chung của quy trình"
          style={{ minHeight: 110 }}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>Các bước ({steps.length})</Text>
            <Text style={styles.muted}>Chạm vào một bước để sửa chi tiết.</Text>
          </View>
          <Button title="+ Thêm bước" disabled={busy} onPress={openNewStep} />
        </View>

        {steps.length === 0 ? (
          <Card>
            <Text style={styles.text}>Chưa có bước nào. Hãy thêm ít nhất một bước công việc.</Text>
          </Card>
        ) : (
          steps.map((step, index) => (
            <Pressable
              key={step.id}
              accessibilityRole="button"
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.78 }]}
              onPress={() => setEditingStep(step)}
              disabled={busy}
            >
              <View style={styles.row}>
                <View style={stepStyles.number}>
                  <Text style={stepStyles.numberText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.heading}>{step.title || "(Chưa đặt tên)"}</Text>
                  {!!step.description && <Text style={styles.muted} numberOfLines={2}>{step.description}</Text>}
                  <Text style={stepStyles.meta}>
                    {step.subTasks?.length || 0} việc con
                    {step.estDays ? ` · ${step.estDays} ngày` : ""}
                    {edges.filter((edge) => edge.source === step.id).length
                      ? ` · ${edges.filter((edge) => edge.source === step.id).length} hướng xử lý`
                      : ""}
                  </Text>
                </View>
                <Text style={stepStyles.chevron}>›</Text>
              </View>
              <View style={stepStyles.actions}>
                <Button
                  title="Đưa lên"
                  disabled={busy || index === 0}
                  onPress={() => setSteps((current) => moveWorkflowStep(current, index, -1))}
                />
                <Button
                  title="Đưa xuống"
                  disabled={busy || index === steps.length - 1}
                  onPress={() => setSteps((current) => moveWorkflowStep(current, index, 1))}
                />
                <Button title="Xóa" disabled={busy} onPress={() => deleteStep(step)} />
              </View>
            </Pressable>
          ))
        )}

        <ErrorText message={error} />
        <Button title={busy ? "Đang lưu…" : "Lưu quy trình"} disabled={busy} onPress={() => void save()} />
        <Button title="Đóng" disabled={busy} onPress={onClose} />
      </Page>

      <Modal visible={!!editingStep} animationType="slide" onRequestClose={() => setEditingStep(null)}>
        {editingStep && (
          <WorkflowStepEditor
            step={editingStep}
            steps={steps}
            edges={edges.filter((edge) => edge.source === editingStep.id)}
            stepIndex={steps.findIndex((step) => step.id === editingStep.id)}
            onClose={() => setEditingStep(null)}
            onSave={saveStep}
          />
        )}
      </Modal>
    </>
  );
}

function WorkflowStepEditor({
  step,
  steps,
  edges,
  stepIndex,
  onClose,
  onSave,
}: {
  step: WorkflowStep;
  steps: WorkflowStep[];
  edges: WorkflowEdge[];
  stepIndex: number;
  onClose: () => void;
  onSave: (step: WorkflowStep, edges: WorkflowEdge[]) => void;
}) {
  const [title, setTitle] = useState(step.title);
  const [description, setDescription] = useState(step.description || "");
  const [assignee, setAssignee] = useState(step.assignee || "");
  const [estDays, setEstDays] = useState(step.estDays === undefined ? "1" : String(step.estDays));
  const [deliverable, setDeliverable] = useState(step.deliverable || "");
  const [note, setNote] = useState(step.note || "");
  const [subTasks, setSubTasks] = useState<WorkflowSubTask[]>(() => (step.subTasks || []).map((task) => ({ ...task })));
  const [newSubTask, setNewSubTask] = useState("");
  const [outgoingEdges, setOutgoingEdges] = useState<WorkflowEdge[]>(() => edges.map((edge) => ({ ...edge })));
  const otherSteps = steps.filter((candidate) => candidate.id !== step.id);

  const addSubTask = () => {
    const value = newSubTask.trim();
    if (!value) return;
    setSubTasks((current) => [
      ...current,
      { id: `sub_${Date.now().toString(36)}`, title: value, done: false },
    ]);
    setNewSubTask("");
  };

  const addBranch = () => {
    if (!otherSteps.length) return;
    const target = otherSteps[0];
    setOutgoingEdges((current) => [
      ...current,
      {
        id: `edge_${Date.now().toString(36)}_${current.length}`,
        source: step.id,
        target: target.id,
        label: `Điều kiện ${current.length + 1}`,
        outcomeKey: `outcome_${Date.now()}_${current.length + 1}`,
        mode: "manual",
        priority: current.length,
        isDefault: current.length === 0,
      },
    ]);
  };

  const updateBranch = (id: string, patch: Partial<WorkflowEdge>) => {
    setOutgoingEdges((current) =>
      current.map((edge) =>
        edge.id === id
          ? { ...edge, ...patch }
          : patch.isDefault
          ? { ...edge, isDefault: false }
          : edge,
      ),
    );
  };

  const save = () => {
    if (!title.trim()) return;
    const parsedDays = Number(estDays);
    onSave(
      {
        ...step,
        title: title.trim(),
        description: description.trim(),
        assignee,
        estDays: Number.isFinite(parsedDays) && parsedDays >= 0 ? parsedDays : undefined,
        deliverable: deliverable.trim(),
        note: note.trim(),
        subTasks: subTasks.filter((task) => task.title.trim()).map((task) => ({ ...task, title: task.title.trim() })),
      },
      outgoingEdges,
    );
  };

  return (
    <Page title={`Bước ${stepIndex + 1}`}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>{title || "(Chưa đặt tên)"}</Text>
          {stepIndex === 0 && <Text style={stepStyles.startBadge}>Bắt đầu quy trình</Text>}
        </View>
        <Button title="Đóng" onPress={onClose} />
      </View>
      <Field label="Tên bước *" value={title} onChangeText={setTitle} />
      <Field
        label="Mô tả bước"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        style={{ minHeight: 90 }}
      />
      <Field label="Người thực hiện" value={assignee} onChangeText={setAssignee} placeholder="Tên hoặc nhóm phụ trách" />
      <Field label="Thời lượng dự kiến (ngày)" value={estDays} onChangeText={setEstDays} keyboardType="numeric" />
      <Field
        label="Kết quả cần đạt"
        value={deliverable}
        onChangeText={setDeliverable}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />
      <Field label="Lưu ý" value={note} onChangeText={setNote} multiline numberOfLines={3} textAlignVertical="top" />

      <Card>
        <Text style={styles.heading}>Công việc con ({subTasks.length})</Text>
        {subTasks.map((task) => (
          <View key={task.id} style={stepStyles.subTaskRow}>
            <Text style={stepStyles.check}>✓</Text>
            <Text style={[styles.text, { flex: 1 }]}>{task.title}</Text>
            <Pressable accessibilityRole="button" onPress={() => setSubTasks((current) => current.filter((item) => item.id !== task.id))}>
              <Text style={stepStyles.remove}>Xóa</Text>
            </Pressable>
          </View>
        ))}
        <View style={stepStyles.addSubTaskRow}>
          <Field
            label=""
            value={newSubTask}
            onChangeText={setNewSubTask}
            onSubmitEditing={addSubTask}
            placeholder="Thêm công việc con"
            returnKeyType="done"
            style={{ flex: 1 }}
          />
          <Button title="Thêm" disabled={!newSubTask.trim()} onPress={addSubTask} />
        </View>
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>Hướng xử lý ({outgoingEdges.length})</Text>
            <Text style={styles.muted}>Dùng khi bước này có nhiều kết quả hoặc nhánh tiếp theo.</Text>
          </View>
          <Button title="+ Thêm" disabled={!otherSteps.length} onPress={addBranch} />
        </View>
        {outgoingEdges.map((edge) => (
          <View key={edge.id} style={stepStyles.branchCard}>
            <Field
              label="Điều kiện hiển thị"
              value={edge.label}
              onChangeText={(label) => updateBranch(edge.id, { label })}
              placeholder="Ví dụ: Nếu được duyệt"
            />
            <ChoiceField
              label="Bước đích"
              value={edge.target}
              choices={otherSteps.map((candidate, index) => ({ value: candidate.id, label: `${index + 1}. ${candidate.title}` }))}
              onChange={(target) => updateBranch(edge.id, { target })}
            />
            <View style={styles.row}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: !!edge.isDefault }}
                onPress={() => updateBranch(edge.id, { isDefault: true })}
              >
                <Text style={styles.text}>{edge.isDefault ? "◉" : "○"} Mặc định</Text>
              </Pressable>
              <Button
                title="Xóa hướng"
                onPress={() => setOutgoingEdges((current) => current.filter((item) => item.id !== edge.id))}
              />
            </View>
          </View>
        ))}
        {!outgoingEdges.length && <Text style={styles.muted}>Chưa có hướng xử lý; bước này sẽ kết thúc quy trình hoặc đi theo thứ tự.</Text>}
      </Card>

      <Button title="Ghi nhận bước" disabled={!title.trim()} onPress={save} />
      <Button title="Hủy" onPress={onClose} />
    </Page>
  );
}

const stepStyles = {
  number: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "#eef2ff",
  },
  numberText: { color: "#4f46e5", fontWeight: "800" as const },
  meta: { color: "#64748b", fontSize: 11, fontFamily: "Inter-Regular" as const },
  chevron: { color: "#94a3b8", fontSize: 26, lineHeight: 26 },
  actions: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginTop: 4 },
  startBadge: { color: "#047857", fontSize: 12, fontWeight: "700" as const, marginTop: 3 },
  subTaskRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingVertical: 7 },
  check: { color: "#059669", fontSize: 15, fontWeight: "800" as const },
  remove: { color: "#be123c", fontSize: 12, fontWeight: "700" as const },
  addSubTaskRow: { flexDirection: "row" as const, alignItems: "flex-end" as const, gap: 8, marginTop: 6 },
  branchCard: { gap: 10, padding: 10, marginTop: 10, borderRadius: 12, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
};
