import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { CheckCircle2, Circle } from "lucide-react-native";
import type { WorkflowSubTask } from "../../../../src/types/hr";
import type { UserProfile } from "../../../../src/types/common";
import { roster } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Card, ErrorText, Field, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { WorkflowButton as Button } from "./WorkflowButton";

export function WorkflowSubtasksField({ items, onChange }: {
  items: WorkflowSubTask[];
  onChange: (items: WorkflowSubTask[]) => void;
}) {
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [title, setTitle] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void roster.colleagues()
      .then(value => { if (active) setPeople(value); })
      .catch(error => { if (active) setError(messageOf(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  const update = (id: string, patch: Partial<WorkflowSubTask>) =>
    onChange(items.map(item => item.id === id ? { ...item, ...patch } : item));
  const add = () => {
    if (!title.trim()) return;
    onChange([...items, { id: randomUUID(), title: title.trim(), done: false }]);
    setTitle("");
  };

  return (
    <Card>
      <Text style={styles.heading}>Công việc con ({items.length})</Text>
      <Text style={styles.muted}>{items.filter(item => item.done).length}/{items.length} hoàn thành</Text>
      <ErrorText message={error} />
      {error && <Button variant="secondary" title="Tải lại nhân sự" onPress={() => setRetry(value => value + 1)} />}
      {items.map((item, index) => (
        <View key={item.id} style={{ gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }}>
          <Field
            label={"Công việc con " + (index + 1) + " *"}
            value={item.title}
            onChangeText={title => update(item.id, { title })}
            multiline
          />
          <ChoiceField
            label={loading ? "Người được giao · Đang tải…" : "Người được giao"}
            disabled={loading}
            value={item.assigneeUid || ""}
            choices={[
              { value: "", label: item.assignee && !item.assigneeUid ? item.assignee : "Chưa giao" },
              ...people.map(person => ({ value: person.uid, label: person.displayName })),
              ...(item.assigneeUid && !people.some(person => person.uid === item.assigneeUid)
                ? [{ value: item.assigneeUid, label: item.assignee || "Người được giao hiện tại" }] : []),
            ]}
            onChange={uid => {
              const person = people.find(person => person.uid === uid);
              if (uid && !person) return;
              update(item.id, { assigneeUid: uid, assignee: person?.displayName || "" });
            }}
          />
          {!!(item.assignee || item.assigneeUid) && (
            <Button variant="secondary" title="Bỏ giao việc" onPress={() => update(item.id, { assigneeUid: "", assignee: "" })} />
          )}
          <View style={[styles.row, { flexWrap: "wrap" }]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!item.done }}
              onPress={() => update(item.id, { done: !item.done })}
              style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              {item.done ? <CheckCircle2 size={18} color="#059669" /> : <Circle size={18} color="#94a3b8" />}
              <Text style={styles.text}>{item.done ? "Đã hoàn thành" : "Chưa hoàn thành"}</Text>
            </Pressable>
            <Button variant="danger" title="Xóa công việc con" onPress={() => onChange(items.filter(task => task.id !== item.id))} />
          </View>
        </View>
      ))}
      {!items.length && <Text style={styles.muted}>Chưa có công việc con.</Text>}
      <Field label="Công việc mới" value={title} onChangeText={setTitle} onSubmitEditing={add} placeholder="Nhập tên công việc con" returnKeyType="done" />
      <Button title="Thêm công việc con" disabled={!title.trim()} onPress={add} />
    </Card>
  );
}