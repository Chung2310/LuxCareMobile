import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Lock,
  User,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  FileText,
  Check,
} from "lucide-react-native";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Credential } from "../../../src/types/hrCredential";
import { CredentialForm } from "../../src/features/credentials/CredentialForm";
import { ALL_EMPLOYEES } from "../../src/features/contracts/employeeFilterModel";
import { DeleteCredentialForm } from "../../src/features/credentials/DeleteCredentialForm";
import { canManageCredentials } from "../../src/features/credentials/model";
import type { CredentialList } from "../../../src/services/hrCredentialService";
import type { HRCredentialStatus, HRCredentialType } from "../../../shared/hr-credential";
import { credentials } from "../../src/api/services";
import { useSession, messageOf } from "../../src/auth/SessionProvider";
import { colors } from "../../src/ui";
import { contractDate } from "../../src/features/contracts/model";
import { canReadCredentials, credentialTypes, credentialStatuses } from "../../src/features/credentials/model";
import { EmployeeSelectModal } from "../../src/features/credentials/EmployeeSelectModal";

export default function Credentials() {
  const { user, selectedBranch } = useSession();
  const params = useLocalSearchParams<{ from?: string }>();
  const allowed = canReadCredentials(user);
  const manage = canManageCredentials(user);

  const [editing, setEditing] = useState<{
    item?: Credential;
    employees: CredentialList["employees"];
    remove?: boolean;
  } | null>(null);

  const formLock = useRef(false);
  const branchId = selectedBranch?._id || user?.branchId || undefined;
  const [data, setData] = useState<CredentialList | null>(null);
  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState(ALL_EMPLOYEES);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<HRCredentialStatus | "">("");
  const [type, setType] = useState<HRCredentialType | "">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  // Filter UI State
  const [showFilters, setShowFilters] = useState(false);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);

  const activeFiltersCount =
    (status ? 1 : 0) + (type ? 1 : 0) + (employee.value ? 1 : 0) + (search ? 1 : 0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setData(null);
      setError(null);
      if (!allowed || !user?.companyCode) {
        setLoading(false);
        return;
      }
      setLoading(true);
      void credentials
        .list({
          companyCode: user.companyCode,
          branchId,
          search,
          status,
          type,
          page,
          limit: 20,
          employeeId: employee.value,
        })
        .then((result) => {
          if (active) setData(result);
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
    }, [allowed, user?.companyCode, branchId, search, status, type, page, employee.value, revision]),
  );

  const handleSearchSubmit = () => {
    setSearch(draft.trim());
    setPage(1);
    setRevision((v) => v + 1);
  };

  const handleResetFilters = () => {
    setEmployee(ALL_EMPLOYEES);
    setDraft("");
    setSearch("");
    setType("");
    setStatus("");
    setPage(1);
    setRevision((v) => v + 1);
  };

  const handleQuickStatusSelect = (targetStatus: HRCredentialStatus | "") => {
    setStatus((prev) => (prev === targetStatus ? "" : targetStatus));
    setPage(1);
  };

  if (!allowed) {
    return (
      <SafeAreaView edges={["top"]} style={uiStyles.container}>
        <View style={uiStyles.emptyCard}>
          <Lock size={40} color="#94a3b8" style={{ marginBottom: 10 }} />
          <Text style={uiStyles.emptyTitle}>Không có quyền truy cập</Text>
          <Text style={uiStyles.emptyText}>
            Bạn cần phân hệ nhân sự và quyền xem chứng chỉ hoặc quyền quản lý nhân sự để truy cập mục này.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const branchEmployees = (data?.employees || []).filter(
    (emp) => !branchId || emp.branchId === branchId,
  );

  return (
    <SafeAreaView edges={["top"]} style={uiStyles.container}>
      <ScrollView
        style={uiStyles.scrollView}
        contentContainerStyle={uiStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => setRevision((v) => v + 1)}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header bar */}
        <View style={uiStyles.headerRow}>
          <Pressable
            style={uiStyles.backBtn}
            onPress={() => {
              if (params.from === "modules") router.replace("/(tabs)/modules");
              else if (router.canGoBack()) router.back();
              else router.replace("/(tabs)/modules");
            }}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color="#0f172a" />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={uiStyles.pageTitle}>Văn bằng & chứng chỉ</Text>
            <Text style={uiStyles.pageSubtitle}>
              {selectedBranch?.name || (branchId ? "Chi nhánh hiện tại" : "Toàn bộ doanh nghiệp")}
            </Text>
          </View>

          {manage && (
            <Pressable
              style={({ pressed }) => [uiStyles.addBtn, pressed && { opacity: 0.85 }]}
              disabled={loading || !data || !!error}
              onPress={() =>
                setEditing({
                  employees: branchEmployees,
                })
              }
            >
              <Text style={uiStyles.addBtnText}>+ Thêm mới</Text>
            </Pressable>
          )}
        </View>

        {/* Quick Summary Stat Badges */}
        {data && (
          <View style={uiStyles.statsRow}>
            <Pressable
              style={[uiStyles.statCard, status === "" && uiStyles.statCardActive]}
              onPress={() => handleQuickStatusSelect("")}
            >
              <Text style={[uiStyles.statNumber, { color: "#0f172a" }]}>{data.summary.total}</Text>
              <Text style={uiStyles.statLabel}>Tất cả</Text>
            </Pressable>

            <Pressable
              style={[
                uiStyles.statCard,
                { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
                status === "active" && uiStyles.statCardActiveGreen,
              ]}
              onPress={() => handleQuickStatusSelect("active")}
            >
              <Text style={[uiStyles.statNumber, { color: "#059669" }]}>{data.summary.active}</Text>
              <Text style={[uiStyles.statLabel, { color: "#065f46" }]}>Hiệu lực</Text>
            </Pressable>

            <Pressable
              style={[
                uiStyles.statCard,
                { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
                status === "expiring" && uiStyles.statCardActiveAmber,
              ]}
              onPress={() => handleQuickStatusSelect("expiring")}
            >
              <Text style={[uiStyles.statNumber, { color: "#d97706" }]}>{data.summary.expiring}</Text>
              <Text style={[uiStyles.statLabel, { color: "#92400e" }]}>Sắp hết hạn</Text>
            </Pressable>

            <Pressable
              style={[
                uiStyles.statCard,
                { backgroundColor: "#fff1f2", borderColor: "#fecdd3" },
                status === "expired" && uiStyles.statCardActiveRose,
              ]}
              onPress={() => handleQuickStatusSelect("expired")}
            >
              <Text style={[uiStyles.statNumber, { color: "#e11d48" }]}>{data.summary.expired}</Text>
              <Text style={[uiStyles.statLabel, { color: "#9f1239" }]}>Hết hạn</Text>
            </Pressable>
          </View>
        )}

        {/* Search Bar & Filter Toggle */}
        <View style={uiStyles.searchCard}>
          <View style={uiStyles.searchInputRow}>
            <TextInput
              style={uiStyles.searchInput}
              placeholder="Tìm nhân viên, chứng chỉ, số hiệu..."
              placeholderTextColor="#94a3b8"
              value={draft}
              onChangeText={setDraft}
              returnKeyType="search"
              onSubmitEditing={handleSearchSubmit}
            />
            {draft.length > 0 && (
              <Pressable
                onPress={() => {
                  setDraft("");
                  if (search) {
                    setSearch("");
                    setPage(1);
                    setRevision((v) => v + 1);
                  }
                }}
                hitSlop={8}
                style={uiStyles.clearInputBtn}
              >
                <X size={14} color="#64748b" />
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [uiStyles.searchSubmitBtn, pressed && { opacity: 0.8 }]}
              onPress={handleSearchSubmit}
              disabled={loading}
            >
              <Text style={uiStyles.searchSubmitText}>Tìm</Text>
            </Pressable>
          </View>

          {/* Quick Filter toggle row */}
          <View style={uiStyles.filterBarRow}>
            <Pressable
              style={[
                uiStyles.filterToggleBtn,
                showFilters && uiStyles.filterToggleBtnActive,
                { flexDirection: "row", alignItems: "center", gap: 6 },
              ]}
              onPress={() => setShowFilters((v) => !v)}
            >
              <Text style={[uiStyles.filterToggleText, showFilters && uiStyles.filterToggleTextActive]}>
                Bộ lọc nâng cao {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ""}
              </Text>
              {showFilters ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <ChevronUp size={13} color="#059669" />
                  <Text style={[uiStyles.filterToggleText, uiStyles.filterToggleTextActive]}>Thu gọn</Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <ChevronDown size={13} color="#64748b" />
                  <Text style={uiStyles.filterToggleText}>Mở bộ lọc</Text>
                </View>
              )}
            </Pressable>

            {activeFiltersCount > 0 && (
              <Pressable onPress={handleResetFilters} style={[uiStyles.resetFiltersBtn, { flexDirection: "row", alignItems: "center", gap: 4 }]} hitSlop={6}>
                <RotateCcw size={12} color="#dc2626" />
                <Text style={uiStyles.resetFiltersText}>Xóa lọc ({activeFiltersCount})</Text>
              </Pressable>
            )}
          </View>

          {/* Dedicated Mobile Filter Panel */}
          {showFilters && (
            <View style={uiStyles.filterPanel}>
              <View style={uiStyles.filterDivider} />

              {/* 1. Lọc theo nhân viên */}
              <View style={uiStyles.filterSection}>
                <Text style={uiStyles.filterSectionTitle}>Nhân viên</Text>
                <Pressable
                  style={({ pressed }) => [
                    uiStyles.employeePickerBtn,
                    employee.value ? uiStyles.employeePickerBtnSelected : null,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setEmployeeModalOpen(true)}
                >
                  <User size={15} color="#059669" style={{ marginRight: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        uiStyles.employeePickerText,
                        employee.value ? uiStyles.employeePickerTextSelected : null,
                      ]}
                      numberOfLines={1}
                    >
                      {employee.value ? employee.label : "Tất cả nhân viên"}
                    </Text>
                  </View>
                  {employee.value ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setEmployee(ALL_EMPLOYEES);
                        setPage(1);
                      }}
                      hitSlop={8}
                      style={uiStyles.clearEmployeeBtn}
                    >
                      <X size={14} color="#64748b" />
                    </Pressable>
                  ) : (
                    <ChevronDown size={14} color="#94a3b8" />
                  )}
                </Pressable>
              </View>

              {/* 2. Lọc theo loại văn bằng */}
              <View style={uiStyles.filterSection}>
                <Text style={uiStyles.filterSectionTitle}>Loại văn bằng & chứng chỉ</Text>
                <View style={uiStyles.chipGrid}>
                  <Pressable
                    style={[uiStyles.filterChip, type === "" && uiStyles.filterChipActive]}
                    onPress={() => {
                      setType("");
                      setPage(1);
                    }}
                  >
                    <Text
                      style={[
                        uiStyles.filterChipText,
                        type === "" && uiStyles.filterChipTextActive,
                      ]}
                    >
                      Tất cả
                    </Text>
                  </Pressable>
                  {Object.entries(credentialTypes).map(([typeKey, typeLabel]) => {
                    const isSelected = type === typeKey;
                    return (
                      <Pressable
                        key={typeKey}
                        style={[uiStyles.filterChip, isSelected && uiStyles.filterChipActive, { flexDirection: "row", alignItems: "center", gap: 4 }]}
                        onPress={() => {
                          setType(isSelected ? "" : (typeKey as HRCredentialType));
                          setPage(1);
                        }}
                      >
                        {isSelected && <Check size={12} color="#059669" strokeWidth={3} />}
                        <Text
                          style={[
                            uiStyles.filterChipText,
                            isSelected && uiStyles.filterChipTextActive,
                          ]}
                        >
                          {typeLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 3. Lọc theo trạng thái hiệu lực */}
              <View style={uiStyles.filterSection}>
                <Text style={uiStyles.filterSectionTitle}>Trạng thái hiệu lực</Text>
                <View style={uiStyles.chipGrid}>
                  <Pressable
                    style={[uiStyles.filterChip, status === "" && uiStyles.filterChipActive]}
                    onPress={() => {
                      setStatus("");
                      setPage(1);
                    }}
                  >
                    <Text
                      style={[
                        uiStyles.filterChipText,
                        status === "" && uiStyles.filterChipTextActive,
                      ]}
                    >
                      Tất cả
                    </Text>
                  </Pressable>
                  {Object.entries(credentialStatuses).map(([statusKey, statusLabel]) => {
                    const isSelected = status === statusKey;
                    return (
                      <Pressable
                        key={statusKey}
                        style={[
                          uiStyles.filterChip,
                          isSelected &&
                            (statusKey === "active"
                              ? uiStyles.filterChipGreen
                              : statusKey === "expiring"
                              ? uiStyles.filterChipAmber
                              : uiStyles.filterChipRose),
                        ]}
                        onPress={() => {
                          setStatus(isSelected ? "" : (statusKey as HRCredentialStatus));
                          setPage(1);
                        }}
                      >
                        <Text
                          style={[
                            uiStyles.filterChipText,
                            isSelected && uiStyles.filterChipTextBold,
                          ]}
                        >
                          {isSelected ? "● " : ""}
                          {statusLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Error Notification */}
        {error && (
          <View style={uiStyles.errorBanner}>
            <Text style={uiStyles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* Credentials List */}
        {data && (
          <>
            <View style={uiStyles.listHeaderRow}>
              <Text style={uiStyles.listCountText}>
                Tìm thấy <Text style={{ fontWeight: "700", color: "#0f172a" }}>{data.total}</Text> hồ sơ
              </Text>
              <Text style={uiStyles.listPageIndicator}>
                Trang {page}/{totalPages}
              </Text>
            </View>

            {data.credentials.length === 0 ? (
              <View style={uiStyles.emptyCard}>
                <FileText size={40} color="#94a3b8" style={{ marginBottom: 10 }} />
                <Text style={uiStyles.emptyTitle}>Không tìm thấy chứng chỉ</Text>
                <Text style={uiStyles.emptyText}>
                  Không có hồ sơ nào phù hợp với bộ lọc hiện tại. Bạn hãy thử đổi từ khóa hoặc đặt lại bộ lọc.
                </Text>
                {activeFiltersCount > 0 && (
                  <Pressable style={uiStyles.emptyResetBtn} onPress={handleResetFilters}>
                    <Text style={uiStyles.emptyResetBtnText}>Xóa toàn bộ bộ lọc</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              data.credentials.map((item) => {
                const statusStyle =
                  item.status === "active"
                    ? uiStyles.badgeActive
                    : item.status === "expiring"
                    ? uiStyles.badgeExpiring
                    : uiStyles.badgeExpired;

                const statusTextStyle =
                  item.status === "active"
                    ? uiStyles.badgeTextActive
                    : item.status === "expiring"
                    ? uiStyles.badgeTextExpiring
                    : uiStyles.badgeTextExpired;

                return (
                  <Pressable
                    key={item._id}
                    style={({ pressed }) => [uiStyles.card, pressed && { opacity: 0.92 }]}
                    onPress={() =>
                      setEditing({
                        item,
                        employees: branchEmployees,
                      })
                    }
                  >
                    {/* Header: Title & Status Badge */}
                    <View style={uiStyles.cardHeader}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={uiStyles.cardTitle}>{item.name}</Text>
                        <View style={uiStyles.cardMetaRow}>
                          <Text style={uiStyles.employeeName}>{item.employeeName}</Text>
                          <Text style={uiStyles.metaDot}>•</Text>
                          <View style={uiStyles.typePill}>
                            <Text style={uiStyles.typePillText}>
                              {credentialTypes[item.type] || item.type}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={[uiStyles.badge, statusStyle]}>
                        <Text style={[uiStyles.badgeText, statusTextStyle]}>
                          {credentialStatuses[item.status] || item.status}
                        </Text>
                      </View>
                    </View>

                    {/* Expiry Bar & View Detail Link */}
                    <View style={uiStyles.dateRow}>
                      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                        <Text style={uiStyles.dateLabel}>Thời hạn:</Text>
                        <Text
                          style={[
                            uiStyles.dateValue,
                            item.status === "expired" && { color: "#e11d48", fontWeight: "700" },
                            item.status === "expiring" && { color: "#d97706", fontWeight: "700" },
                          ]}
                        >
                          {item.expiryDate ? contractDate(item.expiryDate) : "Không thời hạn"}
                        </Text>
                      </View>

                      <View style={[uiStyles.detailLinkBadge, { flexDirection: "row", alignItems: "center", gap: 3 }]}>
                        <Text style={uiStyles.detailLinkText}>Chi tiết</Text>
                        <ChevronRight size={13} color="#059669" />
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}

            {/* Always Visible, Prominent Pagination Bar */}
            <View style={uiStyles.paginationCard}>
              <Pressable
                style={[
                  uiStyles.pageBtn,
                  page <= 1 && uiStyles.pageBtnDisabled,
                  { flexDirection: "row", alignItems: "center", justifyContent: "center" },
                ]}
                disabled={page <= 1}
                onPress={() => setPage((v) => Math.max(1, v - 1))}
              >
                <ChevronLeft size={14} color={page <= 1 ? "#94a3b8" : "#059669"} style={{ marginRight: 2 }} />
                <Text style={[uiStyles.pageBtnText, page <= 1 && uiStyles.pageBtnTextDisabled]}>
                  Trước
                </Text>
              </Pressable>

              <View style={uiStyles.pageCenterInfo}>
                <Text style={uiStyles.pageIndicatorBold}>
                  Trang {page} / {totalPages}
                </Text>
                <Text style={uiStyles.pageSubText} numberOfLines={1}>
                  {data.total > 0
                    ? `Hiển thị ${(page - 1) * data.limit + 1}–${Math.min(
                        page * data.limit,
                        data.total,
                      )} / ${data.total} hồ sơ`
                    : "0 hồ sơ"}
                </Text>
              </View>

              <Pressable
                style={[
                  uiStyles.pageBtn,
                  page >= totalPages && uiStyles.pageBtnDisabled,
                  { flexDirection: "row", alignItems: "center", justifyContent: "center" },
                ]}
                disabled={page >= totalPages}
                onPress={() => setPage((v) => Math.min(totalPages, v + 1))}
              >
                <Text
                  style={[uiStyles.pageBtnText, page >= totalPages && uiStyles.pageBtnTextDisabled]}
                >
                  Sau
                </Text>
                <ChevronRight size={14} color={page >= totalPages ? "#94a3b8" : "#059669"} style={{ marginLeft: 2 }} />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      {/* Employee Filter Bottom Sheet Modal */}
      <EmployeeSelectModal
        visible={employeeModalOpen}
        onClose={() => setEmployeeModalOpen(false)}
        employees={branchEmployees}
        selectedId={employee.value}
        allowAll={true}
        onSelectAll={() => {
          setEmployee(ALL_EMPLOYEES);
          setPage(1);
        }}
        onSelect={(emp) => {
          setEmployee({ value: emp._id, label: emp.displayName || emp.email });
          setPage(1);
        }}
        title="Lọc theo nhân sự"
      />

      {/* Detail / Edit / Create / Delete Modal */}
      <Modal
        visible={!!editing}
        animationType="slide"
        onRequestClose={() => {
          if (!formLock.current) {
            if (editing?.remove) setPage(1);
            setEditing(null);
            setRevision((v) => v + 1);
          }
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
          {editing &&
            (editing.remove && editing.item ? (
              <DeleteCredentialForm
                item={editing.item}
                companyCode={user!.companyCode!}
                setLocked={(value) => {
                  formLock.current = value;
                }}
                onClose={() => {
                  setEditing(null);
                  setPage(1);
                  setRevision((v) => v + 1);
                }}
              />
            ) : (
              <CredentialForm
                item={editing.item}
                employees={editing.employees}
                companyCode={user!.companyCode!}
                readOnly={!manage}
                onDelete={
                  manage && editing.item
                    ? () => setEditing({ item: editing.item, employees: [], remove: true })
                    : undefined
                }
                setLocked={(value) => {
                  formLock.current = value;
                }}
                onClose={() => {
                  setEditing(null);
                  setRevision((v) => v + 1);
                }}
              />
            ))}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const uiStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 70,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748b",
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: "#059669",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  addBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statCardActive: {
    borderColor: "#0f172a",
    borderWidth: 2,
  },
  statCardActiveGreen: {
    borderColor: "#059669",
    borderWidth: 2,
  },
  statCardActiveAmber: {
    borderColor: "#d97706",
    borderWidth: 2,
  },
  statCardActiveRose: {
    borderColor: "#e11d48",
    borderWidth: 2,
  },
  statNumber: {
    fontSize: 17,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 2,
  },
  searchCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    paddingVertical: 0,
  },
  clearInputBtn: {
    padding: 4,
  },
  clearInputText: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "700",
  },
  searchSubmitBtn: {
    backgroundColor: "#059669",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  searchSubmitText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  filterBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  filterToggleBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  filterToggleBtnActive: {
    backgroundColor: "#ecfdf5",
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  filterToggleTextActive: {
    color: "#059669",
  },
  resetFiltersBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetFiltersText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e11d48",
  },
  filterPanel: {
    gap: 12,
    paddingTop: 4,
  },
  filterDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 4,
  },
  filterSection: {
    gap: 6,
  },
  filterSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  filterChip: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterChipActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  filterChipGreen: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  filterChipAmber: {
    backgroundColor: "#d97706",
    borderColor: "#d97706",
  },
  filterChipRose: {
    backgroundColor: "#e11d48",
    borderColor: "#e11d48",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  filterChipTextBold: {
    color: "#ffffff",
    fontWeight: "700",
  },
  employeePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  employeePickerBtnSelected: {
    borderColor: "#059669",
    backgroundColor: "#f0fdf4",
  },
  employeePickerIcon: {
    fontSize: 16,
  },
  employeePickerText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  employeePickerTextSelected: {
    color: "#059669",
    fontWeight: "700",
  },
  clearEmployeeBtn: {
    padding: 4,
    backgroundColor: "#fee2e2",
    borderRadius: 10,
  },
  clearEmployeeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ef4444",
    paddingHorizontal: 4,
  },
  employeePickerChevron: {
    fontSize: 12,
    color: "#64748b",
  },
  errorBanner: {
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 12,
    padding: 12,
  },
  errorBannerText: {
    color: "#be123c",
    fontSize: 13,
    lineHeight: 18,
  },
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    paddingHorizontal: 2,
  },
  listCountText: {
    fontSize: 13,
    color: "#64748b",
  },
  listPageIndicator: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 22,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  employeeName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  metaDot: {
    fontSize: 12,
    color: "#94a3b8",
  },
  typePill: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  badgeActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  badgeTextActive: {
    color: "#059669",
  },
  badgeExpiring: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  badgeTextExpiring: {
    color: "#d97706",
  },
  badgeExpired: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
  },
  badgeTextExpired: {
    color: "#e11d48",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  dateLabel: {
    fontSize: 12,
    color: "#64748b",
    marginRight: 6,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  detailLinkBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  detailLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  paginationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 6,
    gap: 6,
  },
  pageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  pageBtnTextDisabled: {
    color: "#94a3b8",
  },
  pageCenterInfo: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    gap: 2,
  },
  pageIndicatorBold: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  pageSubText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyResetBtn: {
    marginTop: 8,
    backgroundColor: "#059669",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  emptyResetBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
