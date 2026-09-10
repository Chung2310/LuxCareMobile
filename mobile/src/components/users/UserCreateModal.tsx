import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppButton } from "../common/AppButton";
import { DropdownSelectField } from "../common/DropdownSelectField";
import { ROLE_MAP } from "./UserCard";
import type { CreateUserInput, UserRole } from "../../api/userManagementApi";
import type { BranchRecord } from "../../../../src/services/branchService";

interface UserCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserInput) => Promise<void>;
  branches: BranchRecord[];
  departments?: Array<{ id?: string; name: string; code?: string }>;
  defaultBranchId?: string;
  companyCode?: string;
  companyName?: string;
}

const ROLES_LIST: Array<{ id: UserRole; label: string; desc: string }> = [
  { id: "user", label: "Nhân viên", desc: "Nhân viên tác nghiệp chuyên môn / điều dưỡng / CSKH" },
  { id: "manager", label: "Quản lý", desc: "Trưởng khoa / Trưởng bộ phận phụ trách công việc" },
  { id: "branch_owner", label: "Chủ chi nhánh", desc: "Giám đốc / Phụ trách toàn diện cơ sở chi nhánh" },
];

export const UserCreateModal: React.FC<UserCreateModalProps> = ({
  visible,
  onClose,
  onSubmit,
  branches,
  departments = [],
  defaultBranchId,
  companyCode,
  companyName,
}) => {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>("user");
  const [branchId, setBranchId] = useState(defaultBranchId || "");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(false);

  // Sub-picker modals
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showDeptPicker, setShowDeptPicker] = useState(false);

  const resetForm = () => {
    setDisplayName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setRole("user");
    setBranchId(defaultBranchId || "");
    setDepartment("");
    setPhone("");
    setJobTitle("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedName || trimmedName.length < 2) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập họ và tên thành viên (tối thiểu 2 ký tự).");
      return;
    }

    if (!trimmedEmail) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập địa chỉ email đăng nhập.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert("Email không hợp lệ", "Vui lòng nhập đúng định dạng email (ví dụ: user@luxcare.vn).");
      return;
    }

    if (!trimmedPassword || trimmedPassword.length < 6) {
      Alert.alert("Mật khẩu yếu", "Mật khẩu khởi tạo phải có ít nhất 6 ký tự.");
      return;
    }

    const trimmedPhone = phone.trim().replace(/[\s.-]/g, "");
    if (trimmedPhone) {
      const phoneRegex = /^(0|\+84)[0-9]{8,11}$/;
      if (!phoneRegex.test(trimmedPhone)) {
        Alert.alert("Số điện thoại không hợp lệ", "Số điện thoại không đúng định dạng (Ví dụ: 0912345678).");
        return;
      }
    }

    if (role === "admin" || (role as string) === "superadmin") {
      Alert.alert("Không được phép", "Không được phép tạo nhân sự mới với vai trò Quản trị viên (Admin).");
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        displayName: trimmedName,
        email: trimmedEmail,
        password: trimmedPassword,
        role,
        phone: trimmedPhone || undefined,
        branchId: branchId || undefined,
        department: department || undefined,
        division: jobTitle.trim() || undefined,
        companyCode: companyCode || undefined,
        companyName: companyName || undefined,
      });
      resetForm();
      onClose();
    } catch (err: any) {
      Alert.alert("Lỗi", err.message || "Không thể tạo tài khoản người dùng.");
    } finally {
      setLoading(false);
    }
  };

  const selectedRoleConfig = ROLE_MAP[role] || ROLE_MAP.user;
  const selectedBranchName =
    branches.find((b) => b._id === branchId)?.name || "Toàn viện / Chưa gán";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <SafeAreaView style={styles.modalOverlay} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Thêm người dùng mới</Text>
              <Text style={styles.headerSubtitle}>
                Cấp tài khoản đăng nhập & phân quyền nhân sự
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose} disabled={loading}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Họ và tên */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Họ và tên thành viên <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="VD: Bác sĩ Nguyễn Văn An"
                placeholderTextColor="#94a3b8"
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Email đăng nhập <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="VD: an.nguyen@luxcare.vn"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Mật khẩu khởi tạo */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Mật khẩu khởi tạo <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, borderRightWidth: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                  placeholder="Tối thiểu 6 ký tự..."
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Chọn vai trò */}
            <DropdownSelectField
              label="Vai trò & Phân quyền"
              required
              value={`${selectedRoleConfig.label}`}
              icon={selectedRoleConfig.icon}
              iconColor={selectedRoleConfig.color}
              iconBgColor={selectedRoleConfig.bg}
              onPress={() => setShowRolePicker(true)}
            />

            {/* Chọn chi nhánh */}
            {branches.length > 0 && (
              <DropdownSelectField
                label="Chi nhánh công tác"
                value={selectedBranchName}
                placeholder="Chọn chi nhánh..."
                icon="business-outline"
                iconColor="#0284c7"
                iconBgColor="#e0f2fe"
                onPress={() => setShowBranchPicker(true)}
              />
            )}

            {/* Khoa / Phòng ban */}
            {departments.length > 0 ? (
              <DropdownSelectField
                label="Khoa / Phòng ban"
                value={department || "Chưa chọn phòng ban"}
                placeholder="Chọn khoa / phòng ban..."
                icon="layers-outline"
                iconColor="#7c3aed"
                iconBgColor="#f5f3ff"
                onPress={() => setShowDeptPicker(true)}
              />
            ) : (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Khoa / Phòng ban</Text>
                <TextInput
                  style={styles.input}
                  placeholder="VD: Khoa Khám bệnh, Phòng Kế toán..."
                  placeholderTextColor="#94a3b8"
                  value={department}
                  onChangeText={setDepartment}
                />
              </View>
            )}

            {/* Chức danh / Vị trí */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Chức danh / Vị trí chuyên môn</Text>
              <TextInput
                style={styles.input}
                placeholder="VD: Bác sĩ điều trị, Điều dưỡng trưởng..."
                placeholderTextColor="#94a3b8"
                value={jobTitle}
                onChangeText={setJobTitle}
              />
            </View>

            {/* Số điện thoại */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Số điện thoại</Text>
              <TextInput
                style={styles.input}
                placeholder="VD: 0912345678"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </ScrollView>

          {/* Footer buttons */}
          <View style={styles.footer}>
            <AppButton
              title="Hủy"
              variant="secondary"
              onPress={handleClose}
              style={styles.cancelBtn}
              disabled={loading}
            />
            <AppButton
              title="Tạo tài khoản"
              variant="primary"
              onPress={handleSave}
              loading={loading}
              icon="person-add"
              style={styles.saveBtn}
            />
          </View>
        </KeyboardAvoidingView>

        {/* Modal Picker: Vai trò */}
        <Modal
          visible={showRolePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRolePicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowRolePicker(false)}
          >
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>Phân quyền vai trò</Text>
              <ScrollView style={{ maxHeight: 320 }}>
                {ROLES_LIST.map((r) => {
                  const cfg = ROLE_MAP[r.id];
                  const isSelected = role === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[
                        styles.pickerItem,
                        isSelected && styles.pickerItemActive,
                      ]}
                      onPress={() => {
                        setRole(r.id);
                        setShowRolePicker(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Ionicons name={cfg.icon} size={15} color={cfg.color} />
                          <Text style={[styles.pickerRoleTitle, { color: cfg.color }]}>
                            {r.label}
                          </Text>
                        </View>
                        <Text style={styles.pickerRoleDesc}>{r.desc}</Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color="#059669" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal Picker: Chi nhánh */}
        <Modal
          visible={showBranchPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBranchPicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowBranchPicker(false)}
          >
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>Chọn chi nhánh công tác</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    branchId === "" && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    setBranchId("");
                    setShowBranchPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      branchId === "" && styles.pickerItemTextActive,
                    ]}
                  >
                    -- Toàn viện / Không gắn cố định --
                  </Text>
                  {branchId === "" && (
                    <Ionicons name="checkmark" size={18} color="#059669" />
                  )}
                </TouchableOpacity>

                {branches.map((b) => (
                  <TouchableOpacity
                    key={b._id}
                    style={[
                      styles.pickerItem,
                      branchId === b._id && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setBranchId(b._id);
                      setShowBranchPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        branchId === b._id && styles.pickerItemTextActive,
                      ]}
                    >
                      {b.name}
                    </Text>
                    {branchId === b._id && (
                      <Ionicons name="checkmark" size={18} color="#059669" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal Picker: Phòng ban */}
        <Modal
          visible={showDeptPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeptPicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowDeptPicker(false)}
          >
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>Chọn khoa / phòng ban</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {departments.map((d, i) => (
                  <TouchableOpacity
                    key={d.id || `${d.name}-${i}`}
                    style={[
                      styles.pickerItem,
                      department === d.name && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setDepartment(d.name);
                      setShowDeptPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        department === d.name && styles.pickerItemTextActive,
                      ]}
                    >
                      {d.name}
                    </Text>
                    {department === d.name && (
                      <Ionicons name="checkmark" size={18} color="#059669" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  required: {
    color: "#dc2626",
  },
  input: {
    height: 44,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: "#0f172a",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  eyeBtn: {
    height: 44,
    width: 44,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: "#cbd5e1",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  cancelBtn: {
    flex: 1,
  },
  saveBtn: {
    flex: 1.5,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pickerItemActive: {
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
  },
  pickerRoleTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  pickerRoleDesc: {
    fontSize: 11.5,
    color: "#64748b",
    marginTop: 2,
  },
  pickerItemText: {
    fontSize: 13.5,
    color: "#334155",
  },
  pickerItemTextActive: {
    color: "#059669",
    fontWeight: "600",
  },
});
