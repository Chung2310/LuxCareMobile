import React from "react";
import { Pressable, Text, View } from "react-native";
import type { DepartmentRecord } from "../../../../src/services/departmentService";
import { ChoiceField } from "../leave/ChoiceField";
import { equipmentDepartmentChoices } from "./departmentModel";

export function EquipmentDepartmentField({
  value, selectedName, departments, loading, error, onRetry, onChange,
  disabled = false, label = "Phòng ban quản lý", emptyLabel = "Chưa chọn phòng ban",
}: {
  value: string;
  selectedName?: string;
  departments: DepartmentRecord[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  emptyLabel?: string;
}) {
  return <View style={{ gap: 6 }}>
    <ChoiceField
      label={label}
      value={value}
      choices={[{ value: "", label: emptyLabel }, ...equipmentDepartmentChoices(departments, value, selectedName)]}
      onChange={onChange}
      disabled={disabled || loading || !!error}
      triggerLines={2}
      optionLines={3}
    />
    {loading && <Text style={{ fontSize: 12, color: "#64748b" }}>Đang tải phòng ban...</Text>}
    {!!error && <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 12, color: "#b91c1c" }}>{error}</Text>
      <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onRetry}>
        <Text style={{ fontSize: 13, color: "#059669" }}>Tải lại phòng ban</Text>
      </Pressable>
    </View>}
  </View>;
}
