import { Pressable, Text, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import { colors, styles } from "../../ui";

export function WorkflowButton({
  title,
  onPress,
  disabled = false,
  variant = "primary",
  icon,
  style,
  textStyle,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const color = isPrimary ? "#ffffff" : isDanger ? colors.error : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          maxWidth: "100%",
          backgroundColor: isPrimary ? colors.primary : isDanger ? "#fff1f2" : "#ffffff",
          borderWidth: 1,
          borderColor: isPrimary ? colors.primary : isDanger ? "#fecdd3" : colors.border,
          shadowOpacity: 0,
          elevation: 0,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {icon}
      <Text style={[styles.buttonText, { color, textAlign: "center" }, textStyle]}>{title}</Text>
    </Pressable>
  );
}