import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TaskHistoryEntry } from "../../../../src/types/hr";
import {
  parseTaskAction,
  formatHistoryUser,
  formatHistoryTime,
} from "./taskHistoryModel";

export interface TaskHistoryViewProps {
  history?: TaskHistoryEntry[];
}

export const TaskHistoryView: React.FC<TaskHistoryViewProps> = ({ history }) => {
  const [expanded, setExpanded] = useState(false);

  const rawList = history || [];
  // Sort newest first
  const sorted = [...rawList].sort((a, b) => {
    const ta = new Date(a.time).getTime() || 0;
    const tb = new Date(b.time).getTime() || 0;
    return tb - ta;
  });

  const visibleList = expanded ? sorted : sorted.slice(0, 5);
  const hasMore = sorted.length > 5;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <View style={styles.iconBox}>
            <Ionicons name="time" size={15} color="#059669" />
          </View>
          <Text style={styles.sectionTitle}>Lịch sử thao tác</Text>
        </View>
        <View style={styles.badgeCount}>
          <Text style={styles.badgeCountText}>
            {sorted.length > 0 ? `${sorted.length} bản ghi` : "Chưa có"}
          </Text>
        </View>
      </View>

      {/* Empty state */}
      {sorted.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="git-commit-outline" size={26} color="#94a3b8" />
          <Text style={styles.emptyText}>
            Chưa có ghi nhận lịch sử thao tác nào cho công việc này.
          </Text>
        </View>
      ) : (
        <View style={styles.timelineList}>
          {visibleList.map((entry, idx) => {
            const isLatest = idx === 0;
            const isLast = idx === visibleList.length - 1;
            const parsed = parseTaskAction(entry.action);
            const user = formatHistoryUser(entry.user);
            const time = formatHistoryTime(entry.time);

            return (
              <View key={idx} style={styles.timelineRow}>
                {/* Left: Node icon & vertical track */}
                <View style={styles.nodeColumn}>
                  <View
                    style={[
                      styles.nodeCircle,
                      {
                        backgroundColor: parsed.themeBg,
                        borderColor: parsed.themeColor,
                      },
                    ]}
                  >
                    <Ionicons
                      name={parsed.iconName as any}
                      size={12}
                      color={parsed.themeColor}
                    />
                  </View>
                  {!isLast && <View style={styles.connectorLine} />}
                </View>

                {/* Right: Bubble content */}
                <View style={[styles.bubbleCard, isLatest && styles.bubbleLatest]}>
                  {/* Top: User & Relative Time */}
                  <View style={styles.bubbleHeader}>
                    <View style={styles.userRow}>
                      <View
                        style={[styles.userBadgeAvatar, { backgroundColor: user.bg }]}
                      >
                        <Text
                          style={[
                            styles.userBadgeAvatarText,
                            { color: user.color },
                          ]}
                        >
                          {user.initial}
                        </Text>
                      </View>
                      <Text style={styles.userNameText} numberOfLines={1}>
                        {user.name}
                      </Text>
                    </View>

                    <View style={styles.headerRightGroup}>
                      {isLatest && (
                        <View style={styles.latestPill}>
                          <Text style={styles.latestPillText}>Mới nhất</Text>
                        </View>
                      )}
                      <Text style={styles.relativeTimeText}>{time.relative}</Text>
                    </View>
                  </View>

                  {/* Action Title */}
                  <Text style={[styles.actionTitle, { color: parsed.themeColor }]}>
                    {parsed.title}
                  </Text>

                  {/* Transition row or description */}
                  {parsed.fromBadge && parsed.toBadge ? (
                    <View style={styles.transitionRow}>
                      <View
                        style={[
                          styles.pillBadge,
                          { backgroundColor: parsed.fromBadge.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pillBadgeText,
                            { color: parsed.fromBadge.color },
                          ]}
                        >
                          {parsed.fromBadge.label}
                        </Text>
                      </View>
                      <Ionicons
                        name="arrow-forward"
                        size={12}
                        color="#94a3b8"
                        style={{ marginHorizontal: 2 }}
                      />
                      <View
                        style={[
                          styles.pillBadge,
                          { backgroundColor: parsed.toBadge.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pillBadgeText,
                            { color: parsed.toBadge.color, fontWeight: "700" },
                          ]}
                        >
                          {parsed.toBadge.label}
                        </Text>
                      </View>
                    </View>
                  ) : parsed.toBadge ? (
                    <View style={styles.transitionRow}>
                      <View
                        style={[
                          styles.pillBadge,
                          { backgroundColor: parsed.toBadge.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pillBadgeText,
                            { color: parsed.toBadge.color, fontWeight: "700" },
                          ]}
                        >
                          {parsed.toBadge.label}
                        </Text>
                      </View>
                    </View>
                  ) : parsed.description ? (
                    <Text style={styles.descText}>{parsed.description}</Text>
                  ) : null}

                  {/* Bottom: Exact Time Stamp */}
                  <View style={styles.timestampRow}>
                    <Ionicons name="calendar-outline" size={11} color="#94a3b8" />
                    <Text style={styles.timestampText}>{time.full}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Toggle Expand / Collapse */}
          {hasMore && (
            <Pressable
              style={({ pressed }) => [
                styles.expandBtn,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setExpanded(!expanded)}
            >
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={14}
                color="#059669"
              />
              <Text style={styles.expandBtnText}>
                {expanded
                  ? "Thu gọn lịch sử"
                  : `Xem thêm ${sorted.length - 5} thao tác cũ hơn`}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  badgeCount: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeCountText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 6,
  },
  emptyText: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },
  timelineList: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    minHeight: 70,
  },
  nodeColumn: {
    alignItems: "center",
    width: 24,
  },
  nodeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    marginTop: 2,
  },
  connectorLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#e2e8f0",
    marginTop: -2,
    marginBottom: -2,
  },
  bubbleCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    gap: 4,
  },
  bubbleLatest: {
    borderColor: "#a7f3d0",
    backgroundColor: "#f0fdf4",
  },
  bubbleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  userBadgeAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  userBadgeAvatarText: {
    fontSize: 9,
    fontWeight: "800",
  },
  userNameText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b",
    maxWidth: 140,
  },
  headerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  latestPill: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#86efac",
  },
  latestPillText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#15803d",
  },
  relativeTimeText: {
    fontSize: 11,
    color: "#64748b",
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  transitionRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginVertical: 2,
  },
  pillBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
  },
  pillBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  descText: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 17,
  },
  timestampRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  timestampText: {
    fontSize: 10,
    color: "#94a3b8",
  },
  expandBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    marginTop: 2,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
  },
  expandBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },
});
