import { useCallback, useRef, useState, type MutableRefObject } from "react";
import { Alert, Linking, Modal, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import type { TaskAttachment, Workflow, WorkflowEdge, WorkflowStep } from "../../../src/types/hr";
import { workflow } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { workflowAccess } from "../../src/features/workflow/access";
import { WorkflowForm } from "../../src/features/workflow/WorkflowForm";
import { Button, Card, EmptyState, ErrorText, Loading, Page, styles } from "../../src/ui";

export default function WorkflowPage() {
  const { user, selectedBranch } = useSession();
  const access = workflowAccess(user);
  const scopeReady = user?.role === "admin" ? !!selectedBranch?._id : !!user?.branchId;
  const [items, setItems] = useState<Workflow[]>([]);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [stepDetail, setStepDetail] = useState<{ step: WorkflowStep; index: number } | null>(null);
  const [editing, setEditing] = useState<Workflow | "new" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const formLock = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setSelected(null);
      setError(null);
      setItems([]);
      if (!access.read || !scopeReady) return;
      setLoading(true);
      void workflow
        .list(user?.companyCode)
        .then((value) => {
          if (active) setItems(value);
        })
        .catch((loadError) => {
          if (active) setError(messageOf(loadError));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [access.read, scopeReady, user?.companyCode, selectedBranch?._id, user?.uid, revision]),
  );

  const closeEditor = () => {
    if (formLock.current) return;
    setEditing(null);
    setRevision((value) => value + 1);
  };

  const deleteWorkflow = (item: Workflow) => {
    Alert.alert("Xóa quy trình?", `Bạn có chắc muốn xóa “${item.name}”? Thao tác này không thể hoàn tác.`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa quy trình",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await workflow.remove(item.id);
              setSelected(null);
              setRevision((value) => value + 1);
            } catch (deleteError) {
              setError(messageOf(deleteError));
            }
          })();
        },
      },
    ]);
  };

  if (!access.read || !scopeReady) {
    return (
      <Page title="Quy trình làm việc">
        <Text style={styles.text}>Cần quyền xem quy trình và một chi nhánh hợp lệ để sử dụng chức năng này.</Text>
      </Page>
    );
  }

  if (selected) {
    return (
      <>
        <Page title={selected.name || "Quy trình chưa đặt tên"}>
          <View style={styles.row}>
            <Button title="← Danh sách" onPress={() => setSelected(null)} />
            {access.manage && <Button title="Sửa" onPress={() => setEditing(selected)} />}
          </View>
          {!!selected.category && <Text style={detailStyles.category}>{selected.category}</Text>}
          {!!selected.description && <Text style={styles.text}>{selected.description}</Text>}
          <Card>
            <Text style={styles.heading}>Các bước ({selected.steps.length})</Text>
            <Text style={styles.muted}>Chạm vào bước để xem hướng dẫn chi tiết.</Text>
          </Card>
          {selected.steps.length ? (
            selected.steps.map((step, index) => (
              <Pressable
                key={step.id}
                accessibilityRole="button"
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.78 }]}
                onPress={() => setStepDetail({ step, index })}
              >
                <View style={styles.row}>
                  <View style={detailStyles.number}>
                    <Text style={detailStyles.numberText}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.heading}>{step.title}</Text>
                    {!!step.description && <Text style={styles.muted} numberOfLines={3}>{step.description}</Text>}
                    <Text style={detailStyles.meta}>
                      {step.subTasks?.length || 0} việc con
                      {step.estDays ? ` · ${step.estDays} ngày` : ""}
                      {step.assignee ? ` · ${step.assignee}` : ""}
                    </Text>
                  </View>
                  <Text style={detailStyles.chevron}>›</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <EmptyState message="Quy trình chưa có bước nào" />
          )}
          {access.manage && <Button title="Sửa quy trình" onPress={() => setEditing(selected)} />}
          {access.manage && <Button title="Xóa quy trình" onPress={() => deleteWorkflow(selected)} />}
        </Page>
        <StepDetailModal
          detail={stepDetail}
          steps={selected.steps}
          edges={selected.edges || []}
          onClose={() => setStepDetail(null)}
        />
        <WorkflowEditorModal
          editing={editing}
          formLock={formLock}
          onClose={closeEditor}
        />
      </>
    );
  }

  return (
    <>
      <Page title="Quy trình làm việc">
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.muted}>{items.length} quy trình trong chi nhánh hiện tại</Text>
          </View>
          {access.manage && <Button title="+ Quy trình mới" onPress={() => setEditing("new")} />}
        </View>
        <ErrorText message={error} />
        {loading && <Loading />}
        {!loading && !error && !items.length && (
          <EmptyState
            message="Chưa có quy trình nào"
            subtitle={access.manage ? "Tạo quy trình đầu tiên với các bước thực hiện cụ thể." : "Chưa có dữ liệu quy trình trong phạm vi của bạn."}
          />
        )}
        {items.map((item) => (
          <Card key={item.id}>
            <View style={styles.row}>
              <View style={listStyles.icon}>
                <Text style={listStyles.iconText}>↗</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.heading}>{item.name || "(Chưa đặt tên)"}</Text>
                {!!item.category && <Text style={detailStyles.category}>{item.category}</Text>}
              </View>
            </View>
            {!!item.description && <Text style={styles.muted} numberOfLines={3}>{item.description}</Text>}
            <Text style={detailStyles.meta}>{item.steps.length} bước</Text>
            <View style={listStyles.actions}>
              <Button title="Xem chi tiết" onPress={() => setSelected(item)} />
              {access.manage && <Button title="Sửa" onPress={() => setEditing(item)} />}
              {access.manage && <Button title="Xóa" onPress={() => deleteWorkflow(item)} />}
            </View>
          </Card>
        ))}
        <Button title="Tải lại" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
      </Page>
      <WorkflowEditorModal
        editing={editing}
        formLock={formLock}
        onClose={closeEditor}
      />
    </>
  );
}

function WorkflowEditorModal({
  editing,
  formLock,
  onClose,
}: {
  editing: Workflow | "new" | null;
  formLock: MutableRefObject<boolean>;
  onClose: () => void;
}) {
  return (
    <Modal visible={editing !== null} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
        {editing && (
          <WorkflowForm
            initialWorkflow={editing === "new" ? undefined : editing}
            setLocked={(value) => {
              formLock.current = value;
            }}
            onClose={onClose}
            onSaved={onClose}
          />
        )}
      </View>
    </Modal>
  );
}

function StepDetailModal({
  detail,
  steps,
  edges,
  onClose,
}: {
  detail: { step: WorkflowStep; index: number } | null;
  steps: WorkflowStep[];
  edges: WorkflowEdge[];
  onClose: () => void;
}) {
  const step = detail?.step;
  const outgoing = step ? edges.filter((edge) => edge.source === step.id) : [];
  return (
    <Modal visible={!!step} animationType="slide" onRequestClose={onClose}>
      {step && (
        <Page title={`Bước ${(detail?.index ?? 0) + 1}`}>
          <View style={styles.row}>
            <Text style={[styles.heading, { flex: 1 }]}>{step.title}</Text>
            <Button title="Đóng" onPress={onClose} />
          </View>
          {!!step.description && <Text style={styles.text}>{step.description}</Text>}
          {!!step.assignee && <InfoRow label="Người thực hiện" value={step.assignee} />}
          {!!step.estDays && <InfoRow label="Thời lượng dự kiến" value={`${step.estDays} ngày`} />}
          {!!step.note && <Card><Text style={detailStyles.noteLabel}>Lưu ý</Text><Text style={styles.text}>{step.note}</Text></Card>}
          {!!step.deliverable && <Card><Text style={detailStyles.resultLabel}>Kết quả cần đạt</Text><Text style={styles.text}>{step.deliverable}</Text></Card>}
          {!!step.subTasks?.length && (
            <Card>
              <Text style={styles.heading}>Công việc cần làm ({step.subTasks.length})</Text>
              {step.subTasks.map((task) => <Text key={task.id} style={styles.text}>✓ {task.title}</Text>)}
            </Card>
          )}
          {!!outgoing.length && (
            <Card>
              <Text style={styles.heading}>Hướng xử lý ({outgoing.length})</Text>
              {outgoing.map((edge) => (
                <Text key={edge.id} style={styles.text}>
                  • {edge.label} → {steps.find((candidate) => candidate.id === edge.target)?.title || "Bước tiếp theo"}
                  {edge.isDefault ? " (mặc định)" : ""}
                </Text>
              ))}
            </Card>
          )}
          {!!step.attachments?.length && (
            <Card>
              <Text style={styles.heading}>Tệp đính kèm ({step.attachments.length})</Text>
              {step.attachments.map((attachment) => <AttachmentRow key={attachment.id} attachment={attachment} />)}
            </Card>
          )}
        </Page>
      )}
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={detailStyles.infoRow}><Text style={styles.muted}>{label}</Text><Text style={styles.text}>{value}</Text></View>;
}

function AttachmentRow({ attachment }: { attachment: TaskAttachment }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={detailStyles.attachment}
      onPress={() => {
        try {
          const url = new URL(attachment.url);
          if (!["http:", "https:"].includes(url.protocol)) throw new Error("Đường dẫn không được hỗ trợ.");
          void Linking.openURL(url.toString());
        } catch {
          Alert.alert("Không thể mở tệp", "Đường dẫn đính kèm không hợp lệ.");
        }
      }}
    >
      <Text style={detailStyles.attachmentIcon}>{attachment.type === "link" ? "↗" : "▣"}</Text>
      <View style={{ flex: 1 }}><Text style={styles.text} numberOfLines={1}>{attachment.name}</Text><Text style={styles.muted} numberOfLines={1}>{attachment.url}</Text></View>
      <Text style={detailStyles.open}>Mở</Text>
    </Pressable>
  );
}

const listStyles = {
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#eef2ff", alignItems: "center" as const, justifyContent: "center" as const },
  iconText: { color: "#4f46e5", fontSize: 22, fontWeight: "800" as const },
  actions: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
};

const detailStyles = {
  number: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#ecfdf5", alignItems: "center" as const, justifyContent: "center" as const },
  numberText: { color: "#047857", fontWeight: "800" as const },
  category: { color: "#0891b2", fontSize: 12, fontWeight: "700" as const },
  meta: { color: "#64748b", fontSize: 11, fontFamily: "Inter-Regular" as const },
  chevron: { color: "#94a3b8", fontSize: 26, lineHeight: 26 },
  infoRow: { gap: 2, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  noteLabel: { color: "#b45309", fontWeight: "800" as const, marginBottom: 4 },
  resultLabel: { color: "#047857", fontWeight: "800" as const, marginBottom: 4 },
  attachment: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  attachmentIcon: { color: "#4f46e5", fontSize: 18, fontWeight: "800" as const },
  open: { color: "#4f46e5", fontSize: 12, fontWeight: "700" as const },
};
