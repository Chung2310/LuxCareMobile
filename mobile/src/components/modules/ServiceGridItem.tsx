import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ServiceItem } from "./types";
import { useCommunication, communicationBadge } from "../../features/notifications/CommunicationProvider";

interface ServiceGridItemProps {
  item: ServiceItem;
  onPress: (item: ServiceItem) => void;
  widthPercentage?: "25%" | "33.33%" | "50%";
  iconSize?: number;
}

export const ServiceGridItem: React.FC<ServiceGridItemProps> = ({
  item,
  onPress,
  widthPercentage = "25%",
  iconSize = 25,
}) => {
  const { blogUnread, chatUnread } = useCommunication();
  const badge = communicationBadge(item.route, blogUnread, chatUnread, item.badge);
  return (
    <TouchableOpacity
      style={[styles.container, { width: widthPercentage }]}
      onPress={() => onPress(item)}
      activeOpacity={0.72}
    >
      <View style={[styles.iconBox, { backgroundColor: item.bgColor }]}>
        <Ionicons name={item.icon} size={iconSize} color={item.color} />
        {Boolean(badge) && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: 4,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  title: {
    fontSize: 12,
    fontWeight: "500",
    color: "#1e293b",
    textAlign: "center",
    lineHeight: 16,
  },
});
