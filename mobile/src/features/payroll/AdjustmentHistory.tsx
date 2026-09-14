import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { ClipboardList, RefreshCw, Search, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdjustmentDecision } from "./AdjustmentDecision";
import { AdjustmentForm } from "./AdjustmentForm";
import { hasPermission } from "../../auth/access";
import type { PayrollAdjustment } from "../../../../src/types/payrollAdjustment";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Card, ErrorText, Loading, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { contractDate } from "../contracts/model";
import { canReadPayrollRuns } from "./runModel";
import { payslipMoney } from "./model";
import { adjustmentKinds, adjustmentStatuses, canDecideAdjustment, filterAdjustments } from "./adjustmentModel";
import { AdjustmentAction, adjustmentStyles as s } from "./adjustmentUi";

const statusTabs = [
  { value: "", label: "Tất cả" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "snapshotted", label: "Đã vào bảng lương" },
  { value: "rejected", label: "Từ chối" },
  { value: "draft", label: "Nháp" },
];

export function AdjustmentHistory({ period, onChanged, initialStatus = "" }: {
  period: string; onChanged: () => void; initialStatus?: string;
}) {
  const { user, selectedBranch } = useSession();
  const allowed = canReadPayrollRuns(user);
  const [items, setItems] = useState<PayrollAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [kind, setKind] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [decision, setDecision] = useState<{ item: PayrollAdjustment; approve: boolean } | null>(null);
  const [creating, setCreating] = useState(false);
  const lock = useRef(false);
  const close = () => {
    setDecision(null);
    setCreating(false);
    setRevision((value) => value + 1);
    onChanged();
  };
  const saved = (item: PayrollAdjustment) => {
    setItems((current) => [item, ...current.filter((row) => row._id !== item._id)]);
    setStatus(item.status);
    setSearch("");
    setKind("");
    setNotice(item.status === "approved" ? "Đã duyệt điều chỉnh. Khoản vừa xử lý nằm trong danh sách Đã duyệt."
      : item.status === "rejected" ? "Đã từ chối điều chỉnh. Danh sách Từ chối đã được cập nhật."
      : "Đã tạo điều chỉnh. Khoản mới nằm trong danh sách Chờ duyệt.");
    close();
  };
  useFocusEffect(useCallback(() => {
    let active = true;
    setError(null);
    if (!allowed) { setLoading(false); return; }
    setLoading(true);
    void payroll.getAdjustments(period)
      .then((value) => { if (active) setItems(value); })
      .catch((err) => { if (active) setError(messageOf(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, period, user?.uid, user?.companyCode, user?.branchId, selectedBranch?._id, revision]));
  if (!allowed) return null;
  const rows = filterAdjustments(items, search, status, kind);
  return (
    <View style={s.section}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Điều chỉnh lương</Text>
          <Text style={s.subtitle}>Kỳ {period} · {items.length} khoản điều chỉnh</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Tải lại điều chỉnh" disabled={loading}
          style={[s.iconButton, loading && { opacity: 0.5 }]} onPress={() => setRevision((value) => value + 1)}>
          <RefreshCw size={18} color="#475569" />
        </Pressable>
      </View>
      {hasPermission(user, "payroll-period:manage") && <AdjustmentAction title="+ Thêm điều chỉnh" onPress={() => setCreating(true)} />}
      <View style={s.tabs}>
        {statusTabs.map((tab) => (
          <Pressable key={tab.value} accessibilityRole="tab" accessibilityState={{ selected: status === tab.value }}
            onPress={() => { setStatus(tab.value); setNotice(null); }} style={[s.tab, status === tab.value && s.tabActive]}>
            <Text style={[s.tabCount, status === tab.value && s.activeText]}>{items.filter((item) => !tab.value || item.status === tab.value).length}</Text>
            <Text style={[s.tabText, status === tab.value && s.activeText]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
      {notice && <View accessibilityLiveRegion="polite" style={s.notice}><Text style={s.noticeText}>{notice}</Text></View>}
      <View style={s.search}>
        <Search size={18} color="#94a3b8" />
        <TextInput accessibilityLabel="Tìm nhân viên hoặc lý do" placeholder="Tìm nhân viên hoặc lý do" placeholderTextColor="#94a3b8"
          value={search} onChangeText={setSearch} style={s.searchInput} />
        {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" style={s.iconButton} onPress={() => setSearch("")}><X size={16} color="#64748b" /></Pressable>}
      </View>
      <ChoiceField label="Loại điều chỉnh" value={kind}
        choices={[{ value: "", label: "Tất cả loại điều chỉnh" }, ...Object.entries(adjustmentKinds).map(([value, label]) => ({ value, label }))]} onChange={setKind} />
      {(!!search || !!kind) && <AdjustmentAction title="Xóa bộ lọc tìm kiếm" tone="secondary" onPress={() => { setSearch(""); setKind(""); }} />}
      <View style={s.info}><Text style={s.subtitle}>Khoản đã duyệt sẽ chuyển sang “Đã vào bảng lương” khi được đưa vào bản tính. Kiểm tra bản tính để xác nhận thực nhận.</Text></View>
      {loading && <Loading />}
      <ErrorText message={error} />
      {!error && <>
        <Text style={s.subtitle}>{rows.length} khoản · {statusTabs.find((tab) => tab.value === status)?.label || "Tất cả"}</Text>
        {!loading && !rows.length && <View style={s.empty}>
          <ClipboardList size={32} color="#94a3b8" />
          <Text style={s.name}>Không có điều chỉnh phù hợp</Text>
          <Text style={[s.subtitle, { textAlign: "center" }]}>Chọn trạng thái khác hoặc xóa bộ lọc để xem thêm.</Text>
        </View>}
        {rows.map((item) => (
          <Card key={item._id}>
            <View style={s.header}>
              <View style={s.avatar}><Text style={s.avatarText}>{(item.employeeName || item.employeeId).slice(0, 1).toLocaleUpperCase("vi-VN")}</Text></View>
              <View style={{ flex: 1 }}><Text style={s.name}>{item.employeeName || item.employeeId}</Text><Text style={s.subtitle}>{adjustmentKinds[item.kind] || item.kind}</Text></View>
            </View>
            <View style={[s.badge, item.status === "pending" && { backgroundColor: "#fffbeb" }, item.status === "approved" && { backgroundColor: "#ecfdf5" }, item.status === "rejected" && { backgroundColor: "#fff1f2" }]}>
              <Text style={[s.badgeText, item.status === "pending" && { color: "#92400e" }, item.status === "approved" && { color: "#047857" }, item.status === "rejected" && { color: "#be123c" }]}>{adjustmentStatuses[item.status] || item.status}</Text>
            </View>
            <Text style={[s.amount, item.kind === "deduction" && { color: "#be123c" }]}>{item.kind === "deduction" ? "−" : "+"}{payslipMoney(item.amount)}</Text>
            <Text style={s.reason}>{item.reason}</Text>
            {item.createdAt && <Text style={s.subtitle}>Ngày tạo · {contractDate(item.createdAt)}</Text>}
            {item.snapshotAt && <Text style={s.subtitle}>Vào bản tính · {contractDate(item.snapshotAt)}</Text>}
            {canDecideAdjustment(user, item) && <View style={s.actions}>
              <AdjustmentAction title="Từ chối" tone="danger" disabled={loading} onPress={() => setDecision({ item, approve: false })} />
              <AdjustmentAction title="Duyệt điều chỉnh" disabled={loading} onPress={() => setDecision({ item, approve: true })} />
            </View>}
          </Card>
        ))}
      </>}
      <Modal visible={!!decision || creating} animationType="slide" onRequestClose={() => { if (!lock.current) close(); }}>
        <SafeAreaView style={styles.page}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            {creating && <AdjustmentForm period={period} onClose={close} onSaved={saved} setLocked={(value) => { lock.current = value; }} />}
            {decision && <AdjustmentDecision item={decision.item} approve={decision.approve} onClose={close} onSaved={saved} setLocked={(value) => { lock.current = value; }} />}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
