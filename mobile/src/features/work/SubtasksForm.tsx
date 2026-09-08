import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { randomUUID } from "expo-crypto";
import type { HRTask, TaskSubtask } from "../../../../src/types/hr";
import { kanban, roster } from "../../api/services";
import type { UserProfile } from "../../../../src/types/common";
import { ChoiceField } from "../leave/ChoiceField";
import { messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Page, styles } from "../../ui";
import { localDateTime, parseDateTime } from "./model";
export function SubtasksForm({
  task,
  onClose,
  onSaved,
  setLocked,
}: {
  task: HRTask;
  onClose: () => void;
  onSaved: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [items, setItems] = useState(() =>
    (task.subtasks || []).map((item) => ({ ...item, dueDate: localDateTime(item.dueDate) })),
  );
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setPeopleError(null);
    void roster
      .colleagues()
      .then((data) => {
        if (active) setPeople(data);
      })
      .catch((error) => {
        if (active) setPeopleError(messageOf(error));
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const disabled = busy || uncertain;
  const update = (id: string, patch: Partial<TaskSubtask>) =>
    setItems((value) => value.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const subtasks = items.map((item) => {
        if (!item.title.trim()) throw new Error("Mỗi việc nhỏ cần có tên.");
        return {
          ...item,
          title: item.title.trim(),
          dueDate: parseDateTime(item.dueDate || "", "Hạn việc nhỏ") || undefined,
        };
      });
      try {
        await kanban.updateTask(task.id, { subtasks, expectedRevision: task.revision || 0 });
      } catch (error) {
        if (!(error && typeof error === "object" && "status" in error) || Number(error.status) >= 500) {
          setUncertain(true);
          throw new Error("Chưa xác nhận được kết quả lưu. Quay lại tải danh sách trước khi thao tác tiếp.");
        }
        throw error;
      }
      onSaved();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  return (
    <Page title="Việc nhỏ">
      <Text style={styles.heading}>{task.title}</Text>
      <ErrorText message={peopleError} />
      {peopleError && (
        <Button title="Tải lại nhân sự" disabled={disabled} onPress={() => setRetry((value) => value + 1)} />
      )}
      <Text style={styles.muted}>
        {items.filter((item) => item.completed).length}/{items.length} hoàn thành
      </Text>
      {items.map((item) => (
        <Card key={item.id}>
          <Field
            label="Tên việc nhỏ"
            maxLength={255}
            editable={!disabled}
            value={item.title}
            onChangeText={(title) => update(item.id, { title })}
          />
          <ChoiceField
            label="Người được giao"
            value={item.assigneeUid || ""}
            disabled={disabled}
            choices={[
              { value: "", label: "Chưa giao" },
              ...people.map((person) => ({ value: person.uid, label: person.displayName })),
              ...(item.assigneeUid && !people.some((person) => person.uid === item.assigneeUid)
                ? [{ value: item.assigneeUid, label: item.assignee || "Người được giao hiện tại" }]
                : []),
            ]}
            onChange={(uid) => {
              const person = people.find((person) => person.uid === uid);
              if (uid && !person) return;
              update(item.id, {
                assigneeUid: uid || undefined,
                assignee: person?.displayName,
                assigneeAvatar: person?.photoURL,
              });
            }}
          />
          <Field
            label="Hạn (YYYY-MM-DD HH:mm, có thể để trống)"
            editable={!disabled}
            value={item.dueDate || ""}
            onChangeText={(dueDate) => update(item.id, { dueDate })}
          />
          <Field
            label="Ghi chú"
            multiline
            maxLength={500}
            editable={!disabled}
            value={item.note || ""}
            onChangeText={(note) => update(item.id, { note })}
          />
          <Button
            title={item.completed ? "Đã xong — đánh dấu chưa xong" : "Đánh dấu hoàn thành"}
            disabled={disabled}
            onPress={() =>
              update(item.id, {
                completed: !item.completed,
                completedAt: !item.completed ? new Date().toISOString() : undefined,
              })
            }
          />
          <Button
            title="Bỏ việc nhỏ khỏi danh sách"
            disabled={disabled}
            onPress={() => setItems((value) => value.filter((sub) => sub.id !== item.id))}
          />
        </Card>
      ))}
      <Button
        title="Thêm việc nhỏ"
        disabled={disabled || items.length >= 50}
        onPress={() => setItems((value) => [...value, { id: randomUUID(), title: "", completed: false, dueDate: "" }])}
      />
      <ErrorText message={error} />
      <Button title={busy ? "Đang lưu…" : "Lưu việc nhỏ"} disabled={disabled} onPress={() => void save()} />
      <Button title={uncertain ? "Quay lại danh sách" : "Hủy"} disabled={busy} onPress={onClose} />
    </Page>
  );
}
