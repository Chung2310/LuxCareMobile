import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type {
  InventorySupply,
  InventorySupplier,
  InventoryWarehouse,
} from "./types";
import type { BatchStockLineItem, BatchStockPayload } from "../../api/supplyApi";
import { DatePickerModal } from "../../features/credentials/DatePickerModal";
import { InventorySelectModal, type SelectOption } from "./InventorySelectModal";
import {
  AppButton,
  DatePickerField,
  DropdownSelectField,
} from "../common";
import {
  generateVoucherCode,
  isSupplyInWarehouse,
} from "./constants";
import {
  BatchStockLineCard,
  type BatchStockLineState,
} from "./BatchStockLineCard";
import { BatchStockFooter } from "./BatchStockFooter";

export type { BatchStockLineState };

interface BatchStockModalProps {
  visible: boolean;
  initialType?: "in" | "out";
  initialSupply?: InventorySupply | null;
  supplies: InventorySupply[];
  suppliers?: InventorySupplier[];
  warehouses?: InventoryWarehouse[];
  departments?: Array<{ id: string; name: string; code?: string } | string>;
  onClose: () => void;
  onSubmit: (payload: BatchStockPayload) => Promise<void>;
}

export const BatchStockModal: React.FC<BatchStockModalProps> = ({
  visible,
  initialType = "in",
  initialSupply,
  supplies,
  suppliers = [],
  warehouses = [],
  departments = [],
  onClose,
  onSubmit,
}) => {
  const departmentNames = useMemo(() => {
    return (departments || []).map((d) => (typeof d === "string" ? d : d.name)).filter(Boolean);
  }, [departments]);

  const [type, setType] = useState<"in" | "out">(initialType);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDate, setVoucherDate] = useState("");

  // Đối tượng liên quan
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState(departmentNames[0] || "");
  const [reason, setReason] = useState("");

  // Quản lý mở modal chọn tái sử dụng (InventorySelectModal)
  const [selectModalType, setSelectModalType] = useState<
    "supplier" | "warehouse" | "department" | "supply" | null
  >(null);

  // Danh sách mặt hàng
  const [lines, setLines] = useState<BatchStockLineState[]>([]);

  // Modal chọn ngày hết hạn cho dòng đang thao tác
  const [activeExpiryLineId, setActiveExpiryLineId] = useState<string | null>(null);

  // Loading & error
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Bộ lọc mặt hàng: "current" (theo NCC nếu nhập kho, hoặc theo Kho nếu xuất kho) | "all" (tất cả sản phẩm)
  const [supplyFilterMode, setSupplyFilterMode] = useState<"current" | "all">("current");

  // Khởi tạo form khi modal mở
  useEffect(() => {
    if (visible) {
      const txType = initialType || "in";
      setType(txType);
      setVoucherCode(generateVoucherCode(txType));
      const today = new Date().toISOString().slice(0, 10);
      setVoucherDate(today);

      // Nếu có initialSupply và có tên NCC hợp lệ, ưu tiên chọn NCC đó
      const initSupplier =
        (initialSupply?.supplierName && initialSupply.supplierName !== "Chưa xác định"
          ? initialSupply.supplierName
          : "") ||
        suppliers[0]?.name ||
        "";
      setSelectedSupplier(initSupplier);

      // Nếu có initialSupply và có kho lưu trữ, ưu tiên chọn kho đó
      const initWarehouse =
        initialSupply?.warehouseLocation ||
        initialSupply?.warehouseName ||
        warehouses[0]?.name ||
        "";
      setSelectedWarehouse(initWarehouse);

      setSelectedDepartment(departmentNames[0] || "");
      setReason(txType === "in" ? "Nhập bổ sung vật tư định kỳ" : "Cấp phát cho khoa phòng");
      setErrorMsg("");
      setSupplyFilterMode("current");

      // Nếu có initialSupply được truyền vào, thêm nó làm dòng đầu tiên
      if (initialSupply) {
        setLines([
          {
            tempId: `line-${Date.now()}-0`,
            supply: initialSupply,
            quantity: txType === "in" ? 10 : 1,
            batchNumber: initialSupply.batchNumber || "",
            expiryDate: initialSupply.expiryDate || "",
            unitPrice: initialSupply.unitPrice || 0,
          },
        ]);
      } else {
        setLines([]);
      }
    }
  }, [visible, initialType, initialSupply]);

  // Cập nhật mã khi đổi loại phiếu
  const handleTypeChange = (newType: "in" | "out") => {
    setType(newType);
    setVoucherCode(generateVoucherCode(newType));
    setReason(newType === "in" ? "Nhập bổ sung vật tư định kỳ" : "Cấp phát cho khoa phòng");
    setErrorMsg("");
    setSupplyFilterMode("current");
  };

  // Tái sử dụng: Danh sách options cho InventorySelectModal
  const supplierOptions: SelectOption[] = useMemo(() => {
    return suppliers.map((s) => {
      const subInfo = [
        s.contactPerson ? `Đại diện: ${s.contactPerson}` : null,
        s.phone ? `SĐT: ${s.phone}` : null,
      ]
        .filter(Boolean)
        .join(" • ") || s.address || "Chưa cập nhật địa chỉ";

      return {
        id: s.id,
        label: s.name,
        subLabel: subInfo,
        badge: s.shortName || s.code || undefined,
        icon: "business",
        badgeColor: "#059669",
      };
    });
  }, [suppliers]);

  const warehouseOptions: SelectOption[] = useMemo(() => {
    return warehouses.map((w) => ({
      id: w.id,
      label: w.name,
      subLabel: w.location || "Kho lưu trữ vật tư y tế",
      badge: w.code || undefined,
      icon: "file-tray-full",
      badgeColor: "#0284c7",
    }));
  }, [warehouses]);

  const departmentOptions: SelectOption[] = useMemo(() => {
    return departmentNames.map((dept, idx) => ({
      id: `dept-${idx}`,
      label: dept,
      subLabel: "Khoa phòng nhận vật tư",
      icon: "medkit",
      badgeColor: "#0284c7",
    }));
  }, [departmentNames]);

  // Danh sách các mặt hàng của nhà cung cấp đã chọn (cho Nhập kho)
  const supplierSupplies = useMemo(() => {
    if (!selectedSupplier) return supplies;
    const target = selectedSupplier.trim().toLowerCase();
    return supplies.filter((s) => {
      const sName = (s.supplierName || s.supplier || "").trim().toLowerCase();
      if (sName === target) return true;
      if (s.supplierId) {
        const sup = suppliers.find((sp) => sp.id === s.supplierId);
        if (sup && sup.name.trim().toLowerCase() === target) return true;
      }
      return false;
    });
  }, [selectedSupplier, supplies, suppliers]);

  // Danh sách các mặt hàng thuộc Kho đã chọn (cho Xuất kho)
  const warehouseSupplies = useMemo(() => {
    if (!selectedWarehouse) return supplies;
    return supplies.filter((s) => isSupplyInWarehouse(s, selectedWarehouse, warehouses));
  }, [selectedWarehouse, supplies, warehouses]);

  // Các mặt hàng sẽ hiển thị trong Modal chọn theo chế độ lọc
  const displayedSuppliesForSelect = useMemo(() => {
    if (type === "in") {
      if (supplyFilterMode === "current" && supplierSupplies.length > 0) {
        return supplierSupplies;
      }
      return supplies;
    } else {
      // Xuất kho: Ưu tiên danh sách mặt hàng thuộc Kho xuất hàng đã chọn
      if (supplyFilterMode === "current" && warehouseSupplies.length > 0) {
        return warehouseSupplies;
      }
      return supplies;
    }
  }, [type, supplyFilterMode, supplierSupplies, warehouseSupplies, supplies]);

  const supplyOptions: SelectOption[] = useMemo(() => {
    return displayedSuppliesForSelect.map((s) => {
      if (type === "in") {
        const isFromCurrentSupplier =
          Boolean(selectedSupplier) &&
          (s.supplierName || s.supplier || "").trim().toLowerCase() === selectedSupplier.trim().toLowerCase();

        return {
          id: s.id,
          label: s.name,
          subLabel: `Mã: ${s.code} • Tồn: ${s.quantity} ${s.unit}${s.supplierName ? ` • NCC: ${s.supplierName}` : ""}`,
          badge: isFromCurrentSupplier ? "Đúng NCC" : s.category,
          badgeColor: isFromCurrentSupplier ? "#059669" : "#0d9488",
          icon: "cube-outline",
        };
      } else {
        const isMatched = isSupplyInWarehouse(s, selectedWarehouse, warehouses);
        const isOutOfStock = s.quantity <= 0;

        let badgeText = s.category;
        let badgeColor = "#0284c7";

        if (isOutOfStock) {
          badgeText = "Hết hàng";
          badgeColor = "#ef4444";
        } else if (isMatched && selectedWarehouse) {
          badgeText = "Trong kho";
          badgeColor = "#059669";
        }

        return {
          id: s.id,
          label: s.name,
          subLabel: `Mã: ${s.code} • Khả dụng: ${s.quantity} ${s.unit} • Kho: ${s.warehouseLocation || s.warehouseName || "Chung"}`,
          badge: badgeText,
          badgeColor: badgeColor,
          icon: "cube-outline",
        };
      }
    });
  }, [displayedSuppliesForSelect, type, selectedSupplier, selectedWarehouse, warehouses]);

  // Mở bộ chọn mặt hàng (Kiểm tra điều kiện chọn NCC nếu nhập, chọn Kho nếu xuất)
  const handleOpenSupplyPicker = () => {
    if (type === "in" && !selectedSupplier) {
      Alert.alert(
        "Chưa chọn Nhà cung cấp",
        "Vui lòng chọn Nhà cung cấp trước để xem danh mục sản phẩm của nhà cung cấp đó.",
        [
          { text: "Để sau", style: "cancel" },
          {
            text: "Chọn Nhà cung cấp",
            onPress: () => setSelectModalType("supplier"),
          },
        ]
      );
      return;
    }

    if (type === "out" && !selectedWarehouse) {
      Alert.alert(
        "Chưa chọn Kho xuất hàng",
        "Vui lòng chọn Kho xuất hàng trước để lọc danh sách mặt hàng có sẵn trong kho đó.",
        [
          { text: "Để sau", style: "cancel" },
          {
            text: "Chọn Kho xuất hàng",
            onPress: () => setSelectModalType("warehouse"),
          },
        ]
      );
      return;
    }

    if (type === "in") {
      setSupplyFilterMode(supplierSupplies.length > 0 ? "current" : "all");
    } else {
      setSupplyFilterMode(warehouseSupplies.length > 0 ? "current" : "all");
    }
    setSelectModalType("supply");
  };

  // Đổi Nhà cung cấp & Cảnh báo nếu phiếu đã có mặt hàng
  const handleSelectSupplier = (newSupplier: string) => {
    if (
      lines.length > 0 &&
      selectedSupplier &&
      selectedSupplier.trim().toLowerCase() !== newSupplier.trim().toLowerCase()
    ) {
      const foreignLines = lines.filter((l) => {
        const sName = (l.supply.supplierName || l.supply.supplier || "").trim().toLowerCase();
        return sName !== newSupplier.trim().toLowerCase();
      });

      if (foreignLines.length > 0) {
        Alert.alert(
          "Đổi Nhà cung cấp",
          `Phiếu đang có ${foreignLines.length} mặt hàng không thuộc nhà cung cấp mới "${newSupplier}". Bạn có muốn làm mới danh sách mặt hàng để chọn theo NCC mới không?`,
          [
            {
              text: "Giữ lại các mặt hàng",
              onPress: () => {
                setSelectedSupplier(newSupplier);
                setSelectModalType(null);
              },
            },
            {
              text: "Làm mới danh sách",
              style: "destructive",
              onPress: () => {
                setSelectedSupplier(newSupplier);
                setLines((prev) =>
                  prev.filter(
                    (l) =>
                      (l.supply.supplierName || l.supply.supplier || "").trim().toLowerCase() ===
                      newSupplier.trim().toLowerCase()
                  )
                );
                setSelectModalType(null);
              },
            },
          ]
        );
        return;
      }
    }

    setSelectedSupplier(newSupplier);
    setSelectModalType(null);
  };

  // Đổi Kho xuất hàng & Cảnh báo nếu phiếu đã có mặt hàng
  const handleSelectWarehouse = (newWarehouse: string) => {
    if (
      type === "out" &&
      lines.length > 0 &&
      selectedWarehouse &&
      selectedWarehouse.trim().toLowerCase() !== newWarehouse.trim().toLowerCase()
    ) {
      const foreignLines = lines.filter(
        (l) => !isSupplyInWarehouse(l.supply, newWarehouse, warehouses)
      );

      if (foreignLines.length > 0) {
        Alert.alert(
          "Đổi Kho xuất hàng",
          `Phiếu đang có ${foreignLines.length} mặt hàng không thuộc kho mới "${newWarehouse}". Bạn có muốn làm mới danh sách mặt hàng để chọn theo kho mới không?`,
          [
            {
              text: "Giữ lại các mặt hàng",
              onPress: () => {
                setSelectedWarehouse(newWarehouse);
                setSelectModalType(null);
              },
            },
            {
              text: "Làm mới danh sách",
              style: "destructive",
              onPress: () => {
                setSelectedWarehouse(newWarehouse);
                setLines((prev) =>
                  prev.filter((l) => isSupplyInWarehouse(l.supply, newWarehouse, warehouses))
                );
                setSelectModalType(null);
              },
            },
          ]
        );
        return;
      }
    }

    setSelectedWarehouse(newWarehouse);
    setSelectModalType(null);
  };

  // Thêm mặt hàng từ picker
  const handleSelectSupply = (sup: InventorySupply) => {
    if (type === "out" && sup.quantity <= 0) {
      Alert.alert(
        "Không thể xuất hàng",
        `Mặt hàng "${sup.name}" hiện đã hết hàng tồn kho (0 ${sup.unit}). Vui lòng nhập thêm kho hoặc chọn mặt hàng khác.`
      );
      return;
    }

    const existingIndex = lines.findIndex((l) => l.supply.id === sup.id);
    if (existingIndex >= 0) {
      if (type === "out" && lines[existingIndex].quantity >= sup.quantity) {
        Alert.alert(
          "Đã đạt mức tồn tối đa",
          `Số lượng đã thêm (${lines[existingIndex].quantity}) bằng toàn bộ tồn khả dụng (${sup.quantity} ${sup.unit}) trong kho.`
        );
        return;
      }
      setLines((prev) =>
        prev.map((l, idx) =>
          idx === existingIndex ? { ...l, quantity: l.quantity + 1 } : l
        )
      );
    } else {
      setLines((prev) => [
        ...prev,
        {
          tempId: `line-${Date.now()}-${prev.length}`,
          supply: sup,
          quantity: type === "in" ? 10 : 1,
          batchNumber: sup.batchNumber || "",
          expiryDate: sup.expiryDate || "",
          unitPrice: sup.unitPrice || 0,
        },
      ]);
    }
  };

  // Xóa một dòng mặt hàng
  const handleRemoveLine = (tempId: string) => {
    setLines((prev) => prev.filter((l) => l.tempId !== tempId));
  };

  // Cập nhật số lượng của 1 dòng
  const handleUpdateQuantity = (tempId: string, val: string | number) => {
    const qty = typeof val === "string" ? parseInt(val, 10) || 0 : val;
    setLines((prev) =>
      prev.map((l) => (l.tempId === tempId ? { ...l, quantity: Math.max(qty, 0) } : l))
    );
  };

  // Cập nhật số lô
  const handleUpdateBatchNumber = (tempId: string, batchNumber: string) => {
    setLines((prev) =>
      prev.map((l) => (l.tempId === tempId ? { ...l, batchNumber } : l))
    );
  };

  // Cập nhật đơn giá
  const handleUpdateUnitPrice = (tempId: string, val: string) => {
    const price = parseFloat(val) || 0;
    setLines((prev) =>
      prev.map((l) => (l.tempId === tempId ? { ...l, unitPrice: price } : l))
    );
  };

  // Cập nhật hạn dùng
  const handleSetExpiryDate = (dateStr: string) => {
    if (activeExpiryLineId) {
      setLines((prev) =>
        prev.map((l) =>
          l.tempId === activeExpiryLineId ? { ...l, expiryDate: dateStr } : l
        )
      );
      setActiveExpiryLineId(null);
    }
  };

  // Tính tổng
  const totalItemsCount = lines.length;
  const totalQuantity = lines.reduce((acc, l) => acc + (l.quantity || 0), 0);

  // Submit phiếu
  const handleSubmit = async () => {
    if (lines.length === 0) {
      setErrorMsg("Phiếu phải có ít nhất 1 mặt hàng. Vui lòng bấm '+ Thêm mặt hàng'.");
      return;
    }

    // Kiểm tra số lượng hợp lệ
    for (const line of lines) {
      if (!line.quantity || line.quantity <= 0) {
        setErrorMsg(`Mặt hàng "${line.supply.name}" chưa nhập số lượng hợp lệ.`);
        return;
      }
      if (type === "out" && line.quantity > line.supply.quantity) {
        setErrorMsg(
          `Mặt hàng "${line.supply.name}" xuất ${line.quantity} vượt quá tồn kho (${line.supply.quantity} ${line.supply.unit}).`
        );
        return;
      }
    }

    if (!reason.trim()) {
      setErrorMsg("Vui lòng nhập lý do nhập/xuất kho.");
      return;
    }

    if (type === "in" && !selectedSupplier.trim()) {
      setErrorMsg("Vui lòng chọn Nhà cung cấp cho phiếu nhập kho.");
      return;
    }

    if (!selectedWarehouse.trim()) {
      setErrorMsg(
        type === "in"
          ? "Vui lòng chọn Kho tiếp nhận hàng nhập."
          : "Vui lòng chọn Kho xuất hàng."
      );
      return;
    }

    if (type === "out" && !selectedDepartment) {
      setErrorMsg("Vui lòng chọn Khoa / Phòng nhận vật tư.");
      return;
    }

    setErrorMsg("");
    setSubmitting(true);

    try {
      const itemsPayload: BatchStockLineItem[] = lines.map((l) => ({
        supplyId: l.supply.id,
        quantity: l.quantity,
        batchNumber: l.batchNumber.trim() || undefined,
        expiryDate: l.expiryDate ? new Date(l.expiryDate).toISOString() : undefined,
        unitPrice: l.unitPrice || undefined,
      }));

      const payload: BatchStockPayload = {
        type,
        batchCode: voucherCode.trim() || undefined,
        supplier: type === "in" ? selectedSupplier : undefined,
        warehouseLocation: selectedWarehouse || undefined,
        recipientDepartment: type === "out" ? selectedDepartment : undefined,
        reason: reason.trim(),
        items: itemsPayload,
      };

      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể thực hiện lập phiếu.");
    } finally {
      setSubmitting(false);
    }
  };

  const isIn = type === "in";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerIconCircle,
                  { backgroundColor: isIn ? "#ecfdf5" : "#eff6ff" },
                ]}
              >
                <Ionicons
                  name={isIn ? "arrow-down-circle" : "arrow-up-circle"}
                  size={24}
                  color={isIn ? "#059669" : "#0284c7"}
                />
              </View>
              <View>
                <Text style={styles.headerTitle}>
                  {isIn ? "Phiếu Nhập Kho" : "Phiếu Xuất Cấp"}
                </Text>
                <Text style={styles.headerCode}>{voucherCode}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              disabled={submitting}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Tab Switcher: Nhập kho vs Xuất kho */}
          <View style={styles.typeSwitcher}>
            <TouchableOpacity
              style={[styles.typeBtn, isIn && styles.typeBtnActiveIn]}
              onPress={() => handleTypeChange("in")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-down"
                size={14}
                color={isIn ? "#ffffff" : "#059669"}
              />
              <Text style={[styles.typeBtnText, isIn && styles.typeBtnTextActive]}>
                Nhập kho (Thêm hàng)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeBtn, !isIn && styles.typeBtnActiveOut]}
              onPress={() => handleTypeChange("out")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-up"
                size={14}
                color={!isIn ? "#ffffff" : "#0284c7"}
              />
              <Text style={[styles.typeBtnText, !isIn && styles.typeBtnTextActive]}>
                Xuất kho (Cấp phát)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Thông báo lỗi nếu có */}
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#dc2626" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Thông tin chung */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Thông tin chứng từ</Text>

              {/* Ngày lập phiếu (Tái sử dụng DatePickerField) */}
              <DatePickerField
                label="Ngày chứng từ"
                value={voucherDate}
                onChange={setVoucherDate}
              />

              {/* Nhập kho: 1. Nhà cung cấp, 2. Kho tiếp nhận */}
              {isIn ? (
                <>
                  <DropdownSelectField
                    label="Nhà cung cấp *"
                    required
                    value={selectedSupplier}
                    placeholder="Chọn nhà cung cấp phân phối..."
                    icon="business"
                    iconColor="#059669"
                    iconBgColor="#ecfdf5"
                    onPress={() => setSelectModalType("supplier")}
                  />

                  <DropdownSelectField
                    label="Kho tiếp nhận (Nhập vào) *"
                    required
                    value={selectedWarehouse}
                    placeholder="Chọn kho tiếp nhận..."
                    icon="file-tray-full"
                    iconColor="#059669"
                    iconBgColor="#ecfdf5"
                    onPress={() => setSelectModalType("warehouse")}
                  />
                </>
              ) : (
                /* Xuất kho: 1. Kho xuất hàng, 2. Khoa/Phòng nhận */
                <>
                  <DropdownSelectField
                    label="Kho xuất hàng *"
                    required
                    value={selectedWarehouse}
                    placeholder="Chọn kho xuất hàng..."
                    icon="file-tray-full"
                    iconColor="#0284c7"
                    iconBgColor="#eff6ff"
                    onPress={() => setSelectModalType("warehouse")}
                  />

                  <DropdownSelectField
                    label="Khoa / Phòng nhận *"
                    required
                    value={selectedDepartment}
                    placeholder="Chọn khoa / phòng nhận..."
                    icon="medkit"
                    iconColor="#0284c7"
                    iconBgColor="#eff6ff"
                    onPress={() => setSelectModalType("department")}
                  />
                </>
              )}

              {/* Lý do */}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Lý do thực hiện *</Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    isIn
                      ? "VD: Nhập thêm hàng định kỳ vào kho"
                      : "VD: Cấp phát sử dụng cho phòng mổ"
                  }
                  placeholderTextColor="#94a3b8"
                  value={reason}
                  onChangeText={setReason}
                />
              </View>
            </View>

            {/* DANH SÁCH MẶT HÀNG (Line items) */}
            <View style={styles.sectionBox}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.sectionTitle}>
                    Danh sách mặt hàng ({lines.length})
                  </Text>
                  {isIn && Boolean(selectedSupplier) && (
                    <Text style={styles.supplierFilterHint} numberOfLines={1}>
                      Theo NCC: <Text style={{ fontWeight: "700", color: "#059669" }}>{selectedSupplier}</Text>
                    </Text>
                  )}
                  {!isIn && Boolean(selectedWarehouse) && (
                    <Text style={styles.warehouseFilterHint} numberOfLines={1}>
                      Xuất từ kho: <Text style={{ fontWeight: "700", color: "#0284c7" }}>{selectedWarehouse}</Text>
                    </Text>
                  )}
                </View>
                <AppButton
                  variant="outline"
                  size="sm"
                  icon="add-circle"
                  title="Thêm mặt hàng"
                  onPress={handleOpenSupplyPicker}
                  style={{ borderColor: "#a7f3d0", backgroundColor: "#ecfdf5" }}
                  textStyle={{ color: "#059669", fontWeight: "700" }}
                />
              </View>

              {lines.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptyLinesBox}
                  onPress={handleOpenSupplyPicker}
                  activeOpacity={0.7}
                >
                  <Ionicons name="basket-outline" size={32} color="#94a3b8" />
                  <Text style={styles.emptyLinesTitle}>Chưa có mặt hàng nào trong phiếu</Text>
                  <Text style={styles.emptyLinesDesc}>
                    {isIn
                      ? selectedSupplier
                        ? `Chạm vào đây để chọn các sản phẩm của nhà cung cấp "${selectedSupplier}"`
                        : "Chạm vào đây hoặc nút '+ Thêm mặt hàng' để chọn vật tư cần nhập"
                      : selectedWarehouse
                        ? `Chạm vào đây để chọn các vật tư trong kho "${selectedWarehouse}" để xuất cấp`
                        : "Chạm vào đây hoặc nút '+ Thêm mặt hàng' để chọn vật tư cần xuất"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.linesList}>
                  {lines.map((line, idx) => (
                    <BatchStockLineCard
                      key={line.tempId}
                      line={line}
                      index={idx}
                      isIn={isIn}
                      selectedSupplier={selectedSupplier}
                      selectedWarehouse={selectedWarehouse}
                      warehouses={warehouses}
                      onRemove={handleRemoveLine}
                      onUpdateQuantity={handleUpdateQuantity}
                      onUpdateBatchNumber={handleUpdateBatchNumber}
                      onUpdateUnitPrice={handleUpdateUnitPrice}
                      onOpenExpiryPicker={setActiveExpiryLineId}
                    />
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Bottom Bar: Tổng hợp & Nút Xác nhận */}
          <BatchStockFooter
            totalItemsCount={totalItemsCount}
            totalQuantity={totalQuantity}
            isIn={isIn}
            submitting={submitting}
            onClose={onClose}
            onSubmit={handleSubmit}
          />
        </View>
      </View>

      {/* TÁI SỬ DỤNG: InventorySelectModal cho Nhà cung cấp */}
      <InventorySelectModal
        visible={selectModalType === "supplier"}
        title="Chọn Nhà Cung Cấp"
        placeholderSearch="Tìm tên, mã, số điện thoại nhà cung cấp..."
        options={supplierOptions}
        selectedValue={selectedSupplier}
        onSelect={(opt) => {
          handleSelectSupplier(opt.label);
        }}
        onClose={() => setSelectModalType(null)}
      />

      {/* TÁI SỬ DỤNG: InventorySelectModal cho Kho lưu trữ */}
      <InventorySelectModal
        visible={selectModalType === "warehouse"}
        title={isIn ? "Chọn Kho Tiếp Nhận" : "Chọn Kho Xuất Hàng"}
        placeholderSearch="Tìm kiếm kho lưu trữ..."
        options={warehouseOptions}
        selectedValue={selectedWarehouse}
        onSelect={(opt) => {
          handleSelectWarehouse(opt.label);
        }}
        onClose={() => setSelectModalType(null)}
      />

      {/* TÁI SỬ DỤNG: InventorySelectModal cho Khoa / Phòng nhận */}
      <InventorySelectModal
        visible={selectModalType === "department"}
        title="Chọn Khoa / Phòng Nhận"
        placeholderSearch="Tìm khoa phòng..."
        options={departmentOptions}
        selectedValue={selectedDepartment}
        onSelect={(opt) => {
          setSelectedDepartment(opt.label);
          setSelectModalType(null);
        }}
        onClose={() => setSelectModalType(null)}
      />

      {/* TÁI SỬ DỤNG: InventorySelectModal cho Bộ chọn Vật tư Y Tế đưa vào phiếu */}
      <InventorySelectModal
        visible={selectModalType === "supply"}
        title={isIn ? "Chọn Mặt Hàng Nhập Kho" : "Chọn Mặt Hàng Xuất Cấp"}
        placeholderSearch={
          isIn
            ? "Tìm theo tên thuốc, mã vật tư, phân loại..."
            : "Tìm mặt hàng trong kho để xuất cấp..."
        }
        options={supplyOptions}
        bannerNode={
          isIn && Boolean(selectedSupplier) ? (
            <View style={styles.modalSupplierBanner}>
              <View style={styles.modalSupplierBannerIcon}>
                <Ionicons name="business" size={15} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalSupplierBannerTitle}>
                  Nhà cung cấp: <Text style={{ fontWeight: "800" }}>{selectedSupplier}</Text>
                </Text>
                <Text style={styles.modalSupplierBannerSubtitle}>
                  {supplierSupplies.length > 0
                    ? `Hiển thị ${supplierSupplies.length} mặt hàng của nhà cung cấp này`
                    : "Chưa có mặt hàng nào của NCC này (Chọn tab 'Tất cả' để nhập thêm)"}
                </Text>
              </View>
            </View>
          ) : !isIn && Boolean(selectedWarehouse) ? (
            <View style={styles.modalWarehouseBanner}>
              <View style={styles.modalWarehouseBannerIcon}>
                <Ionicons name="file-tray-full" size={15} color="#0284c7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalWarehouseBannerTitle}>
                  Kho xuất hàng: <Text style={{ fontWeight: "800" }}>{selectedWarehouse}</Text>
                </Text>
                <Text style={styles.modalWarehouseBannerSubtitle}>
                  {warehouseSupplies.length > 0
                    ? `Hiển thị ${warehouseSupplies.length} mặt hàng đang lưu trữ tại kho này`
                    : "Kho này chưa có mặt hàng nào (Chọn tab 'Tất cả' để xem toàn bộ)"}
                </Text>
              </View>
            </View>
          ) : undefined
        }
        tabs={
          isIn && Boolean(selectedSupplier)
            ? [
                {
                  id: "current",
                  label: "Sản phẩm của NCC",
                  count: supplierSupplies.length,
                },
                {
                  id: "all",
                  label: "Tất cả sản phẩm",
                  count: supplies.length,
                },
              ]
            : !isIn && Boolean(selectedWarehouse)
            ? [
                {
                  id: "current",
                  label: "Hàng trong kho",
                  count: warehouseSupplies.length,
                },
                {
                  id: "all",
                  label: "Tất cả vật tư",
                  count: supplies.length,
                },
              ]
            : undefined
        }
        activeTab={supplyFilterMode}
        onTabChange={(tabId) => setSupplyFilterMode(tabId as "current" | "all")}
        onSelect={(opt) => {
          const found = supplies.find((s) => s.id === opt.id);
          if (found) handleSelectSupply(found);
          setSelectModalType(null);
        }}
        onClose={() => setSelectModalType(null)}
      />



      {/* DatePickerModal: Hạn dùng của từng dòng */}
      <DatePickerModal
        visible={Boolean(activeExpiryLineId)}
        value={
          lines.find((l) => l.tempId === activeExpiryLineId)?.expiryDate || ""
        }
        title="Chọn hạn sử dụng (HSD)"
        onClose={() => setActiveExpiryLineId(null)}
        onChange={(date: string) => {
          handleSetExpiryDate(date);
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerCode: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
  },
  typeSwitcher: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  typeBtnActiveIn: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  typeBtnActiveOut: {
    backgroundColor: "#0284c7",
    borderColor: "#0284c7",
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  typeBtnTextActive: {
    color: "#ffffff",
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 14,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "600",
  },
  sectionBox: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldRow: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  supplierFilterHint: {
    fontSize: 11.5,
    color: "#64748b",
    marginTop: 2,
  },
  warehouseFilterHint: {
    fontSize: 11.5,
    color: "#64748b",
    marginTop: 2,
  },
  emptyLinesBox: {
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    gap: 6,
  },
  emptyLinesTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  emptyLinesDesc: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
  },
  linesList: {
    gap: 10,
  },
  modalSupplierBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ecfdf5",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  modalSupplierBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSupplierBannerTitle: {
    fontSize: 13,
    color: "#065f46",
  },
  modalSupplierBannerSubtitle: {
    fontSize: 11.5,
    color: "#047857",
    marginTop: 2,
  },
  modalWarehouseBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f0f9ff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  modalWarehouseBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  modalWarehouseBannerTitle: {
    fontSize: 13,
    color: "#0369a1",
  },
  modalWarehouseBannerSubtitle: {
    fontSize: 11.5,
    color: "#0284c7",
    marginTop: 2,
  },
});
