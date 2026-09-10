import React from "react";
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CustomerLeadItem, CustomerLeadStatus } from "../../api/customerLeadApi";

export const STATUS_MAP: Record<
  CustomerLeadStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  new: {
    label: "Mới tiếp nhận",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  contacted: {
    label: "Đã liên hệ",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
  },
  in_consultation: {
    label: "Đang tư vấn",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  converted: {
    label: "Thành công",
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0",
  },
  cancelled: {
    label: "Đã hủy",
    color: "#64748b",
    bg: "#f1f5f9",
    border: "#cbd5e1",
  },
};

export const SOURCE_LABELS: Record<string, string> = {
  qr_code: "Mã QR",
  manual: "Thủ công tại quầy",
  website: "Website",
  referral: "Người quen giới thiệu",
  direct: "Thủ công tại quầy",
  form: "Biểu mẫu Web",
  phone: "Hotline / Điện thoại",
  external_app: "Ứng dụng ngoài",
};

interface CustomerCardProps {
  lead: CustomerLeadItem;
  onPress: (lead: CustomerLeadItem) => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({ lead, onPress }) => {
  const statusConfig = STATUS_MAP[lead.status] || STATUS_MAP.new;
  const sourceLabel = SOURCE_LABELS[lead.source] || lead.source || "Trực tiếp";

  const handleCall = () => {
    if (!lead.phone) return;
    Linking.openURL(`tel:${lead.phone}`).catch(() => {});
  };

  const formatDate = (dateStr?: string | Date) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (name[0] || "KH").toUpperCase();
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(lead)}
      activeOpacity={0.7}
    >
      {/* Top row: Avatar initial, Name, Date, Status */}
      <View style={styles.headerRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{getInitials(lead.fullName)}</Text>
        </View>

        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={styles.fullName} numberOfLines={1}>
              {lead.fullName}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusConfig.bg, borderColor: statusConfig.border },
              ]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: statusConfig.color }]}
              />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <Text style={styles.dateText}>
            Ngày tạo: {formatDate(lead.createdAt)}
          </Text>
        </View>
      </View>

      {/* Middle row: Phone, Source & Branch */}
      <View style={styles.contactRow}>
        <TouchableOpacity
          style={styles.phoneChip}
          onPress={handleCall}
          activeOpacity={0.7}
        >
          <Ionicons name="call" size={13} color="#059669" />
          <Text style={styles.phoneText}>{lead.phone}</Text>
        </TouchableOpacity>

        <View style={styles.sourceChip}>
          <Ionicons name="globe-outline" size={12} color="#475569" />
          <Text style={styles.sourceText}>{sourceLabel}</Text>
        </View>

        {lead.branchName ? (
          <View style={styles.branchChip}>
            <Ionicons name="business-outline" size={12} color="#0284c7" />
            <Text style={styles.branchText} numberOfLines={1}>
              {lead.branchName}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bottom details: Service interest or latest note */}
      {lead.serviceInterest ? (
        <View style={styles.detailRow}>
          <Ionicons name="medkit-outline" size={13} color="#64748b" />
          <Text style={styles.serviceText} numberOfLines={1}>
            Dịch vụ quan tâm:{" "}
            <Text style={styles.serviceHighlight}>{lead.serviceInterest}</Text>
          </Text>
        </View>
      ) : null}

      {lead.notes ? (
        <View style={styles.notesRow}>
          <Ionicons name="chatbubble-ellipses-outline" size={13} color="#94a3b8" />
          <Text style={styles.notesText} numberOfLines={1}>
            {lead.notes}
          </Text>
        </View>
      ) : null}

      {/* Footer: Detail navigation hint & compact call action */}
      <View style={styles.footerRow}>
        <View style={styles.viewDetailHint}>
          <Text style={styles.tapToViewText}>Xem chi tiết & lịch sử</Text>
          <Ionicons name="chevron-forward" size={12} color="#94a3b8" />
        </View>
        <TouchableOpacity
          style={styles.quickCallBtn}
          onPress={handleCall}
          hitSlop={6}
          activeOpacity={0.75}
        >
          <Ionicons name="call" size={12} color="#059669" />
          <Text style={styles.quickCallText}>Gọi điện</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ecfdf5",
    borderWidth: 1.5,
    borderColor: "#a7f3d0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#059669",
  },
  infoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  fullName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 11.5,
    color: "#94a3b8",
    marginTop: 2,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  phoneChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  phoneText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },
  sourceChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  sourceText: {
    fontSize: 11.5,
    color: "#475569",
  },
  branchChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    maxWidth: 130,
  },
  branchText: {
    fontSize: 11.5,
    color: "#0284c7",
    fontWeight: "500",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
    marginBottom: 4,
  },
  serviceText: {
    fontSize: 12,
    color: "#64748b",
    flex: 1,
  },
  serviceHighlight: {
    fontWeight: "600",
    color: "#1e293b",
  },
  notesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  notesText: {
    fontSize: 11.5,
    color: "#64748b",
    fontStyle: "italic",
    flex: 1,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    marginTop: 10,
    paddingTop: 8,
  },
  viewDetailHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tapToViewText: {
    fontSize: 11.5,
    color: "#64748b",
    fontWeight: "500",
  },
  quickCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  quickCallText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
  },
});
