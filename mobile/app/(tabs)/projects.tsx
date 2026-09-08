import { useCallback, useRef, useState } from "react";
import { Alert, FlatList, Modal, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import type { Project } from "../../../src/types/hr";
import { kanban } from "../../src/api/services";
import { useSession, messageOf } from "../../src/auth/SessionProvider";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { ProjectForm } from "../../src/features/work/ProjectForm";
import { AttachmentsForm } from "../../src/features/work/AttachmentsForm";
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "../../src/features/work/project";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { Button, Card, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
export default function Projects() {
  const { user, selectedBranch } = useSession();
  const allowed = canUseModule(user, "hr");
  const manage = hasPermission(user, "work:manage");
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [attachmentProject, setAttachmentProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const formLock = useRef(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [items, setItems] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!allowed) return;
      setLoading(true);
      setError(null);
      setItems([]);
      void kanban
        .listProjects(selectedBranch?._id)
        .then((data) => {
          if (active) setItems(data);
        })
        .catch((error) => {
          if (active) setError(messageOf(error));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [allowed, selectedBranch?._id, revision]),
  );
  if (!allowed)
    return (
      <Page title="Dự án">
        <Text style={styles.text}>Phân hệ nhân sự chưa được kích hoạt.</Text>
      </Page>
    );
  const status = {
    not_started: "Chưa bắt đầu",
    in_progress: "Đang thực hiện",
    paused: "Tạm dừng",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };
  const reload = () => {
    setEditing(null);
    setAttachmentProject(null);
    setRevision((value) => value + 1);
  };
  const remove = async (project: Project) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await kanban.removeProject(project.id);
      reload();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <FlatList
        style={styles.page}
        contentContainerStyle={styles.content}
        data={items.filter(
          (item) =>
            (!statusFilter || item.status === statusFilter) &&
            item.name.toLocaleLowerCase("vi-VN").includes(search.trim().toLocaleLowerCase("vi-VN")),
        )}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={() => setRevision((v) => v + 1)}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <Text style={styles.title}>Dự án</Text>
            {manage && <Button title="Tạo dự án" disabled={busy} onPress={() => setEditing("new")} />}
            <Field label="Tìm dự án" value={search} onChangeText={setSearch} />
            <ChoiceField
              label="Trạng thái"
              value={statusFilter}
              choices={[{ value: "", label: "Tất cả" }, ...PROJECT_STATUSES]}
              onChange={setStatusFilter}
            />
            <ErrorText message={error} />
            {error && <Button title="Thử lại" onPress={() => setRevision((v) => v + 1)} />}
          </View>
        }
        ListEmptyComponent={
          loading ? <Loading /> : !error ? <Text style={styles.muted}>Không có dự án phù hợp.</Text> : null
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.heading}>{item.name}</Text>
            <Button title="Tệp đính kèm" disabled={busy} onPress={() => setAttachmentProject(item)} />
            <Text style={styles.text}>{status[item.status] || item.status}</Text>
            <Text style={styles.muted}>
              Ưu tiên: {PROJECT_PRIORITIES.find((value) => value.value === item.priority)?.label || item.priority}
            </Text>
            <Text style={styles.title}>{item.progress?.percent ?? 0}%</Text>
            <Text style={styles.muted}>
              {item.progress?.completed ?? 0}/{item.progress?.total ?? 0} công việc hoàn thành
            </Text>
            {item.dueAt && <Text style={styles.text}>Hạn: {new Date(item.dueAt).toLocaleDateString("vi-VN")}</Text>}
            {manage && (
              <>
                <Button title="Sửa dự án" disabled={busy} onPress={() => setEditing(item)} />
                <Button
                  title="Xóa dự án"
                  disabled={busy}
                  onPress={() =>
                    Alert.alert(
                      "Xóa dự án?",
                      `Xóa “${item.name}” và gỡ liên kết dự án khỏi các công việc. Các công việc vẫn được giữ lại.`,
                      [
                        { text: "Hủy", style: "cancel" },
                        { text: "Xóa", style: "destructive", onPress: () => void remove(item) },
                      ],
                    )
                  }
                />
              </>
            )}
          </Card>
        )}
      />
      <Modal
        visible={editing !== null || attachmentProject !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!formLock.current) reload();
        }}
      >
        <SafeAreaView style={styles.page}>
          {editing && (
            <ProjectForm
              project={editing === "new" ? undefined : editing}
              onClose={reload}
              onSaved={reload}
              setLocked={(value) => {
                formLock.current = value;
              }}
            />
          )}
          {attachmentProject && (
            <AttachmentsForm
              initial={attachmentProject.attachments || []}
              save={
                manage
                  ? async (attachments) => {
                      await kanban.updateProject(attachmentProject.id, { attachments });
                    }
                  : undefined
              }
              onClose={reload}
              setLocked={(value) => {
                formLock.current = value;
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}
