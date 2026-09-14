import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { CheckCircle2, Circle } from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import type { TaskSubtask } from "../../../../src/types/hr";
import type { UserProfile } from "../../../../src/types/common";
import { Button, Card, Field, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { DateTimePickerModal } from "./DateTimePickerModal";
import { parseDateTime } from "./model";

export function TaskSubtaskInfo({ item }: { item: TaskSubtask }) {
  let due: Date | null = null;
  try { if (item.dueDate) due = new Date(parseDateTime(item.dueDate, "Hạn công việc con")); } catch {}
  const overdue = !!due && !item.completed && due.getTime() < Date.now();
  return (
    <View style={{ gap: 5, marginTop: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {!!item.assigneeAvatar && /^https?:\/\//i.test(item.assigneeAvatar) && (
          <Image source={{ uri: item.assigneeAvatar }} style={{ width: 22, height: 22, borderRadius: 11 }} />
        )}
        <Text style={[styles.muted, { flexShrink: 1 }]}>Phụ trách: {item.assignee || (item.assigneeUid ? "Đã phân công" : "Chưa phân công")}</Text>
      </View>
      <Text style={[styles.muted, overdue && { color: "#be123c" }]}>
        {overdue ? "Quá hạn · " : "Hạn: "}{due ? due.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : item.dueDate || "Chưa đặt"}
      </Text>
      {!!item.note && <Text style={styles.muted}>Ghi chú: {item.note}</Text>}
      <Text style={[styles.muted, item.completed && { color: "#059669" }]}>{item.completed ? "Đã hoàn thành" : "Chưa hoàn thành"}</Text>
    </View>
  );
}

export function TaskSubtasksEditor({ items, people, disabled, canManage, onChange }: {
  items: TaskSubtask[];
  people: UserProfile[];
  disabled: boolean;
  canManage: boolean;
  onChange: (items: TaskSubtask[]) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [dateId, setDateId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [newAssigneeUid, setNewAssigneeUid] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newDateOpen, setNewDateOpen] = useState(false);
  const addDisabled = disabled || items.length >= 50;
  const completed = items.filter(item => item.completed).length;
  const percent = items.length ? Math.round(completed * 100 / items.length) : 0;
  const update = (id: string, patch: Partial<TaskSubtask>) => {
    if (!disabled) onChange(items.map(item => item.id === id ? { ...item, ...patch } : item));
  };
  const add = () => {
    if (disabled || !canManage || !title.trim() || items.length >= 50) return;
    const id = randomUUID();
    const person = people.find(person => person.uid === newAssigneeUid);
    onChange([...items, {
      id,
      title: title.trim(),
      completed: false,
      assigneeUid: newAssigneeUid || undefined,
      assignee: person?.displayName,
      assigneeAvatar: person?.photoURL,
      dueDate: newDueDate || undefined,
      note: newNote.trim() || undefined,
    }]);
    setTitle("");
    setNewAssigneeUid("");
    setNewDueDate("");
    setNewNote("");
    setFilter("all");
    setEditing(null);
  };
  const visible = items.filter(item => filter === "all" || (filter === "done" ? item.completed : !item.completed));
  return (
    <Card>
      <Text style={styles.heading}>Công việc con ({completed}/{items.length}) · {percent}%</Text>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} style={{ height: 6, borderRadius: 3, backgroundColor: "#e2e8f0", overflow: "hidden" }}>
        <View style={{ height: 6, width: (percent + "%") as `${number}%`, backgroundColor: "#059669" }} />
      </View>
      {items.length > 3 && <ChoiceField label="Hiển thị" value={filter} onChange={setFilter} choices={[
        { value: "all", label: "Tất cả (" + items.length + ")" },
        { value: "active", label: "Chưa xong (" + (items.length - completed) + ")" },
        { value: "done", label: "Đã xong (" + completed + ")" },
      ]} />}
      {visible.map(item => (
        <View key={item.id} style={{ gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.completed, disabled }} disabled={disabled}
            onPress={() => update(item.id, { completed: !item.completed, completedAt: !item.completed ? new Date().toISOString() : undefined })}
            style={{ flexDirection: "row", alignItems: "center", minHeight: 44, gap: 10 }}>
            {item.completed ? <CheckCircle2 size={20} color="#059669" /> : <Circle size={20} color="#94a3b8" />}
            <Text style={[styles.text, { flex: 1 }, item.completed && { textDecorationLine: "line-through", color: "#64748b" }]}>{item.title}</Text>
          </Pressable>
          <TaskSubtaskInfo item={item} />
          {canManage && <Button title={editing === item.id ? "Thu gọn" : "Sửa thông tin"} disabled={disabled} onPress={() => setEditing(editing === item.id ? null : item.id)} />}
          {canManage && editing === item.id && <>
            <Field label="Tên công việc con *" value={item.title} maxLength={255} editable={!disabled} onChangeText={title => update(item.id, { title })} />
            <ChoiceField label="Người phụ trách" value={item.assigneeUid || ""} disabled={disabled} choices={[
              { value: "", label: !item.assigneeUid && item.assignee ? item.assignee : "Chưa phân công" },
              ...people.map(person => ({ value: person.uid, label: person.displayName })),
              ...(item.assigneeUid && !people.some(person => person.uid === item.assigneeUid) ? [{ value: item.assigneeUid, label: item.assignee || "Người phụ trách hiện tại" }] : []),
            ]} onChange={uid => {
              const person = people.find(person => person.uid === uid);
              if (uid && !person) return;
              update(item.id, { assigneeUid: uid || undefined, assignee: person?.displayName, assigneeAvatar: person?.photoURL });
            }} />
            <Button title="Chọn ngày giờ hết hạn" disabled={disabled} onPress={() => setDateId(item.id)} />
            <Field label="Ghi chú" value={item.note || ""} maxLength={500} multiline editable={!disabled} onChangeText={note => update(item.id, { note })} />
            <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onChange(items.filter(sub => sub.id !== item.id))} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={[styles.text, { color: "#be123c" }]}>Xóa công việc con</Text>
            </Pressable>
          </>}
        </View>
      ))}
      {!visible.length && <Text style={styles.muted}>{items.length ? "Không có công việc trong mục này." : "Chưa có công việc con."}</Text>}
      {canManage && <>
        <Text style={styles.heading}>Thêm công việc con</Text>
        <Field label="Tên công việc con *" value={title} onChangeText={setTitle} maxLength={255} editable={!addDisabled} returnKeyType="next" />
        <ChoiceField
          label="Người được phân công"
          value={newAssigneeUid}
          disabled={addDisabled}
          choices={[
            { value: "", label: "Chọn người được phân công" },
            ...people.map(person => ({ value: person.uid, label: person.displayName })),
          ]}
          onChange={setNewAssigneeUid}
        />
        <View style={{ gap: 7 }}>
          <Text style={styles.text}>Ngày giờ phải hoàn thành</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={newDueDate ? "Ngày giờ phải hoàn thành: " + newDueDate : "Chọn ngày giờ phải hoàn thành"}
            accessibilityState={{ disabled: addDisabled }}
            disabled={addDisabled}
            onPress={() => setNewDateOpen(true)}
            style={[styles.input, { opacity: addDisabled ? 0.45 : 1 }]}
          >
            <Text style={styles.text}>{newDueDate || "Chọn ngày giờ hoàn thành"}</Text>
          </Pressable>
        </View>
        <Field label="Ghi chú" value={newNote} onChangeText={setNewNote} maxLength={500} multiline editable={!addDisabled} />
        <Button title="Thêm công việc con" disabled={addDisabled || !title.trim()} onPress={add} />
        <DateTimePickerModal
          visible={newDateOpen}
          title="Ngày giờ phải hoàn thành"
          value={newDueDate}
          allowClear
          onClose={() => setNewDateOpen(false)}
          onChange={value => { if (!addDisabled) setNewDueDate(value); setNewDateOpen(false); }}
        />
      </>}
      <DateTimePickerModal visible={dateId !== null} title="Hạn công việc con" value={items.find(item => item.id === dateId)?.dueDate || ""} allowClear
        onClose={() => setDateId(null)} onChange={dueDate => { if (dateId) update(dateId, { dueDate }); setDateId(null); }} />
    </Card>
  );
}