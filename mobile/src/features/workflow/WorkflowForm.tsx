import { useAppAlert } from "../../components/AppAlert";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDot,
  Clock,
  GitBranch,
  Pencil,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react-native";
import type { TaskAttachment, Workflow, WorkflowEdge, WorkflowStep, WorkflowSubTask } from "../../../../src/types/hr";
import { workflow } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Card, ErrorText, Field, colors, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { moveWorkflowStep, newWorkflowStep, pruneWorkflowEdges, workflowPayload } from "./model";
import { SafeAreaView } from "react-native-safe-area-context";
import { WorkflowButton as Button } from "./WorkflowButton";
import { WorkflowSubtasksField } from "./WorkflowSubtasksField";
import { AttachmentsForm } from "../work/AttachmentsForm";

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
  const { showAlert, alertView } = useAppAlert();
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
  const [edges, setEdges] = useState<WorkflowEdge[]>(() =>
    (initialWorkflow?.edges || []).map((edge) => ({ ...edge })),
  );
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
    showAlert("Xóa bước?", `Bạn có chắc muốn xóa “${step.title}”?`, [
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
    setEdges((current) => [
      ...current.filter((edge) => edge.source !== updated.id),
      ...outgoingEdges,
    ]);
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: "#f8fafc" }}
    >
      {/* Header */}
      <View style={formStyles.headerBar}>
        <View style={{ flex: 1 }}>
          <Text style={formStyles.headerTitle}>
            {initialWorkflow ? "Sửa quy trình" : "Tạo quy trình mới"}
          </Text>
          <Text style={formStyles.headerSubtitle}>
            Cấu hình thông tin chung và các bước xử lý
          </Text>
        </View>
        <TouchableOpacity
          style={formStyles.closeBtn}
          onPress={() => {
            if (!lock.current) onClose();
          }}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <X size={20} color="#475569" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={formStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: General Info */}
        <View style={formStyles.card}>
          <Text style={formStyles.cardHeading}>Thông tin chung</Text>
          <Field
            label="Tên quy trình *"
            value={name}
            editable={!busy}
            onChangeText={setName}
            placeholder="Ví dụ: Hướng dẫn nhân viên mới, Quy trình tiếp nhận khám..."
          />
          <Field
            label="Nhóm / Phân loại"
            value={category}
            editable={!busy}
            onChangeText={setCategory}
            placeholder="Ví dụ: Nhân sự, Vận hành, Chuyên môn"
          />
          <Field
            label="Mô tả / Ghi chú quy trình"
            value={description}
            editable={!busy}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholder="Mục tiêu, phạm vi áp dụng, tiêu chuẩn và lưu ý chung của quy trình..."
            style={{ minHeight: 90 }}
          />
        </View>

        {/* Section 2: Steps list */}
        <View style={formStyles.stepsHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={formStyles.cardHeading}>Các bước thực hiện ({steps.length})</Text>
            <Text style={formStyles.mutedText}>
              Chạm vào bước để thiết lập chi tiết hoặc điều kiện rẽ nhánh.
            </Text>
          </View>
          <TouchableOpacity
            style={formStyles.addStepBtn}
            onPress={openNewStep}
            disabled={busy}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={formStyles.addStepBtnText}>Thêm bước</Text>
          </TouchableOpacity>
        </View>

        {steps.length === 0 ? (
          <View style={formStyles.emptyStepBox}>
            <GitBranch size={36} color="#94a3b8" style={{ marginBottom: 6 }} />
            <Text style={formStyles.emptyStepTitle}>Chưa có bước thực hiện nào</Text>
            <Text style={formStyles.emptyStepDesc}>
              Quy trình cần ít nhất một bước công việc cụ thể.
            </Text>
          </View>
        ) : (
          steps.map((step, index) => {
            const stepEdges = edges.filter((edge) => edge.source === step.id);
            return (
              <Pressable
                key={step.id}
                accessibilityRole="button"
                style={({ pressed }) => [
                  formStyles.stepCard,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setEditingStep(step)}
                disabled={busy}
              >
                <View style={formStyles.stepCardTop}>
                  <View style={formStyles.stepNumberBadge}>
                    <Text style={formStyles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={formStyles.stepTitle} numberOfLines={1}>
                        {step.title || "(Chưa đặt tên bước)"}
                      </Text>
                      {index === 0 && (
                        <View style={formStyles.startPill}>
                          <Text style={formStyles.startPillText}>Khởi đầu</Text>
                        </View>
                      )}
                    </View>
                    {!!step.description && (
                      <Text style={formStyles.stepDesc} numberOfLines={2}>
                        {step.description}
                      </Text>
                    )}
                    <View style={formStyles.stepMetaRow}>
                      <View style={formStyles.metaBadge}>
                        <CheckCircle2 size={12} color="#059669" />
                        <Text style={formStyles.metaBadgeText}>
                          {step.subTasks?.length || 0} việc con
                        </Text>
                      </View>
                      {!!step.estDays && (
                        <View style={formStyles.metaBadge}>
                          <Clock size={12} color="#0284c7" />
                          <Text style={formStyles.metaBadgeText}>{step.estDays} ngày</Text>
                        </View>
                      )}
                      {!!step.assignee && (
                        <View style={formStyles.metaBadge}>
                          <User size={12} color="#475569" />
                          <Text style={formStyles.metaBadgeText} numberOfLines={1}>
                            {step.assignee}
                          </Text>
                        </View>
                      )}
                      {stepEdges.length > 0 && (
                        <View style={formStyles.metaBadge}>
                          <GitBranch size={12} color="#7c3aed" />
                          <Text style={formStyles.metaBadgeText}>
                            {stepEdges.length} hướng rẽ
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <ChevronRight size={18} color="#94a3b8" />
                </View>

                {/* Step Reorder & Action Row */}
                <View style={formStyles.stepActionsRow}>
                  <TouchableOpacity
                    style={[
                      formStyles.reorderBtn,
                      (busy || index === 0) && formStyles.btnDisabled,
                    ]}
                    disabled={busy || index === 0}
                    onPress={() => setSteps((curr) => moveWorkflowStep(curr, index, -1))}
                    activeOpacity={0.7}
                  >
                    <ArrowUp size={14} color="#475569" />
                    <Text style={formStyles.reorderBtnText}>Lên</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      formStyles.reorderBtn,
                      (busy || index === steps.length - 1) && formStyles.btnDisabled,
                    ]}
                    disabled={busy || index === steps.length - 1}
                    onPress={() => setSteps((curr) => moveWorkflowStep(curr, index, 1))}
                    activeOpacity={0.7}
                  >
                    <ArrowDown size={14} color="#475569" />
                    <Text style={formStyles.reorderBtnText}>Xuống</Text>
                  </TouchableOpacity>

                  <View style={{ flex: 1 }} />

                  <TouchableOpacity
                    style={formStyles.editStepBtn}
                    onPress={() => setEditingStep(step)}
                    disabled={busy}
                    activeOpacity={0.7}
                  >
                    <Pencil size={14} color="#0284c7" />
                    <Text style={formStyles.editStepBtnText}>Sửa</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={formStyles.deleteStepBtn}
                    onPress={() => deleteStep(step)}
                    disabled={busy}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={14} color="#dc2626" />
                    <Text style={formStyles.deleteStepBtnText}>Xóa</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            );
          })
        )}

        <ErrorText message={error} />

        {/* Bottom Form Actions */}
        <View style={formStyles.bottomActions}>
          <TouchableOpacity
            style={[formStyles.saveBtn, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => void save()}
            activeOpacity={0.8}
          >
            <Check size={18} color="#ffffff" />
            <Text style={formStyles.saveBtnText}>
              {busy ? "Đang lưu..." : "Lưu quy trình"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={formStyles.cancelBtn}
            disabled={busy}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={formStyles.cancelBtnText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Step Editor Modal */}
      <Modal
        visible={!!editingStep}
        animationType="slide"
        onRequestClose={() => setEditingStep(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
          {editingStep && (
            <WorkflowStepEditor
              step={editingStep}
              steps={steps}
              edges={edges.filter((edge) => edge.source === editingStep.id)}
              stepIndex={steps.findIndex((s) => s.id === editingStep.id)}
              onClose={() => setEditingStep(null)}
              onSave={saveStep}
            />
          )}
        </SafeAreaView>
      </Modal>

      {alertView}
    </KeyboardAvoidingView>
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
  const [estDays, setEstDays] = useState(
    step.estDays === undefined ? "1" : String(step.estDays),
  );
  const [deliverable, setDeliverable] = useState(step.deliverable || "");
  const [note, setNote] = useState(step.note || "");
  const [subTasks, setSubTasks] = useState<WorkflowSubTask[]>(() =>
    (step.subTasks || []).map((task) => ({ ...task })),
  );
  const [attachments, setAttachments] = useState<TaskAttachment[]>(() => (step.attachments || []).map(item => ({ ...item })));
  const [editingAttachments, setEditingAttachments] = useState(false);
  const attachmentLock = useRef(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [outgoingEdges, setOutgoingEdges] = useState<WorkflowEdge[]>(() =>
    edges.map((edge) => ({ ...edge })),
  );
  const otherSteps = steps.filter((candidate) => candidate.id !== step.id);

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
    if (subTasks.some(task => !task.title.trim())) {
      setStepError("Mỗi công việc con cần có tên.");
      return;
    }
    setStepError(null);
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
        attachments,
        subTasks: subTasks
          .filter((task) => task.title.trim())
          .map((task) => ({ ...task, title: task.title.trim() })),
      },
      outgoingEdges,
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: "#f8fafc" }}
    >
      {/* Step Modal Header */}
      <View style={formStyles.headerBar}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={formStyles.headerTitle}>Bước {stepIndex + 1}</Text>
            {stepIndex === 0 && (
              <View style={formStyles.startPill}>
                <Text style={formStyles.startPillText}>Khởi đầu</Text>
              </View>
            )}
          </View>
          <Text style={formStyles.headerSubtitle} numberOfLines={1}>
            {title || "(Chưa đặt tên bước)"}
          </Text>
        </View>
        <TouchableOpacity
          style={formStyles.closeBtn}
          onPress={onClose}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <X size={20} color="#475569" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={formStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Step Inputs */}
        <View style={formStyles.card}>
          <Text style={formStyles.cardHeading}>Chi tiết bước</Text>
          <Field
            label="Tên bước *"
            value={title}
            onChangeText={setTitle}
            placeholder="Ví dụ: Tiếp nhận hồ sơ, Thẩm định chuyên môn..."
          />
          <Field
            label="Mô tả bước"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholder="Hướng dẫn cách thực hiện, các tiêu chuẩn cần tuân thủ..."
            style={{ minHeight: 80 }}
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1.2 }}>
              <Field
                label="Người / Nhóm phụ trách"
                value={assignee}
                onChangeText={setAssignee}
                placeholder="VD: Điều dưỡng trưởng"
              />
            </View>
            <View style={{ flex: 0.8 }}>
              <Field
                label="Thời lượng (ngày)"
                value={estDays}
                onChangeText={setEstDays}
                keyboardType="numeric"
                placeholder="1"
              />
            </View>
          </View>
          <Field
            label="Kết quả cần đạt (Deliverable)"
            value={deliverable}
            onChangeText={setDeliverable}
            placeholder="Sản phẩm, biên bản hoặc trạng thái đạt được sau bước này"
          />
          <Field
            label="Lưu ý quan trọng"
            value={note}
            onChangeText={setNote}
            placeholder="Cảnh báo, trường hợp đặc biệt, lưu ý rủi ro..."
          />
        </View>

        <WorkflowSubtasksField items={subTasks} onChange={setSubTasks} />
        <View style={formStyles.card}>
          <Text style={formStyles.cardHeading}>Tệp, ảnh, video, ghi âm và liên kết</Text>
          <Text style={formStyles.mutedText}>{attachments.length} tệp / liên kết đính kèm giai đoạn</Text>
          {attachments.map(item => <Text key={item.id} style={styles.text}>{item.name}</Text>)}
          <Button variant="secondary" title="Quản lý đính kèm" onPress={() => setEditingAttachments(true)} />
        </View>
        <Modal visible={editingAttachments} animationType="slide" onRequestClose={() => { if (!attachmentLock.current) setEditingAttachments(false); }}>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            {editingAttachments && <AttachmentsForm initial={attachments}
              save={async items => { setAttachments(items); }}
              onClose={() => setEditingAttachments(false)}
              setLocked={value => { attachmentLock.current = value; }}
            />}
          </SafeAreaView>
        </Modal>

        {/* Branching Logic Section */}
        <View style={formStyles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text style={formStyles.cardHeading}>
                Hướng xử lý & rẽ nhánh ({outgoingEdges.length})
              </Text>
              <Text style={formStyles.mutedText}>
                Dùng khi bước này có nhiều điều kiện rẽ sang các bước khác nhau.
              </Text>
            </View>
            <TouchableOpacity
              style={[
                formStyles.addBranchBtn,
                !otherSteps.length && { opacity: 0.5 },
              ]}
              disabled={!otherSteps.length}
              onPress={addBranch}
              activeOpacity={0.8}
            >
              <GitBranch size={14} color="#7c3aed" />
              <Text style={formStyles.addBranchBtnText}>+ Thêm nhánh</Text>
            </TouchableOpacity>
          </View>

          {outgoingEdges.map((edge) => (
            <View key={edge.id} style={formStyles.branchCard}>
              <Field
                label="Điều kiện hiển thị"
                value={edge.label}
                onChangeText={(label) => updateBranch(edge.id, { label })}
                placeholder="Ví dụ: Đạt yêu cầu, Không đạt, Cần bổ sung..."
              />
              <ChoiceField
                label="Bước chuyển tiếp tới"
                value={edge.target}
                choices={otherSteps.map((candidate, idx) => ({
                  value: candidate.id,
                  label: `Bước ${idx + 1}: ${candidate.title}`,
                }))}
                onChange={(target) => updateBranch(edge.id, { target })}
              />
              <View style={formStyles.branchFooterRow}>
                <TouchableOpacity
                  style={formStyles.defaultRadioRow}
                  onPress={() => updateBranch(edge.id, { isDefault: true })}
                  activeOpacity={0.7}
                >
                  {edge.isDefault ? (
                    <CircleDot size={18} color="#059669" />
                  ) : (
                    <Circle size={18} color="#94a3b8" />
                  )}
                  <Text
                    style={[
                      formStyles.defaultRadioText,
                      edge.isDefault && { color: "#059669", fontWeight: "700" },
                    ]}
                  >
                    Hướng mặc định
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={formStyles.deleteBranchBtn}
                  onPress={() =>
                    setOutgoingEdges((curr) => curr.filter((item) => item.id !== edge.id))
                  }
                  activeOpacity={0.7}
                >
                  <Trash2 size={14} color="#dc2626" />
                  <Text style={formStyles.deleteBranchText}>Xóa nhánh</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {!outgoingEdges.length && (
            <Text style={formStyles.emptyBranchText}>
              Chưa có nhánh rẽ riêng; bước này sẽ hoàn tất hoặc tuần tự chuyển sang bước tiếp theo.
            </Text>
          )}
        </View>

        <ErrorText message={stepError} />
        {/* Step Bottom Actions */}
        <View style={formStyles.bottomActions}>
          <TouchableOpacity
            style={[formStyles.saveBtn, !title.trim() && { opacity: 0.5 }]}
            disabled={!title.trim()}
            onPress={save}
            activeOpacity={0.8}
          >
            <Check size={18} color="#ffffff" />
            <Text style={formStyles.saveBtnText}>Ghi nhận bước</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={formStyles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={formStyles.cancelBtnText}>Hủy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const formStyles = StyleSheet.create({
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-SemiBold",
  },
  mutedText: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
  },
  stepsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    gap: 10,
  },
  addStepBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#059669",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  addStepBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyStepBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStepTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 4,
  },
  emptyStepDesc: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  stepCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  stepCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  stepNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepNumberText: {
    color: "#059669",
    fontSize: 13,
    fontWeight: "800",
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  startPill: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  startPillText: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "700",
  },
  stepDesc: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
  },
  stepMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  metaBadgeText: {
    fontSize: 11,
    color: "#475569",
  },
  stepActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  reorderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  reorderBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  btnDisabled: {
    opacity: 0.4,
  },
  editStepBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  editStepBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284c7",
  },
  deleteStepBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  deleteStepBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#dc2626",
  },
  bottomActions: {
    gap: 10,
    marginTop: 8,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#059669",
    borderRadius: 12,
    paddingVertical: 13,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  cancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 12,
  },
  cancelBtnText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
  subTaskItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  subTaskItemText: {
    fontSize: 13,
    color: "#334155",
    flex: 1,
  },
  subTaskDeleteBtn: {
    padding: 4,
  },
  addSubTaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  addSubTaskBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#059669",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 18,
  },
  addSubTaskBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  addBranchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f5f3ff",
    borderWidth: 1,
    borderColor: "#ddd6fe",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBranchBtnText: {
    color: "#7c3aed",
    fontSize: 12,
    fontWeight: "700",
  },
  branchCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 10,
    marginTop: 6,
  },
  branchFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  defaultRadioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  defaultRadioText: {
    fontSize: 13,
    color: "#64748b",
  },
  deleteBranchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#fff1f2",
  },
  deleteBranchText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyBranchText: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
    paddingVertical: 4,
  },
});
