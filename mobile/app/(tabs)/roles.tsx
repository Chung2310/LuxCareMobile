import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../../src/auth/SessionProvider";
import { api } from "../../src/api/services";
import { AppButton } from "../../src/components/common/AppButton";
import { useAppAlert } from "../../src/components/AppAlert";
import { createRolePermissionService, type RolePermission, type Permission } from "../../../src/services/rolePermissionService";
import { canManageRoles, canEditRole, roleTitle, roleSlug, withDefaultRoles, togglePermission, groupPermissions } from "../../src/features/roles/model";

const service = createRolePermissionService(api.transport);
const errorText = (error: unknown) => error instanceof Error ? error.message : "Không thể kết nối. Vui lòng thử lại.";

export default function RolesScreen() {
  const { user } = useSession();
  if (!canManageRoles(user)) return (
    <SafeAreaView style={styles.page}><View style={styles.body}>
      <Text style={styles.title}>Phân quyền & Vai trò</Text>
      <Text style={styles.muted}>Chỉ quản trị viên được quản lý vai trò và phân quyền doanh nghiệp.</Text>
      <AppButton title="Quay lại" onPress={() => router.back()} />
    </View></SafeAreaView>
  );
  return <RolesContent key={user!.uid + ":" + user!.companyCode} />;
}

function RolesContent() {
  const { user } = useSession();
  const { showAlert, alertView } = useAppAlert();
  const [company, setCompany] = useState(user?.companyCode?.trim().toUpperCase() || (user?.role === "superadmin" ? "SYSTEM" : ""));
  const [companyDraft, setCompanyDraft] = useState(company);
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<RolePermission | "new" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const request = ++generation.current;
    if (!company) { setError("Tài khoản chưa được gắn với doanh nghiệp."); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const [records, permissions] = await Promise.all([service.list(company), service.permissions()]);
      if (request !== generation.current) return;
      if (!permissions.length) throw new Error("Danh sách quyền đang trống. Vui lòng kiểm tra cấu hình máy chủ.");
      setRoles(withDefaultRoles(records, company));
      setCatalog(permissions);
    } catch (failure) {
      if (request === generation.current) setError(errorText(failure));
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [company]);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);
  const filtered = roles.filter(role => (roleTitle(role) + " " + role.role).toLowerCase().includes(search.trim().toLowerCase()));

  const remove = (role: RolePermission) => {
    showAlert("Xóa cấu hình vai trò?", "Cấu hình quyền của “" + roleTitle(role) +
      "” sẽ bị xóa và ảnh hưởng đến các tài khoản đang dùng vai trò này. Vai trò mặc định sẽ trở về quyền mặc định.", [
      { text: "Hủy", style: "cancel" },
      { text: "Xóa cấu hình", style: "destructive", onPress: () => {
        if (deleting) return;
        setDeleting(true);
        void service.remove(role.role, company).then(() => {
          showAlert("Đã xóa", "Đã xóa cấu hình vai trò.", undefined, "success");
          void load();
        }).catch(failure => showAlert("Không thể xóa", errorText(failure), undefined, "error"))
          .finally(() => setDeleting(false));
      } },
    ]);
  };

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Quay lại" style={styles.iconButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>
        <View style={styles.grow}><Text style={styles.title}>Phân quyền & Vai trò</Text><Text style={styles.muted}>{company || "Chưa có doanh nghiệp"}</Text></View>
        <View style={styles.headerIcon}><Ionicons name="shield-checkmark-outline" size={23} color="#059669" /></View>
      </View>
      <View style={styles.toolbar}>
        {user?.role === "superadmin" && <View style={styles.row}>
          <TextInput style={[styles.input, styles.grow]} value={companyDraft} onChangeText={setCompanyDraft}
            autoCapitalize="characters" placeholder="Mã doanh nghiệp" accessibilityLabel="Mã doanh nghiệp" />
          <AppButton title="Áp dụng" size="sm" disabled={loading || deleting || !companyDraft.trim()} onPress={() => {
            setRoles([]); setCatalog([]); setCompany(companyDraft.trim().toUpperCase());
          }} />
        </View>}
        <View style={styles.row}>
          <View style={styles.grow}><Text style={styles.sectionTitle}>Danh sách vai trò</Text>
            <Text style={styles.muted}>{loading ? "Đang tải..." : error ? "Chưa tải được dữ liệu" : roles.length + " vai trò trong doanh nghiệp"}</Text></View>
          <AppButton title="Tạo mới" icon="add" size="sm" disabled={loading || deleting || !!error || !company} onPress={() => setEditor("new")} />
        </View>
        <SearchField value={search} onChangeText={setSearch} placeholder="Tìm tên vai trò..." />
      </View>
      {error ? <View style={styles.body}><Text style={styles.error}>{error}</Text><AppButton title="Thử lại" onPress={() => void load()} /></View>
        : loading ? <ActivityIndicator style={styles.body} size="large" color="#059669" />
        : <FlatList data={filtered} keyExtractor={item => item.role} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled"
          refreshing={loading} onRefresh={() => void load()}
          ListEmptyComponent={<View style={styles.emptyState}><Ionicons name="search-outline" size={32} color="#94a3b8" /><Text style={styles.sectionTitle}>Không tìm thấy vai trò</Text><Text style={styles.muted}>Thử tìm bằng tên hoặc từ khóa khác.</Text></View>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.roleIcon, item.permissions.includes("*") && styles.privilegedIcon]}>
                  <Ionicons name={item.permissions.includes("*") ? "shield-checkmark" : "people-outline"} size={23} color={item.permissions.includes("*") ? "#7c3aed" : "#059669"} />
                </View>
                <View style={styles.grow}><Text style={styles.cardTitle}>{roleTitle(item)}</Text>
                  <Text style={styles.muted}>{item._id ? "Cấu hình doanh nghiệp" : "Vai trò mặc định"}</Text>
                </View>
              </View>
              <View style={styles.badges}>
                <View style={styles.badge}><Ionicons name="layers-outline" size={14} color="#64748b" /><Text style={styles.badgeText}>Cấp bậc {item.level}</Text></View>
                <View style={[styles.badge, styles.greenBadge]}><Ionicons name="key-outline" size={14} color="#047857" /><Text style={styles.greenText}>{item.permissions.includes("*") ? "Toàn quyền" : item.permissions.length + " quyền truy cập"}</Text></View>
              </View>
              <View style={styles.cardActions}>
                <Pressable accessibilityRole="button" disabled={deleting} onPress={() => setEditor(item)}
                  style={({ pressed }) => [styles.configureAction, (pressed || deleting) && styles.pressed]}>
                  <Text style={styles.actionText}>{canEditRole(user, item.role) ? "Cấu hình quyền" : "Xem chi tiết quyền"}</Text>
                  <Ionicons name="chevron-forward" size={17} color="#059669" />
                </Pressable>
                {item._id && canEditRole(user, item.role) && <Pressable accessibilityRole="button" accessibilityLabel={"Xóa cấu hình " + roleTitle(item)}
                  disabled={deleting} onPress={() => remove(item)} style={({ pressed }) => [styles.deleteAction, (pressed || deleting) && styles.pressed]}>
                  <Ionicons name="trash-outline" size={18} color="#dc2626" />
                </Pressable>}
              </View>
            </View>
          )} />}
      {editor !== null && <RoleEditor key={editor === "new" ? "new" : editor.role}
        role={editor === "new" ? null : editor} company={company} catalog={catalog} roles={roles}
        onClose={() => setEditor(null)} onSaved={() => {
          setEditor(null); void load();
          showAlert("Đã lưu", "Đã cập nhật vai trò và quyền truy cập.", undefined, "success");
        }} />}
      {alertView}
    </SafeAreaView>
  );
}

function RoleEditor({ role, company, catalog, roles, onClose, onSaved }: {
  role: RolePermission | null; company: string; catalog: Permission[]; roles: RolePermission[];
  onClose: () => void; onSaved: () => void;
}) {
  const { user } = useSession();
  const [name, setName] = useState(role ? roleTitle(role) : "");
  const [level, setLevel] = useState(String(role?.level || 5));
  const [permissions, setPermissions] = useState(role?.permissions || []);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const slug = role?.role || roleSlug(name);
  const editable = role ? canEditRole(user, role.role) : canManageRoles(user);
  const groups = useMemo(() => groupPermissions(catalog, search), [catalog, search]);
  const save = async () => {
    if (busy.current || !editable) return;
    const value = Number(level);
    if (!name.trim() || !slug) { setError("Vui lòng nhập tên vai trò hợp lệ."); return; }
    if (!role && roles.some(item => item.role === slug)) { setError("Tên vai trò đã tồn tại. Hãy chọn tên khác."); return; }
    if (!canEditRole(user, slug)) { setError("Không được tạo hoặc thay đổi vai trò quản trị này."); return; }
    if (!Number.isInteger(value) || value < (user?.role === "superadmin" ? 1 : 3) || value > 10) {
      setError(user?.role === "superadmin" ? "Cấp bậc phải là số nguyên từ 1 đến 10." : "Cấp bậc phải là số nguyên từ 3 đến 10."); return;
    }
    busy.current = true; setSaving(true); setError("");
    try {
      await service.save({ companyCode: company, role: slug, displayName: name.trim(), level: value, permissions });
      onSaved();
    } catch (failure) { setError(errorText(failure)); }
    finally { busy.current = false; setSaving(false); }
  };
  return (
    <Modal visible animationType="slide" transparent onRequestClose={() => { if (!saving) onClose(); }}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.sheetHandle} />
          <View style={styles.modalHeader}>
            <View style={styles.headerIcon}><Ionicons name="shield-checkmark-outline" size={23} color="#059669" /></View>
            <View style={styles.grow}><Text style={styles.cardTitle}>{role ? "Cấu hình vai trò" : "Tạo vai trò"}</Text><Text style={styles.muted}>Thiết lập thông tin và quyền truy cập</Text></View>
            <Pressable disabled={saving} onPress={onClose} accessibilityLabel="Đóng" accessibilityRole="button" style={styles.iconButton} hitSlop={8}>
              <Ionicons name="close" size={24} color="#475569" />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            {!editable && <Text style={styles.hint}>Vai trò quản trị này chỉ được xem, không thể chỉnh sửa.</Text>}
            <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Thông tin vai trò</Text>
            <Text style={styles.label}>Tên vai trò</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} editable={editable && !saving}
              placeholder="Ví dụ: Trưởng phòng nhân sự" accessibilityLabel="Tên vai trò" />
            <Text style={styles.label}>Cấp bậc (số nhỏ có cấp bậc cao hơn)</Text>
            <TextInput style={styles.input} value={level} onChangeText={setLevel} keyboardType="number-pad"
              editable={editable && !saving && role?.role !== "admin"} accessibilityLabel="Cấp bậc vai trò" />
            </View>
            <View style={styles.row}><Text style={[styles.sectionTitle, styles.grow]}>Quyền truy cập</Text><View style={[styles.badge, styles.greenBadge]}><Text style={styles.greenText}>{permissions.includes("*") ? "Toàn quyền" : permissions.length + " đã chọn"}</Text></View></View>
            {permissions.includes("*") && <Text style={styles.hint}>Vai trò này được cấp toàn bộ quyền hệ thống.</Text>}
            <SearchField value={search} onChangeText={setSearch} placeholder="Tìm quyền hoặc nhóm..." />
            {groups.length === 0 && <Text style={styles.muted}>Không tìm thấy quyền phù hợp.</Text>}
            {groups.map(([group, items]) => <View key={group} style={styles.group}>
              <View style={styles.groupHeader}><Text style={styles.groupTitle}>{group}</Text><Text style={styles.groupCount}>{items.filter(item => permissions.includes("*") || permissions.includes(item.code)).length}/{items.length}</Text></View>
              {items.map(item => <View key={item.code} style={styles.permission}>
                <View style={styles.grow}><Text style={styles.label}>{item.name}</Text>
                  {!!item.description && <Text style={styles.muted}>{item.description}</Text>}</View>
                <Switch value={permissions.includes("*") || permissions.includes(item.code)}
                  accessibilityLabel={item.name} disabled={!editable || saving || permissions.includes("*")}
                  trackColor={{ false: "#cbd5e1", true: "#059669" }}
                  onValueChange={() => setPermissions(current => togglePermission(current, item.code))} />
              </View>)}
            </View>)}
          </ScrollView>
          {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
          <View style={[styles.row, styles.footer]}>
            <AppButton title="Đóng" variant="secondary" disabled={saving} onPress={onClose} />
            {editable && <AppButton title="Lưu cấu hình" loading={saving} onPress={() => void save()} style={styles.grow} />}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return <View style={styles.searchField}>
    <Ionicons name="search-outline" size={19} color="#94a3b8" />
    <TextInput style={styles.searchInput} value={value} onChangeText={onChangeText} placeholder={placeholder}
      placeholderTextColor="#94a3b8" accessibilityLabel={placeholder} autoCorrect={false} returnKeyType="search" />
    {!!value && <Pressable onPress={() => onChangeText("")} accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" hitSlop={8} style={styles.clearSearch}>
      <Ionicons name="close-circle" size={18} color="#94a3b8" />
    </Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  iconButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  headerIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: "#ecfdf5", alignItems: "center", justifyContent: "center" },
  roleIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#ecfdf5", alignItems: "center", justifyContent: "center" },
  privilegedIcon: { backgroundColor: "#f5f3ff" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", lineHeight: 23 },
  searchField: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  searchInput: { flex: 1, minHeight: 48, paddingVertical: 12, fontSize: 14, color: "#0f172a" },
  clearSearch: { paddingVertical: 12, paddingLeft: 4 },
  listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, gap: 14 },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 10 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f1f5f9", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  greenBadge: { backgroundColor: "#ecfdf5" },
  greenText: { fontSize: 12, fontWeight: "600", color: "#047857" },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 4 },
  configureAction: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  actionText: { fontSize: 13, fontWeight: "700", color: "#059669" },
  deleteAction: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#fff1f2" },
  pressed: { opacity: 0.5 },
  sheetHandle: { width: 36, height: 4, backgroundColor: "#cbd5e1", borderRadius: 2, alignSelf: "center", marginTop: 10 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  formCard: { backgroundColor: "#f8fafc", borderRadius: 16, padding: 16, gap: 12 },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: "#f8fafc", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  groupCount: { fontSize: 12, fontWeight: "600", color: "#059669" },
  page: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  muted: { fontSize: 13, color: "#64748b", lineHeight: 20 },
  hint: { fontSize: 13, color: "#047857", lineHeight: 20, backgroundColor: "#ecfdf5", padding: 10, borderRadius: 10 },
  error: { color: "#b91c1c", lineHeight: 22, padding: 12, borderRadius: 12, backgroundColor: "#fef2f2" },
  body: { padding: 20, gap: 14 },
  toolbar: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, gap: 16 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, padding: 13, backgroundColor: "#fff", color: "#0f172a", fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1 },
  card: { padding: 18, paddingBottom: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", gap: 14 },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end", paddingTop: 50 },
  sheet: { alignSelf: "center", width: "100%", maxWidth: 640, maxHeight: "100%", height: "95%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  label: { color: "#334155", fontWeight: "600", fontSize: 14 },
  group: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, overflow: "hidden" },
  groupTitle: { flex: 1, color: "#334155", fontSize: 14, fontWeight: "700" },
  permission: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  footer: { backgroundColor: "#fff", padding: 16, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
});
