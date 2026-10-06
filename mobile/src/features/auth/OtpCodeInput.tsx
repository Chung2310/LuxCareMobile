import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { authStyles } from "./AuthForm";

type OtpCodeInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
};

export function OtpCodeInput({ label, value, onChangeText, editable = true }: OtpCodeInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, 5);

  return (
    <View style={styles.field}>
      <Text style={authStyles.label}>{label}</Text>
      <Pressable
        accessible={false}
        disabled={!editable}
        onPress={() => inputRef.current?.focus()}
        style={styles.inputArea}
      >
        <View pointerEvents="none" accessible={false} style={styles.cells}>
          {Array.from({ length: 6 }, (_, index) => {
            const digit = value[index] ?? "";
            const active = focused && index === activeIndex && value.length < 6;
            return (
              <View
                key={index}
                style={[
                  styles.cell,
                  digit ? styles.filledCell : styles.emptyCell,
                  active && styles.activeCell,
                ]}
              >
                {digit ? (
                  <Text style={styles.digit}>{digit}</Text>
                ) : active ? (
                  <View style={styles.caret} />
                ) : null}
              </View>
            );
          })}
        </View>
        <TextInput
          ref={inputRef}
          accessibilityLabel={`${label}, gồm 6 chữ số`}
          accessibilityHint="Nhập hoặc dán mã xác minh gồm sáu chữ số đã gửi đến email."
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/\D/g, "").slice(0, 6))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          editable={editable}
          caretHidden
          selectionColor="transparent"
          underlineColorAndroid="transparent"
          style={styles.nativeInput}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 10 },
  inputArea: { minHeight: 60, justifyContent: "center" },
  cells: { flexDirection: "row", gap: 8 },
  cell: {
    flex: 1,
    minWidth: 0,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: 14,
  },
  emptyCell: { backgroundColor: "#f8fbf9", borderColor: "#dce9e2" },
  filledCell: { backgroundColor: "#ecfdf5", borderColor: "#a7d8c2" },
  activeCell: { backgroundColor: "#ffffff", borderColor: "#059669" },
  digit: { fontFamily: "Inter-SemiBold", fontSize: 23, lineHeight: 30, color: "#102820" },
  caret: { width: 2, height: 23, borderRadius: 1, backgroundColor: "#059669" },
  nativeInput: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
    padding: 0,
    color: "transparent",
    fontSize: 1,
    backgroundColor: "transparent",
    opacity: 0.02,
  },
});
