import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, Modal, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import type { DepartmentRecord } from "../../../src/services/departmentService";
import { departments, roster } from "../../src/api/services";
import type { UserProfile } from "../../../src/types/common";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { LegacyForm } from "../../src/features/departments/LegacyForm";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { Button, Card, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
export default function Departments() {
  const { user } = useSession();
  const canManage = ["admin", "superadmin"].includes(user?.role || "");
  const [data, setData] = useState<DepartmentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<DepartmentRecord | "new" | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [legacy, setLegacy] = useState(false);
  const legacyLock = useRef(false);
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [peopleRevision, setPeopleRevision] = useState(0);
  const [manager, setManager] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [activeOnly, setActiveOnly] = useState(false);
  useEffect(() => {
    let mounted = true;
    if (!editing) return;
    setPeopleError(null);
    void roster
      .colleagues()
      .then((value) => {
        if (mounted) setPeople(value);
      })
      .catch((error) => {
        if (mounted) setPeopleError(messageOf(error));
      });
    return () => {
      mounted = false;
    };
  }, [editing, peopleRevision]);
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoading(true);
      setError(null);
      setData([]);
      void departments
        .list({ search: query, activeOnly })
        .then((value) => {
          if (mounted) setData(value);
        })
        .catch((error) => {
          if (mounted) setError(messageOf(error));
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
      return () => {
        mounted = false;
      };
    }, [query, revision, user?.uid, activeOnly]),
  );
  const open = (record: DepartmentRecord | "new") => {
    setEditing(record);
    setFormError(null);
    setCode(record === "new" ? "" : record.code);
    setName(record === "new" ? "" : record.name);
    setDescription(record === "new" ? "" : record.description || "");
    setActive(record === "new" ? true : record.isActive);
    setManager(record === "new" ? "" : record.managerUid || "");
    setSortOrder(String(record === "new" ? 0 : record.sortOrder));
  };
  const save = async () => {
    if (busy || !editing || !name.trim() || !code.trim()) return;
    setBusy(true);
    setFormError(null);
    try {
      const input = { code: code.trim(), name: name.trim(), description: description.trim(), isActive: active };
      const order = Number(sortOrder);
      if (!Number.isSafeInteger(order)) throw new Error("Thứ tự hiển thị phải là số nguyên.");
      Object.assign(input, { sortOrder: order });
      if (editing === "new" || manager !== (editing.managerUid || "")) {
        const person = people.find((item) => item.uid === manager);
        if (manager && !person) throw new Error("Vui lòng chọn người phụ trách trong danh sách.");
        Object.assign(input, { managerUid: manager, managerName: person?.displayName || "" });
      }
      if (editing === "new") await departments.create(input);
      else await departments.update(editing._id, input);
      setEditing(null);
      setRevision((v) => v + 1);
    } catch (error) {
      setFormError(messageOf(error));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await departments.delete(id);
      setRevision((v) => v + 1);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <FlatList
        style={styles.page}
        contentContainerStyle={styles.content}
        data={data}
        keyExtractor={(item) => item._id}
        refreshing={loading}
        onRefresh={() => setRevision((v) => v + 1)}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <Text style={styles.title}>Phòng ban</Text>
            <Button
              title={activeOnly ? "Hiển thị tất cả trạng thái" : "Chỉ phòng ban đang hoạt động"}
              disabled={busy}
              onPress={() => setActiveOnly((value) => !value)}
            />
            {canManage && <Button title="Chuẩn hóa tên phòng ban cũ" disabled={busy} onPress={() => setLegacy(true)} />}
            <Field
              label="Tìm phòng ban"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              onSubmitEditing={() => setQuery(search.trim())}
            />
            <Button title="Tìm kiếm" disabled={loading} onPress={() => setQuery(search.trim())} />
            {canManage && <Button title="Thêm phòng ban" disabled={busy} onPress={() => open("new")} />}
            <ErrorText message={error} />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : error ? (
            <Button title="Thử lại" onPress={() => setRevision((v) => v + 1)} />
          ) : (
            <Text style={styles.muted}>Không có phòng ban phù hợp.</Text>
          )
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.heading}>{item.name}</Text>
            <Text style={styles.muted}>
              {item.code} · {item.isActive ? "Hoạt động" : "Ngừng hoạt động"}
            </Text>
            {!!item.description && <Text style={styles.text}>{item.description}</Text>}
            <Text style={styles.muted}>
              {item.employeeCount ?? 0} nhân sự{item.managerName ? ` · ${item.managerName}` : ""}
            </Text>
            {canManage && (
              <>
                <Button title="Chỉnh sửa" disabled={busy} onPress={() => open(item)} />
                <Button
                  title="Xóa"
                  disabled={busy}
                  onPress={() =>
                    Alert.alert("Xóa phòng ban?", item.name, [
                      { text: "Hủy", style: "cancel" },
                      { text: "Xóa", style: "destructive", onPress: () => void remove(item._id) },
                    ])
                  }
                />
              </>
            )}
          </Card>
        )}
      />
      <Modal
        visible={editing !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setEditing(null);
        }}
      >
        <SafeAreaView style={styles.page}>
          <Page title={editing === "new" ? "Thêm phòng ban" : "Chỉnh sửa phòng ban"}>
            <Field label="Mã phòng ban" value={code} onChangeText={setCode} editable={!busy} />
            <Field label="Tên phòng ban" value={name} onChangeText={setName} editable={!busy} />
            <Field label="Mô tả" value={description} onChangeText={setDescription} multiline editable={!busy} />
            <Field
              label="Thứ tự hiển thị"
              value={sortOrder}
              onChangeText={setSortOrder}
              editable={!busy}
              keyboardType="numbers-and-punctuation"
            />
            <ErrorText message={peopleError} />
            {peopleError && (
              <Button title="Tải lại nhân sự" disabled={busy} onPress={() => setPeopleRevision((value) => value + 1)} />
            )}
            <ChoiceField
              label="Người phụ trách"
              value={manager}
              disabled={busy}
              choices={[
                { value: "", label: "Chưa chọn" },
                ...people.map((item) => ({ value: item.uid, label: item.displayName })),
                ...(editing &&
                editing !== "new" &&
                editing.managerUid &&
                !people.some((item) => item.uid === editing.managerUid)
                  ? [{ value: editing.managerUid, label: editing.managerName || "Người phụ trách hiện tại" }]
                  : []),
              ]}
              onChange={setManager}
            />
            <View style={styles.row}>
              <Text style={styles.text}>Hoạt động</Text>
              <Switch
                accessibilityLabel="Phòng ban hoạt động"
                value={active}
                onValueChange={setActive}
                disabled={busy}
              />
            </View>
            <ErrorText message={formError} />
            <Button
              title={busy ? "Đang lưu…" : "Lưu"}
              disabled={busy || !code.trim() || !name.trim()}
              onPress={() => void save()}
            />
            <Button title="Hủy" disabled={busy} onPress={() => setEditing(null)} />
          </Page>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={legacy}
        animationType="slide"
        onRequestClose={() => {
          if (!legacyLock.current) {
            setLegacy(false);
            setRevision((value) => value + 1);
          }
        }}
      >
        <SafeAreaView style={styles.page}>
          {legacy && (
            <LegacyForm
              onClose={() => {
                setLegacy(false);
                setRevision((value) => value + 1);
              }}
              setLocked={(value) => {
                legacyLock.current = value;
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}
