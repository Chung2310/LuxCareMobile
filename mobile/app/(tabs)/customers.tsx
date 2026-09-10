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
  CustomerCard,
  CustomerCreateModal,
  CustomerDetailModal,
  CustomerQrModal,
  CustomerStatCards,
  SOURCE_LABELS,
  STATUS_MAP,
} from "../../src/components/customers";
import { SearchInput, AppButton, PageLoadingView } from "../../src/components/common";
import {
  customerLeadApi,
  type CreateCustomerLeadInput,
  type CustomerLeadItem,
  type CustomerLeadStats,
  type CustomerLeadStatus,
  type UpdateCustomerLeadInput,
} from "../../src/api/customerLeadApi";
import { branches as branchService } from "../../src/api/services";
import { useSession } from "../../src/auth/SessionProvider";
import type { BranchRecord } from "../../../../src/services/branchService";

const STATUS_FILTERS: Array<{ id: string; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "new", label: "Mới tiếp nhận" },
  { id: "contacted", label: "Đã liên hệ" },
  { id: "in_consultation", label: "Đang tư vấn" },
  { id: "converted", label: "Thành công" },
  { id: "cancelled", label: "Đã hủy" },
];

const SOURCE_FILTERS: Array<{ id: string; label: string }> = [
  { id: "all", label: "Tất cả nguồn" },
  { id: "qr_code", label: "Mã QR" },
  { id: "manual", label: "Thủ công tại quầy" },
  { id: "referral", label: "Người quen giới thiệu" },
  { id: "website", label: "Website doanh nghiệp" },
];

export default function CustomersScreen() {
  const { user, selectedBranch } = useSession();

  // Dữ liệu khách hàng & thống kê
  const [leads, setLeads] = useState<CustomerLeadItem[]>([]);
  const [stats, setStats] = useState<CustomerLeadStats>({
    total: 0,
    todayNew: 0,
    new: 0,
    contacted: 0,
    in_consultation: 0,
    converted: 0,
    cancelled: 0,
  });

  // Danh sách chi nhánh
  const [branchList, setBranchList] = useState<BranchRecord[]>([]);

  // Bộ lọc & tìm kiếm
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  // Trạng thái tải
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailLead, setDetailLead] = useState<CustomerLeadItem | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  // Load danh sách chi nhánh
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const list = await branchService.list();
        if (active) {
          setBranchList(list.filter((b) => b.isActive));
        }
      } catch {
        if (active) setBranchList([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Tải danh sách khách hàng & thống kê
  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const effectiveBranch =
          branchFilter !== "all"
            ? branchFilter
            : selectedBranch?._id || user?.branchId || undefined;

        const [leadRes, statRes] = await Promise.all([
          customerLeadApi.getLeads({
            search: searchQuery.trim() || undefined,
            status:
              statusFilter === "today"
                ? undefined
                : statusFilter !== "all"
                ? statusFilter
                : undefined,
            branchId: effectiveBranch,
            source: sourceFilter !== "all" ? sourceFilter : undefined,
            limit: 100,
          }),
          customerLeadApi.getStats(effectiveBranch),
        ]);

        let loadedLeads = leadRes.leads;

        // Nếu người dùng chọn filter "today", lọc khách hàng tạo trong ngày hôm nay
        if (statusFilter === "today") {
          const today = new Date().toDateString();
          loadedLeads = loadedLeads.filter(
            (l) => new Date(l.createdAt).toDateString() === today,
          );
        }

        setLeads(loadedLeads);
        setStats(statRes);
      } catch (err: any) {
        Alert.alert("Lỗi tải dữ liệu", err.message || "Không thể tải danh sách khách hàng.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchQuery, statusFilter, branchFilter, sourceFilter, selectedBranch, user],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Điều hướng quay lại
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  // Tạo mới khách hàng
  const handleCreateLead = async (data: CreateCustomerLeadInput) => {
    const created = await customerLeadApi.createLead(data);
    Alert.alert("Thành công", `Đã tiếp nhận khách hàng "${created.fullName}".`);
    await loadData(true);
  };

  // Cập nhật thông tin / chăm sóc khách hàng
  const handleUpdateLead = async (
    id: string,
    data: UpdateCustomerLeadInput,
  ): Promise<CustomerLeadItem> => {
    const updated = await customerLeadApi.updateLead(id, data);
    setLeads((prev) => prev.map((l) => (l._id === id ? updated : l)));
    // Làm mới thống kê
    void (async () => {
      try {
        const effectiveBranch =
          branchFilter !== "all"
            ? branchFilter
            : selectedBranch?._id || user?.branchId || undefined;
        const newStats = await customerLeadApi.getStats(effectiveBranch);
        setStats(newStats);
      } catch {}
    })();
    return updated;
  };

  // Xóa khách hàng
  const handleDeleteLead = async (id: string) => {
    await customerLeadApi.deleteLead(id);
    setLeads((prev) => prev.filter((l) => l._id !== id));
    Alert.alert("Đã xóa", "Thông tin khách hàng đã được đưa vào lưu trữ.");
    void (async () => {
      try {
        const effectiveBranch =
          branchFilter !== "all"
            ? branchFilter
            : selectedBranch?._id || user?.branchId || undefined;
        const newStats = await customerLeadApi.getStats(effectiveBranch);
        setStats(newStats);
      } catch {}
    })();
  };

  // Chi nhánh hiển thị hiện tại
  const currentBranchLabel = useMemo(() => {
    if (branchFilter === "all") return "Tất cả chi nhánh";
    const found = branchList.find((b) => b._id === branchFilter);
    return found ? found.name : "Tất cả chi nhánh";
  }, [branchFilter, branchList]);

  // Nguồn hiển thị hiện tại
  const currentSourceLabel = useMemo(() => {
    if (sourceFilter === "all") return "Tất cả nguồn";
    return SOURCE_LABELS[sourceFilter] || sourceFilter;
  }, [sourceFilter]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* 1. Header phân hệ */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Khách hàng & Tiếp nhận
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Quản lý Lead, tư vấn & chăm sóc
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          {/* Nút mở mã QR quầy tiếp nhận */}
          <TouchableOpacity
            style={styles.headerIconBtnQr}
            onPress={() => setQrModalVisible(true)}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Ionicons name="qr-code-outline" size={19} color="#059669" />
          </TouchableOpacity>

          {/* Nút thêm mới khách hàng */}
          <TouchableOpacity
            style={styles.headerIconBtnAdd}
            onPress={() => setCreateModalVisible(true)}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Ionicons name="person-add" size={17} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Thanh tìm kiếm */}
      <View style={styles.searchContainer}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Tìm theo tên, SĐT, dịch vụ quan tâm..."
        />
      </View>

      {/* 3. Thẻ thống kê KPI khách hàng */}
      <CustomerStatCards
        stats={stats}
        selectedStatus={statusFilter}
        onSelectStatus={setStatusFilter}
      />

      {/* 4. Thanh chọn nhanh Chi nhánh & Nguồn */}
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
              color={branchFilter !== "all" ? "#059669" : "#64748b"}
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
              color={branchFilter !== "all" ? "#059669" : "#94a3b8"}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.filterPill,
            sourceFilter !== "all" && styles.filterPillActive,
          ]}
          onPress={() => setShowSourcePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="globe-outline"
            size={13}
            color={sourceFilter !== "all" ? "#059669" : "#64748b"}
          />
          <Text
            style={[
              styles.filterPillText,
              sourceFilter !== "all" && styles.filterPillTextActive,
            ]}
            numberOfLines={1}
          >
            {currentSourceLabel}
          </Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color={sourceFilter !== "all" ? "#059669" : "#94a3b8"}
          />
        </TouchableOpacity>

        {(statusFilter !== "all" ||
          branchFilter !== "all" ||
          sourceFilter !== "all" ||
          searchQuery.trim().length > 0) && (
          <TouchableOpacity
            style={styles.resetFilterBtn}
            onPress={() => {
              setStatusFilter("all");
              setBranchFilter("all");
              setSourceFilter("all");
              setSearchQuery("");
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={14} color="#dc2626" />
            <Text style={styles.resetFilterText}>Xóa lọc</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 5. Bộ lọc trạng thái dạng Chips */}
      <View style={styles.statusChipsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusChipsScroll}
        >
          {STATUS_FILTERS.map((item) => {
            const isSelected = statusFilter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.statusFilterChip,
                  isSelected && styles.statusFilterChipActive,
                ]}
                onPress={() => setStatusFilter(item.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.statusFilterChipText,
                    isSelected && styles.statusFilterChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 6. Danh sách khách hàng */}
      <FlatList
        data={leads}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <CustomerCard lead={item} onPress={setDetailLead} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            colors={["#059669"]}
            tintColor="#059669"
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeaderInfo}>
            <Text style={styles.listHeaderText}>
              Danh sách ({leads.length} khách hàng)
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <PageLoadingView
              title="Đang tải danh sách khách hàng & Leads..."
              subtitle="Hệ thống đang kết nối và nạp dữ liệu từ máy chủ"
              color="#059669"
            />
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={40} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có khách hàng nào</Text>
              <Text style={styles.emptyDesc}>
                {searchQuery || statusFilter !== "all" || sourceFilter !== "all"
                  ? "Không tìm thấy khách hàng phù hợp với điều kiện tìm kiếm và bộ lọc hiện tại."
                  : "Chưa có thông tin khách hàng nào. Chạm vào nút bên dưới để thêm mới hoặc quét mã QR tiếp nhận."}
              </Text>
              <View style={styles.emptyActions}>
                <AppButton
                  title="+ Thêm khách hàng"
                  variant="primary"
                  size="sm"
                  onPress={() => setCreateModalVisible(true)}
                />
                <AppButton
                  title="Mã QR tiếp nhận"
                  variant="outline"
                  size="sm"
                  icon="qr-code-outline"
                  onPress={() => setQrModalVisible(true)}
                />
              </View>
            </View>
          )
        }
      />

      {/* 7. Modal Thêm mới Khách hàng */}
      <CustomerCreateModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={handleCreateLead}
        branches={branchList}
        defaultBranchId={selectedBranch?._id || user?.branchId || undefined}
      />

      {/* 8. Modal Chi tiết & Chăm sóc Khách hàng */}
      <CustomerDetailModal
        visible={!!detailLead}
        lead={detailLead}
        onClose={() => setDetailLead(null)}
        onUpdate={handleUpdateLead}
        onDelete={handleDeleteLead}
      />

      {/* 9. Modal Mã QR Biểu mẫu Tiếp nhận */}
      <CustomerQrModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        companyCode={user?.companyCode || "LUXCARE"}
        branches={branchList}
        currentBranch={selectedBranch}
      />

      {/* Modal Picker: Chọn chi nhánh lọc */}
      <Modal
        visible={showBranchPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBranchPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerBackdrop}
          activeOpacity={1}
          onPress={() => setShowBranchPicker(false)}
        >
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Lọc theo chi nhánh</Text>
            <ScrollView style={{ maxHeight: 300 }}>
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
                  <Ionicons name="checkmark" size={18} color="#059669" />
                )}
              </TouchableOpacity>
              {branchList.map((b) => (
                <TouchableOpacity
                  key={b._id}
                  style={[
                    styles.pickerItem,
                    branchFilter === b._id && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    setBranchFilter(b._id);
                    setShowBranchPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      branchFilter === b._id && styles.pickerItemTextActive,
                    ]}
                  >
                    {b.name}
                  </Text>
                  {branchFilter === b._id && (
                    <Ionicons name="checkmark" size={18} color="#059669" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Picker: Chọn nguồn lọc */}
      <Modal
        visible={showSourcePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSourcePicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerBackdrop}
          activeOpacity={1}
          onPress={() => setShowSourcePicker(false)}
        >
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Lọc theo nguồn khách hàng</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {SOURCE_FILTERS.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.pickerItem,
                    sourceFilter === s.id && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    setSourceFilter(s.id);
                    setShowSourcePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      sourceFilter === s.id && styles.pickerItemTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                  {sourceFilter === s.id && (
                    <Ionicons name="checkmark" size={18} color="#059669" />
                  )}
                </TouchableOpacity>
              ))}
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
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
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
    fontSize: 11.5,
    color: "#64748b",
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtnQr: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconBtnAdd: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: "#ffffff",
  },
  filterPillBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    backgroundColor: "#ffffff",
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
    maxWidth: 160,
  },
  filterPillActive: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  filterPillText: {
    fontSize: 11.5,
    color: "#475569",
    fontWeight: "500",
  },
  filterPillTextActive: {
    color: "#059669",
    fontWeight: "600",
  },
  resetFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  resetFilterText: {
    fontSize: 11,
    color: "#dc2626",
    fontWeight: "600",
  },
  statusChipsRow: {
    backgroundColor: "#ffffff",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  statusChipsScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  statusFilterChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statusFilterChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  statusFilterChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#475569",
  },
  statusFilterChipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  listHeaderInfo: {
    marginBottom: 8,
  },
  listHeaderText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#64748b",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
  },
  emptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 12.5,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyActions: {
    flexDirection: "row",
    gap: 10,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pickerItemActive: {
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
  },
  pickerItemText: {
    fontSize: 13.5,
    color: "#334155",
  },
  pickerItemTextActive: {
    color: "#059669",
    fontWeight: "600",
  },
});
