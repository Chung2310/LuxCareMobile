import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
import type { PayrollRun } from "../../../src/types/payrollRun";
import type { Payslip } from "../../../src/types/payslip";
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
import {
  canReadPayslips,
  payslipMoney,
  payslipsForPeriod,
} from "../../src/features/payroll/model";
import { PayslipDetails } from "../../src/features/payroll/PayslipDetails";
import { SharePayslipButton } from "../../src/features/payroll/SharePayslipButton";
import { PaymentHistory } from "../../src/features/payroll/PaymentHistory";
import { PayrollExport } from "../../src/features/payroll/PayrollExport";
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

export interface PayrollRunsProps {
  initialTab?: "my_payslip" | "company_run";
}

function prevPeriod(p: string): string {
  const parts = p.split("-");
  if (parts.length !== 2) return p;
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  month -= 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function nextPeriod(p: string): string {
  const parts = p.split("-");
  if (parts.length !== 2) return p;
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function formatPeriodLabel(p: string): string {
  const parts = p.split("-");
  if (parts.length !== 2) return p;
  return `Tháng ${parts[1]}/${parts[0]}`;
}

const payrollWarningLabels: Record<string, string> = {
  PAYROLL_DEDUCTIONS_EXCEED_INCOME:
    "Tổng các khoản khấu trừ vượt quá thu nhập trong kỳ (lương thực nhận âm hoặc bằng 0).",
  DEDUCTIONS_EXCEED_INCOME:
    "Tổng các khoản khấu trừ vượt quá thu nhập thực nhận trong kỳ.",
  NEGATIVE_NET_PAY:
    "Lương thực nhận bị âm do các khoản khấu trừ lớn hơn thu nhập.",
  MISSING_BASE_SALARY:
    "Chưa thiết lập lương cơ bản cho nhân sự này.",
  MISSING_STANDARD_DAYS:
    "Chưa có số ngày công chuẩn trong kỳ.",
};

function formatPayrollWarning(warning: string): string {
  return payrollWarningLabels[warning] || warning;
}

const PERSONAL_MONTH_OPTIONS = [
  { label: "Tất cả tháng", value: "all" },
  { label: "Tháng 01", value: "01" },
  { label: "Tháng 02", value: "02" },
  { label: "Tháng 03", value: "03" },
  { label: "Tháng 04", value: "04" },
  { label: "Tháng 05", value: "05" },
  { label: "Tháng 06", value: "06" },
  { label: "Tháng 07", value: "07" },
  { label: "Tháng 08", value: "08" },
  { label: "Tháng 09", value: "09" },
  { label: "Tháng 10", value: "10" },
  { label: "Tháng 11", value: "11" },
  { label: "Tháng 12", value: "12" },
];

export default function PayrollRuns({ initialTab }: PayrollRunsProps = {}) {
  const { user, selectedBranch } = useSession();
  const params = useLocalSearchParams<{ from?: string }>();
  const canCompany = canReadPayrollRuns(user);
  const canPersonal = canReadPayslips(user);
  const branchId = selectedBranch?._id || user?.branchId;

  const [activeTab, setActiveTab] = useState<"my_payslip" | "company_run">(() => {
    if (initialTab) {
      if (initialTab === "company_run" && canCompany) return "company_run";
      if (initialTab === "my_payslip" && canPersonal) return "my_payslip";
    }
    return canPersonal ? "my_payslip" : "company_run";
  });

  // Modal sheet for mobile actions
  const [activeModal, setActiveModal] = useState<
    | "calculate"
    | "sync"
    | "review"
    | "close"
    | "reopen"
    | "payment"
    | "publish"
    | "export"
    | "history"
    | "advanced"
    | "custom_period"
    | null
  >(null);

  // Personal payslips state
  const [personalPayslips, setPersonalPayslips] = useState<Payslip[]>([]);
  const [personalPeriod, setPersonalPeriod] = useState("");
  const [personalSearch, setPersonalSearch] = useState("");
  const [personalYear, setPersonalYear] = useState<string>("all");
  const [personalMonth, setPersonalMonth] = useState<string>("all");
  const [personalExpanded, setPersonalExpanded] = useState<string | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);

  // Company payroll run state
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return String(now.getFullYear()) + "-" + String(now.getMonth() + 1).padStart(2, "0");
  });
  const [draft, setDraft] = useState(period);
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Fetch personal payslips
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!canPersonal || !branchId) return;
      setPersonalLoading(true);
      setPersonalError(null);
      void payroll
        .getEmployeePayslips()
        .then((result) => {
          if (active) setPersonalPayslips(result || []);
        })
        .catch((requestError) => {
          if (active) setPersonalError(messageOf(requestError));
        })
        .finally(() => {
          if (active) setPersonalLoading(false);
        });
      return () => {
        active = false;
      };
    }, [canPersonal, branchId, user?.uid, user?.companyCode, revision]),
  );

  // Fetch company payroll run
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setRun(null);
      setError(null);
      setMissing(false);
      setExpanded(null);
      setLoading(false);
      if (!canCompany || !branchId) return;
      setLoading(true);
      void payroll
        .getRun(period)
        .then((value) => {
          if (!value?._id || value.periodKey !== period) {
            throw new Error("Bảng lương trả về không khớp kỳ đã chọn.");
          }
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
    }, [canCompany, branchId, user?.uid, user?.companyCode, period, revision]),
  );

  if (!canPersonal && !canCompany) {
    return (
      <SafeAreaView edges={["top"]} style={payrollStyles.container}>
        <View style={payrollStyles.accessCard}>
          <Text style={payrollStyles.emptyIcon}>🔒</Text>
          <Text style={payrollStyles.emptyTitle}>Không có quyền truy cập</Text>
          <Text style={payrollStyles.emptyText}>
            Cần tài khoản doanh nghiệp có phân hệ nhân sự để xem bảng lương hoặc phiếu lương.
          </Text>
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
          <Text style={payrollStyles.emptyText}>
            Chọn chi nhánh trong tài khoản để tra cứu bảng lương và phiếu lương.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Personal calculations
  const allPersonalYears = Array.from(
    new Set(
      personalPayslips
        .map((item) => (item.periodKey ? item.periodKey.split("-")[0] : ""))
        .filter(Boolean),
    ),
  ).sort().reverse();

  const personalRows = personalPayslips.filter((item) => {
    const pKey = item.periodKey || "";
    const parts = pKey.split("-");
    const year = parts[0] || "";
    const month = parts[1] || "";

    if (personalYear !== "all" && year !== personalYear) {
      return false;
    }

    if (personalMonth !== "all" && month !== personalMonth) {
      return false;
    }

    if (personalPeriod && pKey !== personalPeriod) {
      return false;
    }

    if (personalSearch.trim()) {
      const q = personalSearch.trim().toLowerCase();
      const monthNum = parseInt(month, 10);
      const formattedSlash1 = `${month}/${year}`;
      const formattedSlash2 = `${monthNum}/${year}`;
      const formattedText1 = `tháng ${monthNum}`;
      const formattedText2 = `thang ${monthNum}`;
      const formattedYear1 = `năm ${year}`;
      const formattedYear2 = `nam ${year}`;
      const matches =
        pKey.toLowerCase().includes(q) ||
        year.toLowerCase().includes(q) ||
        month.toLowerCase().includes(q) ||
        formattedSlash1.toLowerCase().includes(q) ||
        formattedSlash2.toLowerCase().includes(q) ||
        formattedText1.toLowerCase().includes(q) ||
        formattedText2.toLowerCase().includes(q) ||
        formattedYear1.toLowerCase().includes(q) ||
        formattedYear2.toLowerCase().includes(q) ||
        (item.employeeName || "").toLowerCase().includes(q);
      if (!matches) return false;
    }

    return true;
  }).sort((a, b) => (b.periodKey || "").localeCompare(a.periodKey || ""));

  const totalPersonalNet = personalRows.reduce(
    (sum, item) => sum + (Number.isFinite(item.netPay) ? item.netPay : 0),
    0,
  );
  const totalPersonalPaid = personalRows.reduce(
    (sum, item) => sum + (Number.isFinite(item.paidAmount) ? item.paidAmount : 0),
    0,
  );
  const totalPersonalBalance = personalRows.reduce(
    (sum, item) => sum + (Number.isFinite(item.balance) ? item.balance : 0),
    0,
  );

  // Company calculations
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
  const totalGross = lines.reduce((sum, line) => {
    const value = line.calculation.gross;
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const detailAllowed =
    hasPermission(user, "payroll-payment:read") || hasPermission(user, "payroll-payment:manage");
  const isClosed = run?.status === "closed" || run?.status === "paid";
  const isPaid = run?.status === "paid";
  const currentStage = !run
    ? 1
    : isPaid
      ? 4
      : run.status === "closed"
        ? 3
        : run.status === "review"
          ? 2
          : 1;
  const statusLabel = run
    ? runStatuses[run.status] || run.status
    : loading
      ? "Đang tải"
      : missing
        ? "Chưa có"
        : "Chưa tra cứu";

  const goToPrevMonth = () => {
    const nextP = prevPeriod(period);
    setPeriod(nextP);
    setDraft(nextP);
    setExpanded(null);
    setRevision((c) => c + 1);
  };

  const goToNextMonth = () => {
    const nextP = nextPeriod(period);
    setPeriod(nextP);
    setDraft(nextP);
    setExpanded(null);
    setRevision((c) => c + 1);
  };

  const submitCustomPeriod = () => {
    const val = draft.trim();
    if (!validPayrollPeriod(val)) {
      setInputError("Định dạng kỳ dạng YYYY-MM, ví dụ 2026-09.");
      return;
    }
    setInputError(null);
    setPeriod(val);
    setActiveModal(null);
    setExpanded(null);
    setRevision((c) => c + 1);
  };

  const onModalChanged = () => {
    setRevision((c) => c + 1);
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
            refreshing={loading || personalLoading}
            onRefresh={() => setRevision((current) => current + 1)}
            colors={["#059669"]}
          />
        }
      >
        {/* Header hàng đầu */}
        <View style={payrollStyles.headerRow}>
          <Pressable
            style={payrollStyles.backBtn}
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
            <Text style={payrollStyles.pageTitle}>
              {canCompany ? "Bảng lương" : "Phiếu lương của tôi"}
            </Text>
            <Text style={payrollStyles.pageSubtitle}>
              {selectedBranch?.name ? `${selectedBranch.name}` : "Tính và hiển thị lương"}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [payrollStyles.refreshButton, pressed && { opacity: 0.8 }]}
            disabled={loading || personalLoading}
            onPress={() => setRevision((current) => current + 1)}
          >
            <Text style={payrollStyles.refreshButtonText}>↻ Tải lại</Text>
          </Pressable>
        </View>

        {/* Tab switcher giữa Bảng tính lương & Phiếu lương cá nhân */}
        {canPersonal && canCompany && (
          <View style={payrollStyles.tabSegmentContainer}>
            <Pressable
              style={[
                payrollStyles.tabSegmentButton,
                activeTab === "company_run" && payrollStyles.tabSegmentButtonActive,
              ]}
              onPress={() => setActiveTab("company_run")}
            >
              <Text
                style={[
                  payrollStyles.tabSegmentText,
                  activeTab === "company_run" && payrollStyles.tabSegmentTextActive,
                ]}
              >
                🏢 Bảng tính lương
              </Text>
            </Pressable>
            <Pressable
              style={[
                payrollStyles.tabSegmentButton,
                activeTab === "my_payslip" && payrollStyles.tabSegmentButtonActive,
              ]}
              onPress={() => setActiveTab("my_payslip")}
            >
              <Text
                style={[
                  payrollStyles.tabSegmentText,
                  activeTab === "my_payslip" && payrollStyles.tabSegmentTextActive,
                ]}
              >
                📄 Phiếu lương của tôi
              </Text>
            </Pressable>
          </View>
        )}

        {/* ============================================================ */}
        {/* NỘI DUNG TAB 1: BẢNG TÍNH LƯƠNG DOANH NGHIỆP                */}
        {/* ============================================================ */}
        {activeTab === "company_run" ? (
          <>
            {/* Bộ điều hướng tháng chuẩn Mobile */}
            <View style={payrollStyles.monthNavigator}>
              <Pressable
                style={({ pressed }) => [payrollStyles.navArrowBtn, pressed && { opacity: 0.6 }]}
                onPress={goToPrevMonth}
              >
                <Text style={payrollStyles.navArrowText}>◀</Text>
              </Pressable>

              <Pressable
                style={payrollStyles.navMonthLabelBtn}
                onPress={() => setActiveModal("custom_period")}
              >
                <Text style={payrollStyles.navMonthText}>{formatPeriodLabel(period)}</Text>
                <Text style={payrollStyles.navMonthSub}>Nhấn để đổi kỳ</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [payrollStyles.navArrowBtn, pressed && { opacity: 0.6 }]}
                onPress={goToNextMonth}
              >
                <Text style={payrollStyles.navArrowText}>▶</Text>
              </Pressable>
            </View>

            {/* Hero Summary Card chuẩn Mobile Banking / HR */}
            <View style={payrollStyles.heroCard}>
              <View style={payrollStyles.heroTopRow}>
                <View>
                  <Text style={payrollStyles.heroLabel}>TỔNG THỰC NHẬN KỲ NÀY</Text>
                  <Text style={payrollStyles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>
                    {run ? payslipMoney(totalNet) : "—"}
                  </Text>
                </View>
                <View
                  style={[
                    payrollStyles.heroStatusBadge,
                    isClosed ? payrollStyles.heroStatusClosed : payrollStyles.heroStatusActive,
                  ]}
                >
                  <Text
                    style={[
                      payrollStyles.heroStatusText,
                      isClosed ? payrollStyles.heroStatusClosedText : payrollStyles.heroStatusActiveText,
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>
              </View>

              <View style={payrollStyles.heroMetaDivider} />

              <View style={payrollStyles.heroFooterRow}>
                <View style={payrollStyles.heroFooterItem}>
                  <Text style={payrollStyles.heroFooterLabel}>Tổng nhân sự</Text>
                  <Text style={payrollStyles.heroFooterValue}>
                    {run ? `${lines.length} người` : "—"}
                  </Text>
                </View>
                <View style={payrollStyles.heroFooterSep} />
                <View style={payrollStyles.heroFooterItem}>
                  <Text style={payrollStyles.heroFooterLabel}>Tổng quỹ Gross</Text>
                  <Text style={payrollStyles.heroFooterValue} numberOfLines={1}>
                    {run && totalGross > 0 ? payslipMoney(totalGross) : "—"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Thông báo lỗi nếu có */}
            {(inputError || error) && (
              <View style={payrollStyles.errorBanner}>
                <Text style={payrollStyles.errorBannerText}>{inputError || error}</Text>
              </View>
            )}

            {loading && (
              <View style={payrollStyles.loadingCard}>
                <Loading />
                <Text style={payrollStyles.loadingText}>Đang tải dữ liệu kỳ {period}...</Text>
              </View>
            )}


            {/* Trạng thái chưa có bảng lương */}
            {missing && !loading && (
              <View style={payrollStyles.emptyCard}>
                <Text style={payrollStyles.emptyIcon}>📊</Text>
                <Text style={payrollStyles.emptyTitle}>Chưa có bảng lương kỳ {period}</Text>
                <Text style={payrollStyles.emptyText}>
                  Kỳ này chưa được khởi tạo. Bạn có thể nhấn nút bên dưới để tạo kỳ lương mới.
                </Text>
                <View style={{ marginTop: 12, width: "100%" }}>
                  <CreatePayrollRun
                    key={"create:" + period + ":" + revision}
                    period={period}
                    onChanged={() => setRevision((c) => c + 1)}
                  />
                </View>
              </View>
            )}

            {/* ============================================================ */}
            {/* QUY TRÌNH KỲ LƯƠNG: 3 TRẠNG THÁI & 4 THAO TÁC CỐT LÕI       */}
            {/* ============================================================ */}
            {run && !loading && (
              <View style={payrollStyles.lifecycleSection}>
                {/* Stepper Card 4 Bước */}
                <View style={payrollStyles.stepperCard}>
                  <View style={payrollStyles.stepperHeaderRow}>
                    <Text style={payrollStyles.stepperTitle}>Tiến trình kỳ lương</Text>
                    <View style={payrollStyles.stepperStageBadge}>
                      <Text style={payrollStyles.stepperStageBadgeText}>
                        Giai đoạn {currentStage}/4: {currentStage === 1 ? "Nháp" : currentStage === 2 ? "Kiểm tra" : currentStage === 3 ? "Đã chốt" : "Đã thanh toán"}
                      </Text>
                    </View>
                  </View>

                  <View style={payrollStyles.stepperTrackRow}>
                    {/* Bước 1: Nháp */}
                    <View style={payrollStyles.stepNode}>
                      <View
                        style={[
                          payrollStyles.stepCircle,
                          currentStage >= 1 && payrollStyles.stepCircleActive,
                          currentStage > 1 && payrollStyles.stepCircleDone,
                        ]}
                      >
                        <Text
                          style={[
                            payrollStyles.stepCircleText,
                            currentStage >= 1 && payrollStyles.stepCircleTextActive,
                            currentStage > 1 && payrollStyles.stepCircleTextDone,
                          ]}
                        >
                          {currentStage > 1 ? "✓" : "1"}
                        </Text>
                      </View>
                      <Text
                        style={[
                          payrollStyles.stepLabel,
                          currentStage === 1 && payrollStyles.stepLabelActive,
                        ]}
                        numberOfLines={1}
                      >
                        1. Nháp
                      </Text>
                    </View>

                    {/* Đường nối 1 -> 2 */}
                    <View
                      style={[
                        payrollStyles.stepLine,
                        currentStage > 1 && payrollStyles.stepLineActive,
                      ]}
                    />

                    {/* Bước 2: Kiểm tra */}
                    <View style={payrollStyles.stepNode}>
                      <View
                        style={[
                          payrollStyles.stepCircle,
                          currentStage >= 2 && payrollStyles.stepCircleActive,
                          currentStage > 2 && payrollStyles.stepCircleDone,
                        ]}
                      >
                        <Text
                          style={[
                            payrollStyles.stepCircleText,
                            currentStage >= 2 && payrollStyles.stepCircleTextActive,
                            currentStage > 2 && payrollStyles.stepCircleTextDone,
                          ]}
                        >
                          {currentStage > 2 ? "✓" : "2"}
                        </Text>
                      </View>
                      <Text
                        style={[
                          payrollStyles.stepLabel,
                          currentStage === 2 && payrollStyles.stepLabelActive,
                        ]}
                        numberOfLines={1}
                      >
                        2. Kiểm tra
                      </Text>
                    </View>

                    {/* Đường nối 2 -> 3 */}
                    <View
                      style={[
                        payrollStyles.stepLine,
                        currentStage > 2 && payrollStyles.stepLineActive,
                      ]}
                    />

                    {/* Bước 3: Chốt */}
                    <View style={payrollStyles.stepNode}>
                      <View
                        style={[
                          payrollStyles.stepCircle,
                          currentStage >= 3 && payrollStyles.stepCircleActive,
                          currentStage > 3 && payrollStyles.stepCircleDone,
                        ]}
                      >
                        <Text
                          style={[
                            payrollStyles.stepCircleText,
                            currentStage >= 3 && payrollStyles.stepCircleTextActive,
                            currentStage > 3 && payrollStyles.stepCircleTextDone,
                          ]}
                        >
                          {currentStage > 3 ? "✓" : "3"}
                        </Text>
                      </View>
                      <Text
                        style={[
                          payrollStyles.stepLabel,
                          currentStage === 3 && payrollStyles.stepLabelActive,
                        ]}
                        numberOfLines={1}
                      >
                        3. Chốt
                      </Text>
                    </View>

                    {/* Đường nối 3 -> 4 */}
                    <View
                      style={[
                        payrollStyles.stepLine,
                        currentStage >= 4 && payrollStyles.stepLineActive,
                      ]}
                    />

                    {/* Bước 4: Thanh toán */}
                    <View style={payrollStyles.stepNode}>
                      <View
                        style={[
                          payrollStyles.stepCircle,
                          currentStage === 4 && payrollStyles.stepCircleActive,
                          isPaid && payrollStyles.stepCircleDone,
                        ]}
                      >
                        <Text
                          style={[
                            payrollStyles.stepCircleText,
                            currentStage === 4 && payrollStyles.stepCircleTextActive,
                            isPaid && payrollStyles.stepCircleTextDone,
                          ]}
                        >
                          {isPaid ? "✓" : "4"}
                        </Text>
                      </View>
                      <Text
                        style={[
                          payrollStyles.stepLabel,
                          currentStage === 4 && payrollStyles.stepLabelActive,
                        ]}
                        numberOfLines={1}
                      >
                        4. Thanh toán
                      </Text>
                    </View>
                  </View>

                  <Text style={payrollStyles.stepperDesc}>
                    {currentStage === 1 &&
                      "💡 Bước 1 (Nháp): Thực hiện 'Tính lương' từ dữ liệu chấm công và chuyển sang 'Kiểm tra'."}
                    {currentStage === 2 &&
                      "💡 Bước 2 (Kiểm tra): Rà soát bảng lương của từng nhân viên và bấm 'Chốt kỳ' khi số liệu chuẩn xác."}
                    {currentStage === 3 &&
                      "💡 Bước 3 (Chốt): Bảng lương đã chốt và khóa dữ liệu an toàn. Chuyển sang Bước 4 'Thanh toán' để lập phiếu chi."}
                    {currentStage === 4 &&
                      "🎉 Bước 4 (Thanh toán): Kỳ lương đã hoàn tất chi trả và thanh toán toàn bộ cho nhân viên."}
                  </Text>
                </View>

                {/* 4 Thao tác cốt lõi dạng Grid 2x2 */}
                <View style={payrollStyles.fourActionsGrid}>
                  {/* Thao tác 1: Tính lương */}
                  <Pressable
                    style={({ pressed }) => [
                      payrollStyles.coreActionCard,
                      currentStage === 1 && payrollStyles.coreActionCardHighlighted,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => setActiveModal("calculate")}
                  >
                    <View style={payrollStyles.coreActionHeader}>
                      <View
                        style={[
                          payrollStyles.coreActionIconBox,
                          currentStage === 1 && payrollStyles.coreActionIconBoxActive,
                        ]}
                      >
                        <Text style={payrollStyles.coreActionIcon}>⚡</Text>
                      </View>
                      <View
                        style={[
                          payrollStyles.coreActionBadge,
                          currentStage === 1 ? payrollStyles.badgeActive : payrollStyles.badgeMuted,
                        ]}
                      >
                        <Text
                          style={[
                            payrollStyles.coreActionBadgeText,
                            currentStage === 1
                              ? payrollStyles.badgeActiveText
                              : payrollStyles.badgeMutedText,
                          ]}
                        >
                          {currentStage === 1 ? "Cần làm" : "Nháp"}
                        </Text>
                      </View>
                    </View>
                    <Text style={payrollStyles.coreActionTitle}>1. Tính lương</Text>
                    <Text style={payrollStyles.coreActionSub}>Tính từ bảng chấm công</Text>
                  </Pressable>

                  {/* Thao tác 2: Kiểm tra */}
                  <Pressable
                    style={({ pressed }) => [
                      payrollStyles.coreActionCard,
                      currentStage === 2 && payrollStyles.coreActionCardHighlighted,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => setActiveModal("review")}
                  >
                    <View style={payrollStyles.coreActionHeader}>
                      <View
                        style={[
                          payrollStyles.coreActionIconBox,
                          currentStage === 2 && payrollStyles.coreActionIconBoxActive,
                        ]}
                      >
                        <Text style={payrollStyles.coreActionIcon}>🔍</Text>
                      </View>
                      <View
                        style={[
                          payrollStyles.coreActionBadge,
                          currentStage === 2
                            ? payrollStyles.badgeActive
                            : currentStage > 2
                              ? payrollStyles.badgeSuccess
                              : payrollStyles.badgeMuted,
                        ]}
                      >
                        <Text
                          style={[
                            payrollStyles.coreActionBadgeText,
                            currentStage === 2
                              ? payrollStyles.badgeActiveText
                              : currentStage > 2
                                ? payrollStyles.badgeSuccessText
                                : payrollStyles.badgeMutedText,
                          ]}
                        >
                          {currentStage === 2 ? "Đang rà soát" : currentStage > 2 ? "Đã kiểm tra" : "Chờ gửi"}
                        </Text>
                      </View>
                    </View>
                    <Text style={payrollStyles.coreActionTitle}>2. Kiểm tra</Text>
                    <Text style={payrollStyles.coreActionSub}>Chuyển kỳ sang kiểm tra</Text>
                  </Pressable>

                  {/* Thao tác 3: Chốt */}
                  <Pressable
                    style={({ pressed }) => [
                      payrollStyles.coreActionCard,
                      currentStage === 2 && payrollStyles.coreActionCardHighlighted,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => setActiveModal("close")}
                  >
                    <View style={payrollStyles.coreActionHeader}>
                      <View
                        style={[
                          payrollStyles.coreActionIconBox,
                          isClosed && payrollStyles.coreActionIconBoxClosed,
                        ]}
                      >
                        <Text style={payrollStyles.coreActionIcon}>🔒</Text>
                      </View>
                      <View
                        style={[
                          payrollStyles.coreActionBadge,
                          isClosed
                            ? payrollStyles.badgeSuccess
                            : currentStage === 2
                              ? payrollStyles.badgeActive
                              : payrollStyles.badgeMuted,
                        ]}
                      >
                        <Text
                          style={[
                            payrollStyles.coreActionBadgeText,
                            isClosed
                              ? payrollStyles.badgeSuccessText
                              : currentStage === 2
                                ? payrollStyles.badgeActiveText
                                : payrollStyles.badgeMutedText,
                          ]}
                        >
                          {isClosed ? "Đã chốt ✓" : currentStage === 2 ? "Sẵn sàng" : "Chờ duyệt"}
                        </Text>
                      </View>
                    </View>
                    <Text style={payrollStyles.coreActionTitle}>3. Chốt kỳ</Text>
                    <Text style={payrollStyles.coreActionSub}>Khóa dữ liệu bảng lương</Text>
                  </Pressable>

                  {/* Thao tác 4: Thanh toán */}
                  <Pressable
                    style={({ pressed }) => [
                      payrollStyles.coreActionCard,
                      currentStage === 3 && run.status !== "paid" && payrollStyles.coreActionCardHighlighted,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => setActiveModal("payment")}
                  >
                    <View style={payrollStyles.coreActionHeader}>
                      <View
                        style={[
                          payrollStyles.coreActionIconBox,
                          run.status === "paid" && payrollStyles.coreActionIconBoxSuccess,
                        ]}
                      >
                        <Text style={payrollStyles.coreActionIcon}>💵</Text>
                      </View>
                      <View
                        style={[
                          payrollStyles.coreActionBadge,
                          run.status === "paid"
                            ? payrollStyles.badgeSuccess
                            : isClosed
                              ? payrollStyles.badgeActive
                              : payrollStyles.badgeMuted,
                        ]}
                      >
                        <Text
                          style={[
                            payrollStyles.coreActionBadgeText,
                            run.status === "paid"
                              ? payrollStyles.badgeSuccessText
                              : isClosed
                                ? payrollStyles.badgeActiveText
                                : payrollStyles.badgeMutedText,
                          ]}
                        >
                          {run.status === "paid" ? "Đã trả ✓" : isClosed ? "Chi trả" : "Chờ chốt"}
                        </Text>
                      </View>
                    </View>
                    <Text style={payrollStyles.coreActionTitle}>4. Thanh toán</Text>
                    <Text style={payrollStyles.coreActionSub}>Lập lệnh chi trả lương</Text>
                  </Pressable>
                </View>

                {/* Thanh công cụ bổ trợ */}
                <View style={payrollStyles.auxSection}>
                  <Text style={payrollStyles.auxSectionTitle}>Công cụ:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={payrollStyles.auxScroll}
                  >
                    <Pressable
                      style={({ pressed }) => [payrollStyles.auxChip, pressed && { opacity: 0.7 }]}
                      onPress={() => setActiveModal("sync")}
                    >
                      <Text style={payrollStyles.auxChipIcon}>🔄</Text>
                      <Text style={payrollStyles.auxChipText}>Đồng bộ công</Text>
                    </Pressable>

                    {(run.status === "review" || isClosed) && (
                      <Pressable
                        style={({ pressed }) => [payrollStyles.auxChip, pressed && { opacity: 0.7 }]}
                        onPress={() => setActiveModal("reopen")}
                      >
                        <Text style={payrollStyles.auxChipIcon}>🔓</Text>
                        <Text style={payrollStyles.auxChipText}>Mở lại kỳ (Nháp)</Text>
                      </Pressable>
                    )}

                    <Pressable
                      style={({ pressed }) => [payrollStyles.auxChip, pressed && { opacity: 0.7 }]}
                      onPress={() => setActiveModal("publish")}
                    >
                      <Text style={payrollStyles.auxChipIcon}>📤</Text>
                      <Text style={payrollStyles.auxChipText}>Phát hành</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [payrollStyles.auxChip, pressed && { opacity: 0.7 }]}
                      onPress={() => setActiveModal("export")}
                    >
                      <Text style={payrollStyles.auxChipIcon}>📥</Text>
                      <Text style={payrollStyles.auxChipText}>Xuất file</Text>
                    </Pressable>

                    {canReadRunPayments(user) && (
                      <Pressable
                        style={({ pressed }) => [payrollStyles.auxChip, pressed && { opacity: 0.7 }]}
                        onPress={() => setActiveModal("history")}
                      >
                        <Text style={payrollStyles.auxChipIcon}>📋</Text>
                        <Text style={payrollStyles.auxChipText}>Lịch sử chi</Text>
                      </Pressable>
                    )}

                    <Pressable
                      style={({ pressed }) => [payrollStyles.auxChip, pressed && { opacity: 0.7 }]}
                      onPress={() => setActiveModal("advanced")}
                    >
                      <Text style={payrollStyles.auxChipIcon}>⚙️</Text>
                      <Text style={payrollStyles.auxChipText}>Cấu hình & Nhật ký</Text>
                    </Pressable>
                  </ScrollView>
                </View>
              </View>
            )}

            {/* BẢNG HIỂN THỊ LƯƠNG NHÂN VIÊN */}
            {run && !loading && (
              <>
                <View style={payrollStyles.listHeaderRow}>
                  <Text style={payrollStyles.listTitle}>
                    Bảng tính lương ({rows.length} nhân viên)
                  </Text>
                </View>

                {/* Thanh tìm kiếm nhanh */}
                <View style={payrollStyles.searchContainer}>
                  <Text style={payrollStyles.searchIcon}>🔍</Text>
                  <TextInput
                    style={payrollStyles.searchInput}
                    value={searchDraft}
                    onChangeText={(val) => {
                      setSearchDraft(val);
                      setSearch(val);
                      setExpanded(null);
                    }}
                    placeholder="Tìm theo tên nhân viên..."
                    placeholderTextColor="#94a3b8"
                    returnKeyType="search"
                  />
                  {searchDraft.length > 0 && (
                    <Pressable
                      onPress={() => {
                        setSearchDraft("");
                        setSearch("");
                        setExpanded(null);
                      }}
                      hitSlop={8}
                      style={payrollStyles.searchClearBtn}
                    >
                      <Text style={payrollStyles.searchClearText}>✕</Text>
                    </Pressable>
                  )}
                </View>

                {!rows.length ? (
                  <View style={payrollStyles.emptyCard}>
                    <Text style={payrollStyles.emptyIcon}>📋</Text>
                    <Text style={payrollStyles.emptyTitle}>Không tìm thấy nhân viên</Text>
                    <Text style={payrollStyles.emptyText}>
                      Không có nhân viên nào phù hợp với từ khóa &ldquo;{search}&rdquo;.
                    </Text>
                  </View>
                ) : (
                  rows.map((line) => {
                    const net = line.calculation.net ?? line.calculation.netPay ?? 0;
                    const base = line.calculation.monthlySalary ?? line.calculation.baseSalary ?? 0;
                    const workedDays = line.calculation.workedDays;
                    const standardDays = line.calculation.standardDays;
                    const allowances = Number(line.calculation.allowances || 0);
                    const bonuses = Number(line.calculation.bonuses || 0);
                    const gross = Number(line.calculation.gross || 0);
                    const deductions = Number(line.calculation.deductions || 0);
                    const isItemExpanded = expanded === line.employeeId;

                    return (
                      <View key={line.employeeId} style={payrollStyles.employeeCard}>
                        {/* Header Thẻ nhân viên */}
                        <View style={payrollStyles.empHeaderRow}>
                          <View style={payrollStyles.avatarCircle}>
                            <Text style={payrollStyles.avatarText}>
                              {(line.employeeName || "NV").substring(0, 1).toUpperCase()}
                            </Text>
                          </View>

                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={payrollStyles.employeeName} numberOfLines={1}>
                              {line.employeeName || "Nhân viên"}
                            </Text>
                            <View style={payrollStyles.empMetaRow}>
                              <Text style={payrollStyles.empWorkDays}>
                                {workedDays !== undefined
                                  ? `📅 ${workedDays}/${standardDays || "—"} ngày công`
                                  : "Nhân viên"}
                              </Text>
                            </View>
                          </View>

                          <View style={payrollStyles.netBadgeContainer}>
                            <Text style={payrollStyles.netBadgeLabel}>Thực nhận</Text>
                            <Text style={payrollStyles.netBadgeAmount} numberOfLines={1}>
                              {payslipMoney(net)}
                            </Text>
                          </View>
                        </View>

                        {/* Lưới 4 thành phần lương trực quan */}
                        <View style={payrollStyles.empMetricsGrid}>
                          <View style={payrollStyles.empMetricItem}>
                            <Text style={payrollStyles.empMetricLabel}>Lương chính</Text>
                            <Text style={payrollStyles.empMetricValue}>{payslipMoney(base)}</Text>
                          </View>
                          <View style={payrollStyles.empMetricItem}>
                            <Text style={payrollStyles.empMetricLabel}>Phụ cấp & Thưởng</Text>
                            <Text style={payrollStyles.empMetricValue}>
                              {payslipMoney(allowances + bonuses)}
                            </Text>
                          </View>
                          <View style={payrollStyles.empMetricItem}>
                            <Text style={payrollStyles.empMetricLabel}>Tổng Gross</Text>
                            <Text style={payrollStyles.empMetricValue}>{payslipMoney(gross)}</Text>
                          </View>
                          <View style={payrollStyles.empMetricItem}>
                            <Text style={payrollStyles.empMetricLabel}>Khấu trừ</Text>
                            <Text
                              style={[
                                payrollStyles.empMetricValue,
                                deductions > 0 && { color: "#dc2626" },
                              ]}
                            >
                              {payslipMoney(deductions)}
                            </Text>
                          </View>
                        </View>

                        {/* Nút mở rộng bảng tính chi tiết */}
                        {detailAllowed && (
                          <Pressable
                            style={({ pressed }) => [
                              payrollStyles.expandDetailButton,
                              pressed && { opacity: 0.8 },
                            ]}
                            onPress={() =>
                              setExpanded(isItemExpanded ? null : line.employeeId)
                            }
                          >
                            <Text style={payrollStyles.expandDetailText}>
                              {isItemExpanded ? "▲ Thu gọn chi tiết" : "▼ Xem bảng tính chi tiết lương & công"}
                            </Text>
                          </Pressable>
                        )}

                        {detailAllowed && isItemExpanded && (
                          <View style={{ marginTop: 8 }}>
                            <PayslipDetails item={{ runId: run._id, employeeId: line.employeeId }} />
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </>
            )}
          </>
        ) : (
          /* ============================================================ */
          /* NỘI DUNG TAB 2: PHIẾU LƯƠNG CỦA TÔI                         */
          /* ============================================================ */
          <>
            {/* Thẻ thông tin tài khoản đăng nhập */}
            <View style={payrollStyles.userProfileCard}>
              <View style={payrollStyles.userProfileAvatarCircle}>
                <Text style={payrollStyles.userProfileAvatarText}>
                  {(user?.displayName || user?.email || "U").substring(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={payrollStyles.userProfileNameRow}>
                  <Text style={payrollStyles.userProfileName} numberOfLines={1}>
                    {user?.displayName || "Tài khoản của bạn"}
                  </Text>
                  <View style={payrollStyles.userProfileBadge}>
                    <Text style={payrollStyles.userProfileBadgeText}>Cá nhân</Text>
                  </View>
                </View>
                <Text style={payrollStyles.userProfileSub} numberOfLines={1}>
                  {user?.email || "—"} {selectedBranch?.name ? `· ${selectedBranch.name}` : ""}
                </Text>
              </View>
            </View>

            {/* Hero Banner phiếu lương cá nhân */}
            <View style={payrollStyles.heroCard}>
              <View style={payrollStyles.heroTopRow}>
                <View>
                  <Text style={payrollStyles.heroLabel}>TỔNG THỰC NHẬN CỦA BẠN</Text>
                  <Text style={payrollStyles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>
                    {payslipMoney(totalPersonalNet)}
                  </Text>
                </View>
                <View
                  style={[
                    payrollStyles.heroStatusBadge,
                    totalPersonalBalance <= 0 ? payrollStyles.heroStatusClosed : payrollStyles.heroStatusActive,
                  ]}
                >
                  <Text
                    style={[
                      payrollStyles.heroStatusText,
                      totalPersonalBalance <= 0 ? payrollStyles.heroStatusClosedText : payrollStyles.heroStatusActiveText,
                    ]}
                  >
                    {totalPersonalBalance <= 0 ? "Đã quyết toán" : "Còn số dư"}
                  </Text>
                </View>
              </View>

              <View style={payrollStyles.heroMetaDivider} />

              <View style={payrollStyles.heroFooterRow}>
                <View style={payrollStyles.heroFooterItem}>
                  <Text style={payrollStyles.heroFooterLabel}>Đã thanh toán</Text>
                  <Text style={payrollStyles.heroFooterValue}>
                    {payslipMoney(totalPersonalPaid)}
                  </Text>
                </View>
                <View style={payrollStyles.heroFooterSep} />
                <View style={payrollStyles.heroFooterItem}>
                  <Text style={payrollStyles.heroFooterLabel}>Còn lại</Text>
                  <Text
                    style={[
                      payrollStyles.heroFooterValue,
                      totalPersonalBalance > 0 && { color: "#dc2626" },
                    ]}
                  >
                    {payslipMoney(totalPersonalBalance)}
                  </Text>
                </View>
              </View>
            </View>

            {/* KHU VỰC TÌM KIẾM THEO THÁNG, NĂM */}
            <View style={payrollStyles.personalFilterSection}>
              {/* Thanh tìm kiếm tháng/năm */}
              <View style={payrollStyles.searchContainer}>
                <Text style={payrollStyles.searchIcon}>🔍</Text>
                <TextInput
                  style={payrollStyles.searchInput}
                  value={personalSearch}
                  onChangeText={(val) => {
                    setPersonalSearch(val);
                    setPersonalExpanded(null);
                  }}
                  placeholder="Tìm theo tháng, năm (vd: 09, 2026, 09/2026)..."
                  placeholderTextColor="#94a3b8"
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="search"
                />
                {(personalSearch.length > 0 || personalYear !== "all" || personalMonth !== "all") && (
                  <Pressable
                    onPress={() => {
                      setPersonalSearch("");
                      setPersonalYear("all");
                      setPersonalMonth("all");
                      setPersonalExpanded(null);
                    }}
                    hitSlop={8}
                    style={payrollStyles.searchClearBtn}
                  >
                    <Text style={payrollStyles.searchClearText}>✕ Đặt lại</Text>
                  </Pressable>
                )}
              </View>

              {/* Lọc nhanh theo Năm */}
              {allPersonalYears.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={payrollStyles.filterSubLabel}>Năm chi trả:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={payrollStyles.periodPillsScroll}
                  >
                    <Pressable
                      style={[
                        payrollStyles.periodPill,
                        personalYear === "all" && payrollStyles.periodPillActive,
                      ]}
                      onPress={() => {
                        setPersonalYear("all");
                        setPersonalExpanded(null);
                      }}
                    >
                      <Text
                        style={[
                          payrollStyles.periodPillText,
                          personalYear === "all" && payrollStyles.periodPillTextActive,
                        ]}
                      >
                        Tất cả các năm
                      </Text>
                    </Pressable>
                    {allPersonalYears.map((y) => (
                      <Pressable
                        key={y}
                        style={[
                          payrollStyles.periodPill,
                          personalYear === y && payrollStyles.periodPillActive,
                        ]}
                        onPress={() => {
                          setPersonalYear(y);
                          setPersonalExpanded(null);
                        }}
                      >
                        <Text
                          style={[
                            payrollStyles.periodPillText,
                            personalYear === y && payrollStyles.periodPillTextActive,
                          ]}
                        >
                          Năm {y}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Lọc nhanh theo Tháng */}
              <View style={{ gap: 6 }}>
                <Text style={payrollStyles.filterSubLabel}>Tháng chi trả:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={payrollStyles.periodPillsScroll}
                >
                  {PERSONAL_MONTH_OPTIONS.map((m) => (
                    <Pressable
                      key={m.value}
                      style={[
                        payrollStyles.periodPill,
                        personalMonth === m.value && payrollStyles.periodPillActive,
                      ]}
                      onPress={() => {
                        setPersonalMonth(m.value);
                        setPersonalExpanded(null);
                      }}
                    >
                      <Text
                        style={[
                          payrollStyles.periodPillText,
                          personalMonth === m.value && payrollStyles.periodPillTextActive,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Tiêu đề danh sách kết quả */}
            <View style={payrollStyles.listHeaderRow}>
              <Text style={payrollStyles.listTitle}>
                Danh sách phiếu lương ({personalRows.length} kỳ)
              </Text>
            </View>

            {personalError && (
              <View style={payrollStyles.errorBanner}>
                <Text style={payrollStyles.errorBannerText}>{personalError}</Text>
              </View>
            )}

            {personalLoading && <Loading />}

            {!personalLoading && !personalError && personalRows.length === 0 && (
              <View style={payrollStyles.emptyCard}>
                <Text style={payrollStyles.emptyIcon}>💳</Text>
                <Text style={payrollStyles.emptyTitle}>Chưa có phiếu lương</Text>
                <Text style={payrollStyles.emptyText}>
                  Chưa có phiếu lương cá nhân nào được phát hành trong kỳ đã chọn.
                </Text>
              </View>
            )}

            {personalRows.map((item) => {
              const key = `${item.runId}:${item.employeeId}`;
              const isItemExpanded = personalExpanded === key;
              return (
                <View key={key} style={payrollStyles.employeeCard}>
                  <View style={payrollStyles.empHeaderRow}>
                    <View style={payrollStyles.avatarCircle}>
                      <Text style={payrollStyles.avatarText}>📄</Text>
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={payrollStyles.employeeName}>
                        Kỳ lương {item.periodKey || "—"}
                      </Text>
                      <Text style={payrollStyles.employeeMeta}>
                        {item.employeeName || user?.displayName || "Phiếu lương cá nhân"}
                      </Text>
                    </View>
                    <View style={payrollStyles.netBadgeContainer}>
                      <Text style={payrollStyles.netBadgeLabel}>Thực nhận</Text>
                      <Text style={payrollStyles.netBadgeAmount}>
                        {payslipMoney(item.netPay)}
                      </Text>
                    </View>
                  </View>

                  <View style={payrollStyles.empMetricsGrid}>
                    <View style={payrollStyles.empMetricItem}>
                      <Text style={payrollStyles.empMetricLabel}>Đã nhận</Text>
                      <Text style={payrollStyles.empMetricValue}>
                        {payslipMoney(item.paidAmount)}
                      </Text>
                    </View>
                    <View style={payrollStyles.empMetricItem}>
                      <Text style={payrollStyles.empMetricLabel}>Còn lại</Text>
                      <Text
                        style={[
                          payrollStyles.empMetricValue,
                          item.balance > 0 && { color: "#dc2626" },
                        ]}
                      >
                        {payslipMoney(item.balance)}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    style={payrollStyles.expandDetailButton}
                    onPress={() => setPersonalExpanded(isItemExpanded ? null : key)}
                  >
                    <Text style={payrollStyles.expandDetailText}>
                      {isItemExpanded ? "▲ Thu gọn chi tiết" : "▼ Xem chi tiết thu nhập & khấu trừ"}
                    </Text>
                  </Pressable>

                  {isItemExpanded && (
                    <View style={{ marginTop: 8 }}>
                      <PayslipDetails item={item} />
                    </View>
                  )}

                  <View style={{ marginTop: 6 }}>
                    <SharePayslipButton item={item} />
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* ============================================================ */}
      {/* NATIVE BOTTOM SHEET MODAL CHO CÁC THAO TÁC XỬ LÝ            */}
      {/* ============================================================ */}
      <Modal
        visible={Boolean(activeModal)}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={payrollStyles.modalOverlay}>
          <Pressable
            style={payrollStyles.modalBackdrop}
            onPress={() => setActiveModal(null)}
          />
          <View style={payrollStyles.modalContent}>
            <View style={payrollStyles.modalDragHandle} />

            <View style={payrollStyles.modalHeader}>
              <Text style={payrollStyles.modalTitle}>
                {activeModal === "calculate" && "⚡ 1. Tính lương kỳ " + period}
                {activeModal === "review" && "🔍 2. Kiểm tra bảng lương kỳ " + period}
                {activeModal === "close" && "🔒 3. Chốt kỳ lương kỳ " + period}
                {activeModal === "payment" && "💵 4. Thanh toán lương kỳ " + period}
                {activeModal === "reopen" && "🔓 Mở lại kỳ lương " + period}
                {activeModal === "sync" && "🔄 Đồng bộ chấm công kỳ " + period}
                {activeModal === "publish" && "📤 Phát hành phiếu lương " + period}
                {activeModal === "export" && "📥 Xuất bảng lương " + period}
                {activeModal === "history" && "📋 Lịch sử chi trả kỳ " + period}
                {activeModal === "advanced" && "⚙️ Quản trị & Điều chỉnh lương"}
                {activeModal === "custom_period" && "📅 Chọn kỳ lương tra cứu"}
              </Text>
              <Pressable
                onPress={() => setActiveModal(null)}
                hitSlop={10}
                style={payrollStyles.modalCloseButton}
              >
                <Text style={payrollStyles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              style={payrollStyles.modalBody}
              contentContainerStyle={payrollStyles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Modal Đổi kỳ */}
              {activeModal === "custom_period" && (
                <View style={{ gap: 12 }}>
                  <Text style={payrollStyles.inputLabel}>Nhập kỳ lương (YYYY-MM):</Text>
                  <TextInput
                    style={payrollStyles.customPeriodInput}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="YYYY-MM (ví dụ 2026-09)"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numbers-and-punctuation"
                    maxLength={7}
                    returnKeyType="search"
                    onSubmitEditing={submitCustomPeriod}
                  />
                  {inputError && <Text style={payrollStyles.errorText}>{inputError}</Text>}
                  <Pressable
                    style={payrollStyles.primaryModalButton}
                    onPress={submitCustomPeriod}
                  >
                    <Text style={payrollStyles.primaryModalButtonText}>Áp dụng kỳ này</Text>
                  </Pressable>
                </View>
              )}

              {/* 1. Modal Tính lương */}
              {activeModal === "calculate" && run && (
                <CalculatePayrollRun
                  key={"calculate:" + run._id + ":" + run.version + ":" + revision}
                  run={run}
                  onChanged={onModalChanged}
                />
              )}

              {/* 2. Modal Kiểm tra */}
              {activeModal === "review" && run && (
                <View style={{ gap: 12 }}>
                  <Text style={payrollStyles.modalGuideText}>
                    Chuyển kỳ lương sang trạng thái Kiểm tra để rà soát các dòng tính lương trước khi chốt.
                  </Text>
                  <ReviewPayrollRun
                    close={false}
                    key={"review:" + run._id + ":" + run.version + ":" + revision}
                    run={run}
                    onChanged={onModalChanged}
                  />
                </View>
              )}

              {/* 3. Modal Chốt kỳ */}
              {activeModal === "close" && run && (
                <View style={{ gap: 12 }}>
                  <Text style={payrollStyles.modalGuideText}>
                    Chốt và khóa kỳ lương. Sau khi chốt, số liệu sẽ được đóng băng để thực hiện thanh toán chi trả.
                  </Text>
                  <ReviewPayrollRun
                    close={true}
                    key={"close:" + run._id + ":" + run.version + ":" + revision}
                    run={run}
                    onChanged={onModalChanged}
                  />
                </View>
              )}

              {/* 4. Modal Chi trả lương */}
              {activeModal === "payment" && run && (
                <CreatePayrollPayment
                  key={"payment:" + run._id + ":" + revision}
                  run={run}
                  onChanged={onModalChanged}
                />
              )}

              {/* Modal Mở lại kỳ */}
              {activeModal === "reopen" && run && (
                <View style={{ gap: 12 }}>
                  <Text style={payrollStyles.modalGuideText}>
                    Mở lại kỳ lương về trạng thái Nháp để cập nhật công hoặc tính toán lại bảng lương.
                  </Text>
                  <ReopenPayrollRun
                    key={"reopen:" + run._id + ":" + run.version + ":" + revision}
                    run={run}
                    onChanged={onModalChanged}
                  />
                </View>
              )}

              {/* Modal Đồng bộ công */}
              {activeModal === "sync" && run && (
                <SyncRunAttendance
                  key={"sync:" + run._id + ":" + run.version + ":" + revision}
                  run={run}
                  onChanged={onModalChanged}
                />
              )}


              {/* Modal Phát hành phiếu lương */}
              {activeModal === "publish" && run && (
                <PayslipPublication
                  key={"publication:" + run._id + ":" + revision}
                  run={run}
                  onChanged={onModalChanged}
                />
              )}

              {/* Modal Xuất bảng lương */}
              {activeModal === "export" && run && (
                <PayrollExport key={"export:" + run._id + ":" + revision} run={run} />
              )}

              {/* Modal Lịch sử chi trả */}
              {activeModal === "history" && run && (
                <PaymentHistory
                  key={run._id + ":" + revision}
                  runId={run._id}
                  runStatus={run.status}
                  employees={lines}
                  onChanged={onModalChanged}
                />
              )}

              {/* Modal Cấu hình nâng cao & Nhật ký */}
              {activeModal === "advanced" && (
                <View style={{ gap: 16 }}>
                  <PayrollPeriodInputs
                    key={"inputs:" + period + ":" + revision}
                    period={period}
                    employees={lines}
                    onChanged={onModalChanged}
                  />
                  <PayrollVariables
                    key={"variables:" + revision}
                    onChanged={onModalChanged}
                  />
                  <AdjustmentHistory
                    key={period + ":" + revision}
                    period={period}
                    onChanged={onModalChanged}
                  />
                  <PayrollAuditHistory
                    key={"audit:" + period + ":" + revision}
                    period={period}
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const payrollStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 12,
  },

  // Header hàng đầu
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
  refreshButton: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  refreshButtonText: {
    color: "#047857",
    fontWeight: "700",
    fontSize: 12,
  },

  // Segment Tab Bar
  tabSegmentContainer: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  tabSegmentButton: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  tabSegmentButtonActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabSegmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  tabSegmentTextActive: {
    color: "#059669",
    fontWeight: "700",
  },

  // Month Navigator
  monthNavigator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  navArrowText: {
    fontSize: 14,
    color: "#059669",
    fontWeight: "700",
  },
  navMonthLabelBtn: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  navMonthText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  navMonthSub: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "500",
  },

  // Hero Summary Card
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: 24,
    fontWeight: "900",
    color: "#059669",
    marginTop: 4,
  },
  heroStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroStatusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  heroStatusActive: {
    backgroundColor: "#fef3c7",
  },
  heroStatusActiveText: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: "700",
  },
  heroStatusClosed: {
    backgroundColor: "#ecfdf5",
  },
  heroStatusClosedText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "700",
  },
  heroMetaDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },
  heroFooterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroFooterItem: {
    flex: 1,
  },
  heroFooterLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
  },
  heroFooterValue: {
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "700",
    marginTop: 2,
  },
  heroFooterSep: {
    width: 1,
    height: 24,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 12,
  },

  // Lifecycle Section (3 Trạng thái - 4 Thao tác)
  lifecycleSection: {
    gap: 10,
  },
  stepperCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    gap: 12,
  },
  stepperHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepperTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  stepperStageBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  stepperStageBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  stepperTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  stepNode: {
    alignItems: "center",
    width: 68,
    gap: 4,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  stepCircleDone: {
    backgroundColor: "#059669",
    borderColor: "#047857",
  },
  stepCircleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  stepCircleTextActive: {
    color: "#059669",
  },
  stepCircleTextDone: {
    color: "#ffffff",
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
  },
  stepLabelActive: {
    color: "#0f172a",
    fontWeight: "700",
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#e2e8f0",
    marginBottom: 16,
  },
  stepLineActive: {
    backgroundColor: "#059669",
  },
  stepperDesc: {
    fontSize: 12,
    color: "#475569",
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 8,
    lineHeight: 16,
  },

  // 4 Thao tác cốt lõi
  fourActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  coreActionCard: {
    width: "48.7%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 4,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  coreActionCardHighlighted: {
    borderColor: "#059669",
    backgroundColor: "#f0fdf4",
  },
  coreActionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  coreActionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  coreActionIconBoxActive: {
    backgroundColor: "#dcfce7",
  },
  coreActionIconBoxClosed: {
    backgroundColor: "#e0e7ff",
  },
  coreActionIconBoxSuccess: {
    backgroundColor: "#fef3c7",
  },
  coreActionIcon: {
    fontSize: 14,
  },
  coreActionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  coreActionBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  badgeMuted: {
    backgroundColor: "#f1f5f9",
  },
  badgeMutedText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
  },
  badgeActive: {
    backgroundColor: "#dcfce7",
  },
  badgeActiveText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#15803d",
  },
  badgeSuccess: {
    backgroundColor: "#dbeafe",
  },
  badgeSuccessText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  coreActionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  coreActionSub: {
    fontSize: 11,
    color: "#64748b",
  },

  // Auxiliary bar
  auxSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  auxSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  auxScroll: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 2,
  },
  auxChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 5,
  },
  auxChipIcon: {
    fontSize: 11,
  },
  auxChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  modalGuideText: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 17,
    marginBottom: 4,
  },

  // Search input
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
  searchIcon: {
    fontSize: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 8,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchClearText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "700",
  },

  // List Title
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: 4,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },

  // Employee Card
  employeeCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  empHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#059669",
  },
  employeeName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  employeeMeta: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  empMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  employeeIdText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  empMetaDot: {
    fontSize: 10,
    color: "#cbd5e1",
  },
  empWorkDays: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284c7",
  },
  netBadgeContainer: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignItems: "flex-end",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  netBadgeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#047857",
  },
  netBadgeAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#059669",
    marginTop: 1,
  },

  // 4-cell Metrics Grid
  empMetricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  empMetricItem: {
    width: "48%",
  },
  empMetricLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  empMetricValue: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "700",
    marginTop: 2,
  },

  // Expand button
  expandDetailButton: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingVertical: 8,
  },
  expandDetailText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },

  // Warnings
  warningBox: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  warningText: {
    color: "#92400e",
    fontSize: 12,
    lineHeight: 16,
  },

  // User Profile Card (Tab 2)
  userProfileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  userProfileAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  userProfileAvatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
  },
  userProfileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  userProfileName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    flex: 1,
  },
  userProfileBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  userProfileBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  userProfileSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  personalFilterSection: {
    gap: 10,
  },
  filterSubLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginLeft: 2,
  },

  // Personal Period section
  personalPeriodSection: {
    gap: 6,
  },
  personalFilterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    paddingHorizontal: 2,
  },
  periodPillsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  periodPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  periodPillActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  periodPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  periodPillTextActive: {
    color: "#059669",
    fontWeight: "700",
  },

  // Errors & Loading & Empty
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 12,
  },
  errorBannerText: {
    color: "#b91c1c",
    fontSize: 13,
    lineHeight: 18,
  },
  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
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
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 19,
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

  // Modal Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingBottom: 24,
  },
  modalDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    flex: 1,
  },
  modalCloseButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    marginLeft: 8,
  },
  modalCloseText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "700",
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  modalBodyContent: {
    paddingBottom: 30,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  customPeriodInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
  },
  primaryModalButton: {
    backgroundColor: "#059669",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryModalButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 12,
  },
});