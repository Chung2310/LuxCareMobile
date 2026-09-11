import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  ROLE_MAP,
  UserCard,
  UserCreateModal,
  UserDetailModal,
  UserStatCards,
} from "../../src/components/users";
import { AppButton, SearchInput, PageLoadingView } from "../../src/components/common";
import {
  userManagementApi,
  type CreateUserInput,
  type UpdateUserInput,
  type UserRole,
  type UserStats,
} from "../../src/api/userManagementApi";
import { supplyApi } from "../../src/api/supplyApi";
import { branches as branchService } from "../../src/api/services";
import { useSession } from "../../src/auth/SessionProvider";
import type { UserProfile } from "../../../src/types/common";
import type { BranchRecord } from "../../../src/services/branchService";

const ROLE_FILTERS: Array<{ id: string; label: string }> = [
  { id: "all", label: "Tất cả vai trò" },
  { id: "admin", label: "Quản trị viên" },
  { id: "branch_owner", label: "Chủ chi nhánh" },
  { id: "manager", label: "Quản lý" },
  { id: "user", label: "Nhân viên" },
];

export default function UsersScreen() {
  const { user: currentUser, selectedBranch } = useSession();

  // Dữ liệu người dùng & thống kê
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    admin: 0,
    branch_owner: 0,
    manager: 0,
    user: 0,
  });

  // Danh sách chi nhánh & phòng ban thực tế từ backend
  const [branchList, setBranchList] = useState<BranchRecord[]>([]);
  const [departmentList, setDepartmentList] = useState<
    Array<{ id: string; name: string; code?: string }>
  >([]);

  // Bộ lọc & tìm kiếm
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  // Trạng thái tải
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailUser, setDetailUser] = useState<UserProfile | null>(null);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showDeptPicker, setShowDeptPicker] = useState(false);

  // Quyền hạn thao tác
  const canManage = useMemo(() => {
    if (!currentUser) return false;
    const r = currentUser.role;
    return r === "admin" || r === "superadmin" || r === "branch_owner" || r === "manager";
  }, [currentUser]);

  // 1. Tải danh mục Chi nhánh & Phòng ban
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [bList, dList] = await Promise.all([
          branchService.list().catch(() => [] as BranchRecord[]),
          supplyApi.getDepartments().catch(() => []),
        ]);
        if (active) {
          setBranchList(bList.filter((b) => b.isActive));
          setDepartmentList(dList);
        }
      } catch {
        if (active) {
          setBranchList([]);
          setDepartmentList([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 2. Tải danh sách người dùng từ MongoDB (/api/v1/auth/users)
  const loadUsers = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const effectiveBranch =
          branchFilter !== "all"
            ? branchFilter
            : selectedBranch?._id || currentUser?.branchId || undefined;

        const data = await userManagementApi.getUsers({
          companyCode: currentUser?.companyCode || undefined,
          branchId: effectiveBranch,
        });

        setUsers(data);
        setStats(userManagementApi.calculateStats(data));
      } catch (err: any) {
        Alert.alert(
          "Lỗi tải dữ liệu",
          err.message || "Không thể tải danh sách người dùng từ hệ thống.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [branchFilter, selectedBranch, currentUser],
  );

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  // 3. Xử lý quay lại
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  // 4. Tạo người dùng mới
  const handleCreateUser = async (data: CreateUserInput) => {
    await userManagementApi.createUser(data);
    Alert.alert("Thành công", `Đã tạo tài khoản cho "${data.displayName}".`);
    await loadUsers(true);
  };

  // 5. Cập nhật thông tin người dùng
  const handleUpdateUser = async (id: string, data: UpdateUserInput) => {
    await userManagementApi.updateUser(id, data);
    setUsers((prev) =>
      prev.map((u) => {
        const uid = (u as any)._id || u.uid;
        if (uid === id) {
          return { ...u, ...data };
        }
        return u;
      }),
    );
    // Cập nhật lại stats
    setStats((prev) => {
      const updatedList = users.map((u) => {
        const uid = (u as any)._id || u.uid;
        if (uid === id) return { ...u, ...data };
        return u;
      });
      return userManagementApi.calculateStats(updatedList);
    });
    // Cập nhật selected user modal nếu đang mở
    if (detailUser && ((detailUser as any)._id === id || detailUser.uid === id)) {
      setDetailUser((prev: UserProfile | null) => (prev ? { ...prev, ...data } : null));
    }
  };

  // 6. Xóa người dùng
  const handleDeleteUser = async (id: string) => {
    await userManagementApi.deleteUser(id);
    setUsers((prev) => {
      const remaining = prev.filter((u) => ((u as any)._id || u.uid) !== id);
      setStats(userManagementApi.calculateStats(remaining));
      return remaining;
    });
    setDetailUser(null);
    Alert.alert("Đã xóa", "Tài khoản người dùng đã được xóa khỏi hệ thống.");
  };

  // 7. Lọc người dùng theo từ khóa, vai trò, chi nhánh, phòng ban
  const filteredUsers = useMemo(() => {
    let result = users;

    // Lọc theo vai trò
    if (roleFilter !== "all") {
      if (roleFilter === "admin") {
        result = result.filter((u) => u.role === "admin" || u.role === "superadmin");
      } else {
        result = result.filter((u) => u.role === roleFilter);
      }
    }

    // Lọc theo chi nhánh
    if (branchFilter !== "all") {
      result = result.filter((u) => u.branchId === branchFilter);
    }

    // Lọc theo phòng ban
    if (departmentFilter !== "all") {
      result = result.filter(
        (u) =>
          u.department?.toLowerCase() === departmentFilter.toLowerCase() ||
          u.departmentId === departmentFilter,
      );
    }

    // Tìm kiếm theo từ khóa
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((u) => {
        const name = (u.displayName || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const phone = (u.phone || "").toLowerCase();
        const job = (u.jobTitle || "").toLowerCase();
        const dept = (u.department || "").toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          job.includes(q) ||
          dept.includes(q)
        );
      });
    }

    return result;
  }, [users, roleFilter, branchFilter, departmentFilter, searchQuery]);

  // Tên chi nhánh hiện tại
  const currentBranchLabel = useMemo(() => {
    if (branchFilter === "all") return "Tất cả chi nhánh";
    const found = branchList.find((b) => b._id === branchFilter);
    return found ? found.name : "Tất cả chi nhánh";
  }, [branchFilter, branchList]);

  // Tên phòng ban hiện tại
  const currentDeptLabel = useMemo(() => {
    if (departmentFilter === "all") return "Tất cả phòng ban";
    return departmentFilter;
  }, [departmentFilter]);

  const hasActiveFilter =
    roleFilter !== "all" ||
    branchFilter !== "all" ||
    departmentFilter !== "all" ||
    searchQuery.trim().length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* 1. Header phân hệ */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          hitSlop={10}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Quản lý người dùng
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Thành viên & phân quyền hệ thống
          </Text>
        </View>

        {canManage && (
          <TouchableOpacity
            style={styles.headerIconBtnAdd}
            onPress={() => setCreateModalVisible(true)}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Ionicons name="person-add" size={17} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Thanh tìm kiếm */}
      <View style={styles.searchContainer}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Tìm theo tên, email, SĐT, chức vụ..."
        />
      </View>

      {/* 3. Thẻ thống kê KPI theo vai trò */}
      <UserStatCards
        stats={stats}
        selectedRole={roleFilter}
        onSelectRole={setRoleFilter}
      />

      {/* 4. Thanh lọc nâng cao: Chi nhánh & Phòng ban */}
      <View style={styles.filterPillBar}>
        {branchList.length > 0 && (
          <TouchableOpacity
            style={[
              styles.filterPill,
              branchFilter !== "all" && styles.filterPillActive,
            ]}
            onPress={() => setShowBranchPicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="business-outline"
              size={13}
              color={branchFilter !== "all" ? "#6366f1" : "#64748b"}
            />
            <Text
              style={[
                styles.filterPillText,
                branchFilter !== "all" && styles.filterPillTextActive,
              ]}
              numberOfLines={1}
            >
              {currentBranchLabel}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={branchFilter !== "all" ? "#6366f1" : "#94a3b8"}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.filterPill,
            departmentFilter !== "all" && styles.filterPillActive,
          ]}
          onPress={() => setShowDeptPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="layers-outline"
            size={13}
            color={departmentFilter !== "all" ? "#6366f1" : "#64748b"}
          />
          <Text
            style={[
              styles.filterPillText,
              departmentFilter !== "all" && styles.filterPillTextActive,
            ]}
            numberOfLines={1}
          >
            {currentDeptLabel}
          </Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color={departmentFilter !== "all" ? "#6366f1" : "#94a3b8"}
          />
        </TouchableOpacity>

        {hasActiveFilter && (
          <TouchableOpacity
            style={styles.resetFilterBtn}
            onPress={() => {
              setRoleFilter("all");
              setBranchFilter("all");
              setDepartmentFilter("all");
              setSearchQuery("");
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={14} color="#dc2626" />
            <Text style={styles.resetFilterText}>Xóa lọc</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 5. Dải Chips vai trò cuộn ngang */}
      <View style={styles.roleChipsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roleChipsScroll}
        >
          {ROLE_FILTERS.map((item) => {
            const isSelected = roleFilter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.roleChip,
                  isSelected && styles.roleChipActive,
                ]}
                onPress={() => setRoleFilter(item.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.roleChipText,
                    isSelected && styles.roleChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 6. Danh sách người dùng */}
      {loading && !refreshing ? (
        <PageLoadingView
          title="Đang tải danh sách thành viên & phân quyền..."
          subtitle="Hệ thống đang kết nối và nạp danh sách nhân sự"
          color="#6366f1"
        />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => (item as any)._id || item.uid || item.email}
          renderItem={({ item }) => (
            <UserCard
              user={item}
              onPress={(u) => setDetailUser(u)}
            />
          )}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadUsers(true)}
              colors={["#6366f1"]}
              tintColor="#6366f1"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={42} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>Không tìm thấy thành viên nào</Text>
              <Text style={styles.emptySubtitle}>
                {hasActiveFilter
                  ? "Không có người dùng nào khớp với bộ lọc hiện tại. Thử xóa hoặc thay đổi tiêu chí tìm kiếm."
                  : "Hệ thống chưa ghi nhận tài khoản nhân sự nào trong cơ sở dữ liệu."}
              </Text>
              {hasActiveFilter ? (
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => {
                    setRoleFilter("all");
                    setBranchFilter("all");
                    setDepartmentFilter("all");
                    setSearchQuery("");
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh-outline" size={16} color="#6366f1" />
                  <Text style={styles.emptyActionBtnText}>Đặt lại bộ lọc</Text>
                </TouchableOpacity>
              ) : canManage ? (
                <TouchableOpacity
                  style={styles.emptyActionBtnPrimary}
                  onPress={() => setCreateModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person-add" size={16} color="#ffffff" />
                  <Text style={styles.emptyActionBtnPrimaryText}>Thêm thành viên mới</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      {/* 7. Modal Tạo người dùng */}
      <UserCreateModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={handleCreateUser}
        branches={branchList}
        departments={departmentList}
        defaultBranchId={selectedBranch?._id || currentUser?.branchId}
        companyCode={currentUser?.companyCode}
        companyName={currentUser?.companyName}
        managers={users}
      />

      {/* 8. Modal Chi tiết & Phân quyền người dùng */}
      <UserDetailModal
        visible={!!detailUser}
        user={detailUser}
        onClose={() => setDetailUser(null)}
        onUpdate={handleUpdateUser}
        onDelete={handleDeleteUser}
        branches={branchList}
        departments={departmentList}
        canManage={canManage}
      />

      {/* 9. Modal chọn Chi nhánh */}
      <Modal
        visible={showBranchPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBranchPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowBranchPicker(false)}
        >
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Chọn chi nhánh</Text>
              <TouchableOpacity
                onPress={() => setShowBranchPicker(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              <TouchableOpacity
                style={[
                  styles.pickerItem,
                  branchFilter === "all" && styles.pickerItemActive,
                ]}
                onPress={() => {
                  setBranchFilter("all");
                  setShowBranchPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    branchFilter === "all" && styles.pickerItemTextActive,
                  ]}
                >
                  Tất cả chi nhánh
                </Text>
                {branchFilter === "all" && (
                  <Ionicons name="checkmark" size={18} color="#6366f1" />
                )}
              </TouchableOpacity>
              {branchList.map((b) => {
                const isSel = branchFilter === b._id;
                return (
                  <TouchableOpacity
                    key={b._id}
                    style={[styles.pickerItem, isSel && styles.pickerItemActive]}
                    onPress={() => {
                      setBranchFilter(b._id);
                      setShowBranchPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        isSel && styles.pickerItemTextActive,
                      ]}
                    >
                      {b.name}
                    </Text>
                    {isSel && (
                      <Ionicons name="checkmark" size={18} color="#6366f1" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 10. Modal chọn Phòng ban */}
      <Modal
        visible={showDeptPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeptPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowDeptPicker(false)}
        >
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Chọn phòng ban / khoa</Text>
              <TouchableOpacity
                onPress={() => setShowDeptPicker(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              <TouchableOpacity
                style={[
                  styles.pickerItem,
                  departmentFilter === "all" && styles.pickerItemActive,
                ]}
                onPress={() => {
                  setDepartmentFilter("all");
                  setShowDeptPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    departmentFilter === "all" && styles.pickerItemTextActive,
                  ]}
                >
                  Tất cả phòng ban
                </Text>
                {departmentFilter === "all" && (
                  <Ionicons name="checkmark" size={18} color="#6366f1" />
                )}
              </TouchableOpacity>
              {departmentList.map((d) => {
                const isSel = departmentFilter === d.name;
                return (
                  <TouchableOpacity
                    key={d.id || d.name}
                    style={[styles.pickerItem, isSel && styles.pickerItemActive]}
                    onPress={() => {
                      setDepartmentFilter(d.name);
                      setShowDeptPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        isSel && styles.pickerItemTextActive,
                      ]}
                    >
                      {d.name} {d.code ? `(${d.code})` : ""}
                    </Text>
                    {isSel && (
                      <Ionicons name="checkmark" size={18} color="#6366f1" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  headerIconBtnAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: "#f8fafc",
  },
  filterPillBar: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    maxWidth: 160,
  },
  filterPillActive: {
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
  },
  filterPillText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },
  filterPillTextActive: {
    color: "#4f46e5",
    fontWeight: "600",
  },
  resetFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  resetFilterText: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "500",
  },
  roleChipsRow: {
    paddingBottom: 8,
  },
  roleChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  roleChipActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748b",
  },
  roleChipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4f46e5",
  },
  emptyActionBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#4f46e5",
  },
  emptyActionBtnPrimaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  pickerCard: {
    width: "100%",
    maxHeight: 380,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  pickerList: {
    marginTop: 8,
  },
  pickerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  pickerItemActive: {
    backgroundColor: "#eef2ff",
    borderRadius: 8,
  },
  pickerItemText: {
    fontSize: 14,
    color: "#334155",
  },
  pickerItemTextActive: {
    color: "#4f46e5",
    fontWeight: "600",
  },
});
