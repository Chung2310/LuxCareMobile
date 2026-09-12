// @refresh reset
import { useRoleOptions } from "../../features/roles/useRoleOptions";
import { roleTitle } from "../../features/roles/model";
import { useSession } from "../../auth/SessionProvider";
import { useAppAlert } from "../AppAlert";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  Award,
  DollarSign,
  Layers,
  ShieldCheck,
  FileText,
  X,
  Edit3,
  ExternalLink,
  Trash2,
} from "lucide-react-native";
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


const normalizePhone = (phone?: string | null): string => {
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
};

const normalizeDateInput = (val?: any): string => {
  if (!val) return "";
  const str = String(val).trim();
  if (!str) return "";

  // If ISO timestamp format (e.g. 2026-09-02T00:00:00.000Z)
  if (str.includes("T")) {
    const part = str.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
  }

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // General Date parse
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return str.slice(0, 10);
};

// Keep visibility checks outside the component that owns hooks.
export const UserDetailModal: React.FC<UserDetailModalProps> = (props) => {
  if (!props.visible || !props.user) return null;

  return <UserDetailContent {...props} key={props.user.uid} user={props.user} />;
};

type UserDetailContentProps = Omit<UserDetailModalProps, "user"> & { user: UserProfile };

const UserDetailContent: React.FC<UserDetailContentProps> = ({
  visible,
  user,
  onClose,
  onUpdate,
  onDelete,
  branches,
  departments = [],
  canManage = true,
}) => {
  const { showAlert, alertView } = useAppAlert();
  const { user: actor } = useSession();
  const roleOptions = useRoleOptions(visible, user.companyCode);
  const roleLabel = (code: string) => { const option = roleOptions.roles.find(item => item.role === code); return option ? roleTitle(option) : ROLE_MAP[code]?.label || code; };
  const [currentUser, setCurrentUser] = useState<UserProfile>(user);
  const [isEditing, setIsEditing] = useState(false);

  // Edit draft states
  const [draftName, setDraftName] = useState(user.displayName || "");
  const [draftPhone, setDraftPhone] = useState(normalizePhone(user.phone));
  const [draftDept, setDraftDept] = useState(user.department || "");
  const [draftBranchId, setDraftBranchId] = useState(user.branchId || "");
  const [draftBirthDate, setDraftBirthDate] = useState(normalizeDateInput(user.birthDate));
  const [draftSalary, setDraftSalary] = useState(
    user.monthlySalary ? String(user.monthlySalary) : "",
  );
  const [draftIsLeader, setDraftIsLeader] = useState(!!user.isLeader);
  const [draftJdLink, setDraftJdLink] = useState(user.jobDescriptionLink || "");

  // Sub pickers
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showDeptPicker, setShowDeptPicker] = useState(false);

  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  React.useEffect(() => {
    if (user) {
      setCurrentUser(user);
      setDraftName(user.displayName || "");
      setDraftPhone(normalizePhone(user.phone));
      setDraftDept(user.department || "");
      setDraftBranchId(user.branchId || "");
      setDraftBirthDate(normalizeDateInput(user.birthDate));
      setDraftSalary(user.monthlySalary ? String(user.monthlySalary) : "");
      setDraftIsLeader(!!user.isLeader);
      setDraftJdLink(user.jobDescriptionLink || "");
      setIsEditing(false);
    }
  }, [user]);

  const roleConfig = { ...(ROLE_MAP[currentUser.role] || ROLE_MAP.user), label: roleLabel(currentUser.role) };

  const branchObj = branches.find(
    (b) => b._id === (currentUser.branchId || draftBranchId),
  );
  const branchDisplayName =
    currentUser.branchName || branchObj?.name || "Toàn viện / Chưa gán";

  const formatDate = (dateStr?: any) => {
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
  };

  const formatVND = (val?: number) => {
    if (!val || val <= 0) return "Chưa thiết lập";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(val);
  };

  const handleOpenJd = () => {
    if (!currentUser.jobDescriptionLink) return;
    let url = currentUser.jobDescriptionLink.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    Linking.openURL(url).catch(() => {
      showAlert("Lỗi", "Không thể mở liên kết mô tả công việc.", undefined, "error");
    });
  };

  const handleChangeRole = (newRole: UserRole) => {
    if (newRole === currentUser.role) return;

    const newRoleCfg = { ...(ROLE_MAP[newRole] || ROLE_MAP.user), label: roleLabel(newRole) };
    showAlert(
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
              showAlert(
                "Thành công",
                `Đã cập nhật vai trò thành "${newRoleCfg.label}".`, undefined, "success",
              );
            } catch (err: any) {
              showAlert("Lỗi cập nhật", err.message || "Không thể đổi vai trò.", undefined, "error");
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
      showAlert("Thiếu thông tin", "Vui lòng nhập họ và tên (tối thiểu 2 ký tự).", undefined, "error");
      return;
    }

    const rawPhone = normalizePhone(draftPhone);
    const cleanedPhone = rawPhone.replace(/[\s.\-()]/g, "");
    if (cleanedPhone) {
      const phoneRegex = /^(\+84|84|0)[0-9]{8,11}$/;
      if (!phoneRegex.test(cleanedPhone)) {
        showAlert(
          "Số điện thoại không hợp lệ",
          "Số điện thoại không đúng định dạng (Ví dụ: 0912345678 hoặc +84912345678).",
          undefined,
          "error",
        );
        return;
      }
    }

    const parsedSalary = draftSalary.trim()
      ? Number(draftSalary.replace(/[^0-9]/g, ""))
      : undefined;

    let formattedBirthDate: string | undefined = undefined;
    if (draftBirthDate.trim()) {
      const normalized = normalizeDateInput(draftBirthDate.trim());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        showAlert(
          "Ngày sinh không hợp lệ",
          "Vui lòng nhập ngày sinh theo định dạng YYYY-MM-DD (Ví dụ: 1995-08-20).",
          undefined,
          "error",
        );
        return;
      }
      formattedBirthDate = normalized;
    }

    setUpdating(true);
    try {
      const selectedBranchObj = branches.find((b) => b._id === draftBranchId);
      await onUpdate(currentUser.uid, {
        displayName: trimmedName,
        phone: cleanedPhone || undefined,
        department: draftDept || undefined,
        division: currentUser.division || undefined,
        jobTitle: currentUser.jobTitle || undefined,
        branchId: draftBranchId || undefined,
        birthDate: formattedBirthDate,
        isLeader: draftIsLeader,
        monthlySalary: parsedSalary,
        jobDescriptionLink: draftJdLink.trim() || undefined,
      });

      setCurrentUser((prev) => ({
        ...prev,
        displayName: trimmedName,
        phone: cleanedPhone,
        department: draftDept,
        branchId: draftBranchId,
        branchName: selectedBranchObj ? selectedBranchObj.name : prev.branchName,
        birthDate: formattedBirthDate || prev.birthDate,
        isLeader: draftIsLeader,
        monthlySalary:
          parsedSalary !== undefined ? parsedSalary : prev.monthlySalary,
        jobDescriptionLink: draftJdLink.trim() || prev.jobDescriptionLink,
      }));

      setIsEditing(false);
      showAlert("Thành công", "Đã cập nhật thông tin thành viên.", undefined, "success");
    } catch (err: any) {
      showAlert("Lỗi cập nhật", err.message || "Không thể lưu thông tin.", undefined, "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = () => {
    showAlert(
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
              showAlert("Lỗi", err.message || "Không thể xóa tài khoản.", undefined, "error");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalOverlay} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
        >
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {currentUser.displayName || "Chi tiết người dùng"}
              </Text>
              <Text style={styles.headerSubtitle}>
                Hồ sơ tài khoản & phân quyền nhân sự
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Primary Profile Identity Card */}
            <View style={styles.profileCard}>
              <View style={styles.profileTop}>
                {currentUser.photoURL ? (
                  <Image
                    source={{ uri: currentUser.photoURL }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                      {currentUser.displayName
                        ? currentUser.displayName[0].toUpperCase()
                        : "U"}
                    </Text>
                  </View>
                )}

                <View style={styles.profileMetaCol}>
                  <View style={styles.nameRow}>
                    <Text style={styles.profileName} numberOfLines={1}>
                      {currentUser.displayName || "Chưa đặt tên"}
                    </Text>
                  </View>
                  <Text style={styles.profileEmail} numberOfLines={1}>
                    {currentUser.email}
                  </Text>

                  <View style={styles.badgesRow}>
                    {/* Role badge */}
                    <View
                      style={[
                        styles.roleBadge,
                        {
                          backgroundColor: roleConfig.bg,
                          borderColor: roleConfig.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={roleConfig.icon}
                        size={12}
                        color={roleConfig.color}
                      />
                      <Text
                        style={[styles.roleText, { color: roleConfig.color }]}
                      >
                        {roleConfig.label}
                      </Text>
                    </View>

                    {/* Active Status tag */}
                    <View style={styles.statusBadge}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>
                        {currentUser.status === "online"
                          ? "Trực tuyến"
                          : "Hoạt động"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Display Mode (Full Info) vs Edit Mode */}
            {!isEditing ? (
              <>
                {/* 1. Vị trí & Cơ cấu tổ chức */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <View
                      style={[styles.sectionIconWrap, { backgroundColor: "#eff6ff" }]}
                    >
                      <Building2 size={15} color="#2563eb" />
                    </View>
                    <Text style={styles.sectionTitle}>
                      Đơn vị & Cơ cấu tổ chức
                    </Text>
                  </View>

                  <View style={styles.infoGroup}>
                    <InfoRow
                      icon={Building2}
                      iconColor="#0284c7"
                      label="Chi nhánh công tác"
                      value={branchDisplayName}
                      highlight
                    />
                    <InfoRow
                      icon={Layers}
                      iconColor="#7c3aed"
                      label="Khoa / Phòng ban"
                      value={currentUser.department || "Chưa phân khoa"}
                      highlight
                    />
                    <InfoRow
                      icon={Building2}
                      iconColor="#64748b"
                      label="Đơn vị quản lý"
                      value={
                        currentUser.companyName ||
                        currentUser.companyCode ||
                        "Hệ thống LuxCare"
                      }
                    />
                  </View>
                </View>

                {/* 2. Thông tin cá nhân & Liên hệ */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <View
                      style={[styles.sectionIconWrap, { backgroundColor: "#f0fdf4" }]}
                    >
                      <User size={15} color="#16a34a" />
                    </View>
                    <Text style={styles.sectionTitle}>
                      Thông tin cá nhân & Liên hệ
                    </Text>
                  </View>

                  <View style={styles.infoGroup}>
                    <InfoRow
                      icon={Phone}
                      iconColor="#059669"
                      label="Số điện thoại"
                      value={currentUser.phone || "Chưa cập nhật"}
                      highlight={!!currentUser.phone}
                    />
                    <InfoRow
                      icon={Mail}
                      iconColor="#2563eb"
                      label="Email tài khoản"
                      value={currentUser.email}
                    />
                    <InfoRow
                      icon={Calendar}
                      iconColor="#ea580c"
                      label="Ngày sinh"
                      value={formatDate(currentUser.birthDate)}
                    />
                    <InfoRow
                      icon={Award}
                      iconColor="#9333ea"
                      label="Trình độ chuyên môn"
                      value={currentUser.qualification || "Chưa cập nhật"}
                    />
                  </View>
                </View>

                {/* 3. Hệ thống & Hợp đồng */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <View
                      style={[styles.sectionIconWrap, { backgroundColor: "#f8fafc" }]}
                    >
                      <FileText size={15} color="#475569" />
                    </View>
                    <Text style={styles.sectionTitle}>Hệ thống & Đãi ngộ</Text>
                  </View>

                  <View style={styles.infoGroup}>
                    <InfoRow
                      icon={Calendar}
                      iconColor="#0284c7"
                      label="Ngày tham gia hệ thống"
                      value={formatDate(currentUser.createdAt)}
                    />
                    <InfoRow
                      icon={DollarSign}
                      iconColor="#059669"
                      label="Mức lương cơ bản"
                      value={
                        currentUser.monthlySalary
                          ? formatVND(currentUser.monthlySalary)
                          : "Thỏa thuận / Chưa thiết lập"
                      }
                    />
                    {currentUser.jobDescriptionLink ? (
                      <InfoRow
                        icon={ExternalLink}
                        iconColor="#2563eb"
                        label="Bản mô tả công việc (JD)"
                        value="Xem tài liệu JD"
                        action={{
                          label: "Mở liên kết",
                          onPress: handleOpenJd,
                        }}
                      />
                    ) : null}
                  </View>
                </View>

                {/* Edit Button */}
                {canManage && (
                  <TouchableOpacity
                    style={styles.editProfileBtn}
                    onPress={() => setIsEditing(true)}
                    activeOpacity={0.8}
                  >
                    <Edit3 size={15} color="#0284c7" />
                    <Text style={styles.editProfileBtnText}>
                      Chỉnh sửa hồ sơ thành viên
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              /* Inline Edit Form */
              <View style={styles.editFormContainer}>
                <View style={styles.editFormHeader}>
                  <View
                    style={[styles.sectionIconWrap, { backgroundColor: "#e0f2fe" }]}
                  >
                    <Edit3 size={15} color="#0284c7" />
                  </View>
                  <Text style={styles.editFormTitle}>
                    Cập nhật thông tin thành viên
                  </Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Họ và tên <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={draftName}
                    onChangeText={setDraftName}
                    placeholder="Nhập họ và tên"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Số điện thoại</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="phone-pad"
                    value={draftPhone}
                    onChangeText={setDraftPhone}
                    placeholder="Ví dụ: 0912345678"
                    placeholderTextColor="#94a3b8"
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
                      placeholder="Nhập tên khoa / phòng ban"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                )}

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Ngày sinh (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={draftBirthDate}
                    onChangeText={setDraftBirthDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Mức lương cơ bản (VNĐ)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={draftSalary}
                    onChangeText={setDraftSalary}
                    placeholder="Nhập mức lương (ví dụ: 15000000)"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Liên kết bản mô tả công việc (JD)
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={draftJdLink}
                    onChangeText={setDraftJdLink}
                    placeholder="https://..."
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>Trưởng đơn vị / Leader</Text>
                    <Text style={styles.switchSublabel}>
                      Kích hoạt vai trò quản lý phụ trách bộ phận
                    </Text>
                  </View>
                  <Switch
                    value={draftIsLeader}
                    onValueChange={setDraftIsLeader}
                    trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
                    thumbColor={draftIsLeader ? "#0284c7" : "#f1f5f9"}
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

            {/* Quick Role Switcher (Quyền hạn) */}
            {canManage && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[styles.sectionIconWrap, { backgroundColor: "#ecfdf5" }]}
                  >
                    <ShieldCheck size={15} color="#059669" />
                  </View>
                  <Text style={styles.sectionTitle}>Chuyển quyền vai trò</Text>
                  {updating && <ActivityIndicator size="small" color="#059669" />}
                </View>

                <View style={styles.rolesRow}>
                  {!!roleOptions.error && <Text style={{ color: "#b91c1c" }}>{roleOptions.error}</Text>}
                  {(currentUser.uid === actor?.uid ? [] : roleOptions.assignable).map((option) => {
                    const r = option.role;
                    const cfg = { ...(ROLE_MAP[r] || ROLE_MAP.user), label: roleTitle(option) };
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
        {alertView}
      </SafeAreaView>
    </Modal>
  );
};

// Reusable Info Row Component
function InfoRow({
  icon: IconComponent,
  iconColor = "#64748b",
  label,
  value,
  highlight,
  action,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  iconColor?: string;
  label: string;
  value?: string | React.ReactNode;
  highlight?: boolean;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconBox}>
        <IconComponent size={14} color={iconColor} />
      </View>
      <View style={styles.infoContentCol}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text
          style={[styles.infoValue, highlight && styles.infoValueHighlight]}
          numberOfLines={2}
        >
          {value || "Chưa cập nhật"}
        </Text>
      </View>
      {action && (
        <TouchableOpacity
          style={styles.infoActionBtn}
          onPress={action.onPress}
          activeOpacity={0.7}
        >
          <Text style={styles.infoActionBtnText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
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
    paddingHorizontal: 20,
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
    gap: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#ecfdf5",
    borderWidth: 1.5,
    borderColor: "#a7f3d0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#059669",
  },
  profileMetaCol: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileName: {
    fontSize: 16.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  profileEmail: {
    fontSize: 12.5,
    color: "#64748b",
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "600",
  },
  leaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 3,
  },
  leaderBadgeText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#b45309",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16a34a",
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#16a34a",
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
    gap: 8,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 8,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1e293b",
    flex: 1,
  },
  infoGroup: {
    gap: 9,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  infoContentCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748b",
  },
  infoValue: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
    marginTop: 1,
  },
  infoValueHighlight: {
    fontWeight: "600",
    color: "#0f172a",
  },
  infoActionBtn: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  infoActionBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1d4ed8",
  },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 12,
    paddingVertical: 10,
    gap: 7,
  },
  editProfileBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0284c7",
  },
  editFormContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  editFormHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 8,
    marginBottom: 4,
  },
  editFormTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  requiredStar: {
    color: "#ef4444",
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 4,
  },
  switchLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#1e293b",
  },
  switchSublabel: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  editButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
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
    marginBottom: 16,
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
