import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import type {
  InventoryCategory,
  InventorySupplier,
  InventorySupply,
  InventoryWarehouse,
} from "./types";
import { InventorySelectModal, type SelectOption } from "./InventorySelectModal";
import { CategoryFormModal } from "./CategoryFormModal";
import { WarehouseFormModal } from "./WarehouseFormModal";
import { SupplierFormModal } from "./SupplierFormModal";
import { supplyApi } from "../../api/supplyApi";

interface SupplyFormModalProps {
  visible: boolean;
  item: InventorySupply | null; // Nếu null thì là Thêm mới, có item thì là Sửa
  onClose: () => void;
  onSubmit: (formData: Partial<InventorySupply>) => Promise<void>;
  categories?: InventoryCategory[];
  warehouses?: InventoryWarehouse[];
  suppliers?: InventorySupplier[];
  onAddCategory?: (data: any) => Promise<void>;
  onAddWarehouse?: (data: any) => Promise<void>;
  onAddSupplier?: (data: any) => Promise<void>;
}

const COMMON_UNITS = ["Hộp", "Cái", "Gói", "Ống", "Chai", "Cuộn", "Bộ", "Thùng", "Vỉ", "Tép"];

export const SupplyFormModal: React.FC<SupplyFormModalProps> = ({
  visible,
  item,
  onClose,
  onSubmit,
  categories = [],
  warehouses = [],
  suppliers = [],
  onAddCategory,
  onAddWarehouse,
  onAddSupplier,
}) => {
  // 1. Định danh & Phân loại
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("Vật tư tiêu hao");
  const [unit, setUnit] = useState("Hộp");
  const [unitPrice, setUnitPrice] = useState("");

  // 2. Nguồn cung & Vị trí kho
  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [warehouseId, setWarehouseId] = useState<string | undefined>();
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState<string | undefined>();

  // 3. Tồn kho & Cảnh báo
  const [quantity, setQuantity] = useState(0);
  const [minQuantity, setMinQuantity] = useState("10");

  // 4. Lô hàng & Hạn sử dụng
  const [batchNumber, setBatchNumber] = useState("");
  const [manufactureDate, setManufactureDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [requiresExpiry, setRequiresExpiry] = useState(true);

  // 5. Kiểm định & Chứng nhận
  const [inspectionDate, setInspectionDate] = useState("");
  const [nextInspectionDate, setNextInspectionDate] = useState("");
  const [inspectionCertificateNumber, setInspectionCertificateNumber] = useState("");

  // 6. Nhiều hình ảnh & Tài liệu đính kèm
  const [imageUrl, setImageUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [documents, setDocuments] = useState<
    Array<{ name: string; fileUrl: string; fileType?: string; fileSize?: number; uploadedAt?: string }>
  >([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Dropdown Picker Modals
  const [pickerModal, setPickerModal] = useState<"category" | "warehouse" | "supplier" | null>(null);

  // Quick Add Sub-Modals
  const [quickAddModal, setQuickAddModal] = useState<"category" | "warehouse" | "supplier" | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (item) {
      setName(item.name || "");
      setCode(item.code || "");
      setCategory(item.category || "Vật tư tiêu hao");
      setUnit(item.unit || "Hộp");
      setUnitPrice(item.unitPrice ? String(item.unitPrice) : "");

      setWarehouseLocation(item.warehouseLocation || "");
      setWarehouseId(item.warehouseId);
      setSupplierName(item.supplierName && item.supplierName !== "Chưa xác định" ? item.supplierName : "");
      setSupplierId(item.supplierId);

      setQuantity(item.quantity || 0);
      setMinQuantity(String(item.minQuantity ?? 10));

      setBatchNumber(item.batchNumber && item.batchNumber !== "N/A" ? item.batchNumber : "");
      setManufactureDate(item.manufactureDate || "");
      setExpiryDate(item.expiryDate || "");
      setRequiresExpiry(item.requiresExpiry !== false);

      setInspectionDate(item.inspectionDate || todayStr);
      setNextInspectionDate(item.nextInspectionDate || "");
      setInspectionCertificateNumber(item.inspectionCertificateNumber || "");

      setImageUrl(item.imageUrl || "");
      setImages(item.images || (item.imageUrl ? [item.imageUrl] : []));
      setDocuments(item.documents || []);
      setNotes(item.notes || "");
    } else {
      setName("");
      setCode(`VT-${Date.now().toString().slice(-4)}`);
      setCategory(categories[0]?.name || "Vật tư tiêu hao");
      setUnit("Hộp");
      setUnitPrice("");

      setWarehouseLocation(warehouses[0]?.name || "KHO CHÍNH");
      setWarehouseId(warehouses[0]?.id);
      setSupplierName(suppliers[0]?.name || "");
      setSupplierId(suppliers[0]?.id);

      setQuantity(0);
      setMinQuantity("10");

      setBatchNumber("");
      setManufactureDate("");
      setExpiryDate("");
      setRequiresExpiry(true);

      setInspectionDate(todayStr);
      setNextInspectionDate("");
      setInspectionCertificateNumber("");

      setImageUrl("");
      setImages([]);
      setDocuments([]);
      setNotes("");
    }
  }, [item, visible, categories, warehouses, suppliers]);

  // CHỌN NHIỀU ẢNH TỪ THƯ VIỆN THIẾT BỊ
  const handlePickImagesFromLibrary = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Cần quyền truy cập",
          "Vui lòng cho phép ứng dụng truy cập thư viện ảnh để đính kèm hình ảnh vật tư.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setUploadingMedia(true);
      setUploadProgressText(`Đang tải lên ${result.assets.length} hình ảnh...`);

      const filesToUpload = result.assets.map((asset, index) => {
        const uriParts = asset.uri.split("/");
        const fileName = asset.fileName || uriParts[uriParts.length - 1] || `photo_${Date.now()}_${index}.jpg`;
        return {
          uri: asset.uri,
          name: fileName,
          type: asset.mimeType || "image/jpeg",
        };
      });

      const uploaded = await supplyApi.uploadFiles(filesToUpload);

      if (uploaded.length > 0) {
        const newUrls = uploaded.map((u) => u.fileUrl);
        setImages((prev) => {
          const combined = [...prev, ...newUrls];
          // Nếu chưa có ảnh bìa, lấy ảnh đầu tiên
          if (!imageUrl && combined.length > 0) {
            setImageUrl(combined[0]);
          }
          return combined;
        });
        Alert.alert("Thành công", `Đã tải lên ${uploaded.length} hình ảnh từ thư viện.`);
      }
    } catch (err: any) {
      Alert.alert("Lỗi tải ảnh", err.message || "Không thể tải lên ảnh từ thư viện.");
    } finally {
      setUploadingMedia(false);
      setUploadProgressText("");
    }
  };

  // CHỌN TÀI LIỆU (PDF, Word, Excel, CO/CQ, File kiểm định)
  const handlePickDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "image/*",
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setUploadingMedia(true);
      setUploadProgressText(`Đang tải lên ${result.assets.length} tệp tài liệu...`);

      const filesToUpload = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || "application/octet-stream",
      }));

      const uploaded = await supplyApi.uploadFiles(filesToUpload);

      if (uploaded.length > 0) {
        setDocuments((prev) => [...prev, ...uploaded]);
        Alert.alert("Thành công", `Đã đính kèm ${uploaded.length} tệp tài liệu.`);
      }
    } catch (err: any) {
      Alert.alert("Lỗi đính kèm", err.message || "Không thể tải lên tài liệu.");
    } finally {
      setUploadingMedia(false);
      setUploadProgressText("");
    }
  };

  // Xóa 1 ảnh khỏi danh sách
  const handleRemoveImage = (index: number) => {
    const targetUrl = images[index];
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    if (imageUrl === targetUrl) {
      setImageUrl(newImages.length > 0 ? newImages[0] : "");
    }
  };

  // Đặt ảnh làm ảnh đại diện chính
  const handleSetPrimaryImage = (url: string) => {
    setImageUrl(url);
  };

  // Xóa 1 tài liệu khỏi danh sách
  const handleRemoveDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Vui lòng nhập tên vật tư tiêu hao.");
      return;
    }
    if (!code.trim()) {
      alert("Vui lòng nhập mã vật tư.");
      return;
    }
    if (!category.trim()) {
      alert("Vui lòng chọn danh mục phân loại.");
      return;
    }
    if (!unit.trim()) {
      alert("Vui lòng nhập đơn vị tính.");
      return;
    }
    if (!warehouseLocation.trim()) {
      alert("Vui lòng chọn kho lưu trữ.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        category,
        unit: unit.trim(),
        minQuantity: parseInt(minQuantity, 10) || 0,
        unitPrice: parseFloat(unitPrice) || 0,
        warehouseLocation: warehouseLocation.trim(),
        warehouseId,
        supplierName: supplierName.trim() || undefined,
        supplier: supplierName.trim() || undefined,
        supplierId,
        requiresExpiry,
        batchNumber: batchNumber.trim() || undefined,
        manufactureDate: manufactureDate.trim() || undefined,
        expiryDate: requiresExpiry && expiryDate.trim() ? expiryDate.trim() : undefined,
        inspectionDate: inspectionDate.trim() || undefined,
        nextInspectionDate: nextInspectionDate.trim() || undefined,
        inspectionCertificateNumber: inspectionCertificateNumber.trim() || undefined,
        imageUrl: imageUrl || (images.length > 0 ? images[0] : undefined),
        images: images.length > 0 ? images : undefined,
        documents: documents.length > 0 ? documents : undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  // Category select options
  const categoryOptions: SelectOption[] = categories.map((c) => ({
    id: c.id,
    label: c.name,
    subLabel: `Mã: ${c.code}`,
    badge: `${c.itemCount} SP`,
    badgeColor: c.color || "#059669",
    icon: "layers-outline",
  }));

  // Warehouse select options
  const warehouseOptions: SelectOption[] = warehouses.map((w) => ({
    id: w.id,
    label: w.name,
    subLabel: `${w.location} • Thủ kho: ${w.managerName}`,
    badge: `${w.totalItemsCount} mục`,
    badgeColor: "#0284c7",
    icon: "archive-outline",
  }));

  // Supplier select options
  const supplierOptions: SelectOption[] = suppliers.map((s) => ({
    id: s.id,
    label: s.name,
    subLabel: `Mã: ${s.code} • SĐT: ${s.phone || "Chưa có"}`,
    badge: s.shortName,
    badgeColor: "#059669",
    icon: "business-outline",
  }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name={item ? "create-outline" : "cube-outline"}
                  size={20}
                  color="#059669"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {item ? "Cập nhật Danh mục Vật tư" : "Khai báo Danh mục Vật tư mới"}
                </Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  Tên, mã, phân loại, hạn dùng, chứng nhận & hình ảnh đính kèm
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Form Scroll */}
          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* ========================================================
                NHÓM 1: THÔNG TIN ĐỊNH DANH & PHÂN LOẠI
            ======================================================== */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="cube" size={15} color="#059669" />
                  <Text style={styles.sectionTitle}>1. THÔNG TIN ĐỊNH DANH & PHÂN LOẠI</Text>
                </View>
                <Text style={styles.requiredHint}>* Bắt buộc</Text>
              </View>

              {/* Tên vật tư */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  Tên vật tư tiêu hao <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="VD: Găng tay y tế Nitrile không bột Vglove (Size M)"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Mã vật tư & Đơn vị tính */}
              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                  <Text style={styles.label}>
                    Mã vật tư <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, { fontFamily: "monospace", fontWeight: "700" }]}
                    placeholder="VD: VT-GT-01"
                    placeholderTextColor="#94a3b8"
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>
                    Đơn vị tính <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Hộp, Cái, Lọ..."
                    placeholderTextColor="#94a3b8"
                    value={unit}
                    onChangeText={setUnit}
                  />
                </View>
              </View>

              {/* Gợi ý đơn vị tính nhanh */}
              <View style={styles.quickUnitsRow}>
                {COMMON_UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.quickUnitChip, unit === u && styles.quickUnitChipActive]}
                    onPress={() => setUnit(u)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.quickUnitText, unit === u && styles.quickUnitTextActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* DROPDOWN: Danh mục phân loại */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  Danh mục phân loại <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setPickerModal("category")}
                  activeOpacity={0.7}
                >
                  <View style={styles.dropdownLeft}>
                    <View style={[styles.dropdownIconCircle, { backgroundColor: "#ecfdf5" }]}>
                      <Ionicons name="layers-outline" size={16} color="#059669" />
                    </View>
                    <Text style={styles.dropdownValueText}>
                      {category || "Chọn hoặc thêm danh mục phân loại..."}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Đơn giá nhập dự kiến */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Đơn giá nhập dự kiến (VNĐ)</Text>
                <View style={styles.priceInputWrapper}>
                  <TextInput
                    style={[styles.input, { paddingRight: 55 }]}
                    placeholder="VD: 85000"
                    placeholderTextColor="#94a3b8"
                    value={unitPrice}
                    onChangeText={setUnitPrice}
                    keyboardType="numeric"
                  />
                  <Text style={styles.currencyBadge}>VNĐ</Text>
                </View>
              </View>
            </View>

            {/* ========================================================
                NHÓM 2: NGUỒN CUNG ỨNG & VỊ TRÍ LƯU TRỮ
            ======================================================== */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="business" size={15} color="#0284c7" />
                  <Text style={styles.sectionTitle}>2. NGUỒN CUNG ỨNG & VỊ TRÍ LƯU TRỮ</Text>
                </View>
              </View>

              {/* DROPDOWN: Nhà cung cấp */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  Nhà cung cấp / Hãng sản xuất <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setPickerModal("supplier")}
                  activeOpacity={0.7}
                >
                  <View style={styles.dropdownLeft}>
                    <View style={[styles.dropdownIconCircle, { backgroundColor: "#f0fdf4" }]}>
                      <Ionicons name="business-outline" size={16} color="#16a34a" />
                    </View>
                    <Text style={styles.dropdownValueText}>
                      {supplierName || "Chọn hoặc bấm + Thêm nhà cung cấp..."}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* DROPDOWN: Vị trí kho lưu trữ */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  Vị trí kho lưu trữ <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setPickerModal("warehouse")}
                  activeOpacity={0.7}
                >
                  <View style={styles.dropdownLeft}>
                    <View style={[styles.dropdownIconCircle, { backgroundColor: "#f0f9ff" }]}>
                      <Ionicons name="archive-outline" size={16} color="#0284c7" />
                    </View>
                    <Text style={styles.dropdownValueText}>
                      {warehouseLocation || "Chọn hoặc bấm + Thêm kho lưu trữ..."}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            {/* ========================================================
                NHÓM 3: THIẾT LẬP TỒN KHO & CẢNH BÁO
            ======================================================== */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="layers" size={15} color="#059669" />
                  <Text style={styles.sectionTitle}>3. THIẾT LẬP TỒN KHO & CẢNH BÁO</Text>
                </View>
              </View>

              <View style={styles.rowFields}>
                {/* Số lượng tồn kho (read-only) */}
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Số lượng tồn kho</Text>
                  <View style={styles.priceInputWrapper}>
                    <TextInput
                      style={[styles.input, styles.readOnlyInput]}
                      value={String(quantity)}
                      editable={false}
                    />
                    <Text style={styles.unitSuffix}>{unit || "đơn vị"}</Text>
                  </View>
                </View>

                {/* Mức tồn tối thiểu */}
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Mức tồn tối thiểu</Text>
                  <View style={styles.priceInputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="10"
                      placeholderTextColor="#94a3b8"
                      value={minQuantity}
                      onChangeText={setMinQuantity}
                      keyboardType="numeric"
                    />
                    <Text style={styles.unitSuffix}>{unit || "đơn vị"}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={16} color="#0284c7" />
                <Text style={styles.infoBannerText}>
                  {item
                    ? "Số tồn chỉ thay đổi qua chứng từ kho. Lô, kho, giá và đơn vị được cập nhật đồng bộ."
                    : "Sản phẩm mới có tồn kho ban đầu bằng 0. Sau khi tạo danh mục, dùng \"+ Nhập kho theo lô\" để nhập số lượng hàng."}
                </Text>
              </View>
            </View>

            {/* ========================================================
                NHÓM 4: LÔ HÀNG & HẠN SỬ DỤNG
            ======================================================== */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="calendar" size={15} color="#d97706" />
                  <Text style={styles.sectionTitle}>4. LÔ HÀNG & HẠN SỬ DỤNG</Text>
                </View>
              </View>

              {/* Số lô & Ngày sản xuất */}
              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                  <Text style={styles.label}>Số lô sản xuất (Batch/Lot)</Text>
                  <TextInput
                    style={[styles.input, { fontFamily: "monospace" }]}
                    placeholder="VD: LOT-2026-A1"
                    placeholderTextColor="#94a3b8"
                    value={batchNumber}
                    onChangeText={setBatchNumber}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Ngày sản xuất (NSX)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={manufactureDate}
                    onChangeText={setManufactureDate}
                  />
                </View>
              </View>

              {/* Hạn sử dụng (HSD) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Hạn sử dụng (HSD)</Text>
                <TextInput
                  style={[styles.input, !requiresExpiry && styles.readOnlyInput]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={expiryDate}
                  onChangeText={setExpiryDate}
                  editable={requiresExpiry}
                />
              </View>

              {/* Switch Quản lý hạn dùng */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Vật tư có quản lý hạn dùng</Text>
                  <Text style={styles.switchDesc}>Bật tính năng theo dõi cận hạn và cảnh báo quá hạn</Text>
                </View>
                <Switch
                  value={requiresExpiry}
                  onValueChange={(val) => {
                    setRequiresExpiry(val);
                    if (!val) setExpiryDate("");
                  }}
                  trackColor={{ false: "#cbd5e1", true: "#a7f3d0" }}
                  thumbColor={requiresExpiry ? "#059669" : "#f1f5f9"}
                />
              </View>

              {requiresExpiry && !expiryDate && (
                <View style={styles.warningBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color="#d97706" />
                  <Text style={styles.warningBannerText}>
                    Chưa có hạn dùng: hàng chưa được phép xuất dùng vào phòng điều trị.
                  </Text>
                </View>
              )}
            </View>

            {/* ========================================================
                NHÓM 5: KIỂM ĐỊNH & CHỨNG NHẬN CHẤT LƯỢNG
            ======================================================== */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="shield-checkmark" size={15} color="#059669" />
                  <Text style={styles.sectionTitle}>5. KIỂM ĐỊNH & CHỨNG NHẬN CHẤT LƯỢNG</Text>
                </View>
              </View>

              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Ngày kiểm định</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={inspectionDate}
                    onChangeText={setInspectionDate}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Hạn kiểm định tiếp theo</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={nextInspectionDate}
                    onChangeText={setNextInspectionDate}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Số phiếu / Giấy chứng nhận kiểm định</Text>
                <TextInput
                  style={[styles.input, { fontFamily: "monospace" }]}
                  placeholder="VD: KD-2026/08/BYT"
                  placeholderTextColor="#94a3b8"
                  value={inspectionCertificateNumber}
                  onChangeText={setInspectionCertificateNumber}
                />
              </View>
            </View>

            {/* ========================================================
                NHÓM 6: HÌNH ẢNH TỪ THƯ VIỆN & TÀI LIỆU ĐÍNH KÈM
            ======================================================== */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="images" size={15} color="#6366f1" />
                  <Text style={styles.sectionTitle}>6. HÌNH ẢNH & TÀI LIỆU CO/CQ, HDSD</Text>
                </View>
              </View>

              {/* Đang tải lên spinner */}
              {uploadingMedia && (
                <View style={styles.uploadingBox}>
                  <ActivityIndicator size="small" color="#059669" />
                  <Text style={styles.uploadingText}>{uploadProgressText || "Đang xử lý tệp..."}</Text>
                </View>
              )}

              {/* 6.1: BỘ SƯU TẬP HÌNH ẢNH */}
              <View style={styles.fieldGroup}>
                <View style={styles.mediaTitleRow}>
                  <Text style={[styles.label, styles.mediaLabel]} numberOfLines={1}>
                    Ảnh sản phẩm ({images.length})
                  </Text>
                  <TouchableOpacity
                    style={styles.mediaAddBtn}
                    onPress={handlePickImagesFromLibrary}
                    disabled={uploadingMedia}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="image-outline" size={13} color="#059669" />
                    <Text style={styles.mediaAddBtnText}>+ Thư viện</Text>
                  </TouchableOpacity>
                </View>

                {images.length > 0 ? (
                  <View style={styles.imagesGrid}>
                    {images.map((imgUri, idx) => {
                      const isPrimary = imageUrl === imgUri;
                      return (
                        <View key={`${imgUri}-${idx}`} style={styles.imageCard}>
                          <Image source={{ uri: imgUri }} style={styles.imageCardThumb} />
                          {isPrimary && (
                            <View style={styles.primaryBadge}>
                              <Text style={styles.primaryBadgeText}>Ảnh bìa</Text>
                            </View>
                          )}
                          <TouchableOpacity
                            style={styles.imageDeleteBtn}
                            onPress={() => handleRemoveImage(idx)}
                            hitSlop={8}
                          >
                            <Ionicons name="close-circle" size={18} color="#ef4444" />
                          </TouchableOpacity>
                          {!isPrimary && (
                            <TouchableOpacity
                              style={styles.setPrimaryBtn}
                              onPress={() => handleSetPrimaryImage(imgUri)}
                            >
                              <Text style={styles.setPrimaryText}>Đặt làm bìa</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.emptyMediaBox}
                    onPress={handlePickImagesFromLibrary}
                    disabled={uploadingMedia}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="images-outline" size={26} color="#94a3b8" />
                    <Text style={styles.emptyMediaTitle}>Chưa có hình ảnh nào</Text>
                    <Text style={styles.emptyMediaDesc}>
                      Chạm để chọn một hoặc nhiều ảnh từ thư viện thiết bị
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 6.2: TÀI LIỆU ĐÍNH KÈM CO/CQ, HDSD */}
              <View style={[styles.fieldGroup, { marginTop: 8 }]}>
                <View style={styles.mediaTitleRow}>
                  <Text style={[styles.label, styles.mediaLabel]} numberOfLines={1}>
                    Tài liệu CO/CQ & HDSD ({documents.length})
                  </Text>
                  <TouchableOpacity
                    style={[styles.mediaAddBtn, { borderColor: "#bae6fd", backgroundColor: "#f0f9ff" }]}
                    onPress={handlePickDocuments}
                    disabled={uploadingMedia}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="attach-outline" size={14} color="#0284c7" />
                    <Text style={[styles.mediaAddBtnText, { color: "#0284c7" }]}>+ Đính kèm</Text>
                  </TouchableOpacity>
                </View>

                {documents.length > 0 ? (
                  <View style={styles.docsList}>
                    {documents.map((doc, idx) => (
                      <View key={`${doc.fileUrl}-${idx}`} style={styles.docRow}>
                        <View style={styles.docIconBox}>
                          <Ionicons
                            name={
                              doc.fileType?.includes("pdf")
                                ? "document-text"
                                : doc.fileType?.includes("image")
                                ? "image"
                                : "document"
                            }
                            size={18}
                            color="#0284c7"
                          />
                        </View>
                        <View style={styles.docInfo}>
                          <Text style={styles.docName} numberOfLines={1}>
                            {doc.name}
                          </Text>
                          {doc.fileSize ? (
                            <Text style={styles.docSize}>
                              {Math.round(doc.fileSize / 1024)} KB
                            </Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          style={styles.docDeleteBtn}
                          onPress={() => handleRemoveDocument(idx)}
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.emptyMediaBox}
                    onPress={handlePickDocuments}
                    disabled={uploadingMedia}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="document-attach-outline" size={26} color="#94a3b8" />
                    <Text style={styles.emptyMediaTitle}>Chưa có tài liệu đính kèm</Text>
                    <Text style={styles.emptyMediaDesc}>
                      Chạm để đính kèm tệp CO/CQ, PDF, Word hoặc bảng thông số
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 6.3: Ghi chú bảo quản */}
              <View style={[styles.fieldGroup, { marginTop: 8 }]}>
                <Text style={styles.label}>Ghi chú điều kiện bảo quản & Lưu ý sử dụng</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="VD: Bảo quản 2-8°C, tránh ánh sáng trực tiếp, độ ẩm < 70%. Sử dụng một lần duy nhất..."
                  placeholderTextColor="#94a3b8"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting || uploadingMedia}
            >
              <Ionicons name={item ? "checkmark-circle-outline" : "add"} size={18} color="#ffffff" />
              <Text style={styles.submitBtnText}>
                {submitting ? "Đang lưu..." : item ? "Lưu thay đổi" : "Thêm vật tư"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* DROPDOWN 1: Chọn Danh Mục */}
      <InventorySelectModal
        visible={pickerModal === "category"}
        title="Chọn Danh Mục Phân Loại"
        placeholderSearch="Tìm danh mục phân loại..."
        options={categoryOptions}
        selectedValue={category}
        onSelect={(opt) => setCategory(opt.label)}
        onClose={() => setPickerModal(null)}
        onAddNew={onAddCategory ? () => setQuickAddModal("category") : undefined}
        addNewLabel="+ Thêm phân loại"
      />

      {/* DROPDOWN 2: Chọn Kho Lưu Trữ */}
      <InventorySelectModal
        visible={pickerModal === "warehouse"}
        title="Chọn Kho Lưu Trữ"
        placeholderSearch="Tìm kiếm kho lưu trữ..."
        options={warehouseOptions}
        selectedValue={warehouseLocation}
        onSelect={(opt) => {
          setWarehouseLocation(opt.label);
          setWarehouseId(opt.id);
        }}
        onClose={() => setPickerModal(null)}
        onAddNew={onAddWarehouse ? () => setQuickAddModal("warehouse") : undefined}
        addNewLabel="+ Thêm kho"
      />

      {/* DROPDOWN 3: Chọn Nhà Cung Cấp */}
      <InventorySelectModal
        visible={pickerModal === "supplier"}
        title="Chọn Nhà Cung Cấp"
        placeholderSearch="Tìm tên, mã nhà cung cấp..."
        options={supplierOptions}
        selectedValue={supplierName}
        onSelect={(opt) => {
          setSupplierName(opt.label);
          setSupplierId(opt.id);
        }}
        onClose={() => setPickerModal(null)}
        onAddNew={onAddSupplier ? () => setQuickAddModal("supplier") : undefined}
        addNewLabel="+ Thêm NCC"
      />

      {/* QUICK ADD MODAL: Danh Mục */}
      {onAddCategory && (
        <CategoryFormModal
          visible={quickAddModal === "category"}
          item={null}
          onClose={() => setQuickAddModal(null)}
          onSubmit={async (data) => {
            await onAddCategory(data);
            setCategory(data.name);
            setQuickAddModal(null);
          }}
        />
      )}

      {/* QUICK ADD MODAL: Kho */}
      {onAddWarehouse && (
        <WarehouseFormModal
          visible={quickAddModal === "warehouse"}
          item={null}
          onClose={() => setQuickAddModal(null)}
          onSubmit={async (data) => {
            await onAddWarehouse(data);
            setWarehouseLocation(data.name);
            setQuickAddModal(null);
          }}
        />
      )}

      {/* QUICK ADD MODAL: Nhà Cung Cấp */}
      {onAddSupplier && (
        <SupplierFormModal
          visible={quickAddModal === "supplier"}
          item={null}
          onClose={() => setQuickAddModal(null)}
          onSubmit={async (data) => {
            await onAddSupplier(data);
            setSupplierName(data.name);
            setQuickAddModal(null);
          }}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  formScroll: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#334155",
    letterSpacing: 0.4,
  },
  requiredHint: {
    fontSize: 11,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  fieldGroup: {
    marginBottom: 12,
  },
  rowFields: {
    flexDirection: "row",
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  required: {
    color: "#ef4444",
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "500",
  },
  readOnlyInput: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
    borderColor: "#e2e8f0",
  },
  priceInputWrapper: {
    position: "relative",
    justifyContent: "center",
  },
  currencyBadge: {
    position: "absolute",
    right: 12,
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  unitSuffix: {
    position: "absolute",
    right: 12,
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  quickUnitsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: -4,
    marginBottom: 12,
  },
  quickUnitChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  quickUnitChipActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  quickUnitText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  quickUnitTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
  dropdownButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  dropdownIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownValueText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    flex: 1,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#f0f9ff",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#bae6fd",
    marginTop: 2,
  },
  infoBannerText: {
    fontSize: 11,
    color: "#0369a1",
    lineHeight: 16,
    flex: 1,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
  },
  switchDesc: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fde68a",
    marginTop: 6,
  },
  warningBannerText: {
    fontSize: 11,
    color: "#92400e",
    flex: 1,
    fontWeight: "500",
  },
  mediaTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  mediaLabel: {
    flex: 1,
    marginBottom: 0,
  },
  mediaAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "#ecfdf5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    flexShrink: 0,
  },
  mediaAddBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  uploadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#86efac",
    marginBottom: 12,
  },
  uploadingText: {
    fontSize: 12,
    color: "#15803d",
    fontWeight: "600",
  },
  emptyMediaBox: {
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  emptyMediaTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginTop: 6,
  },
  emptyMediaDesc: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 2,
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  imageCard: {
    width: 76,
    height: 76,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    position: "relative",
    backgroundColor: "#f1f5f9",
  },
  imageCardThumb: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  primaryBadge: {
    position: "absolute",
    bottom: 2,
    left: 2,
    right: 2,
    backgroundColor: "rgba(5, 150, 105, 0.85)",
    borderRadius: 4,
    paddingVertical: 1,
    alignItems: "center",
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#ffffff",
  },
  imageDeleteBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#ffffff",
    borderRadius: 10,
  },
  setPrimaryBtn: {
    position: "absolute",
    bottom: 2,
    left: 2,
    right: 2,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    borderRadius: 4,
    paddingVertical: 1,
    alignItems: "center",
  },
  setPrimaryText: {
    fontSize: 8,
    fontWeight: "600",
    color: "#ffffff",
  },
  docsList: {
    gap: 6,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 8,
    gap: 8,
  },
  docIconBox: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: "#f0f9ff",
    alignItems: "center",
    justifyContent: "center",
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  docSize: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 1,
  },
  docDeleteBtn: {
    padding: 4,
  },
  textArea: {
    height: 70,
    textAlignVertical: "top",
    paddingTop: 8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#059669",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
