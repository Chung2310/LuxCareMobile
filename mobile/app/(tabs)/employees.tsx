import { useCallback, useRef, useState } from "react";
import { FlatList, Modal, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import type { UserProfile } from "../../../src/types/common";
import type { EmployeeProfileInput } from "../../../src/services/rosterService";
import { getRoleDisplayName } from "../../../src/utils/permissionUtils";
import { roster } from "../../src/api/services";
import { useSession, messageOf } from "../../src/auth/SessionProvider";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { Button, Card, EmptyState, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
export default function Employees() {
  const { user, selectedBranch } = useSession();
  const allowed = canUseModule(user, "hr") && (hasPermission(user, "hr:read") || hasPermission(user, "user:read"));
  const [items, setItems] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EmployeeProfileInput>({});
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!allowed) return;
      setLoading(true);
      setError(null);
      setItems([]);
      void roster
        .list(user?.companyCode, selectedBranch?._id || user?.branchId)
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
    }, [allowed, user?.companyCode, user?.branchId, selectedBranch?._id, revision]),
  );
  const save = async () => {
    if (lock.current || !selected) return;
    lock.current = true;
    setBusy(true);
    setFormError(null);
    try {
      if (!draft.displayName?.trim()) throw new Error("Vui lòng nhập họ tên.");
      await roster.update(selected.uid, draft);
      setSelected({ ...selected, ...draft });
      setEditing(false);
      setRevision((v) => v + 1);
    } catch (error) {
      setFormError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!allowed)
    return (
      <Page title="Nhân sự">
        <Text style={styles.text}>Bạn chưa được cấp quyền xem nhân sự.</Text>
      </Page>
    );
  const query = search.trim().toLocaleLowerCase("vi-VN");
  const data = items.filter((item) =>
    [item.displayName, item.email, item.phone, item.department, item.jobTitle].some((value) =>
      value?.toLocaleLowerCase("vi-VN").includes(query),
    ),
  );
  return (
    <>
      <FlatList
        style={styles.page}
        contentContainerStyle={styles.content}
        data={data}
        keyExtractor={(item) => item.uid}
        refreshing={loading}
        onRefresh={() => setRevision((v) => v + 1)}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <Text style={styles.title}>Nhân sự</Text>
            <Text style={styles.muted}>
              {selectedBranch?.name || user?.branchName || user?.companyName} · {data.length} nhân viên
            </Text>
            <Field label="Tìm tên, email, phòng ban" value={search} onChangeText={setSearch} />
            <ErrorText message={error} />
            {error && <Button title="Thử lại" onPress={() => setRevision((v) => v + 1)} />}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : !error ? (
            <EmptyState
              message="Không có nhân sự phù hợp"
              subtitle={search ? "Không tìm thấy nhân viên phù hợp với từ khóa." : undefined}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.heading}>{item.displayName}</Text>
            <Text style={styles.text}>{item.jobTitle || getRoleDisplayName(item.role)}</Text>
            <Text style={styles.muted}>
              {item.department} · {item.email}
            </Text>
            <Button
              title="Xem hồ sơ"
              onPress={() => {
                setSelected(item);
                setEditing(false);
                setFormError(null);
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
          <Page title={editing ? "Cập nhật hồ sơ" : "Hồ sơ nhân sự"}>
            {editing ? (
              <>
                {(
                  [
                    ["displayName", "Họ tên"],
                    ["phone", "Điện thoại"],
                    ["birthDate", "Ngày sinh (YYYY-MM-DD)"],
                    ["jobTitle", "Chức danh"],
                    ["qualification", "Trình độ"],
                    ["division", "Bộ phận"],
                  ] as const
                ).map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    value={draft[key] || ""}
                    editable={!busy}
                    onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))}
                  />
                ))}
                <Button
                  title={busy ? "Đang lưu…" : "Lưu hồ sơ"}
                  disabled={busy || !draft.displayName?.trim()}
                  onPress={() => void save()}
                />
                <Button title="Hủy chỉnh sửa" disabled={busy} onPress={() => setEditing(false)} />
              </>
            ) : (
              <>
                <Card>
                  <Text style={styles.heading}>{selected?.displayName}</Text>
                  <Text style={styles.text}>{selected?.email}</Text>
                  <Text style={styles.text}>{getRoleDisplayName(selected?.role || "")}</Text>
                  {[
                    ["Điện thoại", selected?.phone],
                    ["Ngày sinh", selected?.birthDate],
                    ["Chức danh", selected?.jobTitle],
                    ["Trình độ", selected?.qualification],
                    ["Phòng ban", selected?.department],
                    ["Bộ phận", selected?.division],
                  ].map(([label, value]) => (
                    <Text key={label} style={styles.text}>
                      {label}: {value || "Chưa cập nhật"}
                    </Text>
                  ))}
                </Card>
                {hasPermission(user, "user:manage") && (
                  <Button
                    title="Chỉnh sửa hồ sơ"
                    onPress={() => {
                      setDraft({
                        displayName: selected?.displayName || "",
                        phone: selected?.phone || "",
                        birthDate: selected?.birthDate || "",
                        jobTitle: selected?.jobTitle || "",
                        qualification: selected?.qualification || "",
                        division: selected?.division || "",
                      });
                      setEditing(true);
                    }}
                  />
                )}
              </>
            )}
            <ErrorText message={formError} />
            <Button title="Đóng" disabled={busy} onPress={() => setSelected(null)} />
          </Page>
        </SafeAreaView>
      </Modal>
    </>
  );
}
