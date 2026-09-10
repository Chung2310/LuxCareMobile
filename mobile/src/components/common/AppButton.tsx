import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type AppButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "danger"
  | "blue"
  | "ghost";

export type AppButtonSize = "sm" | "md" | "lg";

export interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  icon?: keyof typeof Ionicons.glyphMap | React.ReactNode;
  iconPosition?: "left" | "right";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  activeOpacity?: number;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  activeOpacity = 0.75,
}) => {
  const isInteractive = !disabled && !loading;

  // Colors based on variant
  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return {
          container: styles.variantPrimary,
          text: styles.textPrimary,
          loaderColor: "#ffffff",
          iconColor: "#ffffff",
        };
      case "secondary":
        return {
          container: styles.variantSecondary,
          text: styles.textSecondary,
          loaderColor: "#475569",
          iconColor: "#475569",
        };
      case "outline":
        return {
          container: styles.variantOutline,
          text: styles.textOutline,
          loaderColor: "#059669",
          iconColor: "#059669",
        };
      case "danger":
        return {
          container: styles.variantDanger,
          text: styles.textDanger,
          loaderColor: "#ffffff",
          iconColor: "#ffffff",
        };
      case "blue":
        return {
          container: styles.variantBlue,
          text: styles.textBlue,
          loaderColor: "#ffffff",
          iconColor: "#ffffff",
        };
      case "ghost":
        return {
          container: styles.variantGhost,
          text: styles.textGhost,
          loaderColor: "#475569",
          iconColor: "#475569",
        };
    }
  };

  // Sizing styles
  const getSizeStyles = () => {
    switch (size) {
      case "sm":
        return {
          container: styles.sizeSm,
          text: styles.textSizeSm,
          iconSize: 14,
        };
      case "lg":
        return {
          container: styles.sizeLg,
          text: styles.textSizeLg,
          iconSize: 18,
        };
      case "md":
      default:
        return {
          container: styles.sizeMd,
          text: styles.textSizeMd,
          iconSize: 16,
        };
    }
  };

  const vStyles = getVariantStyles();
  const sStyles = getSizeStyles();

  const renderIcon = () => {
    if (!icon) return null;
    if (typeof icon === "string") {
      return (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={sStyles.iconSize}
          color={vStyles.iconColor}
          style={iconPosition === "left" ? styles.iconLeft : styles.iconRight}
        />
      );
    }
    return (
      <View style={iconPosition === "left" ? styles.iconLeft : styles.iconRight}>
        {icon}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.baseButton,
        vStyles.container,
        sStyles.container,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={isInteractive ? onPress : undefined}
      activeOpacity={activeOpacity}
      disabled={!isInteractive}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vStyles.loaderColor} />
      ) : (
        <View style={styles.innerContent}>
          {iconPosition === "left" && renderIcon()}
          <Text
            style={[styles.baseText, vStyles.text, sStyles.text, textStyle]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {iconPosition === "right" && renderIcon()}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  innerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: {
    width: "100%",
  },
  disabled: {
    opacity: 0.55,
  },
  baseText: {
    fontWeight: "600",
    textAlign: "center",
  },
  iconLeft: {
    marginRight: 6,
  },
  iconRight: {
    marginLeft: 6,
  },

  // Sizes
  sizeSm: {
    height: 36,
    paddingHorizontal: 12,
  },
  textSizeSm: {
    fontSize: 12.5,
  },
  sizeMd: {
    height: 44,
    paddingHorizontal: 16,
  },
  textSizeMd: {
    fontSize: 14,
  },
  sizeLg: {
    height: 50,
    paddingHorizontal: 20,
  },
  textSizeLg: {
    fontSize: 15,
  },

  // Variants
  variantPrimary: {
    backgroundColor: "#059669",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  textPrimary: {
    color: "#ffffff",
  },

  variantSecondary: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  textSecondary: {
    color: "#334155",
  },

  variantOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#059669",
  },
  textOutline: {
    color: "#059669",
  },

  variantDanger: {
    backgroundColor: "#dc2626",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  textDanger: {
    color: "#ffffff",
  },

  variantBlue: {
    backgroundColor: "#0284c7",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  textBlue: {
    color: "#ffffff",
  },

  variantGhost: {
    backgroundColor: "transparent",
  },
  textGhost: {
    color: "#475569",
  },
});
