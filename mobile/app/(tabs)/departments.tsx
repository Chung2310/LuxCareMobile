import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import {
  DepartmentCard,
  DepartmentCreateModal,
  DepartmentDetailModal,
  DepartmentLegacyModal,
  DepartmentStatCards,
  RoomCard,
  RoomModal,
  type DepartmentFilterMode,
  type DepartmentInput,
  type DepartmentRecord,
  type DepartmentStatMetrics,
  type DepartmentTabType,
  type RoomInput,
  type RoomRecord,
} from "../../src/components/departments";
import { PageLoadingView, SearchInput } from "../../src/components/common";
import {
  branches as branchService,
  departments as deptService,
  rooms as roomService,
  roster,
} from "../../src/api/services";
import { useSession } from "../../src/auth/SessionProvider";
import { useAppLoading } from "../../src/context/LoadingContext";
import type { UserProfile } from "../../../src/types/common";
import type { BranchRecord } from "../../../src/services/branchService";

const ROOM_TYPE_FILTER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "all", label: "Tất cả loại" },
  { id: "clinic", label: "Phòng khám" },
  { id: "treatment", label: "Thủ thuật / Đ.trị" },
  { id: "storage", label: "Kho vật tư / Dược" },
  { id: "office", label: "Văn phòng" },
  { id: "meeting", label: "Phòng họp" },
  { id: "other", label: "Khác" },
];

export default function DepartmentsScreen() {
  const { user, selectedBranch } = useSession();
  const params = useLocalSearchParams<{ from?: string }>();
  const { navigateWithLoading } = useAppLoading();

  // Quyền quản lý (admin, superadmin, branch_owner, manager)
  const canManage = useMemo(() => {
    if (!user) return false;
    const r = user.role;
    return r === "admin" || r === "superadmin" || r === "branch_owner" || r === "manager";
  }, [user]);

  // Tab: "departments" (Phòng ban) | "rooms" (Phòng chức năng)
  const [activeTab, setActiveTab] = useState<DepartmentTabType>("departments");

  // Dữ liệu Phòng ban
  const [deptList, setDeptList] = useState<DepartmentRecord[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptSearch, setDeptSearch] = useState("");
  const [filterMode, setFilterMode] = useState<DepartmentFilterMode>("all");

  // Dữ liệu Phòng chức năng
  const [roomList, setRoomList] = useState<RoomRecord[]>([]);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomSearch, setRoomSearch] = useState("");
  const [selectedRoomType, setSelectedRoomType] = useState<string>("all");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // Chi nhánh & Nhân sự phụ trách
  const [branchList, setBranchList] = useState<BranchRecord[]>([]);
  const [colleagues, setColleagues] = useState<UserProfile[]>([]);

  // Modals Phòng ban
  const [detailDept, setDetailDept] = useState<DepartmentRecord | null>(null);
  const [createDeptVisible, setCreateDeptVisible] = useState(false);
  const [legacyModalVisible, setLegacyModalVisible] = useState(false);

  // Modals Phòng chức năng
  const [editingRoom, setEditingRoom] = useState<RoomRecord | "new" | null>(null);

  // Trạng thái làm mới
  const [refreshing, setRefreshing] = useState(false);

  // 1. Tải danh sách Chi nhánh & Nhân sự (Trưởng bộ phận)
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [bList, cList] = await Promise.all([
          branchService.list().catch(() => [] as BranchRecord[]),
          roster.colleagues().catch(() => [] as UserProfile[]),
        ]);
        if (active) {
          const activeBranches = bList.filter((b) => b.isActive);
          setBranchList(activeBranches);
          setColleagues(cList);

          const defaultBranch =
            selectedBranch?._id ||
            user?.branchId ||
            (activeBranches.length > 0 ? activeBranches[0]._id : "");
          setSelectedBranchId(defaultBranch);
        }
      } catch {
        if (active) {
          setBranchList([]);
          setColleagues([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedBranch, user]);

  // 2. Tải danh sách Phòng ban
  const loadDepartments = useCallback(async (isSilent = false) => {
    if (!isSilent) setDeptLoading(true);
    try {
      const data = await deptService.list();
      setDeptList(data || []);
    } catch (err: any) {
      Alert.alert("Lỗi tải phòng ban", err.message || "Không thể tải danh sách phòng ban.");
    } finally {
      setDeptLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 3. Tải danh sách Phòng chức năng
  const loadRooms = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setRoomLoading(true);
      try {
        const data = await roomService.list({
          branchId: selectedBranchId || undefined,
        });
        setRoomList(data || []);
      } catch (err: any) {
        Alert.alert("Lỗi tải phòng chức năng", err.message || "Không thể tải danh sách phòng.");
      } finally {
        setRoomLoading(false);
        setRefreshing(false);
      }
    },
    [selectedBranchId],
  );

  // Focus effect: nạp dữ liệu ban đầu
  useFocusEffect(
    useCallback(() => {
      void loadDepartments(deptList.length > 0);
      void loadRooms(roomList.length > 0);
    }, [loadDepartments, loadRooms]),
  );

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === "departments") {
      await loadDepartments(true);
    } else {
      await loadRooms(true);
    }
  };

  // Thống kê phòng ban
  const deptMetrics: DepartmentStatMetrics = useMemo(() => {
    const total = deptList.length;
    const active = deptList.filter((d) => d.isActive).length;
    const inactive = total - active;
    const totalStaff = deptList.reduce((acc, curr) => acc + (curr.employeeCount || 0), 0);
    return { total, active, inactive, totalStaff };
  }, [deptList]);

  // Lọc phòng ban theo tìm kiếm & trạng thái
  const filteredDepartments = useMemo(() => {
    const q = deptSearch.toLowerCase().trim();
    return deptList.filter((item) => {
      if (filterMode === "active" && !item.isActive) return false;
      if (filterMode === "inactive" && item.isActive) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q) ||
        (item.managerName || "").toLowerCase().includes(q)
      );
    });
  }, [deptList, deptSearch, filterMode]);

  // Lọc phòng chức năng theo tìm kiếm, chi nhánh & loại phòng
  const filteredRooms = useMemo(() => {
    const q = roomSearch.toLowerCase().trim();
    return roomList.filter((item) => {
      if (selectedBranchId && item.branchId && item.branchId !== selectedBranchId) {
        return false;
      }
      if (selectedRoomType !== "all" && (item.type || "other") !== selectedRoomType) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q) ||
        (item.floor || "").toLowerCase().includes(q)
      );
    });
  }, [roomList, roomSearch, selectedBranchId, selectedRoomType]);

  // CRUD Phòng ban
  const handleSaveDepartment = async (id: string, input: Partial<DepartmentInput>) => {
    await deptService.update(id, input);
    await loadDepartments(true);
  };

  const handleCreateDepartment = async (input: DepartmentInput) => {
    await deptService.create(input);
    await loadDepartments(true);
  };

  const handleDeleteDepartment = async (id: string) => {
    await deptService.delete(id);
    await loadDepartments(true);
  };

  // CRUD Phòng chức năng
  const handleSaveRoom = async (id: string | null, input: RoomInput) => {
    if (id) {
      await roomService.update(id, input);
    } else {
      await roomService.create(input);
    }
    await loadRooms(true);
  };

  const handleDeleteRoom = async (id: string) => {
    await roomService.delete(id);
    await loadRooms(true);
  };

  // Điều hướng sơ đồ tổ chức
  const handleViewOrgChart = (dept?: DepartmentRecord) => {
    navigateWithLoading("/(tabs)/org-chart", {
      title: dept ? `Sơ đồ: ${dept.name}` : "Sơ đồ tổ chức",
      icon: "git-network",
      color: "#059669",
      bgColor: "#ecfdf5",
    });
  };

  const isInitialLoading = activeTab === "departments" ? deptLoading && deptList.length === 0 : roomLoading && roomList.length === 0;

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* 1. TOP HEADER BAR */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (params.from === "modules") router.replace("/(tabs)/modules");
            else if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/modules");
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.headerLeft}>
          <Text style={styles.screenTitle}>Phòng ban & Cơ sở</Text>
          <Text style={styles.screenSubtitle}>
            Cơ cấu tổ chức & quản lý phòng chức năng
          </Text>
        </View>

        <View style={styles.headerRightButtons}>
          {/* Nút Sơ đồ tổ chức */}
          <TouchableOpacity
            style={styles.orgChartBtn}
            onPress={() => handleViewOrgChart()}
            activeOpacity={0.75}
          >
            <Ionicons name="git-network-outline" size={15} color="#059669" />
            <Text style={styles.orgChartBtnText}>Sơ đồ</Text>
          </TouchableOpacity>

          {/* Nút Thêm mới */}
          {canManage && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => {
                if (activeTab === "departments") {
                  setCreateDeptVisible(true);
                } else {
                  setEditingRoom("new");
                }
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="add" size={16} color="#ffffff" />
              <Text style={styles.addBtnText}>Thêm</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. SUB-TAB SEGMENT SWITCHER */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "departments" && styles.tabButtonActive]}
          onPress={() => setActiveTab("departments")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="business"
            size={16}
            color={activeTab === "departments" ? "#059669" : "#64748b"}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "departments" && styles.tabButtonTextActive,
            ]}
          >
            Phòng ban ({deptList.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === "rooms" && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab("rooms");
            if (roomList.length === 0) void loadRooms();
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="grid"
            size={16}
            color={activeTab === "rooms" ? "#059669" : "#64748b"}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "rooms" && styles.tabButtonTextActive,
            ]}
          >
            Phòng chức năng ({roomList.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. MAIN CONTENT: FLATLIST CHO PHÒNG BAN HOẶC PHÒNG CHỨC NĂNG */}
      {isInitialLoading ? (
        <PageLoadingView
          title={
            activeTab === "departments"
              ? "Đang tải danh sách phòng ban..."
              : "Đang tải danh sách phòng chức năng..."
          }
        />
      ) : activeTab === "departments" ? (
        <FlatList
          style={styles.flatList}
          contentContainerStyle={styles.listContent}
          data={filteredDepartments}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#059669"]}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.listHeaderSection}>
              {/* Thẻ thống kê nhanh */}
              <DepartmentStatCards
                metrics={deptMetrics}
                filterMode={filterMode}
                onSelectFilter={setFilterMode}
              />

              {/* Ô tìm kiếm phòng ban */}
              <View style={styles.searchSection}>
                <SearchInput
                  value={deptSearch}
                  onChangeText={setDeptSearch}
                  placeholder="Tìm theo mã, tên, chức năng phòng ban..."
                  onClear={() => setDeptSearch("")}
                />
              </View>

              {/* Nút Chuẩn hóa tên phòng ban cũ */}
              {canManage && (
                <TouchableOpacity
                  style={styles.legacyMergeBar}
                  onPress={() => setLegacyModalVisible(true)}
                  activeOpacity={0.75}
                >
                  <View style={styles.legacyMergeLeft}>
                    <Ionicons name="git-merge" size={16} color="#0d9488" />
                    <Text style={styles.legacyMergeText}>
                      Chuẩn hóa các tên phòng ban cũ trong hệ thống
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#0d9488" />
                </TouchableOpacity>
              )}

              {/* Header đếm số lượng */}
              <View style={styles.countSummaryRow}>
                <Text style={styles.countSummaryText}>
                  Hiển thị{" "}
                  <Text style={styles.countBold}>{filteredDepartments.length}</Text> phòng ban
                </Text>
                {deptSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setDeptSearch("")}>
                    <Text style={styles.resetFilterText}>Xóa lọc tìm kiếm</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <DepartmentCard
              department={item}
              onPress={(dept) => setDetailDept(dept)}
              onViewOrgChart={handleViewOrgChart}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="business-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Không tìm thấy phòng ban nào</Text>
              <Text style={styles.emptySubtitle}>
                {deptSearch
                  ? `Không có kết quả nào khớp với "${deptSearch}". Hãy thử từ khóa khác.`
                  : "Chưa có phòng ban nào trong danh mục hoặc trạng thái đã chọn."}
              </Text>
              {(deptSearch.length > 0 || filterMode !== "all") && (
                <TouchableOpacity
                  style={styles.emptyResetBtn}
                  onPress={() => {
                    setDeptSearch("");
                    setFilterMode("all");
                  }}
                >
                  <Text style={styles.emptyResetBtnText}>Xóa bộ lọc</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={<View style={{ height: 30 }} />}
        />
      ) : (
        /* ROOMS LIST */
        <FlatList
          style={styles.flatList}
          contentContainerStyle={styles.listContent}
          data={filteredRooms}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#059669"]}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.listHeaderSection}>
              {/* Lọc theo Chi nhánh nếu có nhiều cơ sở */}
              {branchList.length > 1 && (
                <View style={styles.branchFilterBox}>
                  <Text style={styles.branchFilterLabel}>Lọc theo cơ sở / chi nhánh:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.branchFilterScroll}
                  >
                    <TouchableOpacity
                      style={[
                        styles.branchPill,
                        !selectedBranchId && styles.branchPillActive,
                      ]}
                      onPress={() => setSelectedBranchId("")}
                    >
                      <Text
                        style={[
                          styles.branchPillText,
                          !selectedBranchId && styles.branchPillTextActive,
                        ]}
                      >
                        Tất cả ({branchList.length})
                      </Text>
                    </TouchableOpacity>

                    {branchList.map((b) => (
                      <TouchableOpacity
                        key={b._id}
                        style={[
                          styles.branchPill,
                          selectedBranchId === b._id && styles.branchPillActive,
                        ]}
                        onPress={() => setSelectedBranchId(b._id)}
                      >
                        <Text
                          style={[
                            styles.branchPillText,
                            selectedBranchId === b._id && styles.branchPillTextActive,
                          ]}
                        >
                          {b.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Lọc theo Loại phòng chức năng */}
              <View style={styles.roomTypeFilterBox}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.roomTypeFilterScroll}
                >
                  {ROOM_TYPE_FILTER_OPTIONS.map((opt) => {
                    const isSelected = selectedRoomType === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.roomTypePill,
                          isSelected && styles.roomTypePillActive,
                        ]}
                        onPress={() => setSelectedRoomType(opt.id)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.roomTypePillText,
                            isSelected && styles.roomTypePillTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Ô tìm kiếm phòng chức năng */}
              <View style={styles.searchSection}>
                <SearchInput
                  value={roomSearch}
                  onChangeText={setRoomSearch}
                  placeholder="Tìm phòng khám, phòng phẫu thuật, kho..."
                  onClear={() => setRoomSearch("")}
                />
              </View>

              {/* Header đếm số lượng */}
              <View style={styles.countSummaryRow}>
                <Text style={styles.countSummaryText}>
                  Hiển thị <Text style={styles.countBold}>{filteredRooms.length}</Text> phòng chức năng
                </Text>
                {(roomSearch.length > 0 || selectedRoomType !== "all") && (
                  <TouchableOpacity
                    onPress={() => {
                      setRoomSearch("");
                      setSelectedRoomType("all");
                    }}
                  >
                    <Text style={styles.resetFilterText}>Xóa bộ lọc</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <RoomCard room={item} onPress={(room) => setEditingRoom(room)} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="grid-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Chưa có phòng chức năng nào</Text>
              <Text style={styles.emptySubtitle}>
                {roomSearch || selectedRoomType !== "all"
                  ? `Không tìm thấy phòng nào khớp với bộ lọc đã chọn.`
                  : "Chưa cấu hình phòng chức năng cho cơ sở này."}
              </Text>
              {(roomSearch.length > 0 || selectedRoomType !== "all") && (
                <TouchableOpacity
                  style={[styles.emptyResetBtn, { marginBottom: 12 }]}
                  onPress={() => {
                    setRoomSearch("");
                    setSelectedRoomType("all");
                  }}
                >
                  <Text style={styles.emptyResetBtnText}>Xóa bộ lọc</Text>
                </TouchableOpacity>
              )}
              {canManage && (
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={() => setEditingRoom("new")}
                >
                  <Text style={styles.emptyAddBtnText}>+ Thêm phòng chức năng</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={<View style={{ height: 30 }} />}
        />
      )}

      {/* 4. MODALS */}
      {/* Modal Chi tiết & Chỉnh sửa phòng ban */}
      <DepartmentDetailModal
        visible={Boolean(detailDept)}
        department={detailDept}
        colleagues={colleagues}
        canManage={canManage}
        onClose={() => setDetailDept(null)}
        onSave={handleSaveDepartment}
        onDelete={handleDeleteDepartment}
        onViewOrgChart={handleViewOrgChart}
      />

      {/* Modal Thêm mới phòng ban */}
      <DepartmentCreateModal
        visible={createDeptVisible}
        colleagues={colleagues}
        onClose={() => setCreateDeptVisible(false)}
        onCreate={handleCreateDepartment}
      />

      {/* Modal Chuẩn hóa tên phòng ban cũ */}
      <DepartmentLegacyModal
        visible={legacyModalVisible}
        departmentList={deptList}
        onClose={() => setLegacyModalVisible(false)}
        onMergedSuccess={() => void loadDepartments(true)}
      />

      {/* Modal Tạo/Sửa Phòng chức năng */}
      <RoomModal
        visible={Boolean(editingRoom)}
        editingRoom={editingRoom}
        branchList={branchList}
        currentBranchId={selectedBranchId || branchList[0]?._id || ""}
        canManage={canManage}
        onClose={() => setEditingRoom(null)}
        onSave={handleSaveRoom}
        onDelete={handleDeleteRoom}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerLeft: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 11.5,
    color: "#64748b",
    marginTop: 1,
  },
  headerRightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orgChartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  orgChartBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
  },
  tabButtonActive: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  tabButtonText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#64748b",
  },
  tabButtonTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
  flatList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listHeaderSection: {
    marginBottom: 8,
  },
  searchSection: {
    marginBottom: 10,
  },
  legacyMergeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f0fdfa",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ccfbf1",
    marginBottom: 10,
  },
  legacyMergeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  legacyMergeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f766e",
  },
  countSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  countSummaryText: {
    fontSize: 12,
    color: "#64748b",
  },
  countBold: {
    fontWeight: "700",
    color: "#0f172a",
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },
  branchFilterBox: {
    marginBottom: 10,
  },
  branchFilterLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 6,
  },
  branchFilterScroll: {
    flexDirection: "row",
  },
  branchPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 8,
  },
  branchPillActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  branchPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  branchPillTextActive: {
    color: "#ffffff",
  },
  roomTypeFilterBox: {
    marginBottom: 10,
  },
  roomTypeFilterScroll: {
    flexDirection: "row",
  },
  roomTypePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 6,
  },
  roomTypePillActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  roomTypePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  roomTypePillTextActive: {
    color: "#ffffff",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
    maxWidth: 260,
  },
  emptyResetBtn: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  emptyResetBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#059669",
  },
  emptyAddBtn: {
    backgroundColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  emptyAddBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#ffffff",
  },
});
