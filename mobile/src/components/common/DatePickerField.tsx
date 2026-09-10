import React, { useState } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DatePickerModal, formatDateVN } from "../../features/credentials/DatePickerModal";

export interface DatePickerFieldProps {
  label?: string;
  required?: boolean;
  value: string; // YYYY-MM-DD or ""
  onChange: (dateStr: string) => void;
  title?: string;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  buttonStyle?: StyleProp<ViewStyle>;
}

export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  label,
  required = false,
  value,
  onChange,
  title,
  placeholder = "Chọn ngày...",
  allowClear = false,
  disabled = false,
  style,
  buttonStyle,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatted = value ? formatDateVN(value) : "";

  const handleClear = (e: any) => {
    e?.stopPropagation?.();
    onChange("");
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.triggerBtn, disabled && styles.triggerBtnDisabled, buttonStyle]}
        onPress={() => !disabled && setIsOpen(true)}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <View style={styles.contentLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="calendar-outline" size={15} color="#059669" />
          </View>
          <Text
            style={[styles.valueText, !formatted && styles.placeholderText]}
            numberOfLines={1}
          >
            {formatted || placeholder}
          </Text>
        </View>

        <View style={styles.contentRight}>
          {allowClear && Boolean(value) && (
            <TouchableOpacity onPress={handleClear} hitSlop={8} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
          <Ionicons name="chevron-down" size={16} color="#94a3b8" />
        </View>
      </TouchableOpacity>

      <DatePickerModal
        visible={isOpen}
        value={value}
        title={title || label || "Chọn ngày"}
        allowClear={allowClear}
        onClose={() => setIsOpen(false)}
        onChange={(newDate: string) => {
          onChange(newDate);
          setIsOpen(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#475569",
  },
  required: {
    color: "#dc2626",
  },
  triggerBtn: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  triggerBtnDisabled: {
    backgroundColor: "#f1f5f9",
    opacity: 0.6,
  },
  contentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    flex: 1,
  },
  placeholderText: {
    color: "#94a3b8",
    fontWeight: "400",
  },
  contentRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clearBtn: {
    padding: 2,
  },
});
