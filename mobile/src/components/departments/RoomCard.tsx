import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  ROOM_TYPE_ICONS,
  ROOM_TYPE_LABELS,
  type RoomRecord,
} from "./types";

interface RoomCardProps {
  room: RoomRecord;
  onPress: (room: RoomRecord) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, onPress }) => {
  const typeMeta = ROOM_TYPE_ICONS[room.type] || ROOM_TYPE_ICONS.other;
  const typeLabel = ROOM_TYPE_LABELS[room.type] || "Phòng chức năng";

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(room)}
      activeOpacity={0.8}
    >
      {/* 1. Header: Type Icon + Room Name + Status Pill */}
      <View style={styles.headerRow}>
        <View style={[styles.typeIconBox, { backgroundColor: typeMeta.bg }]}>
          <Ionicons name={typeMeta.icon as any} size={16} color={typeMeta.color} />
        </View>

        <View style={styles.titleCol}>
          <Text style={styles.nameText} numberOfLines={1}>
            {room.name}
          </Text>
          <View style={styles.subCodeRow}>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{room.code}</Text>
            </View>
            <Text style={styles.typeBadgeText}>• {typeLabel}</Text>
          </View>
        </View>

        <View
          style={[
            styles.statusPill,
            room.isActive ? styles.statusActive : styles.statusInactive,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: room.isActive ? "#16a34a" : "#94a3b8" },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: room.isActive ? "#15803d" : "#64748b" },
            ]}
          >
            {room.isActive ? "Hoạt động" : "Tạm ngừng"}
          </Text>
        </View>
      </View>

      {/* 2. Description if any */}
      {Boolean(room.description) && (
        <Text style={styles.descText} numberOfLines={2}>
          {room.description}
        </Text>
      )}

      {/* 3. Info strip: Floor, Equipment count */}
      <View style={styles.infoStrip}>
        <View style={styles.infoItem}>
          <Ionicons name="layers-outline" size={14} color="#64748b" />
          <Text style={styles.infoValue}>
            {room.floor ? `Tầng ${room.floor}` : "Chưa gắn tầng"}
          </Text>
        </View>

        <View style={styles.infoDivider} />

        <View style={styles.infoItem}>
          <Ionicons name="medkit-outline" size={14} color="#7c3aed" />
          <Text style={styles.infoValue}>
            {room.equipmentCount ?? 0} <Text style={styles.infoLabel}>thiết bị y tế</Text>
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  typeIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  titleCol: {
    flex: 1,
  },
  nameText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  subCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  codeBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  codeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  typeBadgeText: {
    fontSize: 11,
    color: "#64748b",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  statusInactive: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  descText: {
    fontSize: 12.5,
    color: "#475569",
    lineHeight: 18,
    marginBottom: 10,
  },
  infoStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 10,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e293b",
  },
  infoLabel: {
    fontWeight: "400",
    color: "#64748b",
  },
  infoDivider: {
    width: 1,
    height: 14,
    backgroundColor: "#cbd5e1",
  },
});
