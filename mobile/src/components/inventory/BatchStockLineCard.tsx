import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InventorySupply, InventoryWarehouse } from "./types";
import { formatDateVN } from "../../features/credentials/DatePickerModal";
import { QuantityStepper } from "../common";
import { isSupplyInWarehouse } from "./constants";

export interface BatchStockLineState {
  tempId: string;
  supply: InventorySupply;
  quantity: number;
  batchNumber: string;
  expiryDate: string;
  unitPrice: number;
  notes?: string;
}

export interface BatchStockLineCardProps {
  line: BatchStockLineState;
  index: number;
  isIn: boolean;
  selectedSupplier?: string;
  selectedWarehouse?: string;
  warehouses?: InventoryWarehouse[];
  onRemove: (tempId: string) => void;
  onUpdateQuantity: (tempId: string, val: string | number) => void;
  onUpdateBatchNumber: (tempId: string, val: string) => void;
  onUpdateUnitPrice: (tempId: string, val: string) => void;
  onOpenExpiryPicker: (tempId: string) => void;
}

export const BatchStockLineCard: React.FC<BatchStockLineCardProps> = ({
  line,
  index,
  isIn,
  selectedSupplier = "",
  selectedWarehouse = "",
  warehouses = [],
  onRemove,
  onUpdateQuantity,
  onUpdateBatchNumber,
  onUpdateUnitPrice,
  onOpenExpiryPicker,
}) => {
  const isOverStock = !isIn && line.quantity > line.supply.quantity;

  const isForeignSupplier =
    isIn &&
    Boolean(selectedSupplier) &&
    Boolean(line.supply.supplierName) &&
    line.supply.supplierName.trim().toLowerCase() !==
      selectedSupplier.trim().toLowerCase();

  const isForeignWarehouse =
    !isIn &&
    Boolean(selectedWarehouse) &&
    !isSupplyInWarehouse(line.supply, selectedWarehouse, warehouses);

  return (
    <View style={styles.card}>
      {/* Header của dòng */}
      <View style={styles.cardHeader}>
        <View style={styles.indexCircle}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.supplyName} numberOfLines={2}>
            {line.supply.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.supplyCode}>Mã: {line.supply.code}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.supplyStock}>
              Tồn kho: {line.supply.quantity} {line.supply.unit}
            </Text>

            {isIn && Boolean(line.supply.supplierName) && (
              <>
                <Text style={styles.dot}>•</Text>
                <Text
                  style={[
                    styles.supplierBadge,
                    isForeignSupplier && styles.badgeWarning,
                  ]}
                  numberOfLines={1}
                >
                  NCC: {line.supply.supplierName}
                </Text>
              </>
            )}

            {!isIn && (
              <>
                <Text style={styles.dot}>•</Text>
                <Text
                  style={[
                    styles.warehouseBadge,
                    isForeignWarehouse && styles.badgeWarning,
                  ]}
                  numberOfLines={1}
                >
                  Kho: {line.supply.warehouseLocation || line.supply.warehouseName || selectedWarehouse}
                </Text>
              </>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => onRemove(line.tempId)}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={17} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Cảnh báo nếu mặt hàng khác nhà cung cấp của phiếu */}
      {isForeignSupplier && (
        <View style={styles.foreignSupplierWarning}>
          <Ionicons name="alert-circle-outline" size={13} color="#ea580c" />
          <Text style={styles.foreignSupplierText}>
            Khác NCC: Mặt hàng này thuộc "{line.supply.supplierName}", sẽ nhập theo phiếu của "{selectedSupplier}".
          </Text>
        </View>
      )}

      {/* Cảnh báo nếu mặt hàng khác kho xuất của phiếu */}
      {isForeignWarehouse && (
        <View style={styles.foreignWarehouseWarning}>
          <Ionicons name="alert-circle-outline" size={13} color="#0284c7" />
          <Text style={styles.foreignWarehouseText}>
            Khác kho: Mặt hàng này đang lưu tại "{line.supply.warehouseLocation || "Kho khác"}", sẽ xuất từ "{selectedWarehouse}".
          </Text>
        </View>
      )}

      {/* Cảnh báo vượt quá tồn kho */}
      {isOverStock && (
        <View style={styles.overStockWarning}>
          <Ionicons name="alert-circle" size={13} color="#dc2626" />
          <Text style={styles.overStockText}>
            Số lượng xuất ({line.quantity}) vượt tồn hiện có ({line.supply.quantity})
          </Text>
        </View>
      )}

      {/* Row số lượng & số lô */}
      <View style={styles.inputsRow}>
        <View style={styles.qtyGroup}>
          <Text style={styles.miniLabel}>Số lượng ({line.supply.unit}) *</Text>
          <QuantityStepper
            value={line.quantity}
            onChange={(val) => onUpdateQuantity(line.tempId, val)}
            min={1}
            max={!isIn ? line.supply.quantity : undefined}
          />
        </View>

        <View style={styles.batchGroup}>
          <Text style={styles.miniLabel}>Số lô</Text>
          <TextInput
            style={styles.miniInput}
            placeholder="Số lô..."
            placeholderTextColor="#94a3b8"
            value={line.batchNumber}
            onChangeText={(val) => onUpdateBatchNumber(line.tempId, val)}
          />
        </View>
      </View>

      {/* Row Hạn dùng & Đơn giá (nếu nhập kho) */}
      <View style={[styles.inputsRow, { marginTop: 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.miniLabel}>Hạn dùng (HSD)</Text>
          <TouchableOpacity
            style={styles.miniDatePickerBtn}
            onPress={() => onOpenExpiryPicker(line.tempId)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={14} color="#64748b" />
            <Text style={styles.miniDatePickerText}>
              {line.expiryDate ? formatDateVN(line.expiryDate) : "Chọn HSD"}
            </Text>
          </TouchableOpacity>
        </View>

        {isIn && (
          <View style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>Đơn giá nhập (VNĐ)</Text>
            <TextInput
              style={styles.miniInput}
              keyboardType="number-pad"
              placeholder="Giá nhập..."
              placeholderTextColor="#94a3b8"
              value={line.unitPrice ? String(line.unitPrice) : ""}
              onChangeText={(val) => onUpdateUnitPrice(line.tempId, val)}
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  indexCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  indexText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  supplyName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  supplyCode: {
    fontSize: 11,
    color: "#64748b",
  },
  dot: {
    fontSize: 10,
    color: "#cbd5e1",
  },
  supplyStock: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "600",
  },
  supplierBadge: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "600",
  },
  warehouseBadge: {
    fontSize: 11,
    color: "#0284c7",
    fontWeight: "600",
  },
  badgeWarning: {
    color: "#ea580c",
  },
  removeBtn: {
    padding: 4,
  },
  foreignSupplierWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#ffedd5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  foreignSupplierText: {
    fontSize: 11,
    color: "#c2410c",
    flex: 1,
    lineHeight: 15,
  },
  foreignWarehouseWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#e0f2fe",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  foreignWarehouseText: {
    fontSize: 11,
    color: "#0369a1",
    flex: 1,
    lineHeight: 15,
  },
  overStockWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
  },
  overStockText: {
    fontSize: 11,
    color: "#dc2626",
    fontWeight: "600",
    flex: 1,
  },
  inputsRow: {
    flexDirection: "row",
    gap: 10,
  },
  qtyGroup: {
    flex: 1.2,
  },
  batchGroup: {
    flex: 1,
  },
  miniLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
  },
  miniInput: {
    height: 40,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  miniDatePickerBtn: {
    height: 40,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
  },
  miniDatePickerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
});
