import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  ChevronLeft,
  GitFork,
  RotateCcw,
  SlidersHorizontal,
  Lock,
  Building2,
  CheckCircle2,
  ArrowDown,
  X,
} from "lucide-react-native";
import type { RecruitmentPipeline } from "../../../src/types/recruitment";
import { recruitment } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { RecruitmentSubnav } from "../../src/features/recruitment/RecruitmentSubnav";
import { recruitmentAccess } from "../../src/features/recruitment/access";
import { OUTCOMES } from "../../src/features/recruitment/applicantModel";
import { PipelineForm } from "../../src/features/recruitment/PipelineForm";
import { RecruitmentModal } from "../../src/features/recruitment/RecruitmentModal";
import { useAppAlert } from "../../src/components/AppAlert";

export default function Pipeline() {
  const { showAlert, alertView } = useAppAlert();
  const { user, selectedBranch } = useSession();
  const access = recruitmentAccess(user);
  const scopeReady = user?.role === "admin" ? !!selectedBranch?._id : !!user?.branchId;

  const [pipeline, setPipeline] = useState<RecruitmentPipeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const lock = useRef(false);

  const loadPipeline = useCallback(
    async (isRefresh = false) => {
      if (!access.read || !scopeReady) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await recruitment.getPipeline();
        setPipeline(data);
      } catch (err) {
        setError(messageOf(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [access.read, scopeReady],
  );

  useFocusEffect(
    useCallback(() => {
      void loadPipeline();
    }, [loadPipeline, revision, selectedBranch?._id]),
  );

  const close = () => {
    if (lock.current) return;
    setEditing(false);
    setRevision((value) => value + 1);
  };

  if (!access.read) {
    return (
      <SafeAreaView style={pipStyles.safeContainer} edges={["top"]}>
        <View style={pipStyles.headerRow}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.push("/(tabs)/recruitment"))}
            style={pipStyles.backBtn}
          >
            <ChevronLeft size={20} color="#334155" />
          </Pressable>
          <Text style={pipStyles.headerTitle}>Quy trình tuyển dụng</Text>
        </View>
        <RecruitmentSubnav active="pipeline" />
        <View style={pipStyles.emptyBox}>
          <Lock size={40} color="#94a3b8" />
          <Text style={pipStyles.emptyTitle}>Không có quyền truy cập</Text>
          <Text style={pipStyles.emptyDesc}>
            Tài khoản của bạn cần thuộc doanh nghiệp và có quyền đọc phân hệ Tuyển dụng / HR.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!scopeReady) {
    return (
      <SafeAreaView style={pipStyles.safeContainer} edges={["top"]}>
        <View style={pipStyles.headerRow}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.push("/(tabs)/recruitment"))}
            style={pipStyles.backBtn}
          >
            <ChevronLeft size={20} color="#334155" />
          </Pressable>
          <Text style={pipStyles.headerTitle}>Quy trình tuyển dụng</Text>
        </View>
        <RecruitmentSubnav active="pipeline" />
        <View style={pipStyles.emptyBox}>
          <Building2 size={40} color="#94a3b8" />
          <Text style={pipStyles.emptyTitle}>Chưa chọn chi nhánh</Text>
          <Text style={pipStyles.emptyDesc}>
            {user?.role === "admin"
              ? "Vui lòng chọn chi nhánh làm việc trong mục Tài khoản để xem quy trình tuyển dụng."
              : "Hồ sơ của bạn chưa được liên kết với chi nhánh làm việc."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const sortedStages = pipeline?.stages
    ? pipeline.stages.slice().sort((a, b) => a.position - b.position)
    : [];

  const activeStagesCount = sortedStages.filter((s) => s.isActive).length;
  const disabled = loading || refreshing;

  return (
    <>
      <SafeAreaView style={pipStyles.safeContainer} edges={["top"]}>
        <ScrollView
          style={pipStyles.scroll}
          contentContainerStyle={pipStyles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadPipeline(true)}
              colors={["#059669"]}
              tintColor="#059669"
            />
          }
        >
          {/* Header Bar with Back Button */}
          <View style={pipStyles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.push("/(tabs)/recruitment"))}
                style={pipStyles.backBtn}
              >
                <ChevronLeft size={20} color="#334155" />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={pipStyles.headerTitle}>Quy trình tuyển dụng</Text>
                <Text style={pipStyles.headerSub}>
                  {selectedBranch?.name || user?.branchName || "Toàn công ty"} · {sortedStages.length} giai đoạn
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                style={({ pressed }) => [pipStyles.refreshBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setRevision((v) => v + 1)}
                disabled={disabled}
              >
                <RotateCcw size={15} color="#059669" />
              </Pressable>

              {access.manage && (
                <Pressable
                  style={({ pressed }) => [
                    pipStyles.editBtn,
                    (disabled || !pipeline) && { opacity: 0.5 },
                    pressed && { opacity: 0.8 },
                  ]}
                  disabled={disabled || !pipeline}
                  onPress={() => setEditing(true)}
                >
                  <SlidersHorizontal size={14} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={pipStyles.editBtnText}>Chỉnh sửa</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Sub Navigation Bar */}
          <RecruitmentSubnav active="pipeline" />

          {/* Info Banner */}
          <View style={pipStyles.infoBanner}>
            <View style={pipStyles.infoIconWrapper}>
              <GitFork size={18} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={pipStyles.infoTitle}>Quy trình tuyển dụng chuẩn</Text>
              <Text style={pipStyles.infoDesc}>
                Các bước được sắp xếp tuần tự từ trên xuống dưới. Ứng viên nộp hồ sơ sẽ bắt đầu từ giai đoạn đầu tiên và lần lượt chuyển tiếp qua từng vòng.
              </Text>
            </View>
          </View>

          {/* Stats Bar */}
          <View style={pipStyles.statsRow}>
            <View style={[pipStyles.statCard, { borderLeftColor: "#059669" }]}>
              <Text style={pipStyles.statValue}>{sortedStages.length}</Text>
              <Text style={pipStyles.statLabel}>Tổng giai đoạn</Text>
            </View>
            <View style={[pipStyles.statCard, { borderLeftColor: "#10b981" }]}>
              <Text style={[pipStyles.statValue, { color: "#047857" }]}>{activeStagesCount}</Text>
              <Text style={pipStyles.statLabel}>Đang hoạt động</Text>
            </View>
            <View style={[pipStyles.statCard, { borderLeftColor: "#94a3b8" }]}>
              <Text style={[pipStyles.statValue, { color: "#64748b" }]}>{sortedStages.length - activeStagesCount}</Text>
              <Text style={pipStyles.statLabel}>Đã tắt</Text>
            </View>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={pipStyles.errorBanner}>
              <Text style={pipStyles.errorText}>{error}</Text>
            </View>
          )}

          {/* Loading Indicator */}
          {loading && (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color="#059669" />
            </View>
          )}

          {/* Pipeline Stages Sequential Flow */}
          {!loading && sortedStages.length > 0 && (
            <View style={pipStyles.stagesContainer}>
              <Text style={pipStyles.sectionTitle}>Các bước trong quy trình</Text>
              {sortedStages.map((stage, index) => {
                const isLast = index === sortedStages.length - 1;
                const terminalOutcomeObj = OUTCOMES.find((item) => item.value === stage.terminalOutcome);

                return (
                  <View key={stage.id} style={pipStyles.stageWrapper}>
                    <View style={pipStyles.stageCard}>
                      <View style={pipStyles.stageHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                          <View
                            style={[
                              pipStyles.stageNumberBadge,
                              { backgroundColor: stage.color || "#059669" },
                            ]}
                          >
                            <Text style={pipStyles.stageNumberText}>{index + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={pipStyles.stageName}>{stage.name || "Giai đoạn chưa đặt tên"}</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                              <View style={[pipStyles.colorDot, { backgroundColor: stage.color || "#64748b" }]} />
                              <Text style={pipStyles.colorText}>{stage.color || "#64748b"}</Text>
                            </View>
                          </View>
                        </View>

                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          {stage.isActive ? (
                            <View style={pipStyles.activeBadge}>
                              <CheckCircle2 size={11} color="#047857" style={{ marginRight: 3 }} />
                              <Text style={pipStyles.activeBadgeText}>Hoạt động</Text>
                            </View>
                          ) : (
                            <View style={pipStyles.inactiveBadge}>
                              <Text style={pipStyles.inactiveBadgeText}>Đã tắt</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={pipStyles.stageFooter}>
                        <Text style={pipStyles.stageFooterLabel}>Kết quả chuyển tiếp:</Text>
                        {terminalOutcomeObj ? (
                          <View
                            style={[
                              pipStyles.outcomeBadge,
                              stage.terminalOutcome === "hired" && { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
                              stage.terminalOutcome === "rejected" && { backgroundColor: "#fff1f2", borderColor: "#fecdd3" },
                              stage.terminalOutcome === "withdrawn" && { backgroundColor: "#fef3c7", borderColor: "#fde68a" },
                            ]}
                          >
                            <Text
                              style={[
                                pipStyles.outcomeBadgeText,
                                stage.terminalOutcome === "hired" && { color: "#047857" },
                                stage.terminalOutcome === "rejected" && { color: "#be123c" },
                                stage.terminalOutcome === "withdrawn" && { color: "#b45309" },
                              ]}
                            >
                              {terminalOutcomeObj.label}
                            </Text>
                          </View>
                        ) : (
                          <View style={[pipStyles.outcomeBadge, { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }]}>
                            <Text style={[pipStyles.outcomeBadgeText, { color: "#64748b" }]}>Đang tuyển (chưa có kết quả cuối)</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Flow Connector Arrow */}
                    {!isLast && (
                      <View style={pipStyles.connectorRow}>
                        <View style={pipStyles.connectorLine} />
                        <View style={pipStyles.connectorCircle}>
                          <ArrowDown size={13} color="#94a3b8" />
                        </View>
                        <View style={pipStyles.connectorLine} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Empty State */}
          {!loading && sortedStages.length === 0 && (
            <View style={pipStyles.emptyBox}>
              <GitFork size={40} color="#94a3b8" />
              <Text style={pipStyles.emptyTitle}>Chưa có quy trình tuyển dụng</Text>
              <Text style={pipStyles.emptyDesc}>
                Hệ thống chưa thiết lập các bước quy trình phỏng vấn và lọc hồ sơ cho doanh nghiệp.
              </Text>
              {access.manage && (
                <Pressable
                  style={pipStyles.primaryBtn}
                  onPress={() => setEditing(true)}
                >
                  <SlidersHorizontal size={15} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={pipStyles.primaryBtnText}>Cấu hình quy trình ngay</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Modal for Editing Pipeline */}
      {editing && pipeline && access.manage && (
        <RecruitmentModal
          title="Sửa quy trình tuyển dụng"
          subtitle="Sắp xếp thứ tự và cấu hình các bước trong quy trình"
          visible={editing}
          onClose={close}
        >
          <PipelineForm
            pipeline={pipeline}
            setLocked={(value) => {
              lock.current = value;
            }}
            onClose={() => {
              setEditing(false);
              setRevision((value) => value + 1);
            }}
          />
        </RecruitmentModal>
      )}
      {alertView}
    </>
  );
}

const pipStyles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    alignItems: "center",
    justifyContent: "center",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  infoBanner: {
    flexDirection: "row",
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 12,
    gap: 12,
    alignItems: "flex-start",
  },
  infoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#166534",
    marginBottom: 2,
  },
  infoDesc: {
    fontSize: 12,
    color: "#15803d",
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  statLabel: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
  },
  errorBanner: {
    backgroundColor: "#fff1f2",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorText: {
    color: "#be123c",
    fontSize: 13,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  stagesContainer: {
    gap: 0,
  },
  stageWrapper: {
    alignItems: "stretch",
  },
  stageCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  stageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  stageNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stageNumberText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  stageName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  colorText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  activeBadgeText: {
    fontSize: 11,
    color: "#047857",
    fontWeight: "700",
  },
  inactiveBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  inactiveBadgeText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  stageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  stageFooterLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  outcomeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  outcomeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  connectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 24,
  },
  connectorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "transparent",
  },
  connectorCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 36,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
    marginVertical: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalSubtitle: {
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
});
