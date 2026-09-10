import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { UserProfile } from "../../../src/types/common";
import type { EmployeeProfileInput } from "../../../src/services/rosterService";
import type { DepartmentRecord } from "../../../src/services/departmentService";
import type { BranchRecord } from "../../../src/services/branchService";
import { getRoleDisplayName } from "../../../src/utils/permissionUtils";
import { branches, departments, roster } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { EmptyState, ErrorText, Loading, Page } from "../../src/ui";

const AVATAR_COLORS = [
  "#059669",
  "#0284c7",
  "#7c3aed",
  "#d97706",
  "#e11d48",
  "#0d9488",
  "#2563eb",
  "#ea580c",
  "#4f46e5",
];

const ROLE_OPTIONS: Array<{ value: UserProfile["role"]; label: string }> = [
  { value: "user", label: "Nhân viên" },
  { value: "manager", label: "Quản lý" },
  { value: "branch_owner", label: "Chủ chi nhánh" },
  { value: "admin", label: "Quản trị viên" },
];

function getAvatarColor(name?: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name?: string): string {
  if (!name) return "NV";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatSalary(amount?: number | null): string {
  if (amount == null || amount === 0) return "Chưa cập nhật";
  return amount.toLocaleString("vi-VN") + " đ";
}

export default function Employees() {
  const { user, selectedBranch } = useSession();
  const allowed = canUseModule(user, "hr") && (hasPermission(user, "hr:read") || hasPermission(user, "user:read"));
  const canManageUsers = hasPermission(user, "user:manage") || user?.role === "admin" || user?.role === "superadmin";

  const [items, setItems] = useState<UserProfile[]>([]);
  const [deptList, setDeptList] = useState<DepartmentRecord[]>([]);
  const [branchList, setBranchList] = useState<BranchRecord[]>([]);

  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  // Selected employee for detail view & edit
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTab, setEditTab] = useState<"general" | "work" | "role" | "salary">("general");
  const [draft, setDraft] = useState<EmployeeProfileInput>({});
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!allowed) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [usersData, departmentsData, branchesData] = await Promise.all([
          roster.list(user?.companyCode, selectedBranch?._id || user?.branchId),
          departments.list().catch(() => []),
          branches.list().catch(() => []),
        ]);
        setItems(usersData);
        setDeptList(departmentsData);
        setBranchList(branchesData);
      } catch (err) {
        setError(messageOf(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [allowed, user?.companyCode, user?.branchId, selectedBranch?._id],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!allowed) return;
      setLoading(true);
      setError(null);

      Promise.all([
        roster.list(user?.companyCode, selectedBranch?._id || user?.branchId),
        departments.list().catch(() => []),
        branches.list().catch(() => []),
      ])
        .then(([usersData, departmentsData, branchesData]) => {
          if (active) {
            setItems(usersData);
            setDeptList(departmentsData);
            setBranchList(branchesData);
          }
        })
        .catch((err) => {
          if (active) setError(messageOf(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [allowed, user?.companyCode, user?.branchId, selectedBranch?._id, revision]),
  );

  const initDraftFromUser = (u: UserProfile) => {
    setDraft({
      displayName: u.displayName || "",
      email: u.email || "",
      phone: u.phone || "",
      birthDate: u.birthDate || "",
      department: u.department || "",
      departmentId: u.departmentId || "",
      jobTitle: u.jobTitle || "",
      qualification: u.qualification || "",
      division: u.division || "",
      role: u.role || "user",
      branchId: u.branchId || "",
      branchName: u.branchName || "",
      isLeader: !!u.isLeader,
      monthlySalary: u.monthlySalary || undefined,
      jobDescriptionLink: u.jobDescriptionLink || "",
      level: u.level || undefined,
      status: u.status || "online",
    });
    setEditTab("general");
    setFormError(null);
  };

  const save = async () => {
    if (lock.current || !selected) return;
    lock.current = true;
    setBusy(true);
    setFormError(null);
    try {
      if (!draft.displayName?.trim()) throw new Error("Vui lòng nhập họ tên nhân viên.");
      await roster.update(selected.uid, draft);
      const updatedUser: UserProfile = { ...selected, ...draft };
      setSelected(updatedUser);
      setItems((curr) => curr.map((u) => (u.uid === selected.uid ? updatedUser : u)));
      setEditing(false);
      setRevision((v) => v + 1);
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  // Distinct departments for filter chips
  const departmentsList = useMemo(() => {
    const depts = new Set<string>();
    deptList.forEach((d) => {
      if (d.name?.trim()) depts.add(d.name.trim());
    });
    items.forEach((item) => {
      if (item.department?.trim()) depts.add(item.department.trim());
    });
    return Array.from(depts);
  }, [items, deptList]);

  // Leaders count
  const leadersCount = useMemo(() => {
    return items.filter(
      (item) => item.isLeader || item.role === "manager" || item.role === "admin" || item.role === "superadmin",
    ).length;
  }, [items]);

  // Filtered employees list
  const filteredData = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi-VN");
    return items.filter((item) => {
      if (selectedDept !== "all" && item.department?.trim() !== selectedDept) {
        return false;
      }
      if (query) {
        const match = [
          item.displayName,
          item.email,
          item.phone,
          item.department,
          item.jobTitle,
          item.division,
          item.branchName,
        ].some((val) => val?.toLocaleLowerCase("vi-VN").includes(query));
        if (!match) return false;
      }
      return true;
    });
  }, [items, selectedDept, search]);

  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert("Thông báo", "Nhân sự này chưa cập nhật số điện thoại.");
      return;
    }
    void Linking.openURL(`tel:${phone.replace(/\s+/g, "")}`);
  };

  const handleEmail = (email?: string) => {
    if (!email) return;
    void Linking.openURL(`mailto:${email}`);
  };

  if (!allowed) {
    return (
      <Page title="Nhân sự">
        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed-outline" size={44} color="#94a3b8" />
          <Text style={styles.emptyTitle}>Chưa được cấp quyền</Text>
          <Text style={styles.emptyDesc}>Bạn cần có quyền xem nhân sự để truy cập danh bạ công ty.</Text>
        </View>
      </Page>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <FlatList
          style={styles.flatList}
          contentContainerStyle={styles.flatListContent}
          data={filteredData}
          keyExtractor={(item) => item.uid}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void loadData(true);
                setRevision((v) => v + 1);
              }}
              colors={["#059669"]}
              tintColor="#059669"
            />
          }
          ListHeaderComponent={
            <View style={styles.headerWrapper}>
              {/* Header bar */}
              <View style={styles.headerBar}>
                <View style={styles.headerLeft}>
                  <Text style={styles.headerTitle}>Danh bạ nhân sự</Text>
                  <View style={styles.branchRow}>
                    <View style={styles.branchDot} />
                    <Text style={styles.branchName}>
                      {selectedBranch?.name || user?.branchName || user?.companyName || "Toàn công ty"} · {items.length} nhân viên
                    </Text>
                  </View>
                </View>

                <View style={styles.headerRight}>
                  <TouchableOpacity
                    style={styles.refreshBtn}
                    onPress={() => setRevision((v) => v + 1)}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="reload" size={16} color="#475569" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.orgChartBtn}
                    onPress={() => router.push("/(tabs)/org-chart" as any)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="git-network-outline" size={15} color="#2563eb" />
                    <Text style={styles.orgChartText}>Sơ đồ tổ chức</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Stats overview banner */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderLeftColor: "#059669" }]}>
                  <Text style={[styles.statValue, { color: "#059669" }]}>{items.length}</Text>
                  <Text style={styles.statLabel}>Tổng nhân sự</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: "#0284c7" }]}>
                  <Text style={[styles.statValue, { color: "#0284c7" }]}>{departmentsList.length}</Text>
                  <Text style={styles.statLabel}>Phòng ban</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: "#7c3aed" }]}>
                  <Text style={[styles.statValue, { color: "#7c3aed" }]}>{leadersCount}</Text>
                  <Text style={styles.statLabel}>Cán bộ quản lý</Text>
                </View>
              </View>

              {/* Search Bar */}
              <View style={styles.searchBox}>
                <Ionicons name="search" size={17} color="#64748b" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm tên, chức danh, SĐT, phòng ban..."
                  placeholderTextColor="#94a3b8"
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch("")} style={{ padding: 4 }} activeOpacity={0.6}>
                    <Ionicons name="close-circle" size={17} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Department filter chips */}
              {departmentsList.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.deptChipsRow}
                >
                  <TouchableOpacity
                    style={[styles.deptChip, selectedDept === "all" && styles.deptChipActive]}
                    onPress={() => setSelectedDept("all")}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.deptChipText, selectedDept === "all" && styles.deptChipTextActive]}>
                      Tất cả ({items.length})
                    </Text>
                  </TouchableOpacity>
                  {departmentsList.map((dept) => {
                    const isSelected = selectedDept === dept;
                    const count = items.filter((i) => i.department?.trim() === dept).length;
                    return (
                      <TouchableOpacity
                        key={dept}
                        style={[styles.deptChip, isSelected && styles.deptChipActive]}
                        onPress={() => setSelectedDept(dept)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.deptChipText, isSelected && styles.deptChipTextActive]}>
                          {dept} ({count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <ErrorText message={error} />
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <Loading />
            ) : !error ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>Không có nhân sự phù hợp</Text>
                <Text style={styles.emptyDesc}>
                  {search
                    ? `Không tìm thấy nhân viên nào theo từ khóa "${search}".`
                    : "Chưa có danh sách nhân viên trong phòng ban này."}
                </Text>
                {(search || selectedDept !== "all") && (
                  <TouchableOpacity
                    style={styles.resetFilterBtn}
                    onPress={() => {
                      setSearch("");
                      setSelectedDept("all");
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.resetFilterText}>Xem toàn bộ nhân viên</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const avatarColor = getAvatarColor(item.displayName);
            const initials = getInitials(item.displayName);
            const isManager =
              item.isLeader || item.role === "manager" || item.role === "admin" || item.role === "superadmin";

            return (
              <TouchableOpacity
                style={styles.employeeCard}
                onPress={() => {
                  setSelected(item);
                  setEditing(false);
                  setFormError(null);
                }}
                activeOpacity={0.75}
              >
                {/* Left Avatar */}
                <View style={[styles.avatarBox, { backgroundColor: avatarColor }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                  {isManager && (
                    <View style={styles.leaderBadge}>
                      <Ionicons name="star" size={9} color="#ffffff" />
                    </View>
                  )}
                </View>

                {/* Middle Info */}
                <View style={styles.cardInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.nameText} numberOfLines={1}>
                      {item.displayName || "Chưa đặt tên"}
                    </Text>
                    {isManager && (
                      <View style={styles.managerPill}>
                        <Text style={styles.managerPillText}>Quản lý</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.jobTitleText} numberOfLines={1}>
                    {item.jobTitle || getRoleDisplayName(item.role)}
                  </Text>

                  <View style={styles.deptRow}>
                    <Ionicons name="business-outline" size={12} color="#64748b" />
                    <Text style={styles.deptText} numberOfLines={1}>
                      {item.department || "Chưa phân phòng"}
                    </Text>
                  </View>
                </View>

                {/* Right Action Shortcuts */}
                <View style={styles.actionShortcuts}>
                  {Boolean(item.phone) && (
                    <TouchableOpacity
                      style={styles.phoneActionBtn}
                      onPress={() => handleCall(item.phone)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="call" size={15} color="#059669" />
                    </TouchableOpacity>
                  )}
                  <View style={styles.chevronBox}>
                    <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>

      {/* Employee Profile Detail & Edit Modal */}
      <Modal
        visible={selected !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!lock.current) setSelected(null);
        }}
      >
        <SafeAreaView style={styles.modalContainer} edges={["top", "bottom"]}>
          {/* Modal Header Bar */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalHeaderTitle}>
                {editing ? "Chỉnh sửa toàn diện hồ sơ" : "Hồ sơ nhân sự"}
              </Text>
              <Text style={styles.modalHeaderSubtitle}>
                {editing ? "Cập nhật công tác, chức danh, phân quyền & lương" : selected?.email}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setSelected(null)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {editing ? (
            /* Edit Form with Tabs for Comprehensive Info */
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              {/* Form Category Navigation */}
              <View style={styles.formNavRow}>
                <TouchableOpacity
                  style={[styles.formNavTab, editTab === "general" && styles.formNavTabActive]}
                  onPress={() => setEditTab("general")}
                >
                  <Text style={[styles.formNavText, editTab === "general" && styles.formNavTextActive]}>
                    Cá nhân
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.formNavTab, editTab === "work" && styles.formNavTabActive]}
                  onPress={() => setEditTab("work")}
                >
                  <Text style={[styles.formNavText, editTab === "work" && styles.formNavTextActive]}>
                    Công tác
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.formNavTab, editTab === "role" && styles.formNavTabActive]}
                  onPress={() => setEditTab("role")}
                >
                  <Text style={[styles.formNavText, editTab === "role" && styles.formNavTextActive]}>
                    Phân quyền
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.formNavTab, editTab === "salary" && styles.formNavTabActive]}
                  onPress={() => setEditTab("salary")}
                >
                  <Text style={[styles.formNavText, editTab === "salary" && styles.formNavTextActive]}>
                    Lương & JD
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.editScrollContent} keyboardShouldPersistTaps="handled">
                {/* TAB 1: THÔNG TIN CÁ NHÂN */}
                {editTab === "general" && (
                  <View style={styles.editSectionBox}>
                    <Text style={styles.editSectionTitle}>👤 Thông tin cá nhân cơ bản</Text>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Họ và tên *</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Ví dụ: Bác sĩ Nguyễn Văn A"
                        placeholderTextColor="#94a3b8"
                        value={draft.displayName || ""}
                        onChangeText={(val) => setDraft((curr) => ({ ...curr, displayName: val }))}
                      />
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Email nội bộ</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Ví dụ: nva@luxcare.vn"
                        placeholderTextColor="#94a3b8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={draft.email || ""}
                        onChangeText={(val) => setDraft((curr) => ({ ...curr, email: val }))}
                      />
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Số điện thoại liên hệ</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Ví dụ: 0987654321"
                        placeholderTextColor="#94a3b8"
                        keyboardType="phone-pad"
                        value={draft.phone || ""}
                        onChangeText={(val) => setDraft((curr) => ({ ...curr, phone: val }))}
                      />
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Ngày sinh (YYYY-MM-DD)</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Ví dụ: 1990-05-20"
                        placeholderTextColor="#94a3b8"
                        value={draft.birthDate || ""}
                        onChangeText={(val) => setDraft((curr) => ({ ...curr, birthDate: val }))}
                      />
                    </View>
                  </View>
                )}

                {/* TAB 2: CÔNG TÁC & PHÒNG BAN */}
                {editTab === "work" && (
                  <View style={styles.editSectionBox}>
                    <Text style={styles.editSectionTitle}>🏢 Phòng ban & Chuyên môn</Text>

                    {/* Department Quick Select */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Phòng ban / Khoa</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Nhập hoặc chọn phòng ban bên dưới"
                        placeholderTextColor="#94a3b8"
                        value={draft.department || ""}
                        onChangeText={(val) => setDraft((curr) => ({ ...curr, department: val }))}
                      />
                      {deptList.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                          <View style={{ flexDirection: "row", gap: 6 }}>
                            {deptList.map((d) => (
                              <TouchableOpacity
                                key={d._id}
                                style={[
                                  styles.miniPickerPill,
                                  draft.department === d.name && styles.miniPickerPillActive,
                                ]}
                                onPress={() =>
                                  setDraft((curr) => ({
                                    ...curr,
                                    department: d.name,
                                    departmentId: d._id,
                                  }))
                                }
                              >
                                <Text
                                  style={[
                                    styles.miniPickerText,
                                    draft.department === d.name && styles.miniPickerTextActive,
                                  ]}
                                >
                                  {d.name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      )}
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Bộ phận / Khối chuyên môn</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Ví dụ: Khối Lâm sàng, Hành chính tổng hợp..."
                        placeholderTextColor="#94a3b8"
                        value={draft.division || ""}
                        onChangeText={(val) => setDraft((curr) => ({ ...curr, division: val }))}
                      />
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Chức danh công việc</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Ví dụ: Bác sĩ Trưởng khoa, Điều dưỡng viên..."
                        placeholderTextColor="#94a3b8"
                        value={draft.jobTitle || ""}
                        onChangeText={(val) => setDraft((curr) => ({ ...curr, jobTitle: val }))}
                      />
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Trình độ học vấn & Chuyên môn</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Ví dụ: Thạc sĩ Y khoa, CKI, Cử nhân..."
                        placeholderTextColor="#94a3b8"
                        value={draft.qualification || ""}
                        onChangeText={(val) => setDraft((curr) => ({ ...curr, qualification: val }))}
                      />
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Cấp bậc / Level</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Ví dụ: 1, 2, 3..."
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        value={draft.level != null ? String(draft.level) : ""}
                        onChangeText={(val) =>
                          setDraft((curr) => ({
                            ...curr,
                            level: val.trim() ? parseInt(val.trim(), 10) || undefined : undefined,
                          }))
                        }
                      />
                    </View>
                  </View>
                )}

                {/* TAB 3: PHÂN QUYỀN & CHI NHÁNH */}
                {editTab === "role" && (
                  <View style={styles.editSectionBox}>
                    <Text style={styles.editSectionTitle}>🛡️ Phân quyền & Vai trò hệ thống</Text>

                    {/* Role options */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Vai trò hệ thống</Text>
                      <View style={styles.rolePickerRow}>
                        {ROLE_OPTIONS.map((opt) => {
                          const isSelected = draft.role === opt.value;
                          return (
                            <TouchableOpacity
                              key={opt.value}
                              style={[styles.rolePickerBtn, isSelected && styles.rolePickerBtnActive]}
                              onPress={() => setDraft((curr) => ({ ...curr, role: opt.value }))}
                              activeOpacity={0.75}
                            >
                              <Ionicons
                                name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                                size={15}
                                color={isSelected ? "#059669" : "#94a3b8"}
                              />
                              <Text style={[styles.rolePickerText, isSelected && styles.rolePickerTextActive]}>
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Branch Quick Select */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Chi nhánh làm việc</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Tên chi nhánh làm việc..."
                        placeholderTextColor="#94a3b8"
                        value={draft.branchName || ""}
                        onChangeText={(val) => setDraft((curr) => ({ ...curr, branchName: val }))}
                      />
                      {branchList.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                          <View style={{ flexDirection: "row", gap: 6 }}>
                            {branchList.map((b) => (
                              <TouchableOpacity
                                key={b._id}
                                style={[
                                  styles.miniPickerPill,
                                  draft.branchId === b._id && styles.miniPickerPillActive,
                                ]}
                                onPress={() =>
                                  setDraft((curr) => ({
                                    ...curr,
                                    branchId: b._id,
                                    branchName: b.name,
                                  }))
                                }
                              >
                                <Text
                                  style={[
                                    styles.miniPickerText,
                                    draft.branchId === b._id && styles.miniPickerTextActive,
                                  ]}
                                >
                                  {b.name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      )}
                    </View>

                    {/* Switch: Trưởng nhóm / Leader */}
                    <View style={styles.switchRowCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.switchTitle}>Trưởng nhóm / Trưởng bộ phận</Text>
                        <Text style={styles.switchDesc}>Gắn huy hiệu lãnh đạo và ưu tiên điều phối công việc.</Text>
                      </View>
                      <Switch
                        value={!!draft.isLeader}
                        onValueChange={(val) => setDraft((curr) => ({ ...curr, isLeader: val }))}
                        trackColor={{ true: "#a7f3d0" }}
                        thumbColor={draft.isLeader ? "#059669" : "#f1f5f9"}
                      />
                    </View>

                    {/* Trạng thái làm việc */}
                    <View style={styles.switchRowCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.switchTitle}>Trạng thái hoạt động</Text>
                        <Text style={styles.switchDesc}>
                          {draft.status === "online" ? "Đang làm việc tại viện" : "Đã nghỉ / Tạm dừng"}
                        </Text>
                      </View>
                      <Switch
                        value={draft.status !== "offline"}
                        onValueChange={(val) =>
                          setDraft((curr) => ({ ...curr, status: val ? "online" : "offline" }))
                        }
                        trackColor={{ true: "#a7f3d0" }}
                        thumbColor={draft.status !== "offline" ? "#059669" : "#f1f5f9"}
                      />
                    </View>
                  </View>
                )}

                {/* TAB 4: LƯƠNG & TÀI LIỆU JD */}
                {editTab === "salary" && (
                  <View style={styles.editSectionBox}>
                    <Text style={styles.editSectionTitle}>💰 Chế độ đãi ngộ & Bản mô tả công việc</Text>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Mức lương cơ bản hàng tháng (VNĐ)</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Ví dụ: 15000000"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        value={draft.monthlySalary != null ? String(draft.monthlySalary) : ""}
                        onChangeText={(val) =>
                          setDraft((curr) => ({
                            ...curr,
                            monthlySalary: val.trim() ? parseInt(val.trim(), 10) || undefined : undefined,
                          }))
                        }
                      />
                      {draft.monthlySalary != null && draft.monthlySalary > 0 && (
                        <Text style={styles.salaryPreviewText}>
                          = {formatSalary(draft.monthlySalary)} / tháng
                        </Text>
                      )}
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Đường dẫn bản mô tả công việc (JD Link)</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="https://drive.google.com/..."
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="none"
                        value={draft.jobDescriptionLink || ""}
                        onChangeText={(val) => setDraft((curr) => ({ ...curr, jobDescriptionLink: val }))}
                      />
                    </View>
                  </View>
                )}

                <ErrorText message={formError} />

                {/* Bottom Save & Cancel */}
                <View style={styles.formBtnRow}>
                  <TouchableOpacity
                    style={[styles.saveBtn, busy && { opacity: 0.6 }]}
                    onPress={() => void save()}
                    disabled={busy || !draft.displayName?.trim()}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-done" size={17} color="#ffffff" />
                    <Text style={styles.saveBtnText}>{busy ? "Đang lưu..." : "Lưu thay đổi hồ sơ"}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setEditing(false)}
                    disabled={busy}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelBtnText}>Quay lại xem hồ sơ</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            /* Profile Details View */
            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {/* Hero Profile Card */}
              <View style={styles.profileHeroCard}>
                <View
                  style={[
                    styles.heroAvatarBox,
                    { backgroundColor: getAvatarColor(selected?.displayName) },
                  ]}
                >
                  <Text style={styles.heroAvatarText}>{getInitials(selected?.displayName)}</Text>
                  {selected?.isLeader && (
                    <View style={styles.heroCrownBadge}>
                      <Ionicons name="star" size={14} color="#ffffff" />
                    </View>
                  )}
                </View>

                <Text style={styles.heroNameText}>{selected?.displayName}</Text>
                <Text style={styles.heroJobTitle}>
                  {selected?.jobTitle || getRoleDisplayName(selected?.role || "")}
                </Text>

                <View style={styles.heroBadgeRow}>
                  <View style={styles.heroDeptBadge}>
                    <Text style={styles.heroDeptText}>{selected?.department || "Chưa phân phòng"}</Text>
                  </View>
                  <View style={styles.heroRoleBadge}>
                    <Text style={styles.heroRoleText}>{getRoleDisplayName(selected?.role || "")}</Text>
                  </View>
                  {selected?.isLeader && (
                    <View style={[styles.heroRoleBadge, { backgroundColor: "#fef3c7" }]}>
                      <Text style={[styles.heroRoleText, { color: "#b45309" }]}>Trưởng bộ phận</Text>
                    </View>
                  )}
                </View>

                {/* Quick Action Shortcuts in Hero */}
                <View style={styles.heroActionRow}>
                  {Boolean(selected?.phone) && (
                    <TouchableOpacity
                      style={styles.heroActionBtn}
                      onPress={() => handleCall(selected?.phone)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.heroActionIconBox, { backgroundColor: "#ecfdf5" }]}>
                        <Ionicons name="call" size={18} color="#059669" />
                      </View>
                      <Text style={styles.heroActionLabel}>Gọi điện</Text>
                    </TouchableOpacity>
                  )}

                  {Boolean(selected?.email) && (
                    <TouchableOpacity
                      style={styles.heroActionBtn}
                      onPress={() => handleEmail(selected?.email)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.heroActionIconBox, { backgroundColor: "#eff6ff" }]}>
                        <Ionicons name="mail" size={18} color="#2563eb" />
                      </View>
                      <Text style={styles.heroActionLabel}>Email</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.heroActionBtn}
                    onPress={() => {
                      setSelected(null);
                      router.push("/(tabs)/chat" as any);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.heroActionIconBox, { backgroundColor: "#fdf2f8" }]}>
                      <Ionicons name="chatbubble-ellipses" size={18} color="#ec4899" />
                    </View>
                    <Text style={styles.heroActionLabel}>Nhắn tin</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Info Block: Tổ chức & Công tác */}
              <View style={styles.infoSectionCard}>
                <View style={styles.infoSectionHeader}>
                  <Ionicons name="business" size={16} color="#059669" />
                  <Text style={styles.infoSectionTitle}>Vị trí & Tổ chức</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Phòng ban / Khoa</Text>
                  <Text style={styles.infoValue}>{selected?.department || "Chưa cập nhật"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Chức danh công việc</Text>
                  <Text style={styles.infoValue}>{selected?.jobTitle || "Chưa cập nhật"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Khối / Bộ phận</Text>
                  <Text style={styles.infoValue}>{selected?.division || "Chưa cập nhật"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Cấp bậc / Level</Text>
                  <Text style={styles.infoValue}>{selected?.level != null ? `Cấp ${selected.level}` : "Chưa cập nhật"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Chi nhánh</Text>
                  <Text style={styles.infoValue}>{selected?.branchName || selectedBranch?.name || "Toàn công ty"}</Text>
                </View>
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>Cán bộ phụ trách</Text>
                  <Text style={[styles.infoValue, { color: selected?.isLeader ? "#059669" : "#64748b", fontWeight: "700" }]}>
                    {selected?.isLeader ? "★ Trưởng nhóm / Trưởng khoa" : "Nhân viên"}
                  </Text>
                </View>
              </View>

              {/* Info Block: Liên hệ & Chuyên môn */}
              <View style={styles.infoSectionCard}>
                <View style={styles.infoSectionHeader}>
                  <Ionicons name="person" size={16} color="#0284c7" />
                  <Text style={styles.infoSectionTitle}>Thông tin cá nhân & Chuyên môn</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Số điện thoại</Text>
                  <Text style={[styles.infoValue, { color: "#059669", fontWeight: "700" }]}>
                    {selected?.phone || "Chưa cập nhật"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email nội bộ</Text>
                  <Text style={styles.infoValue}>{selected?.email || "Chưa cập nhật"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Trình độ học vấn</Text>
                  <Text style={styles.infoValue}>{selected?.qualification || "Chưa cập nhật"}</Text>
                </View>
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>Ngày sinh</Text>
                  <Text style={styles.infoValue}>{selected?.birthDate || "Chưa cập nhật"}</Text>
                </View>
              </View>

              {/* Info Block: Chế độ đãi ngộ & JD */}
              <View style={styles.infoSectionCard}>
                <View style={styles.infoSectionHeader}>
                  <Ionicons name="wallet" size={16} color="#7c3aed" />
                  <Text style={styles.infoSectionTitle}>Chế độ đãi ngộ & Tài liệu JD</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Mức lương cơ bản</Text>
                  <Text style={[styles.infoValue, { color: "#7c3aed", fontWeight: "800" }]}>
                    {formatSalary(selected?.monthlySalary)}
                  </Text>
                </View>

                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>Mô tả công việc (JD)</Text>
                  {selected?.jobDescriptionLink ? (
                    <TouchableOpacity
                      onPress={() => void Linking.openURL(selected.jobDescriptionLink!)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: "#2563eb", fontWeight: "700", fontSize: 13 }}>
                        Mở liên kết JD ↗
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.infoValue}>Chưa đính kèm</Text>
                  )}
                </View>
              </View>

              {/* Bottom Action Buttons */}
              {canManageUsers && (
                <TouchableOpacity
                  style={styles.editProfileBtn}
                  onPress={() => {
                    if (selected) {
                      initDraftFromUser(selected);
                      setEditing(true);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="pencil" size={16} color="#ffffff" />
                  <Text style={styles.editProfileBtnText}>Chỉnh sửa thông tin hồ sơ</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={() => setSelected(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.dismissBtnText}>Đóng</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  flatList: {
    flex: 1,
  },
  flatListContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 10,
  },
  headerWrapper: {
    gap: 12,
    marginBottom: 4,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  branchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  branchDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#059669",
  },
  branchName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  orgChartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  orgChartText: {
    color: "#2563eb",
    fontWeight: "700",
    fontSize: 12,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
  },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 1,
  },

  // Search
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 6,
  },

  // Department Chips
  deptChipsRow: {
    flexDirection: "row",
    gap: 7,
    paddingVertical: 2,
  },
  deptChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  deptChipActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  deptChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  deptChipTextActive: {
    color: "#059669",
    fontWeight: "700",
  },

  // Employee Card
  employeeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
    gap: 12,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  leaderBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#f59e0b",
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nameText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flexShrink: 1,
  },
  managerPill: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  managerPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#b45309",
  },
  jobTitleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  deptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  deptText: {
    fontSize: 11,
    color: "#64748b",
  },
  actionShortcuts: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  phoneActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  chevronBox: {
    paddingLeft: 2,
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyDesc: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 18,
  },
  resetFilterBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },

  // Modal Container
  modalContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalScrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },

  // Hero Card in Modal
  profileHeroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
    gap: 6,
  },
  heroAvatarBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    position: "relative",
  },
  heroAvatarText: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "800",
  },
  heroCrownBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#f59e0b",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  heroNameText: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0f172a",
  },
  heroJobTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  heroDeptBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroDeptText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  heroRoleBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroRoleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563eb",
  },
  heroActionRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    width: "100%",
    justifyContent: "center",
  },
  heroActionBtn: {
    alignItems: "center",
    gap: 4,
  },
  heroActionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  heroActionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },

  // Info Sections
  infoSectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  infoSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  infoSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "right",
    maxWidth: "60%",
  },

  // Edit Navigation Tab Bar
  formNavRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 8,
  },
  formNavTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  formNavTabActive: {
    borderBottomColor: "#059669",
  },
  formNavText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  formNavTextActive: {
    color: "#059669",
    fontWeight: "700",
  },

  // Edit Form
  editScrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  editSectionBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  editSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  fieldGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  formInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0f172a",
  },
  miniPickerPill: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  miniPickerPillActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  miniPickerText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  miniPickerTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
  rolePickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rolePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rolePickerBtnActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  rolePickerText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  rolePickerTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
  switchRowCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  switchDesc: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  salaryPreviewText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7c3aed",
    marginTop: 2,
  },
  formBtnRow: {
    gap: 8,
    marginTop: 8,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#059669",
    paddingVertical: 13,
    borderRadius: 12,
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  cancelBtn: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
  },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#059669",
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
  },
  editProfileBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  dismissBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  dismissBtnText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
  },
});
