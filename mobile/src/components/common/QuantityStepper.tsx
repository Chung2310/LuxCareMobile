import React, { useEffect, useState } from "react";
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatIntegerInput, formatNumber, parseIntegerInput } from "../../utils/numberFormat";

export interface QuantityStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  disabled = false,
  style,
  onFocus,
  onBlur,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [text, setText] = useState<string>(formatNumber(value ?? min));

  useEffect(() => {
    if (!isFocused) {
      setText(formatNumber(value !== undefined && value !== null ? value : min));
    }
  }, [value, isFocused, min]);

  const handleDecrease = () => {
    const current = parseIntegerInput(text);
    const base = current || (value ?? min);
    const next = Math.max(base - step, min);
    setText(formatNumber(next));
    onChange(next);
  };

  const handleIncrease = () => {
    const current = parseIntegerInput(text);
    const base = current || (value ?? min);
    const next = max !== undefined ? Math.min(base + step, max) : base + step;
    setText(formatNumber(next));
    onChange(next);
  };

  const handleTextChange = (newText: string) => {
    // Chỉ giữ lại các chữ số 0-9 và hiển thị phân tách mỗi 3 số.
    const clean = formatIntegerInput(newText);

    if (clean === "") {
      // Cho phép người dùng xóa hết để gõ số mới nhanh và chính xác
      setText("");
      onChange(min);
      return;
    }

    // Nếu gõ nhiều chữ số và có số 0 ở đầu (ví dụ "05"), chuẩn hóa thành "5"
    if (clean.length > 1 && clean.startsWith("0")) {
      const normalized = String(parseInt(clean, 10));
      setText(normalized);
      onChange(parseInt(normalized, 10));
      return;
    }

    if (clean === "0") {
      // Cho phép hiển thị tạm "0" khi người dùng đang gõ
      setText("0");
      onChange(min);
      return;
    }

    const parsed = parseIntegerInput(clean);
    if (!isNaN(parsed)) {
      let finalVal = parsed;
      if (max !== undefined && finalVal > max) {
        finalVal = max;
        setText(formatNumber(max));
      } else {
        setText(formatNumber(finalVal));
      }
      onChange(finalVal);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseIntegerInput(text);
    if (isNaN(parsed) || parsed < min) {
      // Nếu người dùng xóa hết hoặc gõ < min mà bấm ra ngoài luôn thì mới mặc định là min (1)
      setText(formatNumber(min));
      onChange(min);
    } else if (max !== undefined && parsed > max) {
      setText(formatNumber(max));
      onChange(max);
    } else {
      setText(formatNumber(parsed));
      onChange(parsed);
    }
    onBlur?.();
  };

  const numValue = value ?? min;
  const canDecrease = !disabled && numValue > min;
  const canIncrease = !disabled && (max === undefined || numValue < max);

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[styles.btn, !canDecrease && styles.btnDisabled]}
        onPress={handleDecrease}
        disabled={!canDecrease}
        activeOpacity={0.7}
      >
        <Ionicons name="remove" size={16} color={canDecrease ? "#475569" : "#94a3b8"} />
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={text}
        placeholder={String(min)}
        placeholderTextColor="#cbd5e1"
        onChangeText={handleTextChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        editable={!disabled}
        selectTextOnFocus
      />

      <TouchableOpacity
        style={[styles.btn, !canIncrease && styles.btnDisabled]}
        onPress={handleIncrease}
        disabled={!canIncrease}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={16} color={canIncrease ? "#475569" : "#94a3b8"} />
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
