import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
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
import type { Contract, Employee } from "../../../src/types/hrContract";
import { ContractForm } from "../../src/features/contracts/ContractForm";
import { ExtensionForm } from "../../src/features/contracts/ExtensionForm";
import type { ContractList } from "../../../src/services/hrContractService";
import { contracts } from "../../src/api/services";
import { useSession, messageOf } from "../../src/auth/SessionProvider";
import { colors } from "../../src/ui";
import {
  canManageContracts,
  canReadContracts,
  contractDate,
  contractStatuses,
} from "../../src/features/contracts/model";
import { ALL_EMPLOYEES } from "../../src/features/contracts/employeeFilterModel";
import { EmployeeSelectModal } from "../../src/features/credentials/EmployeeSelectModal";

const AVATAR_PALETTES = [
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#dcfce7", text: "#15803d" },
  { bg: "#fef3c7", text: "#b45309" },
  { bg: "#f3e8ff", text: "#7e22ce" },
  { bg: "#ffe4e6", text: "#be123c" },
  { bg: "#ccfbf1", text: "#0f766e" },
];

function getAvatarColors(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function getDaysRemaining(endDateStr: string) {
  const end = new Date(endDateStr).getTime();
  if (Number.isNaN(end)) return null;
  const now = Date.now();
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

export default function Contracts() {
  const { user, selectedBranch } = useSession();
  const allowed = canReadContracts(user);
  const manage = canManageContracts(user);

  const [editing, setEditing] = useState<{
    contract?: Contract;
    employees: Employee[];
    extension?: boolean;
    readOnly?: boolean;
  } | null>(null);

  const formLock = useRef(false);
  const branchId = selectedBranch?._id || user?.branchId || undefined;

  // Data & query states
  const [data, setData] = useState<ContractList | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState(ALL_EMPLOYEES);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [expiring, setExpiring] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setData(null);
      setError(null);
      setLoading(false);
      if (!allowed || !user?.companyCode) return;
      setLoading(true);

      void contracts
        .list({
          companyCode: user.companyCode,
          branchId,
          page,
          limit: 15,
          search,
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
    }, [allowed, user?.companyCode, branchId, page, search, employee.value, revision]),
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
    setExpiring(false);
    setPage(1);
    setRevision((v) => v + 1);
  };

  if (!allowed) {
    return (
      <SafeAreaView edges={["top"]} style={styles.container}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🔒</Text>
          <Text style={styles.emptyTitle}>Không có quyền truy cập</Text>
          <Text style={styles.emptyText}>
            Bạn cần phân hệ nhân sự và quyền xem hợp đồng lao động để truy cập mục này.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const rows = data ? (expiring ? data.expiringContracts : data.contracts) : [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const branchEmployees = (data?.employees || []).filter(
    (emp: Employee & { branchId?: string }) => !branchId || !emp.branchId || emp.branchId === branchId,
  );
  const activeFiltersCount =
    (search ? 1 : 0) + (employee.value ? 1 : 0) + (expiring ? 1 : 0);

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Hợp đồng nhân sự</Text>
            <Text style={styles.pageSubtitle}>
              {selectedBranch?.name || (branchId ? "Chi nhánh hiện tại" : "Toàn bộ doanh nghiệp")}
            </Text>
          </View>

          {manage && (
            <Pressable
              style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
              disabled={loading || !data || !!error}
              onPress={() =>
                setEditing({
                  employees: branchEmployees,
                })
              }
            >
              <Text style={styles.addBtnText}>+ Tạo hợp đồng</Text>
            </Pressable>
          )}
        </View>

        {/* Quick Summary Stat Badges */}
        {data && (
          <View style={styles.statsRow}>
            {/* All Contracts Card */}
            <Pressable
              style={[styles.statCard, !expiring && styles.statCardActive]}
              onPress={() => {
                if (expiring) {
                  setExpiring(false);
                  setPage(1);
                }
              }}
            >
              <Text style={[styles.statCount, !expiring && styles.statCountActive]}>
                {data.total}
              </Text>
              <Text style={[styles.statLabel, !expiring && styles.statLabelActive]}>
                Tất cả HĐ
              </Text>
            </Pressable>

            {/* Expiring Soon Card */}
            <Pressable
              style={[
                styles.statCard,
                styles.statCardExpiring,
                expiring && styles.statCardExpiringActive,
              ]}
              onPress={() => {
                setExpiring(true);
                setPage(1);
              }}
            >
              <View style={styles.statCountRow}>
                <Text
                  style={[
                    styles.statCount,
                    styles.statCountExpiring,
                    expiring && { color: "#b45309" },
                  ]}
                >
                  {data.expiringContracts.length}
                </Text>
                {data.expiringContracts.length > 0 && (
                  <View style={styles.alertDot} />
                )}
              </View>
              <Text
                style={[
                  styles.statLabel,
                  styles.statLabelExpiring,
                  expiring && { color: "#b45309" },
                ]}
              >
                Sắp hết hạn (20 ngày)
              </Text>
            </Pressable>
          </View>
        )}

        {/* Search & Filter Bar */}
        <View style={styles.filterCard}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm tên nhân viên hoặc loại hợp đồng..."
                placeholderTextColor="#94a3b8"
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
              />
              {draft.length > 0 && (
                <Pressable
                  onPress={() => {
                    setDraft("");
                    setSearch("");
                    setPage(1);
                    setRevision((v) => v + 1);
                  }}
                  style={styles.clearBtn}
                >
                  <Text style={styles.clearBtnText}>✕</Text>
                </Pressable>
              )}
            </View>

            <Pressable
              style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.85 }]}
              onPress={handleSearchSubmit}
            >
              <Text style={styles.searchBtnText}>Tìm</Text>
            </Pressable>
          </View>

          {/* Filter Toggle Row */}
          <View style={styles.filterActionRow}>
            <Pressable
              style={[styles.filterToggleBtn, filterExpanded && styles.filterToggleBtnActive]}
              onPress={() => setFilterExpanded((v) => !v)}
            >
              <Text style={styles.filterToggleIcon}>⚙️</Text>
              <Text style={styles.filterToggleText}>Lọc nhân sự & thời hạn</Text>
              {activeFiltersCount > 0 && (
                <View style={styles.activeFiltersCountBadge}>
                  <Text style={styles.activeFiltersCountText}>{activeFiltersCount}</Text>
                </View>
              )}
              <Text style={styles.chevronIcon}>{filterExpanded ? "▲" : "▼"}</Text>
            </Pressable>

            {activeFiltersCount > 0 && (
              <Pressable style={styles.resetBtn} onPress={handleResetFilters}>
                <Text style={styles.resetBtnText}>Đặt lại</Text>
              </Pressable>
            )}
          </View>

          {/* Collapsible Filter Detail */}
          {filterExpanded && (
            <View style={styles.filterExpandBox}>
              <Text style={styles.filterSectionTitle}>Nhân sự áp dụng</Text>
              <Pressable
                style={styles.employeeFilterSelectBtn}
                onPress={() => setEmployeeModalOpen(true)}
              >
                <Text style={styles.employeeFilterIcon}>👤</Text>
                <Text style={styles.employeeFilterName} numberOfLines={1}>
                  {employee.value ? employee.label : "Tất cả nhân viên"}
                </Text>
                <Text style={styles.employeeFilterChangeText}>Đổi ›</Text>
              </Pressable>

              <Text style={[styles.filterSectionTitle, { marginTop: 8 }]}>Chế độ xem thời hạn</Text>
              <View style={styles.quickChipsRow}>
                <Pressable
                  style={[styles.quickChip, !expiring && styles.quickChipActive]}
                  onPress={() => {
                    setExpiring(false);
                    setPage(1);
                  }}
                >
                  <Text style={[styles.quickChipText, !expiring && styles.quickChipTextActive]}>
                    Toàn bộ danh sách
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.quickChip, expiring && styles.quickChipActive]}
                  onPress={() => {
                    setExpiring(true);
                    setPage(1);
                  }}
                >
                  <Text style={[styles.quickChipText, expiring && styles.quickChipTextActive]}>
                    Sắp hết hạn trong 20 ngày {data ? `(${data.expiringContracts.length})` : ""}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Loading Spinner */}
        {loading && !data && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>Đang tải danh sách hợp đồng...</Text>
          </View>
        )}

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Contracts List */}
        {data && (
          <>
            <View style={styles.listHeaderRow}>
              <Text style={styles.listCountText}>
                {expiring
                  ? `Có ${rows.length} hợp đồng sắp hết hạn`
                  : `Tìm thấy ${data.total} hợp đồng`}
              </Text>
              <Text style={styles.listPageIndicator}>
                Trang {page}/{totalPages}
              </Text>
            </View>

            {rows.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>Không tìm thấy hợp đồng</Text>
                <Text style={styles.emptyText}>
                  Không có hồ sơ hợp đồng nào phù hợp với điều kiện tìm kiếm. Hãy thử đổi từ khóa hoặc đặt lại bộ lọc.
                </Text>
                {activeFiltersCount > 0 && (
                  <Pressable style={styles.emptyResetBtn} onPress={handleResetFilters}>
                    <Text style={styles.emptyResetBtnText}>Xóa toàn bộ bộ lọc</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              rows.map((item) => {
                const colorsPalette = getAvatarColors(item.employeeName || item._id);
                const daysRemaining = getDaysRemaining(item.endDate);

                const statusBg =
                  item.status === "active"
                    ? "#dcfce7"
                    : item.status === "expired"
                    ? "#ffe4e6"
                    : item.status === "terminated"
                    ? "#f3e8ff"
                    : "#f1f5f9";

                const statusColor =
                  item.status === "active"
                    ? "#15803d"
                    : item.status === "expired"
                    ? "#be123c"
                    : item.status === "terminated"
                    ? "#7e22ce"
                    : "#475569";

                return (
                  <Pressable
                    key={item._id}
                    style={({ pressed }) => [styles.contractCard, pressed && { opacity: 0.92 }]}
                    onPress={() =>
                      setEditing({
                        contract: item,
                        employees: branchEmployees,
                        readOnly: !manage,
                      })
                    }
                  >
                    {/* Header: Avatar, Name & Status Badge */}
                    <View style={styles.cardHeaderRow}>
                      <View
                        style={[
                          styles.avatarBox,
                          { backgroundColor: colorsPalette.bg },
                        ]}
                      >
                        <Text style={[styles.avatarText, { color: colorsPalette.text }]}>
                          {(item.employeeName || "U").charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardEmployeeName}>{item.employeeName}</Text>
                        <View style={styles.contractTypePill}>
                          <Text style={styles.contractTypeText}>{item.contractType}</Text>
                        </View>
                      </View>

                      <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                        <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                          {contractStatuses[item.status] || item.status}
                        </Text>
                      </View>
                    </View>

                    {/* Contract Dates Info Bar */}
                    <View style={styles.cardDateBar}>
                      <View style={styles.dateColItem}>
                        <Text style={styles.dateColLabel}>Bắt đầu</Text>
                        <Text style={styles.dateColValue}>{contractDate(item.startDate)}</Text>
                      </View>

                      <Text style={styles.dateArrowIcon}>→</Text>

                      <View style={styles.dateColItem}>
                        <Text style={styles.dateColLabel}>Hết hạn</Text>
                        <Text
                          style={[
                            styles.dateColValue,
                            item.status === "expired" && { color: "#e11d48", fontWeight: "700" },
                            daysRemaining !== null && daysRemaining <= 20 && daysRemaining > 0 && {
                              color: "#b45309",
                              fontWeight: "700",
                            },
                          ]}
                        >
                          {contractDate(item.endDate)}
                        </Text>
                      </View>

                      {daysRemaining !== null && (
                        <View
                          style={[
                            styles.daysBadge,
                            daysRemaining <= 0
                              ? styles.daysBadgeExpired
                              : daysRemaining <= 20
                              ? styles.daysBadgeWarning
                              : styles.daysBadgeNormal,
                          ]}
                        >
                          <Text
                            style={[
                              styles.daysBadgeText,
                              daysRemaining <= 0
                                ? styles.daysBadgeTextExpired
                                : daysRemaining <= 20
                                ? styles.daysBadgeTextWarning
                                : styles.daysBadgeTextNormal,
                            ]}
                          >
                            {daysRemaining <= 0
                              ? "Hết hạn"
                              : daysRemaining === 1
                              ? "Còn 1 ngày"
                              : `Còn ${daysRemaining} ngày`}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Card Footer: Action buttons */}
                    <View style={styles.cardFooterRow}>
                      {manage && (
                        <Pressable
                          style={styles.extendBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            setEditing({
                              contract: item,
                              employees: branchEmployees,
                              extension: true,
                            });
                          }}
                        >
                          <Text style={styles.extendBtnText}>⚡ Gia hạn</Text>
                        </Pressable>
                      )}

                      <View style={styles.detailLinkBadge}>
                        <Text style={styles.detailLinkText}>
                          {manage ? "Chỉnh sửa & Chi tiết →" : "Xem chi tiết →"}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}

            {/* Always Visible, Prominent Pagination Bar */}
            {!expiring && (
              <View style={styles.paginationCard}>
                <Pressable
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                  disabled={page <= 1}
                  onPress={() => setPage((v) => Math.max(1, v - 1))}
                >
                  <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>
                    ‹ Trước
                  </Text>
                </Pressable>

                <View style={styles.pageCenterInfo}>
                  <Text style={styles.pageIndicatorBold}>
                    Trang {page} / {totalPages}
                  </Text>
                  <Text style={styles.pageSubText} numberOfLines={1}>
                    {data.total > 0
                      ? `Hiển thị ${(page - 1) * data.limit + 1}–${Math.min(
                          page * data.limit,
                          data.total,
                        )} / ${data.total} hợp đồng`
                      : "0 hợp đồng"}
                  </Text>
                </View>

                <Pressable
                  style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
                  disabled={page >= totalPages}
                  onPress={() => setPage((v) => Math.min(totalPages, v + 1))}
                >
                  <Text
                    style={[
                      styles.pageBtnText,
                      page >= totalPages && styles.pageBtnTextDisabled,
                    ]}
                  >
                    Sau ›
                  </Text>
                </Pressable>
              </View>
            )}
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

      {/* Detail / Edit / Create / Extension Modal */}
      <Modal
        visible={!!editing}
        animationType="slide"
        onRequestClose={() => {
          if (!formLock.current) {
            setEditing(null);
            setRevision((v) => v + 1);
          }
        }}
      >
        <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#f8fafc" }}>
          {editing &&
            (editing.extension && editing.contract ? (
              <ExtensionForm
                contract={editing.contract}
                scope={{ companyCode: user!.companyCode!, branchId }}
                setLocked={(value) => {
                  formLock.current = value;
                }}
                onClose={() => {
                  setEditing(null);
                  setRevision((v) => v + 1);
                }}
              />
            ) : (
              <ContractForm
                contract={editing.contract}
                employees={editing.employees}
                scope={{ companyCode: user!.companyCode!, branchId }}
                setLocked={(value) => {
                  formLock.current = value;
                }}
                onClose={() => {
                  setEditing(null);
                  setRevision((v) => v + 1);
                }}
                readOnly={editing.readOnly}
              />
            ))}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    borderRadius: 12,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statCardActive: {
    borderColor: "#059669",
    backgroundColor: "#ecfdf5",
  },
  statCardExpiring: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  statCardExpiringActive: {
    borderColor: "#d97706",
    backgroundColor: "#fef3c7",
  },
  statCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statCount: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  statCountActive: {
    color: "#059669",
  },
  statCountExpiring: {
    color: "#d97706",
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 2,
  },
  statLabelActive: {
    color: "#059669",
  },
  statLabelExpiring: {
    color: "#b45309",
  },
  filterCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 42,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  clearBtnText: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "700",
  },
  searchBtn: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  filterActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  filterToggleBtnActive: {
    opacity: 0.8,
  },
  filterToggleIcon: {
    fontSize: 14,
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  activeFiltersCountBadge: {
    backgroundColor: "#059669",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  activeFiltersCountText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  chevronIcon: {
    fontSize: 10,
    color: "#64748b",
  },
  resetBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetBtnText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "700",
  },
  filterExpandBox: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
    gap: 8,
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  employeeFilterSelectBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  employeeFilterIcon: {
    fontSize: 14,
  },
  employeeFilterName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  employeeFilterChangeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  quickChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickChip: {
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  quickChipActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  quickChipText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },
  quickChipTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
  },
  errorBanner: {
    backgroundColor: "#fff1f2",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorBannerText: {
    color: "#e11d48",
    fontSize: 13,
    fontWeight: "600",
  },
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  listCountText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  listPageIndicator: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
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
  contractCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "800",
  },
  cardEmployeeName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  contractTypePill: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 3,
  },
  contractTypeText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardDateBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    gap: 8,
  },
  dateColItem: {
    flex: 1,
  },
  dateColLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  dateColValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginTop: 1,
  },
  dateArrowIcon: {
    fontSize: 12,
    color: "#cbd5e1",
  },
  daysBadge: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  daysBadgeNormal: {
    backgroundColor: "#ecfdf5",
  },
  daysBadgeWarning: {
    backgroundColor: "#fef3c7",
  },
  daysBadgeExpired: {
    backgroundColor: "#ffe4e6",
  },
  daysBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  daysBadgeTextNormal: {
    color: "#059669",
  },
  daysBadgeTextWarning: {
    color: "#b45309",
  },
  daysBadgeTextExpired: {
    color: "#e11d48",
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  extendBtn: {
    backgroundColor: "#fef3c7",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  extendBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b45309",
  },
  detailLinkBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
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
});
