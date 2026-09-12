import { useAppAlert } from "../../src/components/AppAlert";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import type { UserProfile } from "../../../src/types/common";
import type { BranchRecord } from "../../../src/services/branchService";
import type { DepartmentRecord } from "../../../src/services/departmentService";
import { UserCreateModal } from "../../src/components/users";
import { DatePickerField } from "../../src/components/common/DatePickerField";
import { DropdownSelectField } from "../../src/components/common/DropdownSelectField";
import { userManagementApi, type CreateUserInput } from "../../src/api/userManagementApi";
import { branches as branchService, departments as departmentService, roster } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { hasPermission } from "../../src/auth/access";

/* ==========================================================================
   1. FUNCTIONAL CATEGORIES (Theo chuẩn LuxCare Web)
   ========================================================================== */
interface FunctionalCategory {
  key: string;
  label: string;
  badge: string;
  color: string;
  bg: string;
  border: string;
  text: string;
}

const FUNCTIONAL_CATEGORIES: FunctionalCategory[] = [
  {
    key: "governance",
    label: "Quản trị",
    badge: "GOVERNANCE",
    color: "#0f172a",
    bg: "#f1f5f9",
    border: "#0f172a",
    text: "#0f172a",
  },
  {
    key: "finance",
    label: "Tài chính - Pháp lý",
    badge: "FINANCE",
    color: "#10b981",
    bg: "#ecfdf5",
    border: "#10b981",
    text: "#047857",
  },
  {
    key: "tech",
    label: "Hệ thống & Công nghệ",
    badge: "TECH",
    color: "#4f46e5",
    bg: "#eef2ff",
    border: "#4f46e5",
    text: "#4338ca",
  },
  {
    key: "operations",
    label: "Vận hành - Sản xuất",
    badge: "OPERATIONS",
    color: "#06b6d4",
    bg: "#ecfeff",
    border: "#06b6d4",
    text: "#0e7490",
  },
  {
    key: "sales",
    label: "Kinh doanh & Tiếp thị",
    badge: "SALES",
    color: "#f59e0b",
    bg: "#fffbeb",
    border: "#f59e0b",
    text: "#b45309",
  },
  {
    key: "hr",
    label: "Hành chính & Nhân sự",
    badge: "HR",
    color: "#f43f5e",
    bg: "#fff1f2",
    border: "#f43f5e",
    text: "#be123c",
  },
];

function getCategoryByDivision(divisionOrDept?: string): FunctionalCategory {
  const d = (divisionOrDept || "").toLowerCase();
  if (
    d.includes("quản trị") ||
    d.includes("ban giám đốc") ||
    d.includes("hội đồng") ||
    d.includes("governance") ||
    d.includes("board") ||
    d.includes("ceo") ||
    d.includes("tổng giám đốc")
  ) {
    return FUNCTIONAL_CATEGORIES[0];
  }
  if (
    d.includes("tài chính") ||
    d.includes("kế toán") ||
    d.includes("pháp lý") ||
    d.includes("finance") ||
    d.includes("legal") ||
    d.includes("accounting")
  ) {
    return FUNCTIONAL_CATEGORIES[1];
  }
  if (
    d.includes("kỹ thuật") ||
    d.includes("công nghệ") ||
    d.includes("hệ thống") ||
    d.includes("tech") ||
    d.includes("it") ||
    d.includes("phần mềm") ||
    d.includes("software")
  ) {
    return FUNCTIONAL_CATEGORIES[2];
  }
  if (
    d.includes("vận hành") ||
    d.includes("sản xuất") ||
    d.includes("kho") ||
    d.includes("operations") ||
    d.includes("logistics")
  ) {
    return FUNCTIONAL_CATEGORIES[3];
  }
  if (
    d.includes("kinh doanh") ||
    d.includes("tiếp thị") ||
    d.includes("sales") ||
    d.includes("marketing") ||
    d.includes("csm") ||
    d.includes("cso") ||
    d.includes("thương mại")
  ) {
    return FUNCTIONAL_CATEGORIES[4];
  }
  if (
    d.includes("nhân sự") ||
    d.includes("hành chính") ||
    d.includes("hr") ||
    d.includes("admin") ||
    d.includes("tuyển dụng") ||
    d.includes("đào tạo")
  ) {
    return FUNCTIONAL_CATEGORIES[5];
  }
  return FUNCTIONAL_CATEGORIES[5];
}

function getRoleIcon(roleTitle?: string): string {
  const r = (roleTitle || "").toLowerCase();
  if (
    r.includes("ceo") ||
    r.includes("chủ tịch") ||
    r.includes("coo") ||
    r.includes("cfo") ||
    r.includes("cmo") ||
    r.includes("cso") ||
    r.includes("director") ||
    r.includes("giám đốc") ||
    r.includes("tổng")
  ) {
    return "👑";
  }
  if (
    r.includes("trưởng phòng") ||
    r.includes("manager") ||
    r.includes("leader") ||
    r.includes("trưởng nhóm") ||
    r.includes("phó")
  ) {
    return "💼";
  }
  return "👤";
}

type RoleBadge = { label: string; bg: string; text: string; border: string; rank: number };

function roleBadge(role?: string): RoleBadge {
  switch (role) {
    case "superadmin":   return { label: "Tổng GĐ",      bg: "#f5f3ff", text: "#7c3aed", border: "#ddd6fe", rank: 0 };
    case "admin":        return { label: "Ban GĐ",        bg: "#fffbeb", text: "#b45309", border: "#fde68a", rank: 1 };
    case "branch_owner": return { label: "GĐ Chi Nhánh", bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", rank: 2 };
    case "manager":      return { label: "Quản Lý",       bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", rank: 3 };
    default:             return { label: "Nhân Viên",     bg: "#f1f5f9", text: "#475569", border: "#e2e8f0", rank: 9 };
  }
}

function initials(name: string): string {
  return name.split(/\s+/).slice(-2).map((w) => w[0] ?? "").join("").toUpperCase();
}

function isHttpUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

/* ==========================================================================
   2. TREE DATA STRUCTURE
   ========================================================================== */
interface TreeNode {
  emp: UserProfile;
  children: TreeNode[];
  depth: number;
}

function buildTree(emps: UserProfile[]): TreeNode[] {
  const byUid = new Map(emps.map((e) => [e.uid, e]));
  const uidSet = new Set(emps.map((e) => e.uid));
  const roots = emps
    .filter((e) => !e.parentId || !uidSet.has(e.parentId))
    .sort((a, b) => {
      const la = a.level ?? 99;
      const lb = b.level ?? 99;
      return la !== lb ? la - lb : (a.displayName ?? "").localeCompare(b.displayName ?? "");
    });

  function build(uid: string, depth: number): TreeNode {
    const emp = byUid.get(uid)!;
    const children = emps
      .filter((e) => e.parentId === uid && e.uid !== uid)
      .sort((a, b) => {
        const la = a.level ?? 99;
        const lb = b.level ?? 99;
        return la !== lb ? la - lb : (a.displayName ?? "").localeCompare(b.displayName ?? "");
      })
      .map((c) => build(c.uid, depth + 1));
    return { emp, children, depth };
  }

  return roots.map((r) => build(r.uid, 0));
}

function isDescendant(ancestorUid: string, candidateUid: string, emps: UserProfile[]): boolean {
  if (ancestorUid === candidateUid) return true;
  let curr = emps.find((e) => e.uid === candidateUid);
  const visited = new Set<string>();
  while (curr?.parentId) {
    if (curr.parentId === ancestorUid) return true;
    if (visited.has(curr.parentId)) break;
    visited.add(curr.parentId);
    curr = emps.find((e) => e.uid === curr?.parentId);
  }
  return false;
}

function flattenSearchMatches(nodes: TreeNode[], sq: string): Set<string> {
  const matched = new Set<string>();
  function walk(n: TreeNode) {
    const e = n.emp;
    if (
      e.displayName?.toLowerCase().includes(sq) ||
      e.jobTitle?.toLowerCase().includes(sq) ||
      e.department?.toLowerCase().includes(sq) ||
      e.email?.toLowerCase().includes(sq)
    ) {
      matched.add(e.uid);
    }
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return matched;
}

/* ==========================================================================
   3. ATOMS & MODALS
   ========================================================================== */
function Avatar({
  url,
  name,
  size,
  bg,
  col,
}: {
  url?: string;
  name: string;
  size: number;
  bg: string;
  col: string;
}) {
  if (isHttpUrl(url)) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: col, fontWeight: "800", fontSize: size * 0.38 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

function IRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.iRow}>
      <Text style={s.iIco}>{icon}</Text>
      <Text style={s.iLbl}>{label}</Text>
      <Text style={s.iVal} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function normalizeDateInput(val?: any): string {
  if (!val) return "";
  const str = String(val).trim();
  if (!str) return "";

  if (str.includes("T")) {
    const part = str.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return str.slice(0, 10);
}

function formatDate(dateStr?: any): string {
  if (!dateStr) return "Chưa cập nhật";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Chưa cập nhật";
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "Chưa cập nhật";
  }
}

function normalizePhone(phone?: string | null): string {
  if (!phone) return "";
  const str = String(phone).trim();
  const lower = str.toLowerCase();
  if (
    !str ||
    lower === "chưa cập nhật" ||
    lower === "chua cap nhat" ||
    lower === "chưa có" ||
    lower === "chua co" ||
    lower === "không có" ||
    lower === "khong co" ||
    lower === "null" ||
    lower === "undefined" ||
    lower === "n/a" ||
    lower === "none" ||
    lower === "—" ||
    lower === "-"
  ) {
    return "";
  }
  return str;
}

function OrgEditModal({
  visible,
  emp,
  empList,
  departments,
  onClose,
  onSave,
}: {
  visible: boolean;
  emp: UserProfile | null;
  empList: UserProfile[];
  departments: DepartmentRecord[];
  onClose: () => void;
  onSave: (uid: string, data: Partial<UserProfile>) => Promise<void>;
}) {
  const { showAlert, alertView } = useAppAlert();
  if (!emp) return null;

  const [displayName, setDisplayName] = useState(emp.displayName || "");
  const [jobTitle, setJobTitle] = useState(emp.jobTitle || "");
  const [department, setDepartment] = useState(emp.department || "");
  const [parentId, setParentId] = useState(emp.parentId || "");
  const [phone, setPhone] = useState(normalizePhone(emp.phone));
  const [birthDate, setBirthDate] = useState(normalizeDateInput(emp.birthDate));
  const [monthlySalary, setMonthlySalary] = useState(emp.monthlySalary ? String(emp.monthlySalary) : "");
  const [jobDescriptionLink, setJobDescriptionLink] = useState(emp.jobDescriptionLink || "");
  const [isLeader, setIsLeader] = useState(!!emp.isLeader);

  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [managerSearch, setManagerSearch] = useState("");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (emp) {
      setDisplayName(emp.displayName || "");
      setJobTitle(emp.jobTitle || "");
      setDepartment(emp.department || "");
      setParentId(emp.parentId || "");
      setPhone(normalizePhone(emp.phone));
      setBirthDate(normalizeDateInput(emp.birthDate));
      setMonthlySalary(emp.monthlySalary ? String(emp.monthlySalary) : "");
      setJobDescriptionLink(emp.jobDescriptionLink || "");
      setIsLeader(!!emp.isLeader);
    }
  }, [emp]);

  const candidateManagers = useMemo(() => {
    return empList.filter((e) => e.uid !== emp.uid && !isDescendant(emp.uid, e.uid, empList));
  }, [empList, emp]);

  const filteredManagers = useMemo(() => {
    if (!managerSearch.trim()) return candidateManagers;
    const q = managerSearch.trim().toLowerCase();
    return candidateManagers.filter(
      (m) =>
        m.displayName?.toLowerCase().includes(q) ||
        m.jobTitle?.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q)
    );
  }, [candidateManagers, managerSearch]);

  const selectedManager = empList.find((m) => m.uid === parentId);
  const selectedManagerName = selectedManager
    ? `${selectedManager.displayName}${selectedManager.jobTitle ? ` (${selectedManager.jobTitle})` : ""}`
    : "-- Cấp cao nhất / Không có quản lý --";

  const salaryNum = monthlySalary.replace(/[^0-9]/g, "");
  const salaryPreview = salaryNum ? Number(salaryNum).toLocaleString("vi-VN") + " đ" : "";

  const handleSave = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      showAlert("Thiếu thông tin", "Vui lòng nhập họ và tên (tối thiểu 2 ký tự).", undefined, "error");
      return;
    }

    if (parentId && isDescendant(emp.uid, parentId, empList)) {
      showAlert("Không hợp lệ", "Quản lý trực tiếp không thể là cấp dưới của nhân sự này.", undefined, "error");
      return;
    }

    const cleanPhone = normalizePhone(phone).replace(/[\s.\-()]/g, "");
    if (cleanPhone) {
      const phoneRegex = /^(\+84|84|0)[0-9]{8,11}$/;
      if (!phoneRegex.test(cleanPhone)) {
        showAlert(
          "Số điện thoại không hợp lệ",
          "Số điện thoại không đúng định dạng (Ví dụ: 0912345678 hoặc +84912345678).",
          undefined,
          "error",
        );
        return;
      }
    }

    setLoading(true);
    try {
      await onSave(emp.uid, {
        displayName: trimmedName,
        jobTitle: jobTitle.trim() || undefined,
        department: department || undefined,
        division: jobTitle.trim() || undefined,
        parentId: parentId || undefined,
        phone: cleanPhone || undefined,
        birthDate: birthDate.trim() ? normalizeDateInput(birthDate) : undefined,
        monthlySalary: salaryNum ? parseInt(salaryNum, 10) : undefined,
        jobDescriptionLink: jobDescriptionLink.trim() || undefined,
        isLeader,
      });
      onClose();
    } catch (e: any) {
      showAlert("Lỗi", e?.message || "Không thể lưu thông tin.", undefined, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={s.editModalOverlay} edges={["top", "bottom"]}>
        <View style={s.editContainer}>
          {/* Header */}
          <View style={s.editHeader}>
            <View>
              <Text style={s.editHeaderTitle}>Chỉnh sửa nhân sự</Text>
              <Text style={s.editHeaderSub}>{emp.displayName}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={s.editCloseBtn} disabled={loading}>
              <Text style={{ fontSize: 16, color: "#64748b", fontWeight: "700" }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={s.editScroll} contentContainerStyle={s.editScrollContent} keyboardShouldPersistTaps="handled">
            {/* Họ và tên */}
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Họ và tên <Text style={{ color: "#ef4444" }}>*</Text></Text>
              <TextInput style={s.formInput} value={displayName} onChangeText={setDisplayName} placeholder="VD: Nguyễn Văn A" placeholderTextColor="#94a3b8" />
            </View>

            {/* Chức danh */}
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Chức danh / Vị trí chuyên môn</Text>
              <TextInput style={s.formInput} value={jobTitle} onChangeText={setJobTitle} placeholder="VD: Trưởng khoa Nội" placeholderTextColor="#94a3b8" />
            </View>

            {/* Phòng ban */}
            <DropdownSelectField
              label="Khoa / Phòng ban"
              value={department || "Chưa chọn phòng ban"}
              placeholder="Chọn khoa / phòng ban..."
              icon="layers-outline"
              iconColor="#7c3aed"
              iconBgColor="#f5f3ff"
              onPress={() => setShowDeptPicker(true)}
            />

            {/* Quản lý trực tiếp */}
            <DropdownSelectField
              label="Quản lý trực tiếp (Cấp trên)"
              value={selectedManagerName}
              placeholder="Chọn quản lý trực tiếp..."
              icon="people-outline"
              iconColor="#0284c7"
              iconBgColor="#e0f2fe"
              onPress={() => setShowManagerPicker(true)}
            />

            {/* Trưởng nhóm Leader */}
            <View style={s.formLeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.formLeaderLabel}>👑 Chỉ định Trưởng nhóm / Leader</Text>
                <Text style={s.formLeaderSub}>Hiển thị huy hiệu Leader nổi bật trên sơ đồ tổ chức</Text>
              </View>
              <Pressable
                style={[s.leaderToggle, isLeader && s.leaderToggleActive]}
                onPress={() => setIsLeader(!isLeader)}
              >
                <Text style={[s.leaderToggleText, isLeader && s.leaderToggleTextActive]}>
                  {isLeader ? "BẬT" : "TẮT"}
                </Text>
              </Pressable>
            </View>

            {/* Số điện thoại */}
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Số điện thoại</Text>
              <TextInput style={s.formInput} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="VD: 0912345678" placeholderTextColor="#94a3b8" />
            </View>

            {/* Ngày sinh */}
            <DatePickerField
              label="Ngày sinh"
              value={birthDate}
              onChange={setBirthDate}
              title="Chọn ngày sinh"
              placeholder="Chọn ngày sinh..."
              allowClear
            />

            {/* Mức lương tháng */}
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Mức lương cơ bản hàng tháng (VNĐ)</Text>
              <TextInput style={s.formInput} value={monthlySalary} onChangeText={setMonthlySalary} keyboardType="numeric" placeholder="VD: 15000000" placeholderTextColor="#94a3b8" />
              {salaryPreview ? <Text style={s.salaryPreviewText}>= {salaryPreview} / tháng</Text> : null}
            </View>

            {/* Link JD */}
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Đường dẫn mô tả công việc (JD Link)</Text>
              <TextInput style={s.formInput} value={jobDescriptionLink} onChangeText={setJobDescriptionLink} autoCapitalize="none" keyboardType="url" placeholder="https://drive.google.com/..." placeholderTextColor="#94a3b8" />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={s.editFooter}>
            <Pressable style={s.editCancelBtn} onPress={onClose} disabled={loading}>
              <Text style={s.editCancelBtnTxt}>Hủy</Text>
            </Pressable>
            <Pressable style={[s.editSaveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={s.editSaveBtnTxt}>Lưu thay đổi</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Dept picker modal */}
        <Modal visible={showDeptPicker} transparent animationType="fade" onRequestClose={() => setShowDeptPicker(false)}>
          <Pressable style={s.pickerBackdrop} onPress={() => setShowDeptPicker(false)}>
            <Pressable style={s.pickerCard} onPress={() => {}}>
              <Text style={s.pickerTitle}>Chọn phòng ban</Text>
              <ScrollView style={{ maxHeight: 280 }}>
                {departments.map((d, i) => (
                  <Pressable
                    key={d._id || `${d.name}-${i}`}
                    style={[s.pickerItem, department === d.name && s.pickerItemActive]}
                    onPress={() => {
                      setDepartment(d.name);
                      setShowDeptPicker(false);
                    }}
                  >
                    <Text style={[s.pickerItemText, department === d.name && s.pickerItemTextActive]}>
                      {d.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Manager picker modal */}
        <Modal visible={showManagerPicker} transparent animationType="fade" onRequestClose={() => setShowManagerPicker(false)}>
          <Pressable style={s.pickerBackdrop} onPress={() => setShowManagerPicker(false)}>
            <Pressable style={[s.pickerCard, { maxHeight: "80%" }]} onPress={() => {}}>
              <Text style={s.pickerTitle}>Chọn quản lý trực tiếp</Text>
              <View style={s.searchBox}>
                <Text style={{ marginRight: 6 }}>🔍</Text>
                <TextInput
                  style={s.searchInput}
                  placeholder="Tìm theo tên hoặc chức vụ..."
                  placeholderTextColor="#94a3b8"
                  value={managerSearch}
                  onChangeText={setManagerSearch}
                />
              </View>
              <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                <Pressable
                  style={[s.pickerItem, parentId === "" && s.pickerItemActive]}
                  onPress={() => {
                    setParentId("");
                    setShowManagerPicker(false);
                  }}
                >
                  <Text style={[s.pickerItemText, parentId === "" && s.pickerItemTextActive]}>
                    -- Cấp cao nhất / Không có quản lý --
                  </Text>
                </Pressable>
                {filteredManagers.map((m) => (
                  <Pressable
                    key={m.uid}
                    style={[s.pickerItem, parentId === m.uid && s.pickerItemActive]}
                    onPress={() => {
                      setParentId(m.uid);
                      setShowManagerPicker(false);
                    }}
                  >
                    <View>
                      <Text style={[s.pickerItemText, parentId === m.uid && s.pickerItemTextActive]}>
                        {m.displayName}
                      </Text>
                      {(m.jobTitle || m.department) ? (
                        <Text style={s.pickerSubText}>{[m.jobTitle, m.department].filter(Boolean).join(" • ")}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    {alertView}
    </Modal>
  );
}

function ProfileModal({
  emp,
  managerName,
  onClose,
  canManage,
  onEdit,
  onStartMove,
}: {
  emp: UserProfile | null;
  managerName?: string;
  onClose: () => void;
  canManage?: boolean;
  onEdit?: (emp: UserProfile) => void;
  onStartMove?: (emp: UserProfile) => void;
}) {
  if (!emp) return null;
  const b = roleBadge(emp.role);
  const cat = getCategoryByDivision(emp.department || emp.division);
  const roleIcon = getRoleIcon(emp.jobTitle || emp.role);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <View style={{ alignItems: "center", marginTop: 4, marginBottom: 18 }}>
            <Avatar
              url={emp.photoURL}
              name={emp.displayName ?? "?"}
              size={68}
              bg={cat.bg}
              col={cat.text}
            />
            <Text style={s.mName}>{emp.displayName}</Text>
            <Text style={s.mSub}>
              {roleIcon} {emp.jobTitle || b.label}
            </Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
              {emp.isLeader && (
                <View style={s.leaderBadgeLarge}>
                  <Text style={s.leaderTextLarge}>👑 Leader</Text>
                </View>
              )}
              <View style={[s.pill, { backgroundColor: cat.bg, borderColor: cat.color }]}>
                <Text style={[s.pillTxt, { color: cat.text }]}>{cat.badge}</Text>
              </View>
            </View>
          </View>

          <View style={s.infoBlock}>
            {!!emp.department && <IRow icon="🏢" label="Phòng ban" value={emp.department} />}
            <IRow
              icon="👤"
              label="Quản lý"
              value={managerName || "Cấp cao nhất / Không có"}
            />
            {!!emp.email && <IRow icon="✉️" label="Email" value={emp.email} />}
            {!!emp.phone && <IRow icon="📱" label="Điện thoại" value={emp.phone} />}
            {!!emp.birthDate && <IRow icon="🎂" label="Ngày sinh" value={formatDate(emp.birthDate)} />}
            {emp.monthlySalary != null && emp.monthlySalary > 0 && (
              <IRow icon="💰" label="Lương tháng" value={`${emp.monthlySalary.toLocaleString("vi-VN")} đ`} />
            )}
            {!!emp.jobDescriptionLink && (
              <View style={s.iRow}>
                <Text style={s.iIco}>📄</Text>
                <Text style={s.iLbl}>Mô tả công việc</Text>
                <Pressable onPress={() => Linking.openURL(emp.jobDescriptionLink!)}>
                  <Text style={[s.iVal, { color: "#0284c7", textDecorationLine: "underline" }]}>Xem link JD</Text>
                </Pressable>
              </View>
            )}
            {!!emp.division && <IRow icon="📁" label="Khối" value={emp.division} />}
          </View>

          <View style={s.actionRow}>
            <Pressable
              style={s.actionBtn}
              onPress={(event) => {
                      event.stopPropagation();
                onClose();
                router.push({
                  pathname: "/(tabs)/chat",
                  params: { peerId: emp.uid, name: emp.displayName || emp.email },
                } as any);
              }}
            >
              <Text style={s.actionIco}>💬</Text>
              <Text style={s.actionLbl}>Nhắn tin</Text>
            </Pressable>

            {canManage && (
              <>
                <Pressable
                  style={[s.actionBtn, { backgroundColor: "#f0fdf4", borderColor: "#86efac" }]}
                  onPress={() => {
                    onClose();
                    onEdit?.(emp);
                  }}
                >
                  <Text style={s.actionIco}>✏️</Text>
                  <Text style={[s.actionLbl, { color: "#059669" }]}>Sửa thông tin</Text>
                </Pressable>

                <Pressable
                  style={[s.actionBtn, { backgroundColor: "#eff6ff", borderColor: "#93c5fd" }]}
                  onPress={() => {
                    onClose();
                    onStartMove?.(emp);
                  }}
                >
                  <Text style={s.actionIco}>🔄</Text>
                  <Text style={[s.actionLbl, { color: "#1d4ed8" }]}>Đổi quản lý</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ==========================================================================
   4. TOP-DOWN SMART CARD & RECURSIVE BRANCH (Chuẩn Luxcare Web)
   ========================================================================== */
const CARD_WIDTH = 206;
const CARD_MARGIN = 12;

function TreeBranchView({
  node,
  onSelect,
  collapsed,
  toggleCollapse,
  highlighted,
  movingEmp,
  onStartMove,
  onTargetSelect,
  canManage,
  allEmps,
}: {
  node: TreeNode;
  onSelect: (e: UserProfile) => void;
  collapsed: Set<string>;
  toggleCollapse: (uid: string) => void;
  highlighted: Set<string> | null;
  movingEmp?: UserProfile | null;
  onStartMove?: (e: UserProfile) => void;
  onTargetSelect?: (target: UserProfile) => void;
  canManage?: boolean;
  allEmps: UserProfile[];
}) {
  const { showAlert, alertView } = useAppAlert();
  const { emp, children } = node;
  const isCollapsed = collapsed.has(emp.uid);
  const hasChildren = children.length > 0;
  const isHighlighted = highlighted ? highlighted.has(emp.uid) : false;
  const dimmed = highlighted !== null && !isHighlighted;
  const cat = getCategoryByDivision(emp.department || emp.division);
  const roleIcon = getRoleIcon(emp.jobTitle || emp.role);
  const directReports = children.length;

  const isMoving = movingEmp?.uid === emp.uid;
  const isDesc = movingEmp ? isDescendant(movingEmp.uid, emp.uid, allEmps) : false;
  const isValidTarget = Boolean(movingEmp && !isMoving && !isDesc);
  const isInvalidTarget = Boolean(movingEmp && !isMoving && isDesc);

  return (
    <View style={s.branchCol}>
      {/* Smart Employee Card */}
      <Pressable
        onPress={() => {
          if (movingEmp) {
            if (isValidTarget && onTargetSelect) {
              onTargetSelect(emp);
            } else if (isInvalidTarget) {
              showAlert("Không thể gán", "Không thể gán nhân sự này vào cấp dưới của chính họ.", undefined, "error");
            }
          } else {
            onSelect(emp);
          }
        }}
        onLongPress={() => {
          if (canManage && onStartMove && !movingEmp) {
            onStartMove(emp);
          }
        }}
        delayLongPress={300}
        style={[
          s.card,
          { borderTopColor: cat.color },
          isHighlighted && s.cardHighlighted,
          dimmed && s.cardDimmed,
          isMoving && s.cardMoving,
          isValidTarget && s.cardDropTarget,
          isInvalidTarget && s.cardDisabledTarget,
        ]}
      >
        {/* Moving / Target Banner Badge */}
        {isMoving && (
          <View style={s.cardMovingBadge}>
            <Text style={s.cardMovingBadgeText}>🔄 Đang chuyển vị trí</Text>
          </View>
        )}
        {isValidTarget && (
          <View style={s.cardDropBadge}>
            <Text style={s.cardDropBadgeText}>📥 Gán làm quản lý</Text>
          </View>
        )}

        {/* Top Header Row: Category Badge / Leader & Online Dot */}
        <View style={s.cardTopRow}>
          {emp.isLeader ? (
            <View style={s.leaderBadge}>
              <Text style={s.leaderText}>👑 LEADER</Text>
            </View>
          ) : (
            <View style={[s.catBadge, { backgroundColor: cat.bg }]}>
              <Text style={[s.catBadgeText, { color: cat.text }]}>{cat.badge}</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {canManage && !movingEmp && (
              <Text style={{ fontSize: 10, color: "#94a3b8" }}>⋮⋮</Text>
            )}
            <View
              style={[
                s.onlineDot,
                { backgroundColor: emp.status === "online" ? "#10b981" : "#cbd5e1" },
              ]}
            />
          </View>
        </View>

        {/* Department Title (Main highlight) */}
        <View style={s.deptContainer}>
          <Text style={s.deptName} numberOfLines={2}>
            {emp.department || "Ban Giám đốc"}
          </Text>
        </View>

        {/* Employee Info Row */}
        <View style={s.cardBottomRow}>
          <Avatar
            url={emp.photoURL}
            name={emp.displayName ?? "?"}
            size={30}
            bg={cat.bg}
            col={cat.text}
          />
          <View style={s.cardMeta}>
            <Text style={s.roleText} numberOfLines={1}>
              {roleIcon} {emp.jobTitle || roleBadge(emp.role).label}
            </Text>
            <Text style={s.nameText} numberOfLines={1}>
              {emp.displayName}
            </Text>
          </View>
        </View>

        {/* Collapse / Expand toggle button at bottom border */}
        {hasChildren && (
          <Pressable
            hitSlop={8}
            style={[
              s.toggleBadge,
              {
                backgroundColor: isCollapsed ? "#eff6ff" : "#ecfdf5",
                borderColor: isCollapsed ? "#6366f1" : "#10b981",
              },
            ]}
            onPress={(e) => {
              e.stopPropagation();
              toggleCollapse(emp.uid);
            }}
          >
            <Text
              style={[
                s.toggleText,
                { color: isCollapsed ? "#4f46e5" : "#059669" },
              ]}
            >
              {isCollapsed ? `+${directReports}` : "▲"}
            </Text>
          </Pressable>
        )}
      </Pressable>

      {/* Children connector lines & subtrees */}
      {hasChildren && !isCollapsed && (
        <View style={s.childrenContainer}>
          {/* Vertical stem line dropping from parent card */}
          <View style={s.stemLine} />

          {/* Children horizontal branch */}
          <View style={s.childrenRow}>
            {children.map((child, index) => {
              const isFirst = index === 0;
              const isLast = index === children.length - 1;
              const hasSiblings = children.length > 1;

              return (
                <View key={child.emp.uid} style={s.childWrapper}>
                  {/* Horizontal connector bar */}
                  {hasSiblings && (
                    <View style={s.connectorBar}>
                      <View
                        style={[
                          s.connectorHalf,
                          !isFirst && s.connectorBorder,
                        ]}
                      />
                      <View
                        style={[
                          s.connectorHalf,
                          !isLast && s.connectorBorder,
                        ]}
                      />
                    </View>
                  )}

                  {/* Vertical stem entering child card */}
                  <View style={s.stemLine} />

                  {/* Child subtree */}
                  <TreeBranchView
                    node={child}
                    onSelect={onSelect}
                    collapsed={collapsed}
                    toggleCollapse={toggleCollapse}
                    highlighted={highlighted}
                    movingEmp={movingEmp}
                    onStartMove={onStartMove}
                    onTargetSelect={onTargetSelect}
                    canManage={canManage}
                    allEmps={allEmps}
                  />
                </View>
              );
            })}
          </View>
        </View>
      )}
      {alertView}
    </View>
  );
}

/* ==========================================================================
   5. LIST VIEW COMPONENT (Chế độ Danh sách giống Web)
   ========================================================================== */
function OrgListView({
  emps,
  onSelect,
  highlighted,
  movingEmp,
  onStartMove,
  onTargetSelect,
  canManage,
}: {
  emps: UserProfile[];
  onSelect: (e: UserProfile) => void;
  highlighted: Set<string> | null;
  movingEmp?: UserProfile | null;
  onStartMove?: (e: UserProfile) => void;
  onTargetSelect?: (target: UserProfile) => void;
  canManage?: boolean;
}) {
  const { showAlert, alertView } = useAppAlert();
  const managerMap = useMemo(() => {
    const map = new Map<string, string>();
    emps.forEach((e) => {
      if (e.displayName) map.set(e.uid, e.displayName);
    });
    return map;
  }, [emps]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.listContainer} showsVerticalScrollIndicator={false}>
      {emps.map((emp) => {
        const cat = getCategoryByDivision(emp.department || emp.division);
        const roleIcon = getRoleIcon(emp.jobTitle || emp.role);
        const isHighlighted = highlighted ? highlighted.has(emp.uid) : false;
        const dimmed = highlighted !== null && !isHighlighted;
        const mgrName = emp.parentId ? managerMap.get(emp.parentId) : undefined;

        const isMoving = movingEmp?.uid === emp.uid;
        const isDesc = movingEmp ? isDescendant(movingEmp.uid, emp.uid, emps) : false;
        const isValidTarget = Boolean(movingEmp && !isMoving && !isDesc);
        const isInvalidTarget = Boolean(movingEmp && !isMoving && isDesc);

        return (
          <Pressable
            key={emp.uid}
            onPress={() => {
              if (movingEmp) {
                if (isValidTarget && onTargetSelect) {
                  onTargetSelect(emp);
                } else if (isInvalidTarget) {
                  showAlert("Không thể gán", "Không thể gán nhân sự này vào cấp dưới của chính họ.", undefined, "error");
                }
              } else {
                onSelect(emp);
              }
            }}
            onLongPress={() => {
              if (canManage && onStartMove && !movingEmp) {
                onStartMove(emp);
              }
            }}
            delayLongPress={300}
            style={[
              s.listCard,
              { borderLeftColor: cat.color },
              isHighlighted && s.cardHighlighted,
              dimmed && s.cardDimmed,
              isMoving && s.cardMoving,
              isValidTarget && s.cardDropTarget,
              isInvalidTarget && s.cardDisabledTarget,
            ]}
          >
            <Avatar
              url={emp.photoURL}
              name={emp.displayName ?? "?"}
              size={42}
              bg={cat.bg}
              col={cat.text}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={s.listEmpName}>{emp.displayName}</Text>
                {emp.isLeader && (
                  <View style={s.leaderBadge}>
                    <Text style={s.leaderText}>👑</Text>
                  </View>
                )}
                {isMoving && (
                  <View style={[s.leaderBadge, { backgroundColor: "#6366f1" }]}>
                    <Text style={s.leaderText}>🔄 ĐANG CHUYỂN</Text>
                  </View>
                )}
                {isValidTarget && (
                  <View style={[s.leaderBadge, { backgroundColor: "#10b981" }]}>
                    <Text style={s.leaderText}>📥 GÁN LÀM QUẢN LÝ</Text>
                  </View>
                )}
              </View>
              <Text style={s.listEmpRole}>
                {roleIcon} {emp.jobTitle || roleBadge(emp.role).label}
              </Text>
              <Text style={s.listEmpDept}>
                🏢 {emp.department || "Ban Giám đốc"}
                {mgrName ? ` · 👤 QL: ${mgrName}` : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View style={[s.catBadge, { backgroundColor: cat.bg }]}>
                <Text style={[s.catBadgeText, { color: cat.text }]}>{cat.badge}</Text>
              </View>
              <Pressable
                hitSlop={8}
                style={s.listCallBtn}
                onPress={(event) => {
                      event.stopPropagation();
                  router.push({
                    pathname: "/(tabs)/chat",
                    params: { peerId: emp.uid, name: emp.displayName || emp.email },
                  } as any);
                }}
              >
                <Text style={{ fontSize: 13 }}>💬</Text>
              </Pressable>
            </View>
          </Pressable>
        );
      })}
      <View style={{ height: 60 }} />
      {alertView}
    </ScrollView>
  );
}

/* ==========================================================================
   6. MAIN ORG CHART SCREEN
   ========================================================================== */
export default function OrgChart() {
  const { showAlert, alertView } = useAppAlert();
  const { user, selectedBranch } = useSession();
  const branchId = selectedBranch?._id || user?.branchId || undefined;
  const [empList, setEmpList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [editingEmp, setEditingEmp] = useState<UserProfile | null>(null);
  const [movingEmp, setMovingEmp] = useState<UserProfile | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [deptList, setDeptList] = useState<DepartmentRecord[]>([]);
  const [branchList, setBranchList] = useState<BranchRecord[]>([]);
  const canManage =
    ["admin", "superadmin", "branch_owner", "manager"].includes(user?.role || "") ||
    hasPermission(user, "user:manage");

  // Multi-touch pinch-to-zoom tracking
  const pinchStartDistRef = React.useRef<number | null>(null);
  const pinchStartScaleRef = React.useRef<number>(1.0);

  const handleTouchStart = (e: any) => {
    if (e.nativeEvent.touches && e.nativeEvent.touches.length === 2) {
      const [t1, t2] = e.nativeEvent.touches;
      const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = zoomScale;
    }
  };

  const handleTouchMove = (e: any) => {
    if (e.nativeEvent.touches && e.nativeEvent.touches.length === 2 && pinchStartDistRef.current) {
      const [t1, t2] = e.nativeEvent.touches;
      const currentDist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
      const ratio = currentDist / pinchStartDistRef.current;
      const newScale = Math.min(2.0, Math.max(0.35, Number((pinchStartScaleRef.current * ratio).toFixed(2))));
      setZoomScale(newScale);
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistRef.current = null;
  };

  const handleCreateUser = async (data: CreateUserInput) => {
    await userManagementApi.createUser(data);
    showAlert("Thành công", "Đã thêm nhân sự mới vào hệ thống.", undefined, "success");
    setCreateModalVisible(false);
    setRevision((v) => v + 1);
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      Promise.all([
        roster.list(user?.companyCode ?? "", branchId),
        departmentService.list().catch(() => []),
        branchService.list().catch(() => []),
      ])
        .then(([emps, depts, brs]) => {
          if (active) {
            setEmpList(emps);
            setDeptList(depts);
            setBranchList(brs);
          }
        })
        .catch((e) => {
          if (active) setError(messageOf(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [revision, user?.companyCode, branchId])
  );

  const tree = useMemo(() => buildTree(empList), [empList]);

  const highlighted = useMemo<Set<string> | null>(() => {
    if (!search.trim()) return null;
    return flattenSearchMatches(tree, search.toLowerCase());
  }, [tree, search]);

  const managerName = useMemo(() => {
    if (!selected?.parentId) return undefined;
    return empList.find((e) => e.uid === selected.parentId)?.displayName;
  }, [selected, empList]);

  function toggle(uid: string) {
    setCollapsed((prev) => {
      const n = new Set(prev);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });
  }

  function expandAll() {
    setCollapsed(new Set());
  }

  function collapseAll() {
    const uids = new Set<string>();
    function walk(nodes: TreeNode[]) {
      nodes.forEach((n) => {
        if (n.children.length) {
          uids.add(n.emp.uid);
          walk(n.children);
        }
      });
    }
    walk(tree);
    setCollapsed(uids);
  }

  function zoomIn() {
    setZoomScale((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))));
  }

  function zoomOut() {
    setZoomScale((z) => Math.max(0.35, Number((z - 0.15).toFixed(2))));
  }

  function zoomReset() {
    setZoomScale(1.0);
  }

  function zoomFit() {
    setZoomScale(0.55);
  }

  const handleConfirmMove = (target: UserProfile | null) => {
    if (!movingEmp) return;
    const empToMove = movingEmp;
    if (target && isDescendant(empToMove.uid, target.uid, empList)) {
      showAlert(
        "Không thể gán",
        "Không thể gán nhân sự này làm cấp dưới của người nằm trong nhánh dưới của chính họ.", undefined, "error"
      );
      return;
    }

    const targetName = target ? target.displayName : "Cấp cao nhất (Không có quản lý)";
    showAlert(
      "Xác nhận thay đổi quản lý",
      `Bạn có chắc chắn muốn chuyển quản lý trực tiếp của "${empToMove.displayName}" thành "${targetName}"?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đồng ý",
          style: "default",
          onPress: async () => {
            const newParentId = target ? target.uid : "";
            try {
              setLoading(true);
              await Promise.all([
                roster.update(empToMove.uid, { parentId: newParentId } as any).catch(() => null),
                userManagementApi.updateUser(empToMove.uid, { parentId: newParentId }),
              ]);
              setEmpList((prev) =>
                prev.map((e) => (e.uid === empToMove.uid ? { ...e, parentId: newParentId } : e))
              );
              setRevision((v) => v + 1);
              showAlert("Thành công", `Đã cập nhật quản lý trực tiếp cho ${empToMove.displayName}.`, undefined, "success");
            } catch (err: any) {
              showAlert("Lỗi", err?.message || "Không thể cập nhật quản lý trực tiếp.", undefined, "error");
            } finally {
              setLoading(false);
              setMovingEmp(null);
            }
          },
        },
      ]
    );
  };

  const handleSaveEdit = async (uid: string, draft: Partial<UserProfile>) => {
    await Promise.all([
      roster.update(uid, draft as any).catch(() => null),
      userManagementApi.updateUser(uid, draft as any),
    ]);
    setEmpList((prev) =>
      prev.map((e) => (e.uid === uid ? { ...e, ...draft } : e))
    );
    setRevision((v) => v + 1);
    if (selected?.uid === uid) {
      setSelected((prev) => (prev ? { ...prev, ...draft } : null));
    }
    showAlert("Thành công", "Đã cập nhật thông tin nhân sự.", undefined, "success");
    setEditingEmp(null);
  };

  const Header = () => (
    <View style={s.header}>
      <Pressable onPress={() => router.back()} style={s.iconBtn}>
        <Text style={{ fontSize: 18, color: "#0f172a", fontWeight: "700" }}>{"<"}</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Sơ đồ tổ chức</Text>
        {!loading && !error && (
          <Text style={s.subtitle}>
            {empList.length} nhân sự · {selectedBranch?.name || "Tất cả chi nhánh"}
          </Text>
        )}
      </View>

      {/* View Mode Toggle: Cây vs Danh Sách */}
      <View style={s.viewToggleContainer}>
        <Pressable
          style={[s.toggleTab, viewMode === "tree" && s.toggleTabActive]}
          onPress={() => setViewMode("tree")}
        >
          <Text
            style={[
              s.toggleTabTxt,
              viewMode === "tree" ? s.toggleTabTxtActive : s.toggleTabTxtInactive,
            ]}
          >
            🌳 Cây
          </Text>
        </Pressable>
        <Pressable
          style={[s.toggleTab, viewMode === "list" && s.toggleTabActive]}
          onPress={() => setViewMode("list")}
        >
          <Text
            style={[
              s.toggleTabTxt,
              viewMode === "list" ? s.toggleTabTxtActive : s.toggleTabTxtInactive,
            ]}
          >
            📋 Bảng
          </Text>
        </Pressable>
      </View>

      {canManage && (
        <Pressable style={s.addBtn} onPress={() => setCreateModalVisible(true)}>
          <Text style={s.addBtnText}>+ Thêm</Text>
        </Pressable>
      )}

      <Pressable style={s.iconBtn} onPress={() => setRevision((v) => v + 1)}>
        <Text style={{ fontSize: 17 }}>↺</Text>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={s.root}>
        <Header />
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={s.loadingText}>Đang tải dữ liệu sơ đồ tổ chức…</Text>
        </View>
        {alertView}
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView edges={["top"]} style={s.root}>
        <Header />
        <View style={s.centerBox}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={() => setRevision((v) => v + 1)}>
            <Text style={s.retryTxt}>Thử lại</Text>
          </Pressable>
        </View>
        {alertView}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={s.root}>
      <Header />

      {/* Drag & Drop Sticky Banner */}
      {movingEmp && (
        <View style={s.dragBanner}>
          <View style={s.dragBannerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.dragBannerTitle} numberOfLines={1}>
                🔄 Đổi quản lý cho: {movingEmp.displayName}
              </Text>
              <Text style={s.dragBannerSub}>
                Nhấn thẻ nhân viên để gán làm quản lý mới, hoặc gán làm Cấp cao nhất
              </Text>
            </View>
            <View style={s.dragBannerActions}>
              <Pressable style={s.dragRootBtn} onPress={() => handleConfirmMove(null)}>
                <Text style={s.dragRootBtnText}>👑 Cấp cao nhất</Text>
              </Pressable>
              <Pressable style={s.dragCancelBtn} onPress={() => setMovingEmp(null)}>
                <Text style={s.dragCancelBtnText}>✕ Hủy</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Control Toolbar: Search + Quick Expand/Collapse + Zoom */}
      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Text style={{ color: "#94a3b8", fontSize: 13, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Tìm tên, chức danh, phòng ban…"
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <Pressable onPress={() => setSearch("")} hitSlop={6}>
              <Text style={{ color: "#94a3b8", fontWeight: "700", paddingHorizontal: 4 }}>✕</Text>
            </Pressable>
          )}
        </View>

        {viewMode === "tree" && (
          <View style={s.treeToolRow}>
            <View style={s.expandGroup}>
              <Pressable style={s.toolBtn} onPress={expandAll}>
                <Text style={s.toolBtnTxt}>Mở hết</Text>
              </Pressable>
              <Pressable style={s.toolBtn} onPress={collapseAll}>
                <Text style={s.toolBtnTxt}>Thu gọn</Text>
              </Pressable>
            </View>

            <View style={s.zoomGroup}>
              <Pressable style={s.zoomBtn} onPress={zoomOut}>
                <Text style={s.zoomBtnTxt}>−</Text>
              </Pressable>
              <Pressable style={s.zoomLabelBtn} onPress={zoomReset}>
                <Text style={s.zoomLabelTxt}>{Math.round(zoomScale * 100)}%</Text>
              </Pressable>
              <Pressable style={s.zoomBtn} onPress={zoomIn}>
                <Text style={s.zoomBtnTxt}>+</Text>
              </Pressable>
              <Pressable style={s.floatingFitBtn} onPress={zoomFit}>
                <Text style={s.floatingFitBtnTxt}>Fit</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Main Content Area */}
      {viewMode === "list" ? (
        <OrgListView
          emps={empList}
          onSelect={setSelected}
          highlighted={highlighted}
          movingEmp={movingEmp}
          onStartMove={(e) => setMovingEmp(e)}
          onTargetSelect={(target) => handleConfirmMove(target)}
          canManage={canManage}
        />
      ) : (
        /* 2D Scrollable Interactive Tree Canvas with Pinch Zoom */
        <View style={{ flex: 1 }} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.verticalScroll}
            showsVerticalScrollIndicator={true}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={s.horizontalScroll}
            >
              {tree.length === 0 ? (
                <View style={s.emptyBox}>
                  <Text style={{ fontSize: 36, marginBottom: 8 }}>👥</Text>
                  <Text style={s.emptyTitle}>Chưa có dữ liệu cơ cấu nhân sự</Text>
                  <Text style={s.emptySub}>Vui lòng kiểm tra phân quyền hoặc danh sách nhân viên</Text>
                </View>
              ) : (
                <View
                  style={[
                    s.treeCanvas,
                    {
                      transform: [{ scale: zoomScale }],
                    },
                  ]}
                >
                  <View style={s.rootRow}>
                    {tree.map((rootNode) => (
                      <TreeBranchView
                        key={rootNode.emp.uid}
                        node={rootNode}
                        onSelect={setSelected}
                        collapsed={collapsed}
                        toggleCollapse={toggle}
                        highlighted={highlighted}
                        movingEmp={movingEmp}
                        onStartMove={(e) => setMovingEmp(e)}
                        onTargetSelect={(target) => handleConfirmMove(target)}
                        canManage={canManage}
                        allEmps={empList}
                      />
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          </ScrollView>

          {/* Floating Zoom Action Controls (FAB) */}
          <View style={s.floatingZoomBar}>
            <Pressable style={s.floatingZoomBtn} onPress={zoomIn}>
              <Text style={s.floatingZoomBtnTxt}>+</Text>
            </Pressable>
            <Pressable style={s.floatingZoomLabelBtn} onPress={zoomReset}>
              <Text style={s.floatingZoomLabelTxt}>{Math.round(zoomScale * 100)}%</Text>
            </Pressable>
            <Pressable style={s.floatingZoomBtn} onPress={zoomOut}>
              <Text style={s.floatingZoomBtnTxt}>−</Text>
            </Pressable>
            <Pressable style={s.floatingFitBtn} onPress={zoomFit}>
              <Text style={s.floatingFitBtnTxt}>Fit</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Employee Profile Details Modal */}
      <ProfileModal
        emp={selected}
        managerName={managerName}
        onClose={() => setSelected(null)}
        canManage={canManage}
        onEdit={(e) => setEditingEmp(e)}
        onStartMove={(e) => setMovingEmp(e)}
      />

      {/* Employee Information Edit Modal */}
      {editingEmp && (
        <OrgEditModal
          visible={!!editingEmp}
          emp={editingEmp}
          empList={empList}
          departments={deptList}
          onClose={() => setEditingEmp(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Create New Employee Modal */}
      <UserCreateModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={handleCreateUser}
        branches={branchList}
        departments={deptList.map((d) => ({ id: (d as any).id || d._id, name: d.name, code: d.code }))}
        defaultBranchId={selectedBranch?._id || user?.branchId}
        companyCode={user?.companyCode}
        companyName={user?.companyName}
        managers={empList}
      />
      {alertView}
    </SafeAreaView>
  );
}

/* ==========================================================================
   7. STYLESHEET
   ========================================================================== */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "800", color: "#0f172a", letterSpacing: -0.3 },
  subtitle: { fontSize: 11, color: "#64748b", marginTop: 1 },
  addBtn: {
    backgroundColor: "#059669",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  viewToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 2,
  },
  toggleTab: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  toggleTabActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleTabTxt: { fontSize: 11, fontWeight: "700" },
  toggleTabTxtActive: { color: "#4f46e5" },
  toggleTabTxtInactive: { color: "#64748b" },

  toolbar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: { flex: 1, fontSize: 13, color: "#0f172a", paddingVertical: 0 },

  treeToolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expandGroup: {
    flexDirection: "row",
    gap: 6,
  },
  toolBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  toolBtnTxt: { fontSize: 11, fontWeight: "700", color: "#475569" },

  zoomGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  zoomBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  zoomBtnTxt: { fontSize: 14, fontWeight: "800", color: "#475569" },
  zoomLabelBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  zoomLabelTxt: { fontSize: 10, fontWeight: "700", color: "#475569" },

  /* Floating Zoom Controls */
  floatingZoomBar: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    flexDirection: "column",
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    overflow: "hidden",
  },
  floatingZoomBtn: {
    width: 38,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  floatingZoomBtnTxt: {
    fontSize: 18,
    fontWeight: "800",
    color: "#334155",
  },
  floatingZoomLabelBtn: {
    width: 38,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  floatingZoomLabelTxt: {
    fontSize: 9,
    fontWeight: "700",
    color: "#475569",
  },
  floatingFitBtn: {
    width: 38,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
    borderTopWidth: 1,
    borderColor: "#c7d2fe",
  },
  floatingFitBtnTxt: {
    fontSize: 10,
    fontWeight: "800",
    color: "#4f46e5",
  },

  /* Drag & Drop / Reassign Mode Banner */
  dragBanner: {
    backgroundColor: "#eff6ff",
    borderBottomWidth: 2,
    borderBottomColor: "#3b82f6",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dragBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dragBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1d4ed8",
  },
  dragBannerSub: {
    fontSize: 10,
    color: "#3b82f6",
    marginTop: 2,
  },
  dragBannerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dragRootBtn: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  dragRootBtnText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  dragCancelBtn: {
    backgroundColor: "#64748b",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  dragCancelBtnText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },

  /* 2D Tree Canvas */
  verticalScroll: { flexGrow: 1 },
  horizontalScroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingVertical: 24,
  },
  treeCanvas: {
    alignItems: "center",
  },
  rootRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 32,
  },

  /* Recursive Tree Branch Layout */
  branchCol: {
    alignItems: "center",
  },
  childrenContainer: {
    alignItems: "center",
  },
  childrenRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  childWrapper: {
    alignItems: "center",
    paddingHorizontal: CARD_MARGIN,
    position: "relative",
  },

  /* Connector Lines */
  stemLine: {
    width: 2,
    height: 22,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
  },
  connectorBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    flexDirection: "row",
  },
  connectorHalf: {
    width: "50%",
    height: 2,
  },
  connectorBorder: {
    borderTopWidth: 2,
    borderTopColor: "#cbd5e1",
  },

  /* Smart Employee Card (Chuẩn Web) */
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderTopWidth: 4,
    padding: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
    position: "relative",
  },
  cardHighlighted: {
    borderColor: "#4f46e5",
    shadowColor: "#4f46e5",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  cardDimmed: {
    opacity: 0.25,
  },
  cardMoving: {
    borderColor: "#6366f1",
    borderWidth: 2,
    backgroundColor: "#f5f3ff",
    shadowColor: "#6366f1",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  cardMovingBadge: {
    position: "absolute",
    top: -12,
    left: 8,
    backgroundColor: "#6366f1",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 10,
  },
  cardMovingBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  cardDropTarget: {
    borderColor: "#10b981",
    borderWidth: 2,
    backgroundColor: "#ecfdf5",
    shadowColor: "#10b981",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cardDropBadge: {
    position: "absolute",
    top: -12,
    right: 8,
    backgroundColor: "#10b981",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 10,
  },
  cardDropBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  cardDisabledTarget: {
    opacity: 0.3,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  leaderBadge: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  leaderText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  leaderBadgeLarge: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  leaderTextLarge: {
    color: "#b45309",
    fontSize: 10,
    fontWeight: "800",
  },
  catBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  catBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: "#ffffff",
  },
  deptContainer: {
    minHeight: 28,
    justifyContent: "center",
    marginBottom: 6,
  },
  deptName: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1e293b",
    lineHeight: 14,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  cardMeta: {
    flex: 1,
    marginLeft: 6,
  },
  roleText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
  },
  nameText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 1,
  },

  /* Bottom toggle badge */
  toggleBadge: {
    position: "absolute",
    bottom: -11,
    alignSelf: "center",
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 10,
    borderWidth: 1.5,
    zIndex: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 9,
    fontWeight: "900",
  },

  /* List Mode Styles */
  listContainer: {
    padding: 12,
    gap: 8,
  },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
    padding: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  listEmpName: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  listEmpRole: { fontSize: 11, fontWeight: "600", color: "#64748b", marginTop: 2 },
  listEmpDept: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  listCallBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  /* Modal Details */
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginBottom: 16,
  },
  mName: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginTop: 10, textAlign: "center" },
  mSub: { fontSize: 13, color: "#64748b", marginTop: 3, textAlign: "center" },
  pill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillTxt: { fontSize: 9, fontWeight: "800" },
  infoBlock: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginVertical: 14,
    overflow: "hidden",
  },
  iRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 10,
  },
  iIco: { fontSize: 15, width: 22, textAlign: "center" },
  iLbl: { fontSize: 12, color: "#64748b", width: 78, fontWeight: "600" },
  iVal: { flex: 1, fontSize: 13, color: "#0f172a", fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 12,
    gap: 5,
  },
  actionIco: { fontSize: 20 },
  actionLbl: { fontSize: 12, fontWeight: "700", color: "#475569" },

  /* Org Edit Modal Styles */
  editModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "flex-end",
  },
  editContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
    flex: 1,
    display: "flex",
  },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  editHeaderTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  editHeaderSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  editCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  editScroll: {
    flex: 1,
  },
  editScrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  formGroup: {
    gap: 4,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  formInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: "#0f172a",
  },
  formLeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  formLeaderLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#92400e",
  },
  formLeaderSub: {
    fontSize: 10,
    color: "#b45309",
    marginTop: 2,
  },
  leaderToggle: {
    backgroundColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  leaderToggleActive: {
    backgroundColor: "#f59e0b",
  },
  leaderToggleText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  leaderToggleTextActive: {
    color: "#ffffff",
  },
  salaryPreviewText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
    marginTop: 2,
  },
  editFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  editCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  editCancelBtnTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  editSaveBtn: {
    flex: 2,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
  },
  editSaveBtnTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },

  /* Inner Dropdown / Pickers */
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  pickerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    maxHeight: 380,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pickerItemActive: {
    backgroundColor: "#eff6ff",
  },
  pickerItemText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
  },
  pickerItemTextActive: {
    color: "#2563eb",
    fontWeight: "800",
  },
  pickerSubText: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },

  /* Center / Empty states */
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: { marginTop: 12, color: "#64748b", fontSize: 14 },
  errorText: { color: "#e11d48", fontWeight: "700", fontSize: 15, textAlign: "center" },
  retryBtn: {
    marginTop: 18,
    backgroundColor: "#4f46e5",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryTxt: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  emptyBox: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#475569" },
  emptySub: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
});
