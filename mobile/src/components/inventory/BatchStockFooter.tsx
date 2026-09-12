import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "../common";

export interface BatchStockFooterProps {
  totalItemsCount: number;
  totalQuantity: number;
  isIn: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  keyboardVisible?: boolean;
}

export const BatchStockFooter: React.FC<BatchStockFooterProps> = ({
  totalItemsCount,
  totalQuantity,
  isIn,
  submitting,
  onClose,
  onSubmit,
  keyboardVisible = false,
}) => {
  const insets = useSafeAreaInsets();
  const bottomPadding = keyboardVisible ? 10 : Math.max(insets.bottom, 12);

  return (
    <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
      <View style={styles.footerSummary}>
        <Text style={styles.footerSummaryText}>
          Tổng cộng: <Text style={styles.footerSummaryBold}>{totalItemsCount} mặt hàng</Text>
        </Text>
        <Text style={styles.footerSummarySub}>
          Tổng số lượng: {totalQuantity} đơn vị
        </Text>
      </View>

      <View style={styles.footerActions}>
        <AppButton
          variant="secondary"
          title="Đóng"
          onPress={onClose}
          disabled={submitting}
          style={{ flex: 1 }}
        />

        <AppButton
          variant={isIn ? "primary" : "blue"}
          icon={isIn ? "checkmark-done-circle" : "send"}
          title={isIn ? "Hoàn tất Nhập kho" : "Hoàn tất Xuất cấp"}
          onPress={onSubmit}
          loading={submitting}
          disabled={submitting}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  footerSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerSummaryText: {
    fontSize: 13,
    color: "#475569",
  },
  footerSummaryBold: {
    fontWeight: "800",
    color: "#0f172a",
  },
  footerSummarySub: {
    fontSize: 12,
    color: "#64748b",
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
