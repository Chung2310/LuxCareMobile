import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Building2,
  MapPin,
  Plus,
  X,
  Phone,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Edit3,
  Power,
  Globe,
  RotateCw,
  Search,
  Check,
  Briefcase,
  User,
  Calendar,
  Lock,
  Mail,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import * as Location from "expo-location";
import { randomUUID } from "expo-crypto";
import type { BranchOwnerInput, BranchRecord } from "../../../../src/services/branchService";
import { branches } from "../../api/services";
import { messageOf, useSession } from "../../auth/SessionProvider";
import { useAppAlert } from "../../components/AppAlert";
import { DatePickerField } from "../../components/common/DatePickerField";
import { completeBranchCreation } from "./creation";
import {
  attendanceNetwork,
  branchDraft,
  branchPayload,
  canCreateBranch,
  canEditBranch,
  canReadBranches,
  generateBranchCode,
  newLocation,
  type LocationDraft,
} from "./model";

export function BranchManagement() {
  const insets = useSafeAreaInsets();
  const { user, selectedBranch, selectBranch } = useSession();
  const { showAlert, alertView } = useAppAlert();

  const [items, setItems] = useState<BranchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<BranchRecord | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  const lock = useRef(false);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const allowed = canReadBranches(user);

  const loadData = useCallback(async (isSilent = false) => {
    if (!allowed || editing) {
      setLoading(false);
      return;
    }
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const data = await branches.list();
      if (live.current) {
        setItems(data.filter((branch) => branch.companyCode === user?.companyCode));
      }
    } catch (err) {
      if (live.current) setError(messageOf(err));
    } finally {
      if (live.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [allowed, user?.companyCode, editing]);

  useFocusEffect(
    useCallback(() => {
      void loadData(items.length > 0);
    }, [loadData, revision]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
  };

  const updated = (branch: BranchRecord) => {
    if (!live.current) return;
    if (selectedBranch?._id === branch._id) {
      selectBranch(branch.isActive ? branch : null);
    }
    setItems((current) => [branch, ...current.filter((item) => item._id !== branch._id)]);
    setRevision((value) => value + 1);
  };

  const toggleStatus = (branch: BranchRecord) => {
    if (!canEditBranch(user, branch) || lock.current) return;
    showAlert(
      branch.isActive ? "Ngừng hoạt động chi nhánh?" : "Kích hoạt chi nhánh?",
      `Bạn có chắc chắn muốn ${branch.isActive ? "tạm ngừng hoạt động" : "kích hoạt lại"} chi nhánh "${branch.name}"?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: branch.isActive ? "Ngừng hoạt động" : "Kích hoạt",
          style: branch.isActive ? "destructive" : "default",
          onPress: () => {
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            void branches
              .update(branch._id, { isActive: !branch.isActive })
              .then(updated)
              .catch((err) => setError(messageOf(err)))
              .finally(() => {
                lock.current = false;
                setBusy(false);
              });
          },
        },
      ],
      branch.isActive ? "error" : "info",
    );
  };

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((b) => b.isActive).length;
    const inactive = total - active;
    const totalLocations = items.reduce((acc, curr) => {
      const locations = branchDraft(curr).locations;
      return acc + locations.filter((l) => l.isActive).length;
    }, 0);
    return { total, active, inactive, totalLocations };
  }, [items]);

  // Lọc dữ liệu
  const needle = query.trim().toLocaleLowerCase("vi-VN");
  const filteredRows = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === "active" && !item.isActive) return false;
      if (statusFilter === "inactive" && item.isActive) return false;
      if (!needle) return true;
      return `${item.name} ${item.code} ${item.address || ""} ${item.phone || ""}`
        .toLocaleLowerCase("vi-VN")
        .includes(needle);
    });
  }, [items, statusFilter, needle]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* 1. HEADER BAR CHUẨN LUXCARE */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/modules");
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.screenTitle}>Quản lý chi nhánh</Text>
        </View>

        {canCreateBranch(user) && (
          <TouchableOpacity
            style={styles.addHeaderBtn}
            onPress={() => setEditing("new")}
            disabled={busy}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.addHeaderBtnText}>Thêm</Text>
          </TouchableOpacity>
        )}
      </View>

      {!allowed ? (
        <View style={styles.unauthorizedBox}>
          <AlertCircle size={40} color="#dc2626" />
          <Text style={styles.unauthorizedTitle}>Không có quyền truy cập</Text>
          <Text style={styles.unauthorizedText}>
            Bạn không có quyền quản lý danh sách chi nhánh doanh nghiệp.
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.flatList}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          data={filteredRows}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#059669"]}
              tintColor="#059669"
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {/* Thẻ thống kê 3 ô */}
              <View style={styles.statGrid}>
                <TouchableOpacity
                  style={[styles.statCard, statusFilter === "all" && styles.statCardActive]}
                  onPress={() => setStatusFilter("all")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.statIconBox, { backgroundColor: "#f1f5f9" }]}>
                    <Building2 size={18} color="#475569" />
                  </View>
                  <Text style={styles.statNumber}>{stats.total}</Text>
                  <Text style={styles.statLabel}>Tất cả cơ sở</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.statCard, statusFilter === "active" && styles.statCardActive]}
                  onPress={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.statIconBox, { backgroundColor: "#ecfdf5" }]}>
                    <CheckCircle2 size={18} color="#059669" />
                  </View>
                  <Text style={[styles.statNumber, { color: "#059669" }]}>{stats.active}</Text>
                  <Text style={styles.statLabel}>Đang hoạt động</Text>
                </TouchableOpacity>

                <View style={styles.statCard}>
                  <View style={[styles.statIconBox, { backgroundColor: "#e0f2fe" }]}>
                    <Navigation size={18} color="#0284c7" />
                  </View>
                  <Text style={[styles.statNumber, { color: "#0284c7" }]}>{stats.totalLocations}</Text>
                  <Text style={styles.statLabel}>Điểm chấm công</Text>
                </View>
              </View>

              {/* Ô tìm kiếm */}
              <View style={styles.searchBar}>
                <Search size={18} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm tên chi nhánh, mã hoặc địa chỉ..."
                  placeholderTextColor="#94a3b8"
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                    <X size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Bộ lọc trạng thái ngang */}
              <View style={styles.filterPillsRow}>
                {(
                  [
                    { key: "all", label: `Tất cả (${stats.total})` },
                    { key: "active", label: `Hoạt động (${stats.active})` },
                    { key: "inactive", label: `Tạm dừng (${stats.inactive})` },
                  ] as const
                ).map((pill) => (
                  <TouchableOpacity
                    key={pill.key}
                    style={[
                      styles.filterPill,
                      statusFilter === pill.key && styles.filterPillActive,
                    ]}
                    onPress={() => setStatusFilter(pill.key)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        statusFilter === pill.key && styles.filterPillTextActive,
                      ]}
                    >
                      {pill.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {error && (
                <View style={styles.errorBanner}>
                  <AlertCircle size={16} color="#dc2626" />
                  <Text style={styles.errorBannerText}>{error}</Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <BranchCardItem
              branch={item}
              isSelected={selectedBranch?._id === item._id}
              canEdit={canEditBranch(user, item)}
              busy={busy}
              onEdit={() => setEditing(item)}
              onToggleStatus={() => toggleStatus(item)}
            />
          )}
          ListEmptyComponent={
            loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#059669" />
                <Text style={styles.loadingText}>Đang tải danh sách chi nhánh...</Text>
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Building2 size={44} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>Không tìm thấy chi nhánh nào</Text>
                <Text style={styles.emptySubtitle}>
                  {query
                    ? `Không có kết quả nào khớp với "${query}". Hãy thử từ khóa khác.`
                    : "Chưa có chi nhánh nào được tạo trong hệ thống."}
                </Text>
                {query ? (
                  <TouchableOpacity style={styles.emptyClearBtn} onPress={() => setQuery("")}>
                    <Text style={styles.emptyClearBtnText}>Xóa tìm kiếm</Text>
                  </TouchableOpacity>
                ) : canCreateBranch(user) ? (
                  <TouchableOpacity
                    style={styles.emptyAddBtn}
                    onPress={() => setEditing("new")}
                  >
                    <Plus size={16} color="#ffffff" />
                    <Text style={styles.emptyAddBtnText}>Thêm chi nhánh đầu tiên</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )
          }
        />
      )}

      {editing && (
        <BranchEditorModal
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(branch) => {
            updated(branch);
            setEditing(null);
          }}
        />
      )}

      {alertView}
    </SafeAreaView>
  );
}

// ===================================================================
// THẺ HIỂN THỊ CHI NHÁNH HIỆN ĐẠI (CARD ITEM)
// ===================================================================
function BranchCardItem({
  branch,
  isSelected,
  canEdit,
  busy,
  onEdit,
  onToggleStatus,
}: {
  branch: BranchRecord;
  isSelected: boolean;
  canEdit: boolean;
  busy: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const draft = branchDraft(branch);
  const locations = draft.locations;
  const activeLocationsCount = locations.filter((l) => l.isActive).length;

  return (
    <View style={[styles.branchCard, isSelected && styles.branchCardSelected]}>
      {/* Top row: Tên, Mã, Trạng thái */}
      <View style={styles.branchCardTop}>
        <View style={styles.branchHeaderLeft}>
          <View style={[styles.branchIconWrapper, { backgroundColor: branch.isActive ? "#ecfdf5" : "#f1f5f9" }]}>
            <Building2 size={20} color={branch.isActive ? "#059669" : "#64748b"} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.branchTitleRow}>
              <Text style={styles.branchName} numberOfLines={1}>
                {branch.name}
              </Text>
              {isSelected && (
                <View style={styles.selectedPill}>
                  <Check size={11} color="#059669" />
                  <Text style={styles.selectedPillText}>Đang chọn</Text>
                </View>
              )}
            </View>
            <View style={styles.branchMetaRow}>
              <View style={styles.branchCodeBadge}>
                <Text style={styles.branchCodeText}>{branch.code}</Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: branch.isActive ? "#ecfdf5" : "#f1f5f9",
                    borderColor: branch.isActive ? "#a7f3d0" : "#e2e8f0",
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: branch.isActive ? "#059669" : "#94a3b8" },
                  ]}
                />
                <Text
                  style={[
                    styles.statusPillText,
                    { color: branch.isActive ? "#047857" : "#64748b" },
                  ]}
                >
                  {branch.isActive ? "Hoạt động" : "Tạm dừng"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Thông tin liên hệ & địa chỉ */}
      <View style={styles.branchDetails}>
        <View style={styles.detailRow}>
          <MapPin size={15} color="#64748b" style={styles.detailIcon} />
          <Text style={styles.detailText} numberOfLines={2}>
            {branch.address || "Chưa cập nhật địa chỉ"}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Phone size={14} color="#64748b" style={styles.detailIcon} />
          <Text style={styles.detailText}>
            {branch.phone || "Chưa cập nhật số điện thoại"}
          </Text>
        </View>

        {/* Điểm chấm công summary bar */}
        <TouchableOpacity
          style={styles.locationsToggleRow}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <View style={styles.locationsToggleLeft}>
            <Navigation size={14} color="#0284c7" />
            <Text style={styles.locationsToggleText}>
              {activeLocationsCount}/{locations.length} điểm chấm công bật
            </Text>
          </View>
          <View style={styles.locationsToggleRight}>
            <Text style={styles.locationsToggleAction}>
              {expanded ? "Thu gọn" : "Chi tiết"}
            </Text>
            {expanded ? (
              <ChevronUp size={14} color="#0284c7" />
            ) : (
              <ChevronDown size={14} color="#0284c7" />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Danh sách điểm chấm công mở rộng */}
      {expanded && (
        <View style={styles.expandedLocationsBox}>
          {locations.length === 0 ? (
            <Text style={styles.noLocationText}>Chưa thiết lập điểm chấm công nào.</Text>
          ) : (
            locations.map((loc, idx) => (
              <View key={loc.id || String(idx)} style={styles.locationItemCard}>
                <View style={styles.locationItemTop}>
                  <View style={styles.locationNameBox}>
                    <Text style={styles.locationItemName}>{loc.name || `Điểm #${idx + 1}`}</Text>
                    <View
                      style={[
                        styles.locTypeTag,
                        {
                          backgroundColor: loc.type === "office" ? "#ecfdf5" : "#fffbeb",
                          borderColor: loc.type === "office" ? "#a7f3d0" : "#fde68a",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.locTypeTagText,
                          { color: loc.type === "office" ? "#047857" : "#b45309" },
                        ]}
                      >
                        {loc.type === "office" ? "Văn phòng" : "Công tác"}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.locStatusMiniPill,
                      { backgroundColor: loc.isActive ? "#ecfdf5" : "#f8fafc" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.locStatusMiniText,
                        { color: loc.isActive ? "#059669" : "#94a3b8" },
                      ]}
                    >
                      {loc.isActive ? "Bật" : "Tắt"}
                    </Text>
                  </View>
                </View>

                <View style={styles.locationCoordsRow}>
                  <Text style={styles.coordText}>
                    GPS: {loc.latitude ? `${loc.latitude}, ${loc.longitude}` : "Chưa cài"}
                  </Text>
                  <Text style={styles.radiusText}>Bán kính: {loc.allowedRadius || 100}m</Text>
                </View>

                {loc.type === "office" && !!loc.allowedPublicIps && (
                  <View style={styles.locationIpRow}>
                    <Globe size={12} color="#64748b" />
                    <Text style={styles.ipListText} numberOfLines={1}>
                      IP: {loc.allowedPublicIps.replace(/\n/g, ", ")}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* Action buttons dưới đáy card */}
      <View style={styles.cardActionsRow}>
        {canEdit && (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={onEdit}
            disabled={busy}
            activeOpacity={0.75}
          >
            <Edit3 size={14} color="#0f172a" />
            <Text style={styles.editBtnText}>Chỉnh sửa</Text>
          </TouchableOpacity>
        )}

        {canEdit && (
          <TouchableOpacity
            style={[
              styles.toggleStatusBtn,
              { backgroundColor: branch.isActive ? "#fef2f2" : "#f0fdf4" },
            ]}
            onPress={onToggleStatus}
            disabled={busy}
            activeOpacity={0.75}
          >
            <Power size={13} color={branch.isActive ? "#dc2626" : "#059669"} />
            <Text
              style={[
                styles.toggleStatusBtnText,
                { color: branch.isActive ? "#dc2626" : "#059669" },
              ]}
            >
              {branch.isActive ? "Tạm dừng" : "Kích hoạt"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ===================================================================
// MODAL CHỈNH SỬA / TẠO MỚI CHI NHÁNH (FORM DIALOG)
// ===================================================================
function BranchEditorModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: BranchRecord;
  onClose: () => void;
  onSaved: (branch: BranchRecord) => void;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { showAlert, alertView } = useAppAlert();

  const [draft, setDraft] = useState(() => branchDraft(initial));
  const [owner, setOwner] = useState<BranchOwnerInput>({
    displayName: "",
    email: "",
    password: "",
    phone: "",
    birthDate: "",
    qualification: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<BranchRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lock = useRef(false);
  const pendingRef = useRef<BranchRecord | null>(null);
  const disabled = busy || locating !== null;

  const changeLocation = (id: string, patch: Partial<LocationDraft>) =>
    setDraft((current) => ({
      ...current,
      locations: current.locations.map((location) =>
        location.id === id ? { ...location, ...patch } : location,
      ),
    }));

  const close = () => {
    if (lock.current) return;
    if (!pendingRef.current) {
      onClose();
      return;
    }
    showAlert(
      "Hủy tạo chi nhánh?",
      "Chi nhánh chưa có tài khoản chủ sẽ được xóa khi hủy.",
      [
        { text: "Tiếp tục tạo", style: "cancel" },
        {
          text: "Hủy tạo",
          style: "destructive",
          onPress: () => {
            if (lock.current || !pendingRef.current) return;
            lock.current = true;
            setBusy(true);
            void branches
              .removePending(pendingRef.current._id)
              .then(onClose)
              .catch((err) => setError(messageOf(err)))
              .finally(() => {
                lock.current = false;
                setBusy(false);
              });
          },
        },
      ],
      "error",
    );
  };

  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (initial) {
        if (!canEditBranch(user, initial)) {
          throw Error("Bạn không có quyền sửa chi nhánh này.");
        }
        onSaved(await branches.update(initial._id, branchPayload(draft, user!.companyCode!)));
      } else {
        if (!canCreateBranch(user)) {
          throw Error("Chỉ quản trị viên doanh nghiệp được tạo chi nhánh và tài khoản chủ.");
        }
        const created = await completeBranchCreation(
          branches,
          draft,
          owner,
          user!.companyCode!,
          pendingRef.current,
          (branch) => {
            pendingRef.current = branch;
            setPending(branch);
          },
        );
        pendingRef.current = null;
        setOwner((current) => ({ ...current, password: "" }));
        onSaved(created);
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const capture = async (location: LocationDraft) => {
    if (lock.current) return;
    lock.current = true;
    setLocating(location.id);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        throw Error("Vui lòng cấp quyền vị trí cho LuxCare trong cài đặt thiết bị.");
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const patch: Partial<LocationDraft> = {
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude),
      };
      changeLocation(location.id, patch);
      if (location.type === "office") {
        const { ip } = await branches.currentIp();
        const network = attendanceNetwork(ip);
        changeLocation(location.id, {
          allowedPublicIps: [
            ...new Set([
              ...location.allowedPublicIps
                .split(/[\n,]/)
                .map((value) => value.trim())
                .filter(Boolean),
              network,
            ]),
          ].join("\n"),
        });
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      lock.current = false;
      setLocating(null);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.modalOverlay} edges={["top"]}>
        <View style={styles.modalSheet}>
          {/* Header modal */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderIconBox}>
              <Building2 size={20} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>
                {initial ? "Chỉnh sửa chi nhánh" : "Thêm chi nhánh mới"}
              </Text>
              <Text style={styles.modalSubtitle}>
                {initial ? initial.code : "Khởi tạo cơ sở & điểm chấm công"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={close}
              disabled={disabled}
              hitSlop={8}
            >
              <X size={20} color="#475569" />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              contentContainerStyle={[styles.modalScrollContent, { paddingBottom: insets.bottom + 32 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {pending && (
                <View style={styles.pendingNoticeBox}>
                  <AlertCircle size={18} color="#0284c7" />
                  <Text style={styles.pendingNoticeText}>
                    Đã tạo hồ sơ chi nhánh. Vui lòng hoàn tất khởi tạo tài khoản Chủ chi nhánh hoặc nhấn Hủy.
                  </Text>
                </View>
              )}

              {/* PHẦN 1: THÔNG TIN CHI NHÁNH CƠ BẢN */}
              <View style={styles.formCard}>
                <View style={styles.formCardHeader}>
                  <Building2 size={16} color="#059669" />
                  <Text style={styles.formCardTitle}>Thông tin chi nhánh</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Tên chi nhánh <Text style={{ color: "#dc2626" }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Ví dụ: Chi nhánh Quận 1, Phòng khám Cầu Giấy..."
                    placeholderTextColor="#94a3b8"
                    value={draft.name}
                    editable={!disabled && !pending}
                    maxLength={120}
                    onChangeText={(name) => setDraft((c) => ({ ...c, name }))}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mã định danh chi nhánh</Text>
                  <TextInput
                    style={[styles.formInput, { textTransform: "uppercase" }]}
                    placeholder={
                      generateBranchCode(user?.companyCode || "", draft.name) ||
                      "Tự tạo từ tên chi nhánh (ví dụ: LUX_Q1)"
                    }
                    placeholderTextColor="#94a3b8"
                    value={draft.code}
                    editable={!disabled && !pending}
                    maxLength={32}
                    autoCapitalize="characters"
                    onChangeText={(code) => setDraft((c) => ({ ...c, code }))}
                  />
                  <Text style={styles.inputHint}>
                    Mã dùng để phân biệt và đồng bộ chấm công, báo cáo.
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Địa chỉ hoạt động</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành..."
                    placeholderTextColor="#94a3b8"
                    value={draft.address}
                    editable={!disabled && !pending}
                    maxLength={255}
                    onChangeText={(address) => setDraft((c) => ({ ...c, address }))}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Số điện thoại hotline</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Số điện thoại bàn hoặc di động chi nhánh"
                    placeholderTextColor="#94a3b8"
                    value={draft.phone}
                    editable={!disabled && !pending}
                    maxLength={32}
                    keyboardType="phone-pad"
                    onChangeText={(phone) => setDraft((c) => ({ ...c, phone }))}
                  />
                </View>
              </View>

              {/* PHẦN 2: CẤU HÌNH ĐIỂM CHẤM CÔNG */}
              <View style={styles.formCard}>
                <View style={styles.formCardHeader}>
                  <Navigation size={16} color="#059669" />
                  <Text style={styles.formCardTitle}>Điểm chấm công GPS & IP</Text>
                </View>

                <View style={styles.tipNoticeBox}>
                  <Text style={styles.tipNoticeText}>
                    💡 <Text style={{ fontWeight: "700" }}>Văn phòng:</Text> Kiểm tra cả vị trí GPS và dải IP mạng Wi-Fi.{"\n"}
                    🚗 <Text style={{ fontWeight: "700" }}>Công tác:</Text> Chỉ kiểm tra tọa độ GPS trong bán kính cho phép.
                  </Text>
                </View>

                {draft.locations.map((location, index) => (
                  <View key={location.id} style={styles.locationEditorBox}>
                    <View style={styles.locationEditorHeader}>
                      <View style={styles.locationEditorTitleRow}>
                        <View style={styles.locNumberBadge}>
                          <Text style={styles.locNumberBadgeText}>{index + 1}</Text>
                        </View>
                        <TextInput
                          style={styles.locationNameInput}
                          placeholder="Tên vị trí (VD: Trụ sở chính, Quầy lễ tân)..."
                          placeholderTextColor="#94a3b8"
                          value={location.name}
                          editable={!disabled && !pending}
                          maxLength={120}
                          onChangeText={(name) => changeLocation(location.id, { name })}
                        />
                      </View>

                      {/* Switch bật/tắt điểm này */}
                      <View style={styles.locationSwitchRow}>
                        <Text style={styles.locationSwitchLabel}>
                          {location.isActive ? "Đang bật" : "Tắt"}
                        </Text>
                        <Switch
                          value={location.isActive}
                          disabled={disabled || !!pending}
                          onValueChange={(isActive) => changeLocation(location.id, { isActive })}
                          trackColor={{ false: "#cbd5e1", true: "#a7f3d0" }}
                          thumbColor={location.isActive ? "#059669" : "#f1f5f9"}
                        />
                      </View>
                    </View>

                    {/* Chọn loại điểm: Văn phòng / Công tác */}
                    <View style={styles.locTypeSelectorRow}>
                      {(["office", "business_trip"] as const).map((type) => (
                        <TouchableOpacity
                          key={type}
                          disabled={disabled || !!pending}
                          style={[
                            styles.locTypeOption,
                            location.type === type && styles.locTypeOptionSelected,
                          ]}
                          onPress={() =>
                            changeLocation(location.id, {
                              type,
                              allowedPublicIps:
                                type === "business_trip" ? "" : location.allowedPublicIps,
                            })
                          }
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.locTypeOptionText,
                              location.type === type && styles.locTypeOptionTextSelected,
                            ]}
                          >
                            {type === "office" ? "🏢 Văn phòng" : "🚗 Điểm công tác"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Tọa độ GPS */}
                    <View style={styles.coordsInputRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.subInputLabel}>Vĩ độ (Lat) *</Text>
                        <TextInput
                          style={styles.subInput}
                          placeholder="Ví dụ: 10.7769"
                          placeholderTextColor="#94a3b8"
                          value={location.latitude}
                          editable={!disabled && !pending}
                          keyboardType="numbers-and-punctuation"
                          onChangeText={(latitude) => changeLocation(location.id, { latitude })}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.subInputLabel}>Kinh độ (Long) *</Text>
                        <TextInput
                          style={styles.subInput}
                          placeholder="Ví dụ: 106.7009"
                          placeholderTextColor="#94a3b8"
                          value={location.longitude}
                          editable={!disabled && !pending}
                          keyboardType="numbers-and-punctuation"
                          onChangeText={(longitude) => changeLocation(location.id, { longitude })}
                        />
                      </View>
                    </View>

                    {/* Bán kính cho phép */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.subInputLabel}>Bán kính GPS cho phép (mét) *</Text>
                      <TextInput
                        style={styles.subInput}
                        placeholder="Mặc định: 100 mét"
                        placeholderTextColor="#94a3b8"
                        value={location.allowedRadius}
                        editable={!disabled && !pending}
                        keyboardType="decimal-pad"
                        onChangeText={(allowedRadius) =>
                          changeLocation(location.id, { allowedRadius })
                        }
                      />
                    </View>

                    {/* Nút tự động lấy GPS & IP hiện tại */}
                    <TouchableOpacity
                      style={styles.captureBtn}
                      disabled={disabled || !!pending}
                      onPress={() => void capture(location)}
                      activeOpacity={0.75}
                    >
                      {locating === location.id ? (
                        <ActivityIndicator size="small" color="#0284c7" />
                      ) : (
                        <RotateCw size={15} color="#0284c7" />
                      )}
                      <Text style={styles.captureBtnText}>
                        {locating === location.id
                          ? "Đang xác định tọa độ GPS & IP..."
                          : location.type === "office"
                            ? "Lấy tọa độ GPS & IP hiện tại của bạn"
                            : "Lấy tọa độ GPS thiết bị hiện tại"}
                      </Text>
                    </TouchableOpacity>

                    {/* IP công cộng nếu là Văn phòng */}
                    {location.type === "office" && (
                      <View style={styles.inputGroup}>
                        <Text style={styles.subInputLabel}>IP công cộng được phép *</Text>
                        <TextInput
                          style={[styles.subInput, { height: 70, textAlignVertical: "top" }]}
                          placeholder="Nhập IP công cộng hoặc mạng IPv6 (mỗi IP một dòng)"
                          placeholderTextColor="#94a3b8"
                          value={location.allowedPublicIps}
                          multiline
                          autoCapitalize="none"
                          editable={!disabled && !pending}
                          onChangeText={(allowedPublicIps) =>
                            changeLocation(location.id, { allowedPublicIps })
                          }
                        />
                      </View>
                    )}

                    {/* Nút xóa vị trí này */}
                    {draft.locations.length > 1 && (
                      <TouchableOpacity
                        style={styles.deleteLocBtn}
                        disabled={disabled || !!pending}
                        onPress={() =>
                          setDraft((c) => ({
                            ...c,
                            locations: c.locations.filter((row) => row.id !== location.id),
                          }))
                        }
                        activeOpacity={0.7}
                      >
                        <Text style={styles.deleteLocBtnText}>Xóa điểm chấm công này</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addLocationBtn}
                  disabled={disabled || !!pending}
                  onPress={() =>
                    setDraft((c) => ({
                      ...c,
                      locations: [...c.locations, newLocation(randomUUID())],
                    }))
                  }
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#059669" />
                  <Text style={styles.addLocationBtnText}>Thêm điểm chấm công</Text>
                </TouchableOpacity>
              </View>

              {/* PHẦN 3: TÀI KHOẢN CHỦ CHI NHÁNH (CHỈ KHI TẠO MỚI) */}
              {!initial && (
                <View style={styles.formCard}>
                  <View style={styles.formCardHeader}>
                    <User size={16} color="#059669" />
                    <Text style={styles.formCardTitle}>Tài khoản Chủ chi nhánh (Admin cơ sở)</Text>
                  </View>

                  <View style={styles.ownerNoticeBox}>
                    <Text style={styles.ownerNoticeText}>
                      Tài khoản này sẽ được cấp quyền Giám đốc chi nhánh (Branch Owner) để quản lý
                      nhân sự, phân ca, và duyệt đơn tại cơ sở này.
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Họ và tên chủ chi nhánh <Text style={{ color: "#dc2626" }}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Ví dụ: Nguyễn Văn An"
                      placeholderTextColor="#94a3b8"
                      value={owner.displayName}
                      editable={!disabled}
                      onChangeText={(displayName) =>
                        setOwner((c) => ({ ...c, displayName }))
                      }
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Email đăng nhập <Text style={{ color: "#dc2626" }}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="chu.chinhanh@luxcare.vn"
                      placeholderTextColor="#94a3b8"
                      value={owner.email}
                      editable={!disabled}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onChangeText={(email) => setOwner((c) => ({ ...c, email }))}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Mật khẩu khởi tạo <Text style={{ color: "#dc2626" }}>*</Text>
                    </Text>
                    <View style={styles.passwordWrapper}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="Tối thiểu 6 ký tự"
                        placeholderTextColor="#94a3b8"
                        value={owner.password}
                        editable={!disabled}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        onChangeText={(password) =>
                          setOwner((c) => ({ ...c, password }))
                        }
                      />
                      <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowPassword(!showPassword)}
                        hitSlop={8}
                      >
                        {showPassword ? (
                          <EyeOff size={18} color="#64748b" />
                        ) : (
                          <Eye size={18} color="#64748b" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Số điện thoại cá nhân</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Số di động để liên hệ"
                      placeholderTextColor="#94a3b8"
                      value={owner.phone}
                      editable={!disabled}
                      keyboardType="phone-pad"
                      onChangeText={(phone) => setOwner((c) => ({ ...c, phone }))}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <DatePickerField
                      label="Ngày sinh"
                      value={owner.birthDate || ""}
                      disabled={disabled}
                      allowClear
                      onChange={(birthDate) => setOwner((c) => ({ ...c, birthDate }))}
                    />
                  </View>
                </View>
              )}

              {error && (
                <View style={styles.modalErrorBanner}>
                  <AlertCircle size={16} color="#dc2626" />
                  <Text style={styles.modalErrorBannerText}>{error}</Text>
                </View>
              )}

              {/* NÚT THAO TÁC SUBMIT & HỦY */}
              <View style={styles.modalActionsBox}>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, disabled && { opacity: 0.7 }]}
                  disabled={disabled}
                  onPress={() => void save()}
                  activeOpacity={0.8}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Check size={18} color="#ffffff" />
                  )}
                  <Text style={styles.modalSubmitBtnText}>
                    {busy
                      ? "Đang lưu xử lý..."
                      : initial
                        ? "Lưu thay đổi chi nhánh"
                        : pending
                          ? "Hoàn tất tài khoản chủ"
                          : "Tạo chi nhánh & tài khoản chủ"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  disabled={disabled}
                  onPress={close}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelBtnText}>Đóng / Hủy</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
          {alertView}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ===================================================================
// STYLESHEET
// ===================================================================
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  addHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#059669",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    elevation: 2,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addHeaderBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  flatList: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 14,
  },
  listHeader: {
    gap: 12,
    marginBottom: 2,
  },
  statGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 1,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  statCardActive: {
    borderColor: "#059669",
    backgroundColor: "#f0fdf4",
  },
  statIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  statLabel: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    textAlign: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    paddingVertical: 0,
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterPillActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  filterPillText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#64748b",
  },
  filterPillTextActive: {
    color: "#ffffff",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 12,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#dc2626",
  },
  branchCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    gap: 12,
  },
  branchCardSelected: {
    borderColor: "#059669",
    borderWidth: 1.5,
    backgroundColor: "#fbfdfc",
  },
  branchCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  branchHeaderLeft: {
    flexDirection: "row",
    gap: 12,
    flex: 1,
  },
  branchIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  branchTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  branchName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    flexShrink: 1,
  },
  selectedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  selectedPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  branchMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  branchCodeBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  branchCodeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    letterSpacing: 0.4,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  branchDetails: {
    gap: 8,
    paddingTop: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  detailIcon: {
    marginTop: 2,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    color: "#334155",
    lineHeight: 18,
  },
  locationsToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 2,
  },
  locationsToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationsToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0369a1",
  },
  locationsToggleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  locationsToggleAction: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#0284c7",
  },
  expandedLocationsBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  noLocationText: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 6,
  },
  locationItemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  locationItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationNameBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  locationItemName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  locTypeTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  locTypeTagText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  locStatusMiniPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  locStatusMiniText: {
    fontSize: 11,
    fontWeight: "700",
  },
  locationCoordsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coordText: {
    fontSize: 11.5,
    color: "#64748b",
  },
  radiusText: {
    fontSize: 11.5,
    color: "#0284c7",
    fontWeight: "600",
  },
  locationIpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  ipListText: {
    fontSize: 11,
    color: "#475569",
    flex: 1,
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#1e293b",
  },
  toggleStatusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  toggleStatusBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
  },
  emptyBox: {
    paddingVertical: 50,
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
  emptyClearBtn: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  emptyClearBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#0f172a",
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  unauthorizedBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 10,
  },
  unauthorizedTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  unauthorizedText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  modalHeaderIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  modalScrollContent: {
    padding: 16,
    gap: 16,
  },
  pendingNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#e0f2fe",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 14,
    padding: 12,
  },
  pendingNoticeText: {
    flex: 1,
    fontSize: 12.5,
    color: "#0369a1",
    lineHeight: 17,
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 14,
    elevation: 1,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  formCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  formCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  subInputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  formInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  subInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13.5,
    color: "#0f172a",
  },
  inputHint: {
    fontSize: 11.5,
    color: "#94a3b8",
  },
  tipNoticeBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 10,
  },
  tipNoticeText: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
  locationEditorBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  locationEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  locationEditorTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  locNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#059669",
    justifyContent: "center",
    alignItems: "center",
  },
  locNumberBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ffffff",
  },
  locationNameInput: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  locationSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationSwitchLabel: {
    fontSize: 11.5,
    color: "#64748b",
  },
  locTypeSelectorRow: {
    flexDirection: "row",
    gap: 8,
  },
  locTypeOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  locTypeOptionSelected: {
    borderColor: "#059669",
    backgroundColor: "#ecfdf5",
  },
  locTypeOptionText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#64748b",
  },
  locTypeOptionTextSelected: {
    color: "#059669",
    fontWeight: "700",
  },
  coordsInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  captureBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    paddingVertical: 9,
    borderRadius: 10,
  },
  captureBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0284c7",
  },
  deleteLocBtn: {
    paddingVertical: 6,
    alignItems: "center",
  },
  deleteLocBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#dc2626",
  },
  addLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ecfdf5",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#a7f3d0",
    borderRadius: 12,
    paddingVertical: 12,
  },
  addLocationBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
  },
  ownerNoticeBox: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    padding: 10,
  },
  ownerNoticeText: {
    fontSize: 12,
    color: "#15803d",
    lineHeight: 17,
  },
  passwordWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  eyeBtn: {
    padding: 6,
  },
  modalErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 12,
  },
  modalErrorBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#dc2626",
  },
  modalActionsBox: {
    gap: 10,
    marginTop: 6,
  },
  modalSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#059669",
    paddingVertical: 13,
    borderRadius: 14,
    elevation: 3,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalSubmitBtnText: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#ffffff",
  },
  modalCancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  modalCancelBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#475569",
  },
});
