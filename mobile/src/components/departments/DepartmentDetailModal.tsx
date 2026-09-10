import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
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
import { Ionicons } from "@expo/vector-icons";
import { AppButton } from "../common";
import {
  getDepartmentCodePalette,
  type DepartmentInput,
  type DepartmentRecord,
} from "./types";
import type { UserProfile } from "../../../../src/types/common";

interface DepartmentDetailModalProps {
  visible: boolean;
  department: DepartmentRecord | null;
  colleagues: UserProfile[];
  canManage: boolean;
  onClose: () => void;
  onSave: (id: string, input: Partial<DepartmentInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onViewOrgChart?: (department: DepartmentRecord) => void;
}

export const DepartmentDetailModal: React.FC<DepartmentDetailModalProps> = ({
  visible,
  department,
  colleagues,
  canManage,
  onClose,
  onSave,
  onDelete,
  onViewOrgChart,
}) => {
  if (!department) return null;

  const [code, setCode] = useState(department.code);
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description || "");
  const [managerUid, setManagerUid] = useState(department.managerUid || "");
  const [managerName, setManagerName] = useState(department.managerName || "");
  const [sortOrder, setSortOrder] = useState(department.sortOrder || 0);
  const [isActive, setIsActive] = useState(department.isActive);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [managerSearchQuery, setManagerSearchQuery] = useState("");

  // Sync state when department changes
  useEffect(() => {
    if (department) {
      setCode(department.code);
      setName(department.name);
      setDescription(department.description || "");
      setManagerUid(department.managerUid || "");
      setManagerName(department.managerName || "");
      setSortOrder(department.sortOrder || 0);
      setIsActive(department.isActive);
    }
  }, [department]);

  const palette = getDepartmentCodePalette(code || name);

  // Filter colleagues for manager selector
  const filteredColleagues = colleagues.filter((c) => {
    const q = managerSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.displayName || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q)
    );
  });

  const handleSave = async () => {
    if (!code.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mã phòng ban.");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên phòng ban.");
      return;
    }

    setSaving(true);
    try {
      await onSave(department._id, {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        managerUid: managerUid || undefined,
        managerName: managerName || undefined,
        sortOrder,
        isActive,
      });
      onClose();
    } catch (err: any) {
      Alert.alert("Lỗi lưu phòng ban", err.message || "Không thể cập nhật phòng ban.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Xác nhận xóa phòng ban",
      `Bạn có chắc chắn muốn xóa phòng ban "${department.name}" (${department.code})? Hành động này không thể hoàn tác.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa vĩnh viễn",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await onDelete(department._id);
              onClose();
            } catch (err: any) {
              Alert.alert("Lỗi xóa phòng ban", err.message || "Không thể xóa phòng ban.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.codePill,
                { backgroundColor: palette.bg, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.codePillText, { color: palette.text }]}>
                {department.code}
              </Text>
            </View>
            <View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {department.name}
              </Text>
              <Text style={styles.headerSubtitle}>Thông tin & phân bổ nhân sự</Text>
            </View>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Status & Quick Metrics Card */}
          <View style={styles.metricsCard}>
            <View style={styles.metricItem}>
              <Text style={styles.metricItemLabel}>Trạng thái</Text>
              <View style={styles.metricStatusRow}>
                <View
                  style={[
                    styles.metricStatusDot,
                    { backgroundColor: isActive ? "#16a34a" : "#94a3b8" },
                  ]}
                />
                <Text
                  style={[
                    styles.metricStatusText,
                    { color: isActive ? "#15803d" : "#64748b" },
                  ]}
                >
                  {isActive ? "Đang hoạt động" : "Tạm ngừng"}
                </Text>
              </View>
            </View>

            <View style={styles.metricsDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricItemLabel}>Thành viên</Text>
              <Text style={styles.metricItemValue}>
                {department.employeeCount ?? 0} <Text style={styles.metricItemSub}>nhân sự</Text>
              </Text>
            </View>

            <View style={styles.metricsDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricItemLabel}>Thứ tự</Text>
              <Text style={styles.metricItemValue}>#{sortOrder}</Text>
            </View>
          </View>

          {/* Action to View Org Chart */}
          {onViewOrgChart && (
            <TouchableOpacity
              style={styles.orgChartBanner}
              onPress={() => {
                onClose();
                onViewOrgChart(department);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.orgChartBannerLeft}>
                <View style={styles.orgChartIconBox}>
                  <Ionicons name="git-network" size={18} color="#059669" />
                </View>
                <View>
                  <Text style={styles.orgChartBannerTitle}>Sơ đồ cây tổ chức</Text>
                  <Text style={styles.orgChartBannerSub}>
                    Xem sơ đồ phân cấp & nhân sự phòng ban này
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#059669" />
            </TouchableOpacity>
          )}

          {/* FORM FIELDS */}
          <View style={styles.formSection}>
            <Text style={styles.sectionHeaderTitle}>Cấu hình thông tin</Text>

            {/* Mã phòng ban */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Mã phòng ban <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, !canManage && styles.inputDisabled]}
                value={code}
                onChangeText={(val) => setCode(val.toUpperCase())}
                placeholder="VD: KHTH, GMHS, TCKT..."
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                editable={canManage}
              />
              <Text style={styles.fieldHint}>
                Mã định danh duy nhất viết in hoa, dùng để phân loại hồ sơ & chấm công.
              </Text>
            </View>

            {/* Tên phòng ban */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Tên phòng ban <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, !canManage && styles.inputDisabled]}
                value={name}
                onChangeText={setName}
                placeholder="VD: Khoa Khám bệnh, Phòng Kế hoạch..."
                placeholderTextColor="#94a3b8"
                editable={canManage}
              />
            </View>

            {/* Mô tả chức năng */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mô tả & chức năng nhiệm vụ</Text>
              <TextInput
                style={[styles.input, styles.textArea, !canManage && styles.inputDisabled]}
                value={description}
                onChangeText={setDescription}
                placeholder="Mô tả chức năng, nhiệm vụ chính của phòng ban..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                editable={canManage}
              />
            </View>

            {/* Trưởng bộ phận (Manager) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Trưởng bộ phận phụ trách</Text>
              <TouchableOpacity
                style={[styles.pickerButton, !canManage && styles.inputDisabled]}
                onPress={() => canManage && setShowManagerPicker(true)}
                disabled={!canManage}
                activeOpacity={0.7}
              >
                <View style={styles.pickerButtonLeft}>
                  <Ionicons
                    name="person-circle-outline"
                    size={20}
                    color={managerUid ? "#059669" : "#94a3b8"}
                  />
                  <Text
                    style={[
                      styles.pickerButtonText,
                      !managerUid && styles.pickerButtonPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {managerName || "Chọn người phụ trách từ danh sách nhân sự"}
                  </Text>
                </View>
                {canManage && (
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                )}
              </TouchableOpacity>
              {Boolean(managerUid) && canManage && (
                <TouchableOpacity
                  style={styles.clearManagerBtn}
                  onPress={() => {
                    setManagerUid("");
                    setManagerName("");
                  }}
                >
                  <Ionicons name="close-circle-outline" size={14} color="#dc2626" />
                  <Text style={styles.clearManagerText}>Bỏ chọn người phụ trách</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Thứ tự sắp xếp */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Thứ tự hiển thị trên danh sách</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepperBtn, !canManage && styles.inputDisabled]}
                  onPress={() => canManage && setSortOrder((v) => Math.max(0, v - 1))}
                  disabled={!canManage || sortOrder <= 0}
                >
                  <Ionicons name="remove" size={18} color="#0f172a" />
                </TouchableOpacity>
                <TextInput
                  style={[styles.stepperInput, !canManage && styles.inputDisabled]}
                  value={String(sortOrder)}
                  onChangeText={(val) => {
                    const num = parseInt(val, 10);
                    setSortOrder(isNaN(num) ? 0 : num);
                  }}
                  keyboardType="numeric"
                  editable={canManage}
                />
                <TouchableOpacity
                  style={[styles.stepperBtn, !canManage && styles.inputDisabled]}
                  onPress={() => canManage && setSortOrder((v) => v + 1)}
                  disabled={!canManage}
                >
                  <Ionicons name="add" size={18} color="#0f172a" />
                </TouchableOpacity>
              </View>
              <Text style={styles.fieldHint}>Số nhỏ hơn sẽ được ưu tiên xếp lên trước.</Text>
            </View>

            {/* Trạng thái hoạt động */}
            {canManage && (
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchTitle}>Trạng thái hoạt động</Text>
                  <Text style={styles.switchSubtitle}>
                    {isActive
                      ? "Phòng ban đang hoạt động bình thường"
                      : "Tạm ngừng hoạt động (ẩn trong danh mục chọn)"}
                  </Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: "#cbd5e1", true: "#a7f3d0" }}
                  thumbColor={isActive ? "#059669" : "#f1f5f9"}
                />
              </View>
            )}
          </View>

          {/* FOOTER ACTIONS */}
          {canManage && (
            <View style={styles.footerActions}>
              <AppButton
                title="Lưu thay đổi"
                variant="primary"
                onPress={handleSave}
                loading={saving}
                icon="save-outline"
              />

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
                disabled={deleting}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color="#dc2626" />
                <Text style={styles.deleteBtnText}>
                  {deleting ? "Đang xóa..." : "Xóa phòng ban này"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* MODAL CHỌN TRƯỞNG BỘ PHẬN */}
        <Modal
          visible={showManagerPicker}
          animationType="slide"
          transparent
          onRequestClose={() => setShowManagerPicker(false)}
        >
          <View style={styles.pickerModalOverlay}>
            <View style={styles.pickerModalBox}>
              <View style={styles.pickerModalHeader}>
                <Text style={styles.pickerModalTitle}>Chọn Trưởng bộ phận</Text>
                <TouchableOpacity
                  onPress={() => setShowManagerPicker(false)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Ô tìm kiếm nhân sự */}
              <View style={styles.pickerSearchRow}>
                <Ionicons name="search" size={16} color="#94a3b8" />
                <TextInput
                  style={styles.pickerSearchInput}
                  placeholder="Tìm theo tên, email, sđt..."
                  placeholderTextColor="#94a3b8"
                  value={managerSearchQuery}
                  onChangeText={setManagerSearchQuery}
                />
                {managerSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setManagerSearchQuery("")}>
                    <Ionicons name="close-circle" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView style={styles.colleagueList}>
                {filteredColleagues.map((c) => {
                  const isSelected = c.uid === managerUid;
                  return (
                    <TouchableOpacity
                      key={c.uid}
                      style={[
                        styles.colleagueItem,
                        isSelected && styles.colleagueItemSelected,
                      ]}
                      onPress={() => {
                        setManagerUid(c.uid);
                        setManagerName(c.displayName || c.email || "Nhân sự");
                        setShowManagerPicker(false);
                      }}
                    >
                      <View style={styles.colleagueAvatar}>
                        <Text style={styles.colleagueAvatarText}>
                          {(c.displayName || c.email || "LC").slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.colleagueInfo}>
                        <Text style={styles.colleagueName}>
                          {c.displayName || "Chưa đặt tên"}
                        </Text>
                        <Text style={styles.colleagueMeta}>
                          {c.email || c.phone || "Không có thông tin liên hệ"}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color="#059669" />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {filteredColleagues.length === 0 && (
                  <View style={styles.emptyColleague}>
                    <Text style={styles.emptyColleagueText}>
                      Không tìm thấy nhân sự phù hợp
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  codePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  codePillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#64748b",
  },
  closeBtn: {
    padding: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  metricsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricItemLabel: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 3,
  },
  metricStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metricStatusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  metricItemValue: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  metricItemSub: {
    fontSize: 11,
    fontWeight: "400",
    color: "#64748b",
  },
  metricsDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#e2e8f0",
  },
  orgChartBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ecfdf5",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    marginBottom: 16,
  },
  orgChartBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  orgChartIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  orgChartBannerTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#065f46",
  },
  orgChartBannerSub: {
    fontSize: 11,
    color: "#059669",
    marginTop: 1,
  },
  formSection: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 14,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  requiredStar: {
    color: "#dc2626",
  },
  fieldHint: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
    lineHeight: 15,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: "#0f172a",
  },
  inputDisabled: {
    backgroundColor: "#f1f5f9",
    color: "#64748b",
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerButtonLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  pickerButtonText: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "500",
  },
  pickerButtonPlaceholder: {
    color: "#94a3b8",
    fontWeight: "400",
  },
  clearManagerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  clearManagerText: {
    fontSize: 11.5,
    color: "#dc2626",
    fontWeight: "500",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperInput: {
    width: 60,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  switchSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  footerActions: {
    gap: 10,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fee2e2",
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#dc2626",
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  pickerModalBox: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    paddingBottom: 24,
  },
  pickerModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  pickerModalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  pickerSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 38,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
  },
  colleagueList: {
    paddingHorizontal: 16,
  },
  colleagueItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  colleagueItemSelected: {
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  colleagueAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  colleagueAvatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  colleagueInfo: {
    flex: 1,
  },
  colleagueName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  colleagueMeta: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  emptyColleague: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyColleagueText: {
    fontSize: 12.5,
    color: "#94a3b8",
  },
});
