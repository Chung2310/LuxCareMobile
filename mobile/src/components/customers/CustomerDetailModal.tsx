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
import { STATUS_MAP, SOURCE_LABELS } from "./CustomerCard";
import type {
  CustomerLeadItem,
  CustomerLeadStatus,
  UpdateCustomerLeadInput,
} from "../../api/customerLeadApi";

interface CustomerDetailModalProps {
  visible: boolean;
  lead: CustomerLeadItem | null;
  onClose: () => void;
  onUpdate: (id: string, data: UpdateCustomerLeadInput) => Promise<CustomerLeadItem>;
  onDelete: (id: string) => Promise<void>;
}

const STATUS_LIST: CustomerLeadStatus[] = [
  "new",
  "contacted",
  "in_consultation",
  "converted",
  "cancelled",
];

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  visible,
  lead,
  onClose,
  onUpdate,
  onDelete,
}) => {
  if (!lead) return null;

  const [currentLead, setCurrentLead] = useState<CustomerLeadItem>(lead);
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync state when prop lead changes
  React.useEffect(() => {
    if (lead) setCurrentLead(lead);
  }, [lead]);

  const statusConfig = STATUS_MAP[currentLead.status] || STATUS_MAP.new;

  const handleCall = () => {
    if (!currentLead.phone) return;
    Linking.openURL(`tel:${currentLead.phone}`).catch(() => {
      Alert.alert("Lỗi", "Không thể thực hiện cuộc gọi trên thiết bị này.");
    });
  };

  const handleSms = () => {
    if (!currentLead.phone) return;
    Linking.openURL(`sms:${currentLead.phone}`).catch(() => {
      Alert.alert("Lỗi", "Không thể gửi tin nhắn trên thiết bị này.");
    });
  };

  const handleChangeStatus = async (newStatus: CustomerLeadStatus) => {
    if (newStatus === currentLead.status) return;
    setUpdatingStatus(true);
    try {
      const updated = await onUpdate(currentLead._id, { status: newStatus });
      setCurrentLead(updated);
    } catch (err: any) {
      Alert.alert("Lỗi cập nhật", err.message || "Không thể cập nhật trạng thái.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async () => {
    const trimmed = newNote.trim();
    if (!trimmed) {
      Alert.alert("Lỗi", "Vui lòng nhập nội dung ghi chú chăm sóc.");
      return;
    }

    setSubmittingNote(true);
    try {
      const updated = await onUpdate(currentLead._id, { addNote: trimmed });
      setCurrentLead(updated);
      setNewNote("");
    } catch (err: any) {
      Alert.alert("Lỗi", err.message || "Không thể thêm ghi chú.");
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Xác nhận xóa",
      `Bạn có chắc chắn muốn xóa thông tin khách hàng "${currentLead.fullName}" không?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await onDelete(currentLead._id);
              onClose();
            } catch (err: any) {
              Alert.alert("Lỗi", err.message || "Không thể xóa khách hàng.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const formatDateTime = (dateStr?: string | Date) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return (
        d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) +
        " " +
        d.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      );
    } catch {
      return "";
    }
  };

  const history = currentLead.contactHistory || [];
  // Sort latest first
  const sortedHistory = [...history].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

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
                {currentLead.fullName}
              </Text>
              <Text style={styles.headerSubtitle}>
                Chi tiết thông tin & lịch sử chăm sóc
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
            {/* Lead Primary Card */}
            <View style={styles.profileCard}>
              <View style={styles.profileTop}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {currentLead.fullName ? currentLead.fullName[0].toUpperCase() : "K"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{currentLead.fullName}</Text>
                  <Text style={styles.profilePhone}>{currentLead.phone}</Text>
                </View>
                <View
                  style={[
                    styles.currentStatusBadge,
                    { backgroundColor: statusConfig.bg, borderColor: statusConfig.border },
                  ]}
                >
                  <Text style={[styles.currentStatusText, { color: statusConfig.color }]}>
                    {statusConfig.label}
                  </Text>
                </View>
              </View>

              {/* Quick Actions: Call & SMS */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.callBtn]}
                  onPress={handleCall}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call" size={16} color="#ffffff" />
                  <Text style={styles.actionBtnText}>Gọi điện</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.smsBtn]}
                  onPress={handleSms}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chatbox" size={16} color="#ffffff" />
                  <Text style={styles.actionBtnText}>Gửi SMS</Text>
                </TouchableOpacity>
              </View>

              {/* Extra Lead Info */}
              <View style={styles.infoList}>
                {currentLead.email ? (
                  <View style={styles.infoItem}>
                    <Ionicons name="mail-outline" size={14} color="#64748b" />
                    <Text style={styles.infoText}>{currentLead.email}</Text>
                  </View>
                ) : null}

                {currentLead.address ? (
                  <View style={styles.infoItem}>
                    <Ionicons name="location-outline" size={14} color="#64748b" />
                    <Text style={styles.infoText}>{currentLead.address}</Text>
                  </View>
                ) : null}

                {currentLead.branchName ? (
                  <View style={styles.infoItem}>
                    <Ionicons name="business-outline" size={14} color="#64748b" />
                    <Text style={styles.infoText}>Chi nhánh: {currentLead.branchName}</Text>
                  </View>
                ) : null}

                <View style={styles.infoItem}>
                  <Ionicons name="globe-outline" size={14} color="#64748b" />
                  <Text style={styles.infoText}>
                    Nguồn: {SOURCE_LABELS[currentLead.source] || currentLead.source}
                  </Text>
                </View>

                {currentLead.serviceInterest ? (
                  <View style={styles.infoItem}>
                    <Ionicons name="medkit-outline" size={14} color="#64748b" />
                    <Text style={styles.infoText}>
                      Quan tâm:{" "}
                      <Text style={{ fontWeight: "600", color: "#0f172a" }}>
                        {currentLead.serviceInterest}
                      </Text>
                    </Text>
                  </View>
                ) : null}

                {currentLead.preferredContactTime ? (
                  <View style={styles.infoItem}>
                    <Ionicons name="time-outline" size={14} color="#64748b" />
                    <Text style={styles.infoText}>
                      Giờ liên hệ: {currentLead.preferredContactTime}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.infoItem}>
                  <Ionicons name="calendar-outline" size={14} color="#64748b" />
                  <Text style={styles.infoText}>
                    Ngày tạo: {formatDateTime(currentLead.createdAt)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Status Transition Control */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="swap-horizontal" size={16} color="#059669" />
                <Text style={styles.sectionTitle}>Chuyển trạng thái xử lý</Text>
                {updatingStatus && <ActivityIndicator size="small" color="#059669" />}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View style={styles.statusChipsContainer}>
                  {STATUS_LIST.map((st) => {
                    const cfg = STATUS_MAP[st];
                    const isSelected = currentLead.status === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.statusChip,
                          { borderColor: cfg.border, backgroundColor: cfg.bg },
                          isSelected && {
                            backgroundColor: cfg.color,
                            borderColor: cfg.color,
                          },
                        ]}
                        onPress={() => handleChangeStatus(st)}
                        disabled={updatingStatus}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
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
              </ScrollView>
            </View>

            {/* Add Care Note Field */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="create-outline" size={16} color="#059669" />
                <Text style={styles.sectionTitle}>Ghi chú chăm sóc / Liên hệ mới</Text>
              </View>

              <TextInput
                style={styles.noteInput}
                placeholder="Nhập nội dung đã trao đổi, tư vấn, hẹn tái khám..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                value={newNote}
                onChangeText={setNewNote}
              />

              <View style={styles.noteActionRow}>
                <AppButton
                  title="Thêm ghi chú"
                  variant="primary"
                  size="sm"
                  icon="add-circle-outline"
                  onPress={handleAddNote}
                  loading={submittingNote}
                  disabled={!newNote.trim()}
                />
              </View>
            </View>

            {/* Timeline of Contact History */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="time-outline" size={16} color="#059669" />
                <Text style={styles.sectionTitle}>
                  Lịch sử chăm sóc ({sortedHistory.length})
                </Text>
              </View>

              {sortedHistory.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <Text style={styles.emptyHistoryText}>
                    Chưa có lịch sử chăm sóc nào cho khách hàng này.
                  </Text>
                </View>
              ) : (
                <View style={styles.timelineContainer}>
                  {sortedHistory.map((item, idx) => {
                    const itemCfg =
                      STATUS_MAP[item.status as CustomerLeadStatus] || STATUS_MAP.new;
                    const isLast = idx === sortedHistory.length - 1;
                    return (
                      <View key={idx} style={styles.timelineItem}>
                        <View style={styles.timelineTrack}>
                          <View
                            style={[
                              styles.timelineDot,
                              { backgroundColor: itemCfg.color },
                            ]}
                          />
                          {!isLast && <View style={styles.timelineLine} />}
                        </View>

                        <View style={styles.timelineContent}>
                          <View style={styles.timelineHeader}>
                            <Text style={styles.timelineDate}>
                              {formatDateTime(item.date)}
                            </Text>
                            <View
                              style={[
                                styles.timelineStatusBadge,
                                { backgroundColor: itemCfg.bg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.timelineStatusText,
                                  { color: itemCfg.color },
                                ]}
                              >
                                {itemCfg.label}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.timelineNote}>{item.note}</Text>

                          {item.updatedBy?.displayName ? (
                            <Text style={styles.timelineAuthor}>
                              Bởi: {item.updatedBy.displayName}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Danger Zone: Delete button */}
            <View style={styles.deleteSection}>
              <AppButton
                title="Xóa khách hàng này"
                variant="outline"
                size="sm"
                icon="trash-outline"
                textStyle={{ color: "#dc2626" }}
                style={{ borderColor: "#fca5a5" }}
                onPress={handleDelete}
                loading={deleting}
              />
            </View>
          </ScrollView>
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
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#ecfdf5",
    borderWidth: 1.5,
    borderColor: "#a7f3d0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#059669",
  },
  profileName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  profilePhone: {
    fontSize: 13,
    fontWeight: "600",
    color: "#059669",
    marginTop: 2,
  },
  currentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  currentStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  callBtn: {
    backgroundColor: "#059669",
  },
  smsBtn: {
    backgroundColor: "#0284c7",
  },
  actionBtnText: {
    fontSize: 13,
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
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1e293b",
    flex: 1,
  },
  statusChipsContainer: {
    flexDirection: "row",
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  noteInput: {
    height: 70,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    textAlignVertical: "top",
    fontSize: 13,
    color: "#0f172a",
    marginTop: 10,
  },
  noteActionRow: {
    alignItems: "flex-end",
    marginTop: 8,
  },
  emptyHistory: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyHistoryText: {
    fontSize: 12.5,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  timelineContainer: {
    marginTop: 12,
  },
  timelineItem: {
    flexDirection: "row",
    minHeight: 50,
  },
  timelineTrack: {
    width: 20,
    alignItems: "center",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 3,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 14,
    paddingLeft: 8,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timelineDate: {
    fontSize: 11.5,
    color: "#64748b",
    fontWeight: "500",
  },
  timelineStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timelineStatusText: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  timelineNote: {
    fontSize: 13,
    color: "#1e293b",
    marginTop: 4,
    lineHeight: 18,
  },
  timelineAuthor: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  deleteSection: {
    marginTop: 6,
    marginBottom: 10,
    alignItems: "center",
  },
});
