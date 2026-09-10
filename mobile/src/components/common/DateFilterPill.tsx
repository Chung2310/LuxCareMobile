import React, { useState } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DatePickerModal, formatDateVN } from "../../features/credentials/DatePickerModal";

export interface DateFilterPillProps {
  value: string; // YYYY-MM-DD or ""
  onChange: (dateStr: string) => void;
  title?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export const DateFilterPill: React.FC<DateFilterPillProps> = ({
  value,
  onChange,
  title = "Lọc theo ngày",
  label = "Ngày",
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatted = value ? formatDateVN(value) : "";
  const isActive = Boolean(value);

  const handleClear = (e: any) => {
    e?.stopPropagation?.();
    onChange("");
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.pill, isActive && styles.pillActive, style]}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="calendar-outline"
          size={13}
          color={isActive ? "#059669" : "#64748b"}
        />
        <Text style={[styles.text, isActive && styles.textActive]}>
          {isActive ? `${label}: ${formatted}` : "Lọc ngày"}
        </Text>

        {isActive && (
          <TouchableOpacity onPress={handleClear} hitSlop={8} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={14} color="#059669" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <DatePickerModal
        visible={isOpen}
        value={value}
        title={title}
        allowClear
        onClose={() => setIsOpen(false)}
        onChange={(newDate: string) => {
          onChange(newDate);
          setIsOpen(false);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pillActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  textActive: {
    color: "#059669",
    fontWeight: "700",
  },
  clearBtn: {
    padding: 1,
    marginLeft: 2,
  },
});
