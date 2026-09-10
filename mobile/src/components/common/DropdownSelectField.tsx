import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface DropdownSelectFieldProps {
  label?: string;
  required?: boolean;
  value?: string;
  placeholder?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBgColor?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const DropdownSelectField: React.FC<DropdownSelectFieldProps> = ({
  label,
  required = false,
  value,
  placeholder = "Chọn giá trị...",
  icon = "chevron-forward-outline",
  iconColor = "#059669",
  iconBgColor = "#ecfdf5",
  onPress,
  disabled = false,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <View style={styles.left}>
          <View style={[styles.iconCircle, { backgroundColor: iconBgColor }]}>
            <Ionicons name={icon} size={14} color={iconColor} />
          </View>
          <Text
            style={[styles.valueText, !value && styles.placeholderText]}
            numberOfLines={1}
          >
            {value || placeholder}
          </Text>
        </View>

        <Ionicons name="chevron-down" size={17} color="#64748b" />
      </TouchableOpacity>
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
  button: {
    height: 44,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  buttonDisabled: {
    backgroundColor: "#f1f5f9",
    opacity: 0.6,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 8,
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
});
