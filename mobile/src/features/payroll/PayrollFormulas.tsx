import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RefreshCw } from "lucide-react-native";
import { payroll } from "../../api/services";
import { messageOf, useSession } from "../../auth/SessionProvider";
import { Card, ErrorText, Field, Loading, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import {
  AdjustmentAction as Action,
  adjustmentStyles as s,
} from "./adjustmentUi";
import {
  canDeletePolicy,
  canManageFormulas,
  canReadFormulas,
  formulaDisplayStatuses,
  policyDisplayStatus,
  fundLabels,
  overlappingPolicies,
  parsePolicies,
  percentLabel,
  policyForDate,
  type PayrollPolicyVersion,
} from "./formulaModel";
import { PayrollFormulaEditor } from "./PayrollFormulaEditor";
import { payslipMoney } from "./model";
type Editor = {
  mode: "create" | "edit" | "clone";
  item?: PayrollPolicyVersion;
};
type Pending = {
  item: PayrollPolicyVersion;
  kind: "delete" | "activate" | "retire" | "replace";
};

function translateFormulaError(message: string): string {
  if (
    message.includes("Another active payroll policy already covers this period") ||
    message.toLowerCase().includes("covers this period") ||
    message.toLowerCase().includes("overlap")
  ) {
    return "Đã có chính sách lương khác đang áp dụng trong khoảng thời gian này. Vui lòng bấm 'Thay thế phiên bản đang áp dụng' để tiếp tục.";
  }
  if (
    message.includes("Cannot delete active policy") ||
    message.includes("Ngưng áp dụng phiên bản trước khi xóa")
  ) {
    return "Phiên bản đang được áp dụng. Vui lòng ngưng áp dụng trước khi xóa.";
  }
  if (message.includes("Policy is used in closed payroll run")) {
    return "Phiên bản này đã được dùng trong kỳ lương đã chốt, không thể xóa.";
  }
  return message;
}

export function PayrollFormulas({ onChanged }: { onChanged: () => void }) {
  const { user, selectedBranch } = useSession();
  const allowed = canReadFormulas(user),
    canManage = canManageFormulas(user);
  const [items, setItems] = useState<PayrollPolicyVersion[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0),
    [expanded, setExpanded] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null),
    [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState<string | null>(null);
  const lock = useRef(false),
    mounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      mounted.current = true;
      setLoading(true);
      setError(null);
      if (!allowed) {
        setLoading(false);
        return;
      }
      void payroll
        .getPolicies()
        .then((value) => {
          const parsed = parsePolicies(value, user!.companyCode!);
          if (active) setItems(parsed);
        })
        .catch((err) => {
          if (active) setError(messageOf(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
        mounted.current = false;
      };
    }, [allowed, user?.companyCode, user?.uid, selectedBranch?._id, revision]),
  );
  const reload = () => {
    setLoading(true);
    setRevision((value) => value + 1);
    onChanged();
  };
  const closeEditor = () => {
    if (!lock.current) {
      setEditor(null);
      reload();
    }
  };
  const saved = (item: PayrollPolicyVersion) => {
    setEditor(null);
    setItems((current) => [
      item,
      ...current.filter((row) => row._id !== item._id),
    ]);
    setSearch("");
    setStatus("");
    setExpanded(item._id);
    setNotice("Đã lưu phiên bản “" + item.name + "”.");
    reload();
  };
  const perform = async () => {
    if (!pending || lock.current || !canManage || actionError) return;
    lock.current = true;
    setBusy(true);
    try {
      const { item, kind } = pending;
      if (kind === "delete") {
        if (!canDeletePolicy(item))
          throw Error("Ngưng áp dụng phiên bản trước khi xóa.");
        const result = await payroll.deletePolicy(item._id);
        if (result?.policyId !== item._id)
          throw Error(
            "Chưa xác nhận được kết quả xóa. Tải lại danh sách để kiểm tra.",
          );
        if (mounted.current)
          setItems((current) => current.filter((row) => row._id !== item._id));
      } else {
        const result =
          kind === "retire"
            ? await payroll.retirePolicy(item._id)
            : await payroll.activatePolicy(
                item._id,
                kind === "replace" ? { replaceOverlaps: true } : {},
              );
        const updated = parsePolicies([result], user!.companyCode!)[0];
        if (
          updated._id !== item._id ||
          updated.status !== (kind === "retire" ? "retired" : "active")
        )
          throw Error(
            "Trạng thái trả về không khớp. Tải lại danh sách để kiểm tra.",
          );
        if (mounted.current) {
          setStatus("");
          setItems((current) =>
            current.map((row) => (row._id === updated._id ? updated : row)),
          );
        }
      }
      if (mounted.current) {
        setPending(null);
        setNotice(
          kind === "delete"
            ? "Đã xóa phiên bản “" + item.name + "”."
            : "Đã cập nhật trạng thái phiên bản. Tính lại kỳ nháp để cập nhật bảng lương theo cấu hình mới.",
        );
        reload();
      }
    } catch (err) {
      if (mounted.current) {
        const rawMsg = messageOf(err);
        const isOverlap =
          (err as { code?: string }).code === "PAYROLL_POLICY_OVERLAP" ||
          rawMsg.includes("Another active payroll policy already covers this period") ||
          rawMsg.toLowerCase().includes("covers this period") ||
          rawMsg.toLowerCase().includes("overlap");

        if (isOverlap && pending.kind === "activate") {
          setPending({ ...pending, kind: "replace" });
          setActionError(null);
        } else {
          setActionError(translateFormulaError(rawMsg));
        }
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  if (!allowed)
    return (
      <ErrorText message="Cần quyền đọc chính sách lương để xem phiên bản công thức." />
    );
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const displayStatus = (item: PayrollPolicyVersion) => policyDisplayStatus(item, items, today);
  const rows = items.filter(
    (item) =>
      (!status || displayStatus(item) === status) &&
      (item.code + " " + item.name)
        .toLocaleLowerCase("vi-VN")
        .includes(search.trim().toLocaleLowerCase("vi-VN")),
  );
  const requestAction = (item: PayrollPolicyVersion, kind: Pending["kind"]) => {
    setActionError(null);
    if (kind === "activate" && overlappingPolicies(items, item).length > 0) {
      setPending({ item, kind: "replace" });
      return;
    }
    setPending({ item, kind });
  };
  return (
    <View style={s.section}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Phiên bản công thức lương</Text>
          <Text style={s.subtitle}>
            Thuế TNCN · BHXH · BHYT · BHTN · Tăng ca
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tải lại phiên bản công thức"
          disabled={loading || !!pending}
          style={s.iconButton}
          onPress={reload}
        >
          <RefreshCw size={18} color="#475569" />
        </Pressable>
      </View>
      {canManage && (
        <Action
          title="+ Tạo phiên bản công thức"
          disabled={loading || !!pending || !!error}
          onPress={() =>
            setEditor({
              mode: "create",
              item:
                policyForDate(items, today) ||
                items[0],
            })
          }
        />
      )}
      {notice && (
        <View style={s.notice}>
          <Text style={s.noticeText}>{notice}</Text>
        </View>
      )}
      <Field
        label="Tìm phiên bản"
        placeholder="Tên hoặc mã phiên bản"
        value={search}
        onChangeText={setSearch}
      />
      <ChoiceField
        label="Trạng thái"
        value={status}
        choices={[
          { value: "", label: "Tất cả phiên bản" },
          ...Object.entries(formulaDisplayStatuses).map(([value, label]) => ({
            value,
            label,
          })),
        ]}
        onChange={setStatus}
      />
      {loading && <Loading />}
      <ErrorText message={error} />
      {!loading && !error && !rows.length && (
        <Card>
          <Text style={s.name}>Chưa có phiên bản phù hợp</Text>
          <Text style={s.subtitle}>Thử đổi bộ lọc hoặc tạo phiên bản mới.</Text>
        </Card>
      )}
      {!loading && !error &&
        rows.map((item) => (
          <Card key={item._id}>
            <Text style={s.name}>{item.name}</Text>
            <Text style={s.subtitle}>
              {item.code} · Phiên bản {item.version}
            </Text>
            <View
              style={[
                s.badge,
                displayStatus(item) === "active" && { backgroundColor: "#ecfdf5" },
              ]}
            >
              <Text style={s.badgeText}>{formulaDisplayStatuses[displayStatus(item)]}</Text>
            </View>
            <Text style={s.subtitle}>
              Hiệu lực: {item.effectiveFrom.slice(0, 10)} →{" "}
              {item.effectiveTo?.slice(0, 10) || "Không giới hạn"}
            </Text>
            <View style={s.info}>
              <Text style={styles.muted}>
                Tỷ lệ đóng · Người lao động / Doanh nghiệp
              </Text>
              {item.funds.map((fund) => (
                <Text key={fund.code} style={styles.text}>
                  {fundLabels[fund.code]}: {percentLabel(fund.employeeRate)} /{" "}
                  {percentLabel(fund.employerRate)}
                </Text>
              ))}
              <Text style={styles.text}>
                Thuế TNCN: {item.taxBrackets.length} bậc (
                {item.taxBrackets
                  .map((bracket) => percentLabel(bracket.rate))
                  .join(" · ")}
                )
              </Text>
            </View>
            <Action
              title={
                expanded === item._id
                  ? "Thu gọn cấu hình"
                  : "Xem cấu hình thuế & bảo hiểm"
              }
              tone="secondary"
              onPress={() =>
                setExpanded(expanded === item._id ? null : item._id)
              }
            />
            {expanded === item._id && (
              <View style={{ gap: 6 }}>
                <Text style={styles.text}>
                  Lương cơ sở: {payslipMoney(item.baseSalary)} · Lương tối thiểu
                  vùng: {payslipMoney(item.regionalMinimumWage)}
                </Text>
                <Text style={styles.text}>
                  Hệ số trần BHXH/BHYT: {item.socialCapMultiplier} · BHTN:{" "}
                  {item.unemploymentCapMultiplier}
                </Text>
                <Text style={styles.text}>
                  Giảm trừ bản thân: {payslipMoney(item.personalDeduction)}
                </Text>
                <Text style={styles.text}>
                  Mỗi người phụ thuộc: {payslipMoney(item.dependentDeduction)}
                </Text>
                {item.taxBrackets.map((bracket, index) => (
                  <Text key={index} style={styles.text}>
                    Bậc {index + 1}:{" "}
                    {bracket.upTo === undefined
                      ? "Phần còn lại"
                      : "Đến " + payslipMoney(bracket.upTo)}{" "}
                    · {percentLabel(bracket.rate)}
                  </Text>
                ))}
                <Text style={styles.text}>
                  Hợp đồng ngắn hạn:{" "}
                  {percentLabel(item.shortTermWithholdingRate)} · Ngưỡng{" "}
                  {payslipMoney(item.shortTermWithholdingThreshold)}
                </Text>
                <Text style={styles.text}>
                  Không cư trú: {percentLabel(item.nonResidentRate)}
                </Text>
                <Text style={styles.text}>
                  Tăng ca: ngày thường ×{item.overtime.weekday}, ngày nghỉ ×
                  {item.overtime.restDay}, ngày lễ ×{item.overtime.holiday}
                </Text>
                <Text style={styles.text}>
                  Phụ trội ban đêm: {percentLabel(item.overtime.nightPremium)} ·
                  Tăng ca ban đêm:{" "}
                  {percentLabel(item.overtime.nightOvertimeBonus)}
                </Text>
                <Text style={styles.text}>
                  Làm tròn: {payslipMoney(item.roundingUnit)}
                </Text>
                {!!item.sourceReference && (
                  <Text style={styles.muted}>
                    Căn cứ: {item.sourceReference}
                  </Text>
                )}
              </View>
            )}
            {canManage && (
              <View style={[s.actions, { flexWrap: "wrap" }]}>
                {item.status !== "retired" && (
                  <Action
                    title="Sửa"
                    tone="secondary"
                    disabled={loading || !!pending}
                    onPress={() => setEditor({ mode: "edit", item })}
                  />
                )}
                <Action
                  title="Nhân bản"
                  tone="secondary"
                  disabled={loading || !!pending}
                  onPress={() => setEditor({ mode: "clone", item })}
                />
                <Action
                  title={item.status === "active" ? "Ngưng áp dụng" : "Áp dụng"}
                  disabled={loading || !!pending}
                  onPress={() =>
                    requestAction(
                      item,
                      item.status === "active" ? "retire" : "activate",
                    )
                  }
                />
                {canDeletePolicy(item) && (
                  <Action
                    title="Xóa"
                    tone="danger"
                    disabled={loading || !!pending}
                    onPress={() => requestAction(item, "delete")}
                  />
                )}
              </View>
            )}
          </Card>
        ))}
      <Modal
        visible={!!editor}
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <SafeAreaView style={styles.page}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            {editor && (
              <PayrollFormulaEditor
                initial={editor.item}
                mode={editor.mode}
                existing={items}
                onClose={closeEditor}
                onSaved={saved}
                setLocked={(value) => {
                  lock.current = value;
                }}
              />
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!pending}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) {
            setPending(null);
            reload();
          }
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 20,
            backgroundColor: "rgba(15,23,42,0.5)",
          }}
        >
          <ScrollView
            style={{ maxHeight: "85%" }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          >
            <Card>
              <Text style={styles.heading}>
                {pending?.kind === "delete"
                  ? "Xóa phiên bản công thức?"
                  : pending?.kind === "replace"
                    ? "Thay thế phiên bản đang áp dụng?"
                    : pending?.kind === "activate"
                      ? "Áp dụng phiên bản công thức?"
                      : "Ngưng áp dụng phiên bản?"}
              </Text>
              <Text style={styles.text}>
                {pending?.item.name} ({pending?.item.code})
              </Text>
              <Text style={styles.muted}>
                {pending?.kind === "delete"
                  ? "Chỉ xóa được bản nháp hoặc đã ngưng áp dụng chưa được dùng trong kỳ lương đã chốt. Hệ thống sẽ kiểm tra trước khi xóa."
                  : pending?.kind === "replace"
                    ? "Các phiên bản trùng thời gian dưới đây sẽ được kết thúc hiệu lực hoặc ngưng áp dụng. Bảng lương đã tính được giữ nguyên."
                    : pending?.kind === "activate"
                      ? "Phiên bản sẽ áp dụng từ ngày bắt đầu và không giới hạn ngày kết thúc. Cần tính lại kỳ nháp để cập nhật bảng lương."
                      : "Phiên bản này sẽ ngưng áp dụng; hệ thống có thể sử dụng lại phiên bản trước đó cho thời gian tương ứng."}
              </Text>
              {pending?.kind === "replace" && (
                <View style={{ gap: 4, marginVertical: 6 }}>
                  <Text style={[styles.text, { fontWeight: "700" }]}>
                    Các phiên bản trùng lặp sẽ được thay thế:
                  </Text>
                  {overlappingPolicies(items, pending.item).length > 0 ? (
                    overlappingPolicies(items, pending.item).map((item) => (
                      <Text key={item._id} style={[styles.text, { color: "#d97706" }]}>
                        • {item.name} ({item.code})
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.muted}>
                      • Phiên bản công thức đang áp dụng trong cùng khoảng thời gian
                    </Text>
                  )}
                </View>
              )}
              <ErrorText message={actionError} />
              {pending?.kind === "activate" && !!actionError && (
                <Action
                  title="Thay thế phiên bản đang áp dụng"
                  tone="primary"
                  disabled={busy}
                  onPress={() => {
                    setActionError(null);
                    setPending({ ...pending, kind: "replace" });
                  }}
                />
              )}
              <Action
                title={
                  busy
                    ? "Đang xử lý…"
                    : pending?.kind === "replace"
                      ? "Xác nhận thay thế"
                      : "Xác nhận"
                }
                tone={pending?.kind === "delete" ? "danger" : "primary"}
                disabled={busy || (!!actionError && pending?.kind !== "replace")}
                onPress={() => void perform()}
              />
              <Action
                title={actionError ? "Đóng và tải lại" : "Hủy"}
                tone="secondary"
                disabled={busy}
                onPress={() => {
                  setPending(null);
                  if (actionError) reload();
                }}
              />
            </Card>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
