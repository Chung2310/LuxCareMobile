import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { emptyPagination, type PaginationMeta } from "../../../src/types/pagination";
import {
  LEAVE_STATUS_LABELS,
  REQUEST_KIND_OPTIONS,
  type LeaveApplication,
  type LeaveTemplate,
  type RequestKind,
} from "../../../src/types/leave";
import { leave } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { LeaveForm } from "../../src/features/leave/LeaveForm";
import { LeaveTemplates } from "../../src/features/leave/LeaveTemplates";
import { shareLeaveFile } from "../../src/features/leave/files";
import { canDeleteLeave, filterLeavePage } from "../../src/features/leave/model";

const KIND_THEMES: Record<
  RequestKind,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; border: string }
> = {
  leave: { label: "Nghỉ phép", icon: "calendar-outline", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  wfh: { label: "Làm tại nhà", icon: "home-outline", color: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe" },
  exception: { label: "Ngoại lệ", icon: "time-outline", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  event: { label: "Sự kiện", icon: "briefcase-outline", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
};

export default function LeaveScreen() {
  const { user } = useSession();
  const params = useLocalSearchParams<{ create?: string; from?: string }>();
  const allowed = canUseModule(user, "hr");

  const [items, setItems] = useState<LeaveApplication[]>([]);
  const [templates, setTemplates] = useState<LeaveTemplate[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<RequestKind | "">("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const modalLock = useRef(false);
  const [revision, setRevision] = useState(0);

  const [modal, setModal] = useState<"create" | "templates" | null>(null);
  const [decision, setDecision] = useState<{ item: LeaveApplication; type: "approved" | "rejected" } | null>(null);
  const [approvalType, setApprovalType] = useState<"justified" | "unjustified">("justified");
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // Auto-open create modal if query parameter create=1 or create=true
  useEffect(() => {
    if (params.create === "1" || params.create === "true") {
      setModal("create");
    }
  }, [params.create]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!allowed) return;
      setLoading(true);
      setError(null);
      setTemplateError(null);
      setItems([]);
      void leave
        .listApplications(page)
        .then((result) => {
          if (active) {
            setItems(result.data);
            setPagination(result.pagination);
          }
        })
        .catch((err) => {
          if (active) setError(messageOf(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      void leave
        .listTemplates()
        .then((data) => {
          if (active) setTemplates(data || []);
        })
        .catch((err) => {
          if (active) {
            setTemplates([]);
            setTemplateError(messageOf(err));
          }
        });
      return () => {
        active = false;
      };
    }, [allowed, page, revision, user?.uid]),
  );

  const reloadTemplates = async () => {
    setTemplates((await leave.listTemplates()) || []);
  };

  const refresh = () => {
    setPage(1);
    setRevision((value) => value + 1);
  };

  const run = async (action: () => Promise<void>, deciding = false) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setDecisionError(null);
    try {
      await action();
    } catch (err) {
      (deciding ? setDecisionError : setError)(messageOf(err));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };

  const filteredItems = useMemo(
    () => filterLeavePage(items, search, kind, status),
    [items, search, kind, status],
  );

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === "pending").length,
    [items],
  );

  if (!allowed) {
    return (
      <SafeAreaView style={s.page}>
        <View style={s.notAllowedCard}>
          <Ionicons name="lock-closed-outline" size={48} color="#94a3b8" />
          <Text style={s.notAllowedTitle}>Chưa được cấp quyền</Text>
          <Text style={s.notAllowedSub}>
            Phân hệ nhân sự & đơn từ chưa được kích hoạt cho tài khoản này. Vui lòng liên hệ quản trị viên.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.page} edges={["top"]}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        data={filteredItems}
        keyExtractor={(item) => item._id}
        refreshing={loading}
        onRefresh={() => setRevision((v) => v + 1)}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={s.headerWrap}>
            {/* Top Bar Header */}
            <View style={s.topRow}>
              <Pressable
                style={s.backBtn}
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
                <Text style={s.screenTitle}>Đơn từ & Phép</Text>
                <Text style={s.screenSubtitle}>Quản lý nghỉ phép, WFH & giải trình công</Text>
              </View>
            </View>

            {/* Quick Action Buttons */}
            <View style={s.actionRow}>
              <Pressable
                style={({ pressed }) => [s.primaryCreateBtn, pressed && s.primaryCreateBtnPressed]}
                onPress={() => setModal("create")}
                disabled={busy}
              >
                <Ionicons name="add-circle" size={20} color="#ffffff" />
                <Text style={s.primaryCreateBtnText}>Nộp đơn mới</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [s.secondaryTplBtn, pressed && s.secondaryTplBtnPressed]}
                onPress={() => setModal("templates")}
                disabled={busy}
              >
                <Ionicons name="document-text-outline" size={18} color="#475569" />
                <Text style={s.secondaryTplBtnText}>Biểu mẫu</Text>
              </Pressable>
            </View>

            {/* Status Filter Tabs */}
            <View style={s.statusTabs}>
              {[
                { key: "", label: "Tất cả" },
                { key: "pending", label: "Chờ duyệt", count: pendingCount },
                { key: "approved", label: "Đã duyệt" },
                { key: "rejected", label: "Từ chối" },
              ].map((tab) => {
                const isActive = status === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    style={[s.statusTab, isActive && s.statusTabActive]}
                    onPress={() => setStatus(tab.key)}
                  >
                    <Text style={[s.statusTabText, isActive && s.statusTabTextActive]}>
                      {tab.label}
                    </Text>
                    {!!tab.count && tab.count > 0 && (
                      <View style={[s.countBadge, isActive && s.countBadgeActive]}>
                        <Text style={[s.countBadgeText, isActive && s.countBadgeTextActive]}>
                          {tab.count}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Search Bar */}
            <View style={s.searchWrap}>
              <Ionicons name="search" size={18} color="#94a3b8" />
              <TextInput
                style={s.searchInput}
                placeholder="Tìm theo tên nhân viên, lý do, tiêu đề..."
                placeholderTextColor="#94a3b8"
                value={search}
                onChangeText={setSearch}
              />
              {!!search && (
                <Pressable onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </Pressable>
              )}
            </View>

            {/* Kind filter chips */}
            <View style={s.kindChipsWrap}>
              <Pressable
                style={[s.kindChip, kind === "" && s.kindChipActive]}
                onPress={() => setKind("")}
              >
                <Text style={[s.kindChipText, kind === "" && s.kindChipTextActive]}>Tất cả loại</Text>
              </Pressable>
              {REQUEST_KIND_OPTIONS.map((opt) => {
                const isSelected = kind === opt.value;
                const theme = KIND_THEMES[opt.value];
                return (
                  <Pressable
                    key={opt.value}
                    style={[
                      s.kindChip,
                      isSelected && {
                        backgroundColor: theme.bg,
                        borderColor: theme.color,
                      },
                    ]}
                    onPress={() => setKind(isSelected ? "" : opt.value)}
                  >
                    <Ionicons
                      name={theme.icon}
                      size={14}
                      color={isSelected ? theme.color : "#64748b"}
                    />
                    <Text
                      style={[
                        s.kindChipText,
                        isSelected && { color: theme.color, fontWeight: "700" },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Error alerts if any */}
            {!!error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#e11d48" />
                <Text style={s.errorText}>{error}</Text>
                <Pressable onPress={() => setRevision((v) => v + 1)}>
                  <Text style={s.retryLink}>Thử lại</Text>
                </Pressable>
              </View>
            )}
            {!!templateError && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#e11d48" />
                <Text style={s.errorText}>{templateError}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={s.centerBox}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={s.loadingText}>Đang tải danh sách đơn từ...</Text>
            </View>
          ) : !error ? (
            <View style={s.emptyBox}>
              <View style={s.emptyIconCircle}>
                <Ionicons name="document-text-outline" size={38} color="#94a3b8" />
              </View>
              <Text style={s.emptyTitle}>Không tìm thấy đơn từ nào</Text>
              <Text style={s.emptySub}>
                {search || kind || status
                  ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm để xem kết quả"
                  : "Bạn chưa có đơn từ nào. Bấm nút bên dưới để tạo đơn đầu tiên!"}
              </Text>
              {!search && !kind && !status && (
                <Pressable style={s.emptyCreateBtn} onPress={() => setModal("create")}>
                  <Ionicons name="add" size={18} color="#ffffff" />
                  <Text style={s.emptyCreateBtnText}>Nộp đơn ngay</Text>
                </Pressable>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isPending = item.status === "pending";
          const isApproved = item.status === "approved";
          const isRejected = item.status === "rejected";

          const statusBadge = isApproved
            ? { label: "Đã duyệt", bg: "#ecfdf5", border: "#a7f3d0", text: "#047857", icon: "checkmark-circle" as const }
            : isRejected
              ? { label: "Từ chối", bg: "#fff1f2", border: "#fecdd3", text: "#be123c", icon: "close-circle" as const }
              : { label: "Chờ duyệt", bg: "#fffbeb", border: "#fde68a", text: "#b45309", icon: "time" as const };

          const theme = KIND_THEMES[item.requestKind] || KIND_THEMES.leave;
          const authorInitial = (item.employeeName || "NV")
            .split(" ")
            .map((n) => n[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase();

          const attachments = item.attachments?.length
            ? item.attachments
            : item.uploadedFileUrl
              ? [{ url: item.uploadedFileUrl, name: item.uploadedFileName || "Minh chứng" }]
              : [];

          return (
            <View style={s.itemCard}>
              {/* Card Header */}
              <View style={s.cardHeader}>
                <View style={[s.kindTag, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <Ionicons name={theme.icon} size={14} color={theme.color} />
                  <Text style={[s.kindTagText, { color: theme.color }]}>
                    {item.type || theme.label}
                  </Text>
                </View>

                <View
                  style={[
                    s.statusBadge,
                    { backgroundColor: statusBadge.bg, borderColor: statusBadge.border },
                  ]}
                >
                  <Ionicons name={statusBadge.icon} size={13} color={statusBadge.text} />
                  <Text style={[s.statusBadgeText, { color: statusBadge.text }]}>
                    {statusBadge.label}
                  </Text>
                </View>
              </View>

              {/* Submitter & Dates */}
              <View style={s.cardUserRow}>
                <View style={s.userAvatar}>
                  <Text style={s.userAvatarText}>{authorInitial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardUserName}>{item.employeeName}</Text>
                  <View style={s.dateRangeRow}>
                    <Ionicons name="calendar-outline" size={13} color="#64748b" />
                    <Text style={s.dateRangeText}>
                      {new Date(item.startDate).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} –{" "}
                      {new Date(item.endDate).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                    </Text>
                  </View>
                </View>
                {item.chargeableDays !== undefined && (
                  <View style={s.daysBadge}>
                    <Text style={s.daysBadgeText}>{item.chargeableDays} ngày phép</Text>
                  </View>
                )}
              </View>

              {/* Reason quote box */}
              {!!item.reason && (
                <View style={s.reasonBox}>
                  <Text style={s.reasonText}>"{item.reason}"</Text>
                </View>
              )}

              {/* Rejection notice */}
              {!!item.rejectReason && (
                <View style={s.rejectBox}>
                  <Ionicons name="alert-circle-outline" size={16} color="#be123c" />
                  <Text style={s.rejectText}>Lý do từ chối: {item.rejectReason}</Text>
                </View>
              )}

              {/* Approval / note response */}
              {!!(item.approvalNote || item.note) && (
                <View style={s.responseBox}>
                  <Ionicons name="chatbox-outline" size={15} color="#0284c7" />
                  <Text style={s.responseText}>
                    Phản hồi quản lý: {item.approvalNote || item.note}
                  </Text>
                </View>
              )}

              {/* Attachments */}
              {attachments.length > 0 && (
                <View style={s.attachRow}>
                  {attachments.map((file, i) => (
                    <Pressable
                      key={`${file.url}-${i}`}
                      style={({ pressed }) => [s.attachPill, pressed && { opacity: 0.7 }]}
                      onPress={() => void run(() => shareLeaveFile(file.url, file.name))}
                      disabled={busy}
                    >
                      <Ionicons name="attach" size={14} color="#0284c7" />
                      <Text style={s.attachPillText} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Ionicons name="download-outline" size={13} color="#0284c7" />
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Card Footer Actions */}
              <View style={s.cardActionsRow}>
                {/* Manager Decision Buttons */}
                {item.status === "pending" && item.canDecide === true && (
                  <View style={s.managerActionGroup}>
                    <Pressable
                      style={({ pressed }) => [s.approveBtn, pressed && { opacity: 0.85 }]}
                      onPress={() => {
                        setDecision({ item, type: "approved" });
                        setApprovalType("justified");
                        setNote("");
                        setDecisionError(null);
                      }}
                      disabled={busy}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color="#ffffff" />
                      <Text style={s.approveBtnText}>Duyệt đơn</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [s.rejectBtn, pressed && { opacity: 0.85 }]}
                      onPress={() => {
                        setDecision({ item, type: "rejected" });
                        setRejectReason("");
                        setNote("");
                        setDecisionError(null);
                      }}
                      disabled={busy}
                    >
                      <Ionicons name="close-circle-outline" size={16} color="#ffffff" />
                      <Text style={s.rejectBtnText}>Từ chối</Text>
                    </Pressable>
                  </View>
                )}

                {/* Delete Application (Author or Admin) */}
                {canDeleteLeave(item, user) && (
                  <Pressable
                    style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.7 }]}
                    disabled={busy}
                    onPress={() =>
                      Alert.alert("Xóa đơn đang chờ duyệt?", item.type, [
                        { text: "Hủy", style: "cancel" },
                        {
                          text: "Xóa",
                          style: "destructive",
                          onPress: () =>
                            void run(async () => {
                              await leave.remove(item._id);
                              refresh();
                            }),
                        },
                      ])
                    }
                  >
                    <Ionicons name="trash-outline" size={15} color="#e11d48" />
                    <Text style={s.deleteBtnText}>Hủy đơn</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          pagination.totalPages > 1 ? (
            <View style={s.paginationRow}>
              <Pressable
                style={[s.pageBtn, (page <= 1 || busy || loading) && s.pageBtnDisabled]}
                disabled={page <= 1 || busy || loading}
                onPress={() => setPage((v) => v - 1)}
              >
                <Ionicons name="chevron-back" size={16} color={page <= 1 ? "#cbd5e1" : "#475569"} />
                <Text style={[s.pageBtnText, (page <= 1 || busy || loading) && s.pageBtnTextDisabled]}>
                  Trang trước
                </Text>
              </Pressable>

              <Text style={s.pageIndicator}>
                Trang <Text style={{ fontWeight: "700", color: "#0f172a" }}>{page}</Text> /{" "}
                {Math.max(1, pagination.totalPages)}
              </Text>

              <Pressable
                style={[s.pageBtn, (page >= pagination.totalPages || busy || loading) && s.pageBtnDisabled]}
                disabled={page >= pagination.totalPages || busy || loading}
                onPress={() => setPage((v) => v + 1)}
              >
                <Text
                  style={[
                    s.pageBtnText,
                    (page >= pagination.totalPages || busy || loading) && s.pageBtnTextDisabled,
                  ]}
                >
                  Trang sau
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={page >= pagination.totalPages ? "#cbd5e1" : "#475569"}
                />
              </Pressable>
            </View>
          ) : (
            <View style={{ height: 30 }} />
          )
        }
      />

      {/* CREATE MODAL */}
      <Modal
        visible={modal !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!modalLock.current) {
            setModal(null);
            refresh();
          }
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }} edges={["top"]}>
          {modal === "create" && (
            <LeaveForm
              templates={templates}
              setLocked={(value) => {
                modalLock.current = value;
              }}
              onClose={() => {
                setModal(null);
                refresh();
              }}
              onSubmitted={() => {
                setModal(null);
                refresh();
              }}
            />
          )}
          {modal === "templates" && (
            <LeaveTemplates
              templates={templates}
              canManage={hasPermission(user, "timekeeping:manage")}
              reload={reloadTemplates}
              setLocked={(value) => {
                modalLock.current = value;
              }}
              onClose={() => setModal(null)}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* DECISION MODAL (MANAGER APPROVE / REJECT) */}
      <Modal
        visible={decision !== null}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (!lock.current) setDecision(null);
        }}
      >
        <View style={s.modalOverlay}>
          <SafeAreaView style={s.modalSafe}>
            <View style={s.decisionBox}>
              <View style={s.decisionHeader}>
                <View>
                  <Text style={s.decisionTitle}>
                    {decision?.type === "approved" ? "Phê duyệt đơn" : "Từ chối đơn"}
                  </Text>
                  <Text style={s.decisionSub}>
                    {decision?.item.employeeName} · {decision?.item.type}
                  </Text>
                </View>
                <Pressable
                  style={s.decisionCloseBtn}
                  onPress={() => setDecision(null)}
                  disabled={busy}
                >
                  <Ionicons name="close" size={20} color="#475569" />
                </Pressable>
              </View>

              <View style={s.decisionBody}>
                {decision?.type === "approved" ? (
                  <ChoiceField
                    label="Hình thức phê duyệt"
                    value={approvalType}
                    choices={[
                      { value: "justified", label: "Có phép (Được hưởng quyền lợi)" },
                      { value: "unjustified", label: "Không phép (Nghỉ không lương)" },
                    ]}
                    onChange={setApprovalType}
                    disabled={busy}
                  />
                ) : (
                  <View style={{ gap: 6 }}>
                    <Text style={s.inputLabel}>
                      Lý do từ chối <Text style={{ color: "#e11d48" }}>*</Text>
                    </Text>
                    <TextInput
                      style={s.decisionInput}
                      placeholder="Vui lòng giải thích rõ lý do từ chối đơn..."
                      placeholderTextColor="#94a3b8"
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      multiline
                      numberOfLines={3}
                      editable={!busy}
                    />
                  </View>
                )}

                <View style={{ gap: 6 }}>
                  <Text style={s.inputLabel}>Ghi chú thêm (Tùy chọn)</Text>
                  <TextInput
                    style={s.decisionInput}
                    placeholder="Nhập phản hồi cho nhân viên..."
                    placeholderTextColor="#94a3b8"
                    value={note}
                    onChangeText={setNote}
                    multiline
                    numberOfLines={2}
                    editable={!busy}
                  />
                </View>

                {!!decisionError && (
                  <View style={s.errorBox}>
                    <Ionicons name="alert-circle" size={16} color="#e11d48" />
                    <Text style={s.errorText}>{decisionError}</Text>
                  </View>
                )}

                <View style={s.decisionBtnRow}>
                  <Pressable
                    style={s.decisionCancelBtn}
                    onPress={() => setDecision(null)}
                    disabled={busy}
                  >
                    <Text style={s.decisionCancelBtnText}>Hủy</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      decision?.type === "approved" ? s.decisionConfirmApprove : s.decisionConfirmReject,
                      (busy || (decision?.type === "rejected" && !rejectReason.trim())) && {
                        opacity: 0.6,
                      },
                    ]}
                    disabled={busy || (decision?.type === "rejected" && !rejectReason.trim())}
                    onPress={() =>
                      void run(async () => {
                        if (!decision) return;
                        await leave.decide(
                          decision.item._id,
                          decision.type === "approved"
                            ? { decision: "approved", approvalType, note: note.trim() }
                            : { decision: "rejected", rejectReason: rejectReason.trim(), note: note.trim() },
                        );
                        setDecision(null);
                        refresh();
                      }, true)
                    }
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={s.decisionConfirmText}>
                        {decision?.type === "approved" ? "Xác nhận duyệt" : "Xác nhận từ chối"}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 12,
  },
  headerWrap: {
    gap: 12,
    marginBottom: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  screenTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  primaryCreateBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryCreateBtnPressed: {
    opacity: 0.85,
  },
  primaryCreateBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  secondaryTplBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryTplBtnPressed: {
    backgroundColor: "#f1f5f9",
  },
  secondaryTplBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  statusTabs: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  statusTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    flexDirection: "row",
    gap: 4,
  },
  statusTabActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  statusTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  statusTabTextActive: {
    color: "#0f172a",
    fontWeight: "700",
  },
  countBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  countBadgeActive: {
    backgroundColor: "#fef3c7",
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
  },
  countBadgeTextActive: {
    color: "#b45309",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    padding: 0,
  },
  kindChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  kindChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  kindChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#475569",
  },
  kindChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    fontSize: 12,
    color: "#be123c",
    flex: 1,
  },
  retryLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#be123c",
    textDecorationLine: "underline",
  },
  centerBox: {
    padding: 40,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
  },
  emptyBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 30,
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptySub: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  emptyCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyCreateBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  itemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kindTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  kindTagText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  cardUserName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  dateRangeText: {
    fontSize: 12,
    color: "#64748b",
  },
  daysBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  daysBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#047857",
  },
  reasonBox: {
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#cbd5e1",
  },
  reasonText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 18,
    fontStyle: "italic",
  },
  rejectBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#fff1f2",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  rejectText: {
    fontSize: 12,
    color: "#be123c",
    flex: 1,
    lineHeight: 16,
    fontWeight: "500",
  },
  responseBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#f0f9ff",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  responseText: {
    fontSize: 12,
    color: "#0369a1",
    flex: 1,
    lineHeight: 16,
  },
  attachRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  attachPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: "100%",
  },
  attachPillText: {
    fontSize: 12,
    color: "#0284c7",
    fontWeight: "500",
    maxWidth: 180,
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
  },
  managerActionGroup: {
    flexDirection: "row",
    gap: 8,
  },
  approveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  approveBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  rejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e11d48",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  rejectBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#fff1f2",
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e11d48",
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  pageBtnDisabled: {
    opacity: 0.5,
    backgroundColor: "#f1f5f9",
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  pageBtnTextDisabled: {
    color: "#94a3b8",
  },
  pageIndicator: {
    fontSize: 12,
    color: "#64748b",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalSafe: {
    width: "100%",
    maxWidth: 450,
  },
  decisionBox: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  decisionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  decisionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  decisionSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  decisionCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  decisionBody: {
    padding: 18,
    gap: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  decisionInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 10,
    fontSize: 13,
    color: "#0f172a",
    minHeight: 60,
    textAlignVertical: "top",
  },
  decisionBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  decisionCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  decisionCancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  decisionConfirmApprove: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  decisionConfirmReject: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#e11d48",
    alignItems: "center",
    justifyContent: "center",
  },
  decisionConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  notAllowedCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 12,
  },
  notAllowedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  notAllowedSub: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
});
