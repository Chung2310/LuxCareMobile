import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import type { DepartmentRecord } from "../../../src/services/departmentService";
import type { UserProfile } from "../../../src/types/common";
import { departments, roster } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { DepartmentForm } from "../../src/features/departments/DepartmentForm";
import { LegacyForm } from "../../src/features/departments/LegacyForm";
import { colors } from "../../src/ui";

const CODE_PALETTES = [
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#dcfce7", text: "#15803d" },
  { bg: "#fef3c7", text: "#b45309" },
  { bg: "#f3e8ff", text: "#7e22ce" },
  { bg: "#ffe4e6", text: "#be123c" },
  { bg: "#ccfbf1", text: "#0f766e" },
];

function getCodePalette(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CODE_PALETTES.length;
  return CODE_PALETTES[index];
}
export default function Departments() {
  const { user } = useSession();
  const canManage = ["admin", "superadmin"].includes(user?.role || "");

  const [data, setData] = useState<DepartmentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);

  // Filter mode: "all" | "active" | "inactive"
  const [filterMode, setFilterMode] = useState<"all" | "active" | "inactive">("all");

  // Modals state
  const [editing, setEditing] = useState<DepartmentRecord | "new" | null>(null);
  const [legacy, setLegacy] = useState(false);
  const legacyLock = useRef(false);

  // People for manager selection
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [peopleRevision, setPeopleRevision] = useState(0);

  useEffect(() => {
    let mounted = true;
    if (!editing) return;
    setPeopleLoading(true);
    setPeopleError(null);
    void roster
      .colleagues()
      .then((value) => {
        if (mounted) setPeople(value);
      })
      .catch((err) => {
        if (mounted) setPeopleError(messageOf(err));
      })
      .finally(() => {
        if (mounted) setPeopleLoading(false);
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

      const activeOnly = filterMode === "active" ? true : undefined;

      void departments
        .list({ search: query, activeOnly })
        .then((value) => {
          if (mounted) {
            if (filterMode === "inactive") {
              setData(value.filter((d) => !d.isActive));
            } else {
              setData(value);
            }
          }
        })
        .catch((err) => {
          if (mounted) setError(messageOf(err));
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });

      return () => {
        mounted = false;
      };
    }, [query, revision, user?.uid, filterMode]),
  );

  const handleSearchSubmit = () => {
    setQuery(search.trim());
    setPage(1);
    setRevision((v) => v + 1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setQuery("");
    setFilterMode("all");
    setPage(1);
    setRevision((v) => v + 1);
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await departments.delete(id);
      setEditing(null);
      setPage(1);
      setRevision((v) => v + 1);
    } catch (err) {
      setError(messageOf(err));
    }
  };

  // Pagination state
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  // Metrics calculation
  const totalCount = data.length;
  const activeCount = data.filter((d) => d.isActive).length;
  const inactiveCount = data.filter((d) => !d.isActive).length;

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const pagedData = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Phòng ban</Text>
          <Text style={styles.pageSubtitle}>Sơ đồ tổ chức & phân bổ nhân sự</Text>
        </View>

        {canManage && (
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setEditing("new")}
          >
            <Text style={styles.addBtnText}>+ Thêm mới</Text>
          </Pressable>
        )}
      </View>

      {/* FlatList for all content */}
      <FlatList
        style={styles.flatList}
        contentContainerStyle={styles.listContent}
        data={pagedData}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => setRevision((v) => v + 1)}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerComponent}>
            {/* Quick Stat Metric Badges */}
            <View style={styles.statsRow}>
              {/* All Card */}
              <Pressable
                style={[styles.statCard, filterMode === "all" && styles.statCardActive]}
                onPress={() => {
                  setFilterMode("all");
                  setPage(1);
                }}
              >
                <Text style={[styles.statCount, filterMode === "all" && styles.statCountActive]}>
                  {totalCount}
                </Text>
                <Text style={[styles.statLabel, filterMode === "all" && styles.statLabelActive]}>
                  Tất cả phòng ban
                </Text>
              </Pressable>

              {/* Active Card */}
              <Pressable
                style={[styles.statCard, filterMode === "active" && styles.statCardActive]}
                onPress={() => {
                  setFilterMode("active");
                  setPage(1);
                }}
              >
                <Text style={[styles.statCount, filterMode === "active" && styles.statCountActive]}>
                  {activeCount}
                </Text>
                <Text style={[styles.statLabel, filterMode === "active" && styles.statLabelActive]}>
                  Đang hoạt động
                </Text>
              </Pressable>

              {/* Inactive Card */}
              <Pressable
                style={[styles.statCard, filterMode === "inactive" && styles.statCardActive]}
                onPress={() => {
                  setFilterMode("inactive");
                  setPage(1);
                }}
              >
                <Text style={[styles.statCount, filterMode === "inactive" && styles.statCountActive]}>
                  {inactiveCount}
                </Text>
                <Text style={[styles.statLabel, filterMode === "inactive" && styles.statLabelActive]}>
                  Tạm ngừng
                </Text>
              </Pressable>
            </View>

            {/* Search & Actions Card */}
            <View style={styles.filterCard}>
              <View style={styles.searchRow}>
                <View style={styles.searchInputWrap}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Tìm theo mã hoặc tên phòng ban..."
                    placeholderTextColor="#94a3b8"
                    value={search}
                    onChangeText={setSearch}
                    onSubmitEditing={handleSearchSubmit}
                    returnKeyType="search"
                  />
                  {search.length > 0 && (
                    <Pressable
                      onPress={() => {
                        setSearch("");
                        setQuery("");
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

              {canManage && (
                <Pressable
                  style={({ pressed }) => [styles.legacyBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => setLegacy(true)}
                >
                  <Text style={styles.legacyBtnIcon}>🔄</Text>
                  <Text style={styles.legacyBtnText}>Chuẩn hóa tên phòng ban cũ</Text>
                </Pressable>
              )}
            </View>

            {/* Error Banner */}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {error}</Text>
              </View>
            )}

            {/* List count summary */}
            <View style={styles.listHeaderRow}>
              <Text style={styles.listCountText}>
                Tìm thấy <Text style={{ fontWeight: "700", color: "#0f172a" }}>{data.length}</Text> phòng ban
              </Text>
              <Text style={styles.listPageIndicator}>
                Trang {page}/{totalPages}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.loadingText}>Đang tải danh sách phòng ban...</Text>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🏢</Text>
              <Text style={styles.emptyTitle}>Không có phòng ban phù hợp</Text>
              <Text style={styles.emptyText}>
                Không tìm thấy phòng ban nào khớp với điều kiện lọc hiện tại.
              </Text>
              {(query || filterMode !== "all") && (
                <Pressable style={styles.emptyResetBtn} onPress={handleResetFilters}>
                  <Text style={styles.emptyResetBtnText}>Xóa bộ lọc</Text>
                </Pressable>
              )}
            </View>
          )
        }
        ListFooterComponent={
          data.length > 0 ? (
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
                  {`Hiển thị ${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                    page * PAGE_SIZE,
                    data.length,
                  )} / ${data.length} phòng ban`}
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
          ) : null
        }
        renderItem={({ item }) => {
          const palette = getCodePalette(item.code || item.name);

          return (
            <Pressable
              style={({ pressed }) => [styles.deptCard, pressed && { opacity: 0.92 }]}
              onPress={() => setEditing(item)}
            >
              {/* Card Header: Code Badge, Name & Status */}
              <View style={styles.cardHeaderRow}>
                <View style={[styles.codeBadge, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.codeBadgeText, { color: palette.text }]}>
                    {item.code}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.deptName}>{item.name}</Text>
                  <Text style={styles.deptOrder}>Thứ tự hiển thị: #{item.sortOrder}</Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    item.isActive ? styles.statusBadgeActive : styles.statusBadgeInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      item.isActive
                        ? styles.statusBadgeTextActive
                        : styles.statusBadgeTextInactive,
                    ]}
                  >
                    {item.isActive ? "Hoạt động" : "Tạm ngừng"}
                  </Text>
                </View>
              </View>

              {/* Description if present */}
              {!!item.description && (
                <Text style={styles.deptDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              )}

              {/* Info Row: Employee count & Manager */}
              <View style={styles.infoRow}>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>👥 Nhân sự</Text>
                  <Text style={styles.infoValue}>
                    {item.employeeCount ?? 0} thành viên
                  </Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>👤 Trưởng bộ phận</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {item.managerName || "Chưa phân công"}
                  </Text>
                </View>
              </View>

              {/* Card Footer: Detail Link */}
              <View style={styles.cardFooterRow}>
                <View style={{ flex: 1 }} />
                <View style={styles.detailLinkBadge}>
                  <Text style={styles.detailLinkText}>
                    {canManage ? "Chỉnh sửa & Chi tiết →" : "Xem chi tiết →"}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Department Create / Edit Modal */}
      <Modal
        visible={editing !== null}
        animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        {editing && (
          <DepartmentForm
            editing={editing}
            people={people}
            peopleLoading={peopleLoading}
            peopleError={peopleError}
            onRetryPeople={() => setPeopleRevision((v) => v + 1)}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              setRevision((v) => v + 1);
            }}
            onDelete={remove}
            canManage={canManage}
          />
        )}
      </Modal>

      {/* Legacy Department Normalization Modal */}
      <Modal
        visible={legacy}
        animationType="slide"
        onRequestClose={() => {
          if (!legacyLock.current) {
            setLegacy(false);
            setRevision((v) => v + 1);
          }
        }}
      >
        {legacy && (
          <LegacyForm
            onClose={() => {
              setLegacy(false);
              setRevision((v) => v + 1);
            }}
            setLocked={(value) => {
              legacyLock.current = value;
            }}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
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
  flatList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 70,
    gap: 12,
  },
  headerComponent: {
    gap: 12,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statCardActive: {
    borderColor: "#059669",
    backgroundColor: "#ecfdf5",
  },
  statCount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  statCountActive: {
    color: "#059669",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 2,
  },
  statLabelActive: {
    color: "#059669",
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
  legacyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  legacyBtnIcon: {
    fontSize: 13,
  },
  legacyBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
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
  deptCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 10,
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
  codeBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  codeBadgeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  deptName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  deptOrder: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusBadgeActive: {
    backgroundColor: "#dcfce7",
  },
  statusBadgeInactive: {
    backgroundColor: "#f1f5f9",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusBadgeTextActive: {
    color: "#15803d",
  },
  statusBadgeTextInactive: {
    color: "#64748b",
  },
  deptDesc: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailLinkBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  loadingBox: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
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
  listPageIndicator: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
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
    marginTop: 8,
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
