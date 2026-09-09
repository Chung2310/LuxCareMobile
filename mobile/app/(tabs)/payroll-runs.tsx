import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PayrollRun } from "../../../src/types/payrollRun";
import { payroll } from "../../src/api/services";
import { useSession, messageOf } from "../../src/auth/SessionProvider";
import { hasPermission } from "../../src/auth/access";
import { Loading } from "../../src/ui";
import {
  canReadPayrollRuns,
  effectiveRunLines,
  runStatuses,
  validPayrollPeriod,
} from "../../src/features/payroll/runModel";
import { payslipMoney } from "../../src/features/payroll/model";
import { PayslipDetails } from "../../src/features/payroll/PayslipDetails";
import { PaymentHistory } from "../../src/features/payroll/PaymentHistory";
import { PayrollExport } from "../../src/features/payroll/PayrollExport";
import { PayrollIssues } from "../../src/features/payroll/PayrollIssues";
import { CreatePayrollRun } from "../../src/features/payroll/CreatePayrollRun";
import { SyncRunAttendance } from "../../src/features/payroll/SyncRunAttendance";
import { CalculatePayrollRun } from "../../src/features/payroll/CalculatePayrollRun";
import { ReviewPayrollRun } from "../../src/features/payroll/ReviewPayrollRun";
import { ReopenPayrollRun } from "../../src/features/payroll/ReopenPayrollRun";
import { CreatePayrollPayment } from "../../src/features/payroll/CreatePayrollPayment";
import { PayslipPublication } from "../../src/features/payroll/PayslipPublication";
import { AdjustmentHistory } from "../../src/features/payroll/AdjustmentHistory";
import { PayrollAuditHistory } from "../../src/features/payroll/PayrollAuditHistory";
import { canReadRunPayments } from "../../src/features/payroll/paymentModel";
import { PayrollPeriodInputs } from "../../src/features/payroll/PayrollPeriodInputs";
import { PayrollVariables } from "../../src/features/payroll/PayrollVariables";

export default function PayrollRuns() {
  const { user, selectedBranch } = useSession();
  const allowed = canReadPayrollRuns(user);
  const branchId = selectedBranch?._id || user?.branchId;
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return String(now.getFullYear()) + "-" + String(now.getMonth() + 1).padStart(2, "0");
  });
  const [draft, setDraft] = useState(period);
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [issueRunId, setIssueRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setRun(null);
      setIssueRunId(null);
      setError(null);
      setMissing(false);
      setExpanded(null);
      setLoading(false);
      if (!allowed || !branchId) return;
      setLoading(true);
      void payroll
        .getRun(period)
        .then((value) => {
          if (!value?._id || value.periodKey !== period) {
            throw new Error("Bảng lương trả về không khớp kỳ đã chọn.");
          }
          if (active) setIssueRunId(value._id);
          effectiveRunLines(value);
          if (active) setRun(value);
        })
        .catch((requestError) => {
          if (!active) return;
          if (requestError?.status === 404 && requestError?.code === "PAYROLL_RUN_NOT_FOUND") {
            setMissing(true);
          } else {
            setError(messageOf(requestError));
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [allowed, branchId, user?.uid, user?.companyCode, period, revision]),
  );

  if (!allowed) {
    return (
      <SafeAreaView edges={["top"]} style={payrollStyles.container}>
        <View style={payrollStyles.accessCard}>
          <Text style={payrollStyles.emptyIcon}>🔒</Text>
          <Text style={payrollStyles.emptyTitle}>Không có quyền truy cập</Text>
          <Text style={payrollStyles.emptyText}>Cần phân hệ nhân sự và quyền xem kỳ lương để tra cứu.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!branchId) {
    return (
      <SafeAreaView edges={["top"]} style={payrollStyles.container}>
        <View style={payrollStyles.accessCard}>
          <Text style={payrollStyles.emptyIcon}>🏢</Text>
          <Text style={payrollStyles.emptyTitle}>Chưa chọn chi nhánh</Text>
          <Text style={payrollStyles.emptyText}>Chọn chi nhánh trong tài khoản để tra cứu bảng lương.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const lines = run?.effectiveLines || [];
  const normalizedSearch = search.trim().toLocaleLowerCase("vi-VN");
  const rows = lines.filter((line) =>
    (String(line.employeeName || "") + " " + line.employeeId)
      .toLocaleLowerCase("vi-VN")
      .includes(normalizedSearch),
  );
  const totalNet = lines.reduce((sum, line) => {
    const value = line.calculation.net ?? line.calculation.netPay;
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const detailAllowed = hasPermission(user, "payroll-payment:read") || hasPermission(user, "payroll-payment:manage");
  const isClosed = run?.status === "closed" || run?.status === "paid";
  const statusLabel = run
    ? runStatuses[run.status] || run.status
    : loading
      ? "Đang tải"
      : missing
        ? "Chưa có"
        : "Chưa tra cứu";

  const submitLookup = () => {
    const value = draft.trim();
    if (!validPayrollPeriod(value)) {
      setInputError("Nhập kỳ hợp lệ dạng YYYY-MM, ví dụ 2026-09.");
      return;
    }
    setInputError(null);
    setPeriod(value);
    setSearch(searchDraft.trim());
    setExpanded(null);
    setRevision((current) => current + 1);
  };

  const clearSearch = () => {
    setSearchDraft("");
    setSearch("");
    setExpanded(null);
  };

  return (
    <SafeAreaView edges={["top"]} style={payrollStyles.container}>
      <ScrollView
        style={payrollStyles.scrollView}
        contentContainerStyle={payrollStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => setRevision((current) => current + 1)}
            colors={["#059669"]}
          />
        }
      >
        <View style={payrollStyles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={payrollStyles.pageTitle}>Tra cứu bảng lương</Text>
            <Text style={payrollStyles.pageSubtitle}>
              {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [payrollStyles.refreshButton, pressed && { opacity: 0.8 }]}
            disabled={loading}
            onPress={() => setRevision((current) => current + 1)}
          >
            <Text style={payrollStyles.refreshButtonText}>↻ Làm mới</Text>
          </Pressable>
        </View>

        <View style={payrollStyles.statsRow}>
          <View style={payrollStyles.statCard}>
            <Text style={[payrollStyles.statNumber, { color: "#0f172a" }]} numberOfLines={1} adjustsFontSizeToFit>
              {period}
            </Text>
            <Text style={payrollStyles.statLabel}>Kỳ tra cứu</Text>
          </View>
          <View style={payrollStyles.statCard}>
            <Text style={[payrollStyles.statNumber, { color: "#059669" }]}>{run ? lines.length : "—"}</Text>
            <Text style={payrollStyles.statLabel}>Nhân viên</Text>
          </View>
          <View style={payrollStyles.statCard}>
            <Text style={[payrollStyles.statNumber, { color: "#2563eb", fontSize: 14 }]} numberOfLines={1} adjustsFontSizeToFit>
              {run ? payslipMoney(totalNet) : "—"}
            </Text>
            <Text style={payrollStyles.statLabel}>Tổng thực nhận</Text>
          </View>
          <View style={payrollStyles.statCard}>
            <View
              style={[
                payrollStyles.statusPill,
                isClosed ? payrollStyles.statusPillPositive : payrollStyles.statusPillNeutral,
              ]}
            >
              <Text
                style={[
                  payrollStyles.statusPillText,
                  isClosed ? payrollStyles.statusPillTextPositive : payrollStyles.statusPillTextNeutral,
                ]}
                numberOfLines={1}
              >
                {statusLabel}
              </Text>
            </View>
            <Text style={payrollStyles.statLabel}>Trạng thái</Text>
          </View>
        </View>

        <View style={payrollStyles.searchCard}>
          <Text style={payrollStyles.sectionTitle}>Bộ lọc tra cứu</Text>
          <View style={payrollStyles.periodRow}>
            <View style={{ flex: 1 }}>
              <Text style={payrollStyles.inputLabel}>Kỳ lương</Text>
              <TextInput
                style={payrollStyles.periodInput}
                value={draft}
                onChangeText={setDraft}
                placeholder="YYYY-MM"
                placeholderTextColor="#94a3b8"
                keyboardType="numbers-and-punctuation"
                maxLength={7}
                returnKeyType="search"
                onSubmitEditing={submitLookup}
              />
            </View>
            <Pressable
              style={({ pressed }) => [payrollStyles.primaryButton, pressed && { opacity: 0.8 }]}
              disabled={loading}
              onPress={submitLookup}
            >
              <Text style={payrollStyles.primaryButtonText}>Tra cứu</Text>
            </Pressable>
          </View>

          <View style={payrollStyles.searchInputRow}>
            <Text style={payrollStyles.searchIcon}>⌕</Text>
            <TextInput
              style={payrollStyles.searchInput}
              value={searchDraft}
              onChangeText={setSearchDraft}
              placeholder="Tìm tên hoặc mã nhân viên..."
              placeholderTextColor="#94a3b8"
              returnKeyType="search"
              onSubmitEditing={() => {
                setSearch(searchDraft.trim());
                setExpanded(null);
              }}
            />
            {searchDraft.length > 0 && (
              <Pressable onPress={clearSearch} hitSlop={8} style={payrollStyles.clearInputButton}>
                <Text style={payrollStyles.clearInputText}>✕</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [payrollStyles.filterButton, pressed && { opacity: 0.8 }]}
              onPress={() => {
                setSearch(searchDraft.trim());
                setExpanded(null);
              }}
            >
              <Text style={payrollStyles.filterButtonText}>Lọc</Text>
            </Pressable>
          </View>

          <View style={payrollStyles.filterBarRow}>
            <Text style={payrollStyles.filterHint}>
              {run ? String(rows.length) + "/" + String(lines.length) + " dòng lương phù hợp" : "Nhập kỳ lương để bắt đầu tra cứu"}
            </Text>
            {!!search && (
              <Pressable onPress={clearSearch} hitSlop={6}>
                <Text style={payrollStyles.resetFiltersText}>✕ Xóa tìm kiếm</Text>
              </Pressable>
            )}
          </View>
        </View>

        {(inputError || error) && (
          <View style={payrollStyles.errorBanner}>
            <Text style={payrollStyles.errorBannerText}>{inputError || error}</Text>
          </View>
        )}

        {loading && (
          <View style={payrollStyles.loadingCard}>
            <Loading />
            <Text style={payrollStyles.loadingText}>Đang tải dữ liệu bảng lương...</Text>
          </View>
        )}

        {issueRunId && (
          <PayrollIssues
            key={"issues:" + issueRunId + ":" + revision}
            runId={issueRunId}
            employees={run?.effectiveLines || []}
          />
        )}

        {missing && (
          <View style={payrollStyles.emptyCard}>
            <Text style={payrollStyles.emptyIcon}>📊</Text>
            <Text style={payrollStyles.emptyTitle}>Chưa có bảng lương</Text>
            <Text style={payrollStyles.emptyText}>
              {"Chưa có bảng lương cho kỳ " + period + ". Hãy kiểm tra lại kỳ hoặc tạo kỳ mới."}
            </Text>
          </View>
        )}
        {missing && !loading && (
          <CreatePayrollRun
            key={"create:" + period + ":" + revision}
            period={period}
            onChanged={() => setRevision((current) => current + 1)}
          />
        )}

        <PayrollPeriodInputs
          key={"inputs:" + period + ":" + revision}
          period={period}
          employees={lines}
          onChanged={() => setRevision((current) => current + 1)}
        />
        <PayrollVariables key={"variables:" + revision} onChanged={() => setRevision((current) => current + 1)} />
        <AdjustmentHistory
          key={period + ":" + revision}
          period={period}
          onChanged={() => setRevision((current) => current + 1)}
        />

        {run && (
          <>
            <View style={payrollStyles.summaryCard}>
              <View style={payrollStyles.cardHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={payrollStyles.cardTitle}>{"Kỳ lương " + run.periodKey}</Text>
                  <Text style={payrollStyles.cardSubtitle}>
                    {String(lines.length) + " nhân viên · dữ liệu hiệu lực của kỳ"}
                  </Text>
                </View>
                <View
                  style={[
                    payrollStyles.statusPill,
                    isClosed ? payrollStyles.statusPillPositive : payrollStyles.statusPillNeutral,
                  ]}
                >
                  <Text
                    style={[
                      payrollStyles.statusPillText,
                      isClosed ? payrollStyles.statusPillTextPositive : payrollStyles.statusPillTextNeutral,
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>
              </View>
              <View style={payrollStyles.summaryMetricRow}>
                <View style={payrollStyles.summaryMetric}>
                  <Text style={payrollStyles.metricLabel}>Tổng thực nhận</Text>
                  <Text style={payrollStyles.metricValue}>{payslipMoney(totalNet)}</Text>
                </View>
                <View style={payrollStyles.summaryMetric}>
                  <Text style={payrollStyles.metricLabel}>Phạm vi</Text>
                  <Text style={payrollStyles.metricValue}>{selectedBranch?.name || "Chi nhánh hiện tại"}</Text>
                </View>
              </View>
              <Text style={payrollStyles.cardNote}>
                Tổng được tính theo các dòng lương có hiệu lực, không phải số tiền đã thanh toán.
              </Text>
            </View>

            <View style={payrollStyles.managementStack}>
              <PayrollExport key={"export:" + run._id + ":" + revision} run={run} />
              <CreatePayrollPayment
                key={"payment:" + run._id + ":" + revision}
                run={run}
                onChanged={() => setRevision((current) => current + 1)}
              />
              <ReopenPayrollRun
                key={"reopen:" + run._id + ":" + run.version + ":" + revision}
                run={run}
                onChanged={() => setRevision((current) => current + 1)}
              />
              <ReviewPayrollRun
                close
                key={"close:" + run._id + ":" + run.version + ":" + revision}
                run={run}
                onChanged={() => setRevision((current) => current + 1)}
              />
              <ReviewPayrollRun
                key={"review:" + run._id + ":" + run.version + ":" + revision}
                run={run}
                onChanged={() => setRevision((current) => current + 1)}
              />
              <CalculatePayrollRun
                key={"calculate:" + run._id + ":" + run.version + ":" + revision}
                run={run}
                onChanged={() => setRevision((current) => current + 1)}
              />
              <SyncRunAttendance
                key={"sync:" + run._id + ":" + run.version + ":" + revision}
                run={run}
                onChanged={() => setRevision((current) => current + 1)}
              />
              <PayslipPublication
                key={"publication:" + run._id + ":" + revision}
                run={run}
                onChanged={() => setRevision((current) => current + 1)}
              />
              {canReadRunPayments(user) && (
                <PaymentHistory
                  key={run._id + ":" + revision}
                  runId={run._id}
                  runStatus={run.status}
                  employees={lines}
                  onChanged={() => setRevision((current) => current + 1)}
                />
              )}
            </View>

            <View style={payrollStyles.listHeaderRow}>
              <Text style={payrollStyles.listCountText}>
                Tìm thấy <Text style={payrollStyles.listCountStrong}>{rows.length}</Text> dòng lương
              </Text>
              <Text style={payrollStyles.listPageIndicator}>{period}</Text>
            </View>

            {!rows.length ? (
              <View style={payrollStyles.emptyCard}>
                <Text style={payrollStyles.emptyIcon}>📋</Text>
                <Text style={payrollStyles.emptyTitle}>Không tìm thấy nhân viên</Text>
                <Text style={payrollStyles.emptyText}>Không có dòng lương phù hợp với từ khóa hiện tại.</Text>
                {!!search && (
                  <Pressable style={payrollStyles.emptyResetButton} onPress={clearSearch}>
                    <Text style={payrollStyles.emptyResetButtonText}>Xóa tìm kiếm</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              rows.map((line) => {
                const net = line.calculation.net ?? line.calculation.netPay;
                return (
                  <View key={line.employeeId} style={payrollStyles.resultCard}>
                    <View style={payrollStyles.cardHeader}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={payrollStyles.cardTitle}>{line.employeeName || line.employeeId}</Text>
                        <View style={payrollStyles.cardMetaRow}>
                          <Text style={payrollStyles.employeeId}>{line.employeeId}</Text>
                          <Text style={payrollStyles.metaDot}>•</Text>
                          <View style={payrollStyles.typePill}>
                            <Text style={payrollStyles.typePillText}>{"Kỳ " + period}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={payrollStyles.detailLinkBadge}>
                        <Text style={payrollStyles.detailLinkText}>Chi tiết →</Text>
                      </View>
                    </View>

                    <View style={payrollStyles.moneyRow}>
                      <View style={payrollStyles.moneyBlock}>
                        <Text style={payrollStyles.metricLabel}>Tổng thu nhập</Text>
                        <Text style={payrollStyles.moneyValue}>{payslipMoney(line.calculation.gross)}</Text>
                      </View>
                      <View style={[payrollStyles.moneyBlock, payrollStyles.moneyBlockHighlight]}>
                        <Text style={payrollStyles.metricLabel}>Thực nhận</Text>
                        <Text style={[payrollStyles.moneyValue, payrollStyles.moneyValuePrimary]}>
                          {payslipMoney(net)}
                        </Text>
                      </View>
                    </View>

                    {!!line.warnings?.length && (
                      <View style={payrollStyles.warningBox}>
                        {line.warnings.map((warning, index) => (
                          <Text key={index} style={payrollStyles.warningText}>
                            {"⚠ " + warning}
                          </Text>
                        ))}
                      </View>
                    )}

                    {detailAllowed && (
                      <Pressable
                        style={({ pressed }) => [payrollStyles.detailButton, pressed && { opacity: 0.8 }]}
                        onPress={() => setExpanded(expanded === line.employeeId ? null : line.employeeId)}
                      >
                        <Text style={payrollStyles.detailButtonText}>
                          {expanded === line.employeeId ? "Thu gọn chi tiết" : "Xem chi tiết dòng lương"}
                        </Text>
                      </Pressable>
                    )}
                    {detailAllowed && expanded === line.employeeId && (
                      <PayslipDetails item={{ runId: run._id, employeeId: line.employeeId }} />
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        <PayrollAuditHistory key={"audit:" + period + ":" + revision} period={period} />
      </ScrollView>
    </SafeAreaView>
  );
}

const payrollStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  pageTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a", letterSpacing: -0.3 },
  pageSubtitle: { fontSize: 13, fontWeight: "500", color: "#64748b", marginTop: 2 },
  refreshButton: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  refreshButtonText: { color: "#047857", fontWeight: "700", fontSize: 12 },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1,
    minHeight: 70,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statNumber: { fontSize: 17, fontWeight: "800" },
  statLabel: { fontSize: 10, fontWeight: "600", color: "#64748b", marginTop: 3, textAlign: "center" },
  statusPill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, borderWidth: 1, maxWidth: "100%" },
  statusPillPositive: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  statusPillNeutral: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" },
  statusPillText: { fontSize: 10, fontWeight: "700" },
  statusPillTextPositive: { color: "#059669" },
  statusPillTextNeutral: { color: "#475569" },
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
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  inputLabel: { fontSize: 12, fontWeight: "700", color: "#475569", marginBottom: 6 },
  periodRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  periodInput: {
    height: 44,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600",
  },
  primaryButton: { height: 44, justifyContent: "center", backgroundColor: "#059669", paddingHorizontal: 14, borderRadius: 10 },
  primaryButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 44,
    gap: 8,
  },
  searchIcon: { fontSize: 20, color: "#64748b", lineHeight: 22 },
  searchInput: { flex: 1, fontSize: 14, color: "#0f172a", paddingVertical: 0 },
  clearInputButton: { padding: 4 },
  clearInputText: { fontSize: 14, color: "#94a3b8", fontWeight: "700" },
  filterButton: { backgroundColor: "#059669", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  filterButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  filterBarRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
  filterHint: { flex: 1, fontSize: 12, color: "#64748b" },
  resetFiltersText: { fontSize: 12, fontWeight: "600", color: "#e11d48" },
  errorBanner: {
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 12,
    padding: 12,
  },
  errorBannerText: { color: "#be123c", fontSize: 13, lineHeight: 18 },
  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    paddingVertical: 8,
  },
  loadingText: { color: "#64748b", fontSize: 12, marginBottom: 10 },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", lineHeight: 22 },
  cardSubtitle: { fontSize: 12, color: "#64748b", marginTop: 4 },
  summaryMetricRow: { flexDirection: "row", gap: 8 },
  summaryMetric: { flex: 1, backgroundColor: "#f8fafc", borderRadius: 10, padding: 10 },
  metricLabel: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  metricValue: { fontSize: 15, color: "#0f172a", fontWeight: "800", marginTop: 4 },
  cardNote: { fontSize: 11, color: "#64748b", lineHeight: 17 },
  managementStack: { gap: 14 },
  listHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
  listCountText: { fontSize: 13, color: "#64748b" },
  listCountStrong: { color: "#0f172a", fontWeight: "800" },
  listPageIndicator: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  resultCard: {
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
  cardMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 },
  employeeId: { fontSize: 12, fontWeight: "600", color: "#475569" },
  metaDot: { fontSize: 12, color: "#94a3b8" },
  typePill: { backgroundColor: "#f1f5f9", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  typePillText: { fontSize: 11, fontWeight: "600", color: "#475569" },
  moneyRow: { flexDirection: "row", gap: 8 },
  moneyBlock: { flex: 1, backgroundColor: "#f8fafc", paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10 },
  moneyBlockHighlight: { backgroundColor: "#ecfdf5" },
  moneyValue: { fontSize: 14, fontWeight: "800", color: "#0f172a", marginTop: 4 },
  moneyValuePrimary: { color: "#059669" },
  warningBox: { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", borderRadius: 10, padding: 9, gap: 4 },
  warningText: { color: "#92400e", fontSize: 12, lineHeight: 17 },
  detailLinkBadge: { backgroundColor: "#ecfdf5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  detailLinkText: { fontSize: 11, fontWeight: "700", color: "#059669" },
  detailButton: { alignItems: "center", backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingVertical: 10 },
  detailButtonText: { color: "#0f766e", fontSize: 13, fontWeight: "700" },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  accessCard: {
    flex: 1,
    margin: 16,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  emptyIcon: { fontSize: 36, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", textAlign: "center" },
  emptyText: { fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 20 },
  emptyResetButton: { marginTop: 8, backgroundColor: "#059669", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  emptyResetButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
});