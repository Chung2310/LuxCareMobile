import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppButton } from "../common";

export interface BatchStockFooterProps {
  totalItemsCount: number;
  totalQuantity: number;
  isIn: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export const BatchStockFooter: React.FC<BatchStockFooterProps> = ({
  totalItemsCount,
  totalQuantity,
  isIn,
  submitting,
  onClose,
  onSubmit,
}) => {
  return (
    <View style={styles.footer}>
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
    paddingVertical: 12,
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
