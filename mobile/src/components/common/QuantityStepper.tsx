import React from "react";
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface QuantityStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  disabled = false,
  style,
}) => {
  const handleDecrease = () => {
    const next = Math.max(value - step, min);
    onChange(next);
  };

  const handleIncrease = () => {
    const next = max !== undefined ? Math.min(value + step, max) : value + step;
    onChange(next);
  };

  const handleTextChange = (text: string) => {
    const parsed = parseInt(text, 10);
    if (isNaN(parsed)) {
      onChange(min);
    } else {
      let finalVal = Math.max(parsed, min);
      if (max !== undefined) finalVal = Math.min(finalVal, max);
      onChange(finalVal);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[styles.btn, (disabled || value <= min) && styles.btnDisabled]}
        onPress={handleDecrease}
        disabled={disabled || value <= min}
        activeOpacity={0.7}
      >
        <Ionicons name="remove" size={16} color={value <= min ? "#94a3b8" : "#475569"} />
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={String(value)}
        onChangeText={handleTextChange}
        editable={!disabled}
      />

      <TouchableOpacity
        style={[styles.btn, (disabled || (max !== undefined && value >= max)) && styles.btnDisabled]}
        onPress={handleIncrease}
        disabled={disabled || (max !== undefined && value >= max)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="add"
          size={16}
          color={max !== undefined && value >= max ? "#94a3b8" : "#475569"}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    overflow: "hidden",
  },
  btn: {
    width: 34,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    paddingVertical: 0,
  },
});
