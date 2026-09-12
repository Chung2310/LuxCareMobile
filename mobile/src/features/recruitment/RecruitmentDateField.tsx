import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar, ChevronDown } from "lucide-react-native";
import { DatePickerModal, formatDateVN } from "../credentials/DatePickerModal";
import { DateTimePickerModal } from "../work/DateTimePickerModal";

export function RecruitmentDateField({
  label, value, onChange, disabled = false, withTime = false, required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  withTime?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const display = value ? formatDateVN(value) + (withTime ? " · " + value.slice(11, 16) : "") : "";
  const commit = (next: string) => {
    if (!disabled) onChange(next);
    setOpen(false);
  };
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? " *" : ""}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: display || "Chưa chọn" }}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, (disabled || pressed) && { opacity: 0.5 }]}
      >
        <Calendar size={16} color="#059669" />
        <Text style={[styles.value, !value && { color: "#94a3b8" }]}>
          {display || (withTime ? "Chọn ngày và giờ" : "Chọn ngày")}
        </Text>
        <ChevronDown size={14} color="#64748b" />
      </Pressable>
      {open && !disabled && (withTime ? (
        <DateTimePickerModal visible minuteStep={1} value={value} title={label} allowClear={!required}
          onClose={() => setOpen(false)} onChange={commit} />
      ) : (
        <DatePickerModal visible value={value} title={label} allowClear={!required}
          clearLabel="Bỏ chọn ngày" showYearShortcuts={false}
          onClose={() => setOpen(false)} onChange={commit} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: "#475569" },
  button: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, backgroundColor: "#f8fafc" },
  value: { flex: 1, fontSize: 13, color: "#0f172a" },
});
