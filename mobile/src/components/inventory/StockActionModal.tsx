import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InventorySupply } from "./types";

interface StockActionModalProps {
  visible: boolean;
  type: "in" | "out" | null;
  item: InventorySupply | null;
  onClose: () => void;
  onConfirm: (payload: {
    supplyId: string;
    type: "in" | "out";
    quantity: number;
    department?: string;
    batchNumber?: string;
    expiryDate?: string;
    reason: string;
  }) => void;
}

const DEPARTMENTS = [
  "Khoa Cấp Cứu & Hồi Sức",
  "Khoa Ngoại - Phòng Mổ",
  "Khoa Khám Bệnh & Cận Lâm Sàng",
  "Khoa Nội Tổng Hợp",
  "Khoa Sản - Nhi",
  "Khoa Dược - Nhà Thuốc Viện",
  "Phòng Xét Nghiệm Trung Tâm",
];

export const StockActionModal: React.FC<StockActionModalProps> = ({
  visible,
  type,
  item,
  onClose,
  onConfirm,
}) => {
  if (!item || !type) return null;

  const [quantity, setQuantity] = useState("10");
  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS[0]);
  const [batchNumber, setBatchNumber] = useState(item.batchNumber || "");
  const [expiryDate, setExpiryDate] = useState(item.expiryDate || "");
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isStockOut = type === "out";

  const handleConfirm = () => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg("Vui lòng nhập số lượng hợp lệ (lớn hơn 0).");
      return;
    }

    if (isStockOut && qty > item.quantity) {
      setErrorMsg(`Số lượng xuất (${qty}) vượt quá số lượng tồn kho hiện tại (${item.quantity} ${item.unit}).`);
      return;
    }

    setErrorMsg("");
    onConfirm({
      supplyId: item.id,
      type,
      quantity: qty,
      department: isStockOut ? selectedDept : undefined,
      batchNumber: !isStockOut ? batchNumber : undefined,
      expiryDate: !isStockOut ? expiryDate : undefined,
      reason: reason.trim() || (isStockOut ? `Xuất cấp phát cho ${selectedDept}` : "Nhập bổ sung kho"),
    });

    onClose();
  };

  const adjustQty = (delta: number) => {
    const current = parseInt(quantity, 10) || 0;
    const next = Math.max(current + delta, 1);
    setQuantity(String(next));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.titleWrapper}>
              <View
                style={[
                  styles.typeIconBox,
                  { backgroundColor: isStockOut ? "#eff6ff" : "#ecfdf5" },
                ]}
              >
                <Ionicons
                  name={isStockOut ? "arrow-up-circle" : "arrow-down-circle"}
                  size={22}
                  color={isStockOut ? "#0284c7" : "#059669"}
                />
              </View>
              <View>
                <Text style={styles.sheetTitle}>
                  {isStockOut ? "Phiếu Xuất Kho Cấp Phát" : "Phiếu Nhập Bổ Sung Kho"}
                </Text>
                <Text style={styles.sheetSubtitle}>{item.name}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Tồn kho hiện tại */}
            <View style={styles.stockBanner}>
              <Text style={styles.stockBannerLabel}>Tồn kho hiện tại:</Text>
              <Text style={styles.stockBannerValue}>
                {item.quantity} {item.unit}
              </Text>
            </View>

            {/* Số lượng xuất/nhập */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Số lượng {isStockOut ? "xuất" : "nhập"} ({item.unit}):
              </Text>

              <View style={styles.qtyControlRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => adjustQty(-10)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.qtyBtnText}>-10</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => adjustQty(-1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={18} color="#334155" />
                </TouchableOpacity>

                <TextInput
                  style={styles.qtyInput}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                />

                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => adjustQty(1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={18} color="#334155" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => adjustQty(10)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.qtyBtnText}>+10</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Khoa phòng tiếp nhận (Nếu là xuất kho) */}
            {isStockOut && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Khoa / Phòng ban tiếp nhận:</Text>
                <View style={styles.deptPillsContainer}>
                  {DEPARTMENTS.map((dept) => {
                    const isSelected = selectedDept === dept;
                    return (
                      <TouchableOpacity
                        key={dept}
                        style={[
                          styles.deptPill,
                          isSelected && styles.deptPillSelected,
                        ]}
                        onPress={() => setSelectedDept(dept)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.deptPillText,
                            isSelected && styles.deptPillTextSelected,
                          ]}
                        >
                          {dept}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Số lô & Hạn sử dụng (Nếu là nhập kho) */}
            {!isStockOut && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Số lô sản xuất:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ví dụ: LOT-2026A10"
                  value={batchNumber}
                  onChangeText={setBatchNumber}
                />

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                  Hạn sử dụng (YYYY-MM-DD):
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ví dụ: 2028-12-31"
                  value={expiryDate}
                  onChangeText={setExpiryDate}
                />
              </View>
            )}

            {/* Lý do xuất/nhập */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Lý do / Ghi chú đợt cấp phát:</Text>
              <TextInput
                style={[styles.textInput, { height: 70, textAlignVertical: "top" }]}
                placeholder={isStockOut ? "Ví dụ: Cấp bù cơ số trực tuần..." : "Ví dụ: Nhập theo hợp đồng số 12..."}
                placeholderTextColor="#94a3b8"
                value={reason}
                onChangeText={setReason}
                multiline
              />
            </View>

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#dc2626" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Nút Hoàn tất */}
          <View style={styles.sheetFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: isStockOut ? "#0284c7" : "#059669" },
              ]}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmBtnText}>
                {isStockOut ? "Xác nhận xuất kho" : "Xác nhận nhập kho"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingTop: 18,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  titleWrapper: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  typeIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  sheetSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollArea: {
    paddingHorizontal: 20,
  },
  stockBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  stockBannerLabel: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  stockBannerValue: {
    fontSize: 15,
    color: "#059669",
    fontWeight: "800",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  qtyControlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  qtyBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  qtyInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  deptPillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  deptPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  deptPillSelected: {
    backgroundColor: "#f0f9ff",
    borderColor: "#0284c7",
  },
  deptPillText: {
    fontSize: 12,
    color: "#475569",
  },
  deptPillTextSelected: {
    color: "#0284c7",
    fontWeight: "700",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 6,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 12,
    flex: 1,
  },
  sheetFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  confirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
});
