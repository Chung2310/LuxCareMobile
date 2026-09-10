import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import type { UserProfile } from "../../../../src/types/common";
import type { UpdateUserInput, UserRole } from "../../api/userManagementApi";
import type { BranchRecord } from "../../../../src/services/branchService";

interface UserDetailModalProps {
  visible: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onUpdate: (id: string, data: UpdateUserInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  branches: BranchRecord[];
  departments?: Array<{ id?: string; name: string; code?: string }>;
  canManage?: boolean;
}

const ROLES_ORDER: UserRole[] = ["user", "manager", "branch_owner", "admin"];

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  visible,
  user,
  onClose,
  onUpdate,
  onDelete,
  branches,
  departments = [],
  canManage = true,
}) => {
  if (!user) return null;

  const [currentUser, setCurrentUser] = useState<UserProfile>(user);
  const [isEditing, setIsEditing] = useState(false);

  // Edit draft states
  const [draftName, setDraftName] = useState(user.displayName || "");
  const [draftPhone, setDraftPhone] = useState(user.phone || "");
  const [draftDept, setDraftDept] = useState(user.department || "");
  const [draftJobTitle, setDraftJobTitle] = useState(user.jobTitle || "");
  const [draftBranchId, setDraftBranchId] = useState(user.branchId || "");

  // Sub pickers
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showDeptPicker, setShowDeptPicker] = useState(false);

  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  React.useEffect(() => {
    if (user) {
      setCurrentUser(user);
      setDraftName(user.displayName || "");
      setDraftPhone(user.phone || "");
      setDraftDept(user.department || "");
      setDraftJobTitle(user.jobTitle || "");
      setDraftBranchId(user.branchId || "");
      setIsEditing(false);
    }
  }, [user]);

  const roleConfig = ROLE_MAP[currentUser.role] || ROLE_MAP.user;

  const handleCall = () => {
    if (!currentUser.phone) return;
    Linking.openURL(`tel:${currentUser.phone}`).catch(() => {
      Alert.alert("Lỗi", "Không thể thực hiện cuộc gọi.");
    });
  };

  const handleSms = () => {
    if (!currentUser.phone) return;
    Linking.openURL(`sms:${currentUser.phone}`).catch(() => {
      Alert.alert("Lỗi", "Không thể gửi tin nhắn.");
    });
  };

  const handleEmail = () => {
    if (!currentUser.email) return;
    Linking.openURL(`mailto:${currentUser.email}`).catch(() => {
      Alert.alert("Lỗi", "Không thể mở ứng dụng email.");
    });
  };

  const handleChangeRole = (newRole: UserRole) => {
    if (newRole === currentUser.role) return;

    const newRoleCfg = ROLE_MAP[newRole] || ROLE_MAP.user;
    Alert.alert(
      "Xác nhận thay đổi vai trò",
      `Bạn có chắc chắn muốn thay đổi quyền của "${currentUser.displayName}" thành "${newRoleCfg.label}" không?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xác nhận",
          onPress: async () => {
            setUpdating(true);
            try {
              await onUpdate(currentUser.uid, { role: newRole });
              setCurrentUser((prev) => ({ ...prev, role: newRole }));
              Alert.alert("Thành công", `Đã cập nhật vai trò thành "${newRoleCfg.label}".`);
            } catch (err: any) {
              Alert.alert("Lỗi cập nhật", err.message || "Không thể đổi vai trò.");
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  };

  const handleSaveProfile = async () => {
    const trimmedName = draftName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập họ và tên (tối thiểu 2 ký tự).");
      return;
    }

    const trimmedPhone = draftPhone.trim().replace(/[\s.-]/g, "");
    if (trimmedPhone) {
      const phoneRegex = /^(0|\+84)[0-9]{8,11}$/;
      if (!phoneRegex.test(trimmedPhone)) {
        Alert.alert("Số điện thoại không hợp lệ", "Số điện thoại không đúng định dạng (Ví dụ: 0912345678).");
        return;
      }
    }

    setUpdating(true);
    try {
      const branchObj = branches.find((b) => b._id === draftBranchId);
      await onUpdate(currentUser.uid, {
        displayName: trimmedName,
        phone: trimmedPhone || undefined,
        department: draftDept || undefined,
        division: draftJobTitle.trim() || undefined,
        jobTitle: draftJobTitle.trim() || undefined,
        branchId: draftBranchId || undefined,
      });

      setCurrentUser((prev) => ({
        ...prev,
        displayName: trimmedName,
        phone: trimmedPhone,
        department: draftDept,
        jobTitle: draftJobTitle.trim(),
        division: draftJobTitle.trim(),
        branchId: draftBranchId,
        branchName: branchObj ? branchObj.name : prev.branchName,
      }));

      setIsEditing(false);
      Alert.alert("Thành công", "Đã cập nhật thông tin thành viên.");
    } catch (err: any) {
      Alert.alert("Lỗi cập nhật", err.message || "Không thể lưu thông tin.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Xác nhận xóa tài khoản",
      `Bạn có chắc chắn muốn xóa tài khoản của "${currentUser.displayName}" khỏi hệ thống không? Hành động này không thể hoàn tác.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa tài khoản",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await onDelete(currentUser.uid);
              onClose();
            } catch (err: any) {
              Alert.alert("Lỗi", err.message || "Không thể xóa tài khoản.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const formatDate = (dateStr?: any) => {
    if (!dateStr) return "Chưa cập nhật";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "Chưa cập nhật";
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.modalOverlay} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {currentUser.displayName || "Chi tiết người dùng"}
              </Text>
              <Text style={styles.headerSubtitle}>
                Hồ sơ tài khoản & quyền hạn hệ thống
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Primary Profile Card */}
            <View style={styles.profileCard}>
              <View style={styles.profileTop}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : "U"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{currentUser.displayName}</Text>
                  <Text style={styles.profileEmail}>{currentUser.email}</Text>
                </View>
                <View
                  style={[
                    styles.roleBadge,
                    { backgroundColor: roleConfig.bg, borderColor: roleConfig.border },
                  ]}
                >
                  <Ionicons name={roleConfig.icon} size={13} color={roleConfig.color} />
                  <Text style={[styles.roleText, { color: roleConfig.color }]}>
                    {roleConfig.label}
                  </Text>
                </View>
              </View>

              {/* Quick Actions: Call, SMS, Email */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.callBtn, !currentUser.phone && styles.actionBtnDisabled]}
                  onPress={handleCall}
                  disabled={!currentUser.phone}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call" size={15} color="#ffffff" />
                  <Text style={styles.actionBtnText}>Gọi điện</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.smsBtn, !currentUser.phone && styles.actionBtnDisabled]}
                  onPress={handleSms}
                  disabled={!currentUser.phone}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chatbox" size={15} color="#ffffff" />
                  <Text style={styles.actionBtnText}>Gửi SMS</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.emailBtn]}
                  onPress={handleEmail}
                  activeOpacity={0.7}
                >
                  <Ionicons name="mail" size={15} color="#ffffff" />
                  <Text style={styles.actionBtnText}>Email</Text>
                </TouchableOpacity>
              </View>

              {/* Info Attributes */}
              {!isEditing ? (
                <View style={styles.infoList}>
                  <View style={styles.infoItem}>
                    <Ionicons name="call-outline" size={14} color="#64748b" />
                    <Text style={styles.infoText}>
                      Điện thoại:{" "}
                      <Text style={styles.infoHighlight}>
                        {currentUser.phone || "Chưa có SĐT"}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.infoItem}>
                    <Ionicons name="business-outline" size={14} color="#64748b" />
                    <Text style={styles.infoText}>
                      Chi nhánh:{" "}
                      <Text style={styles.infoHighlight}>
                        {currentUser.branchName || "Toàn viện / Chưa gán"}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.infoItem}>
                    <Ionicons name="layers-outline" size={14} color="#64748b" />
                    <Text style={styles.infoText}>
                      Khoa / Phòng ban:{" "}
                      <Text style={styles.infoHighlight}>
                        {currentUser.department || "Chưa phân khoa"}
                      </Text>
                    </Text>
                  </View>

                  {currentUser.jobTitle ? (
                    <View style={styles.infoItem}>
                      <Ionicons name="id-card-outline" size={14} color="#64748b" />
                      <Text style={styles.infoText}>
                        Chức danh:{" "}
                        <Text style={styles.infoHighlight}>{currentUser.jobTitle}</Text>
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.infoItem}>
                    <Ionicons name="calendar-outline" size={14} color="#64748b" />
                    <Text style={styles.infoText}>
                      Ngày tham gia: {formatDate(currentUser.createdAt)}
                    </Text>
                  </View>

                  {canManage && (
                    <TouchableOpacity
                      style={styles.editProfileBtn}
                      onPress={() => setIsEditing(true)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="create-outline" size={14} color="#0284c7" />
                      <Text style={styles.editProfileBtnText}>
                        Chỉnh sửa thông tin thành viên
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                /* Inline Edit Form */
                <View style={styles.editFormContainer}>
                  <Text style={styles.editFormTitle}>Chỉnh sửa thông tin</Text>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Họ và tên</Text>
                    <TextInput
                      style={styles.input}
                      value={draftName}
                      onChangeText={setDraftName}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Số điện thoại</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="phone-pad"
                      value={draftPhone}
                      onChangeText={setDraftPhone}
                    />
                  </View>

                  <DropdownSelectField
                    label="Chi nhánh công tác"
                    value={
                      branches.find((b) => b._id === draftBranchId)?.name ||
                      "Toàn viện / Chưa gán"
                    }
                    icon="business-outline"
                    iconColor="#0284c7"
                    iconBgColor="#e0f2fe"
                    onPress={() => setShowBranchPicker(true)}
                  />

                  {departments.length > 0 ? (
                    <DropdownSelectField
                      label="Khoa / Phòng ban"
                      value={draftDept || "Chưa chọn phòng ban"}
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
                        value={draftDept}
                        onChangeText={setDraftDept}
                      />
                    </View>
                  )}

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Chức vụ / Vị trí</Text>
                    <TextInput
                      style={styles.input}
                      value={draftJobTitle}
                      onChangeText={setDraftJobTitle}
                    />
                  </View>

                  <View style={styles.editButtonsRow}>
                    <AppButton
                      title="Hủy"
                      variant="secondary"
                      size="sm"
                      onPress={() => setIsEditing(false)}
                      style={{ flex: 1 }}
                      disabled={updating}
                    />
                    <AppButton
                      title="Lưu thay đổi"
                      variant="primary"
                      size="sm"
                      icon="save-outline"
                      onPress={handleSaveProfile}
                      loading={updating}
                      style={{ flex: 1.5 }}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Quick Role Switcher (Quyền hạn) */}
            {canManage && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#059669" />
                  <Text style={styles.sectionTitle}>Chuyển quyền vai trò</Text>
                  {updating && <ActivityIndicator size="small" color="#059669" />}
                </View>

                <View style={styles.rolesRow}>
                  {ROLES_ORDER.map((r) => {
                    const cfg = ROLE_MAP[r];
                    const isSelected = currentUser.role === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.roleChip,
                          { borderColor: cfg.border, backgroundColor: cfg.bg },
                          isSelected && {
                            backgroundColor: cfg.color,
                            borderColor: cfg.color,
                          },
                        ]}
                        onPress={() => handleChangeRole(r)}
                        disabled={updating}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={cfg.icon}
                          size={12}
                          color={isSelected ? "#ffffff" : cfg.color}
                        />
                        <Text
                          style={[
                            styles.roleChipText,
                            { color: cfg.color },
                            isSelected && { color: "#ffffff", fontWeight: "700" },
                          ]}
                        >
                          {cfg.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Danger Zone: Delete User */}
            {canManage && currentUser.role !== "superadmin" && (
              <View style={styles.deleteSection}>
                <AppButton
                  title="Xóa tài khoản này"
                  variant="outline"
                  size="sm"
                  icon="trash-outline"
                  textStyle={{ color: "#dc2626" }}
                  style={{ borderColor: "#fca5a5" }}
                  onPress={handleDelete}
                  loading={deleting}
                />
              </View>
            )}
          </ScrollView>

          {/* Sub-picker: Chi nhánh khi chỉnh sửa */}
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
                      draftBranchId === "" && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setDraftBranchId("");
                      setShowBranchPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        draftBranchId === "" && styles.pickerItemTextActive,
                      ]}
                    >
                      -- Toàn viện / Chưa gán --
                    </Text>
                    {draftBranchId === "" && (
                      <Ionicons name="checkmark" size={18} color="#059669" />
                    )}
                  </TouchableOpacity>

                  {branches.map((b) => (
                    <TouchableOpacity
                      key={b._id}
                      style={[
                        styles.pickerItem,
                        draftBranchId === b._id && styles.pickerItemActive,
                      ]}
                      onPress={() => {
                        setDraftBranchId(b._id);
                        setShowBranchPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          draftBranchId === b._id && styles.pickerItemTextActive,
                        ]}
                      >
                        {b.name}
                      </Text>
                      {draftBranchId === b._id && (
                        <Ionicons name="checkmark" size={18} color="#059669" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Sub-picker: Phòng ban khi chỉnh sửa */}
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
                        draftDept === d.name && styles.pickerItemActive,
                      ]}
                      onPress={() => {
                        setDraftDept(d.name);
                        setShowDeptPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          draftDept === d.name && styles.pickerItemTextActive,
                        ]}
                      >
                        {d.name}
                      </Text>
                      {draftDept === d.name && (
                        <Ionicons name="checkmark" size={18} color="#059669" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        </KeyboardAvoidingView>
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
    backgroundColor: "#f8fafc",
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
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    padding: 16,
    gap: 12,
  },
  profileCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f0fdf4",
    borderWidth: 1.5,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#16a34a",
  },
  profileName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  profileEmail: {
    fontSize: 12.5,
    color: "#64748b",
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
    gap: 5,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  callBtn: {
    backgroundColor: "#059669",
  },
  smsBtn: {
    backgroundColor: "#0284c7",
  },
  emailBtn: {
    backgroundColor: "#6366f1",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  infoList: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 12.5,
    color: "#475569",
    flex: 1,
  },
  infoHighlight: {
    fontWeight: "600",
    color: "#0f172a",
  },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 10,
    paddingVertical: 8,
    gap: 6,
    marginTop: 8,
  },
  editProfileBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#0284c7",
  },
  editFormContainer: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
    gap: 10,
  },
  editFormTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 2,
  },
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  input: {
    height: 40,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#0f172a",
  },
  editButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1e293b",
    flex: 1,
  },
  rolesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  deleteSection: {
    marginTop: 4,
    marginBottom: 12,
    alignItems: "center",
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
  pickerItemText: {
    fontSize: 13.5,
    color: "#334155",
  },
  pickerItemTextActive: {
    color: "#059669",
    fontWeight: "600",
  },
});
