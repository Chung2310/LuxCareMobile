import { useCallback, useRef, useState } from "react";
import { Alert, FlatList, Linking, Modal, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import type { HRTask, Project } from "../../../src/types/hr";
import { kanban } from "../../src/api/services";
import { useSession, messageOf } from "../../src/auth/SessionProvider";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { Button, Card, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { shareLeaveFile } from "../../src/features/leave/files";
import { TaskForm } from "../../src/features/work/TaskForm";
import { SubtasksForm } from "../../src/features/work/SubtasksForm";
import { AttachmentsForm } from "../../src/features/work/AttachmentsForm";
import {
  canUpdateTask,
  normalizePriority,
  normalizeTaskStatus,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "../../src/features/work/model";
export default function Work() {
  const { user, selectedBranch } = useSession();
  const allowed = canUseModule(user, "hr");
  const manage = hasPermission(user, "work:manage");
  const [items, setItems] = useState<HRTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [projectId, setProjectId] = useState("");
  const [mine, setMine] = useState(false);
  const [selected, setSelected] = useState<HRTask | null>(null);
  const [editing, setEditing] = useState<HRTask | "new" | null>(null);
  const [subtasksTask, setSubtasksTask] = useState<HRTask | null>(null);
  const [attachmentTask, setAttachmentTask] = useState<HRTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const lock = useRef(false);
  const formLock = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!allowed) return;
      setLoading(true);
      setError(null);
      setItems([]);
      setProjectError(null);
      void kanban
        .listTasks(selectedBranch?._id)
        .then((data) => {
          if (active) setItems(data);
        })
        .catch((error) => {
          if (active) setError(messageOf(error));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      void kanban
        .listProjects(selectedBranch?._id)
        .then((data) => {
          if (active) setProjects(data);
        })
        .catch((error) => {
          if (active) {
            setProjects([]);
            setProjectError(messageOf(error));
          }
        });
      return () => {
        active = false;
      };
    }, [allowed, selectedBranch?._id, user?.uid, revision]),
  );
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setDetailError(null);
    try {
      await action();
    } catch (error) {
      setDetailError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const reload = () => {
    setSelected(null);
    setEditing(null);
    setSubtasksTask(null);
    setAttachmentTask(null);
    setRevision((value) => value + 1);
  };
  if (!allowed)
    return (
      <Page title="Công việc">
        <Text style={styles.text}>Phân hệ nhân sự chưa được kích hoạt.</Text>
      </Page>
    );
  const query = search.trim().toLocaleLowerCase("vi-VN");
  const filtered = items.filter(
    (task) =>
      (!status || normalizeTaskStatus(task.status) === status) &&
      (!projectId || task.projectId === projectId) &&
      (!mine || task.assigneeUid === user?.uid || task.subtasks?.some((sub) => sub.assigneeUid === user?.uid)) &&
      (!query ||
        [task.title, task.description, task.assignee].some((value) =>
          value?.toLocaleLowerCase("vi-VN").includes(query),
        )),
  );
  const statusLabel = (task: HRTask) =>
    TASK_STATUSES.find((item) => item.value === normalizeTaskStatus(task.status))?.label || task.status;
  return (
    <>
      <FlatList
        style={styles.page}
        contentContainerStyle={styles.content}
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={() => setRevision((v) => v + 1)}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <Text style={styles.title}>Công việc</Text>
            <Text style={styles.muted}>
              {selectedBranch?.name || user?.branchName} · {filtered.length} công việc
            </Text>
            {manage && <Button title="Giao việc mới" onPress={() => setEditing("new")} />}
            <Button title="Xem dự án" onPress={() => router.push("/(tabs)/projects")} />
            <Field label="Tìm công việc hoặc người được giao" value={search} onChangeText={setSearch} />
            <ChoiceField
              label="Trạng thái"
              value={status}
              choices={[{ value: "", label: "Tất cả" }, ...TASK_STATUSES]}
              onChange={setStatus}
            />
            <ChoiceField
              label="Dự án"
              value={projectId}
              choices={[
                { value: "", label: "Tất cả" },
                ...projects.map((project) => ({ value: project.id, label: project.name })),
              ]}
              onChange={setProjectId}
            />
            <Button
              title={mine ? "Hiển thị mọi công việc được phép xem" : "Chỉ việc được giao cho tôi"}
              onPress={() => setMine((value) => !value)}
            />
            <ErrorText message={error} />
            <ErrorText message={projectError} />
            {(error || projectError) && <Button title="Tải lại" onPress={() => setRevision((v) => v + 1)} />}
          </View>
        }
        ListEmptyComponent={
          loading ? <Loading /> : !error ? <Text style={styles.muted}>Không có công việc phù hợp.</Text> : null
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.heading}>{item.title}</Text>
            <Text style={styles.text}>
              {statusLabel(item)} · {TASK_PRIORITIES.find((p) => p.value === normalizePriority(item.priority))?.label}
            </Text>
            <Text style={styles.muted}>
              {item.assignee} · Hạn {new Date(item.dueDate).toLocaleString("vi-VN")}
            </Text>
            <Button
              title="Chi tiết công việc"
              onPress={() => {
                setSelected(item);
                setDetailError(null);
              }}
            />
          </Card>
        )}
      />
      <Modal
        visible={selected !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!lock.current) setSelected(null);
        }}
      >
        <SafeAreaView style={styles.page}>
          <Page title={selected?.title || "Công việc"}>
            {selected && (
              <>
                <Text style={styles.text}>
                  {statusLabel(selected)} · {selected.assignee}
                </Text>
                <Text style={styles.text}>{selected.description || "Chưa có mô tả"}</Text>
                <Text style={styles.muted}>Hạn chót: {new Date(selected.dueDate).toLocaleString("vi-VN")}</Text>
                <Text style={styles.text}>
                  Dự tính: {selected.estTime || 0} giờ · Thực tế: {selected.actualTime || 0} giờ
                </Text>
                {!!selected.linkNote && <Text style={styles.text}>Ghi chú: {selected.linkNote}</Text>}
                {!!selected.subtasks?.length && (
                  <Card>
                    <Text style={styles.heading}>Việc nhỏ</Text>
                    {selected.subtasks.map((sub) => (
                      <Text key={sub.id} style={styles.text}>
                        {sub.completed ? "✓" : "○"} {sub.title}
                        {sub.assignee ? ` · ${sub.assignee}` : ""}
                      </Text>
                    ))}
                  </Card>
                )}
                {!!selected.attachments?.length && (
                  <Card>
                    <Text style={styles.heading}>Đính kèm</Text>
                    {selected.attachments.map((file) => (
                      <Button
                        key={file.id}
                        title={file.name}
                        disabled={busy}
                        onPress={() =>
                          void run(async () => {
                            if (file.type === "link") {
                              const url = new URL(file.url);
                              if (!["https:", "http:"].includes(url.protocol))
                                throw new Error("Đường dẫn không được hỗ trợ.");
                              await Linking.openURL(url.toString());
                            } else await shareLeaveFile(file.url, file.name);
                          })
                        }
                      />
                    ))}
                  </Card>
                )}
                {!!selected.history?.length && (
                  <Card>
                    <Text style={styles.heading}>Lịch sử</Text>
                    {selected.history.map((entry, i) => (
                      <Text key={i} style={styles.text}>
                        {new Date(entry.time).toLocaleString("vi-VN")} · {entry.user}: {entry.action}
                      </Text>
                    ))}
                  </Card>
                )}
                {canUpdateTask(user, selected) && (
                  <Button
                    title="Quản lý đính kèm"
                    disabled={busy}
                    onPress={() => {
                      setAttachmentTask(selected);
                      setSelected(null);
                    }}
                  />
                )}
                {canUpdateTask(user, selected) && (
                  <Button
                    title="Quản lý việc nhỏ"
                    disabled={busy}
                    onPress={() => {
                      setSubtasksTask(selected);
                      setSelected(null);
                    }}
                  />
                )}
                {canUpdateTask(user, selected) && (
                  <Button
                    title="Cập nhật công việc"
                    disabled={busy}
                    onPress={() => {
                      setEditing(selected);
                      setSelected(null);
                    }}
                  />
                )}
                {manage && (
                  <Button
                    title="Xóa công việc"
                    disabled={busy}
                    onPress={() =>
                      Alert.alert("Xóa công việc?", selected.title, [
                        { text: "Hủy", style: "cancel" },
                        {
                          text: "Xóa",
                          style: "destructive",
                          onPress: () =>
                            void run(async () => {
                              await kanban.removeTask(selected.id);
                              reload();
                            }),
                        },
                      ])
                    }
                  />
                )}
              </>
            )}
            <ErrorText message={detailError} />
            <Button title="Đóng" disabled={busy} onPress={() => setSelected(null)} />
          </Page>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={editing !== null || subtasksTask !== null || attachmentTask !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!formLock.current) reload();
        }}
      >
        <SafeAreaView style={styles.page}>
          {subtasksTask && (
            <SubtasksForm
              task={subtasksTask}
              onClose={reload}
              onSaved={reload}
              setLocked={(value) => {
                formLock.current = value;
              }}
            />
          )}
          {attachmentTask && (
            <AttachmentsForm
              initial={attachmentTask.attachments || []}
              save={async (attachments) => {
                await kanban.updateTask(attachmentTask.id, {
                  attachments,
                  expectedRevision: attachmentTask.revision || 0,
                });
              }}
              onClose={reload}
              setLocked={(value) => {
                formLock.current = value;
              }}
            />
          )}
          {editing && (
            <TaskForm
              task={editing === "new" ? undefined : editing}
              projects={projects}
              setLocked={(value) => {
                formLock.current = value;
              }}
              onClose={reload}
              onSaved={reload}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}
