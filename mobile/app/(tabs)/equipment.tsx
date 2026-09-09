import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { DatePickerModal } from "../../src/features/credentials/DatePickerModal";
import { EmptyState } from "../../src/ui";
import { equipment } from "../../src/api/services";
import type {
  EquipmentRecord,
  EquipmentSummary,
  EquipmentComplianceSummary,
} from "../../../src/types/equipment";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("using") || s.includes("dùng") || s.includes("đang") || s.includes("in_use"))
    return { label: "Đang dùng", color: "#047857", bg: "#f0fdf4" };
  if (s.includes("ready") || s.includes("sẵn") || s.includes("avail"))
    return { label: "Sẵn sàng", color: "#0284c7", bg: "#f0f9ff" };
  if (s.includes("booked") || s.includes("đơn") || s.includes("đặt") || s.includes("order"))
    return { label: "Đã có đơn", color: "#6366f1", bg: "#eef2ff" };
  if (s.includes("maint") || s.includes("bảo trì") || s.includes("sửa") || s.includes("repair"))
    return { label: "Bảo trì", color: "#b45309", bg: "#fffbeb" };
  if (s.includes("dispos") || s.includes("thanh lý") || s.includes("hỏng") || s.includes("scrap"))
    return { label: "Thanh lý", color: "#64748b", bg: "#f8fafc" };
  return { label: status || "Khác", color: "#475569", bg: "#f1f5f9" };
}

const STATUS_OPTIONS = [
  { label: "Sẵn sàng", value: "ready" },
  { label: "Đang dùng", value: "using" },
  { label: "Đã có đơn", value: "booked" },
  { label: "Bảo trì", value: "maintenance" },
  { label: "Thanh lý", value: "disposed" },
];

const RISK_OPTIONS = [
  { label: "Chưa phân nhóm", value: "Chưa phân nhóm" },
  { label: "Loại A (Rủi ro thấp)", value: "Loại A" },
  { label: "Loại B (Rủi ro trung bình thấp)", value: "Loại B" },
  { label: "Loại C (Rủi ro trung bình cao)", value: "Loại C" },
  { label: "Loại D (Rủi ro cao)", value: "Loại D" },
];

const INSPECTION_RESULT_OPTIONS = [
  { label: "✓ Đạt chuẩn (Pass)", value: "Pass" },
  { label: "✗ Không đạt (Fail)", value: "Fail" },
  { label: "Chờ đánh giá", value: "Pending" },
];

function formatDateDisplay(isoStr?: string): string {
  if (!isoStr) return "";
  const clean = isoStr.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoStr;
}

// ── SwipeableItem ─────────────────────────────────────────────────────────────
function SwipeableItem({
  item,
  onEdit,
  onDelete,
}: {
  item: EquipmentRecord;
  onEdit: (item: EquipmentRecord) => void;
  onDelete: (item: EquipmentRecord) => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dy) < Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        const val = Math.max(-120, Math.min(0, g.dx + (isOpen.current ? -120 : 0)));
        translateX.setValue(val);
      },
      onPanResponderRelease: (_, g) => {
        const finalDx = g.dx + (isOpen.current ? -120 : 0);
        if (finalDx < -80) {
          Animated.spring(translateX, { toValue: -120, useNativeDriver: true }).start();
          isOpen.current = true;
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          isOpen.current = false;
        }
      },
    }),
  ).current;

  const close = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    isOpen.current = false;
  };

  const badge = getStatusBadge(item.status);
  const inspectionDate = item.nextInspectionDate
    ? new Date(item.nextInspectionDate).toLocaleDateString("vi-VN")
    : "Chưa cập nhật";

  return (
    <View style={styles.swipeWrapper}>
      <View style={styles.actionButtons}>
        <Pressable style={styles.editBtn} onPress={() => { close(); onEdit(item); }}>
          <Ionicons name="pencil" size={18} color="#ffffff" />
          <Text style={styles.actionBtnText}>Sửa</Text>
        </Pressable>
        <Pressable style={styles.deleteBtn} onPress={() => { close(); onDelete(item); }}>
          <Ionicons name="trash" size={18} color="#ffffff" />
          <Text style={styles.actionBtnText}>Xóa</Text>
        </Pressable>
      </View>
      <Animated.View style={[styles.itemCard, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <View style={styles.itemCardTop}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemCode}>
              {item.code || "N/A"}
              {item.department || item.departmentName ? ` · ${item.department || item.departmentName}` : ""}
            </Text>
          </View>
          <View style={[styles.itemBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.itemBadgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>
        <View style={styles.itemFooter}>
          <Text style={styles.itemMeta}>
            Hạn kiểm định: <Text style={styles.normalDate}>{inspectionDate}</Text>
          </Text>
          {item.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.category}</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

// ── Select Picker Modal ───────────────────────────────────────────────────────
function SelectModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { label: string; value: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={selectStyles.overlay} onPress={onClose}>
        <View style={selectStyles.sheet} onStartShouldSetResponder={() => true}>
          <View style={selectStyles.header}>
            <Text style={selectStyles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color="#64748b" />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {options.map((opt) => {
              const selected = opt.value === selectedValue;
              return (
                <Pressable
                  key={opt.value}
                  style={[selectStyles.optionItem, selected && selectStyles.optionItemActive]}
                  onPress={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                >
                  <Text style={[selectStyles.optionText, selected && selectStyles.optionTextActive]}>
                    {opt.label}
                  </Text>
                  {selected && <Ionicons name="checkmark-circle" size={20} color="#008852" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

// ── Equipment Form Modal ──────────────────────────────────────────────────────
function EquipmentModal({
  visible,
  onClose,
  onSaved,
  editItem,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  editItem: EquipmentRecord | null;
}) {
  const isEdit = !!editItem;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("ready");
  const [riskClassification, setRiskClassification] = useState("Chưa phân nhóm");
  const [inspectionIntervalMonths, setInspectionIntervalMonths] = useState("12");
  const [manufacturer, setManufacturer] = useState("");
  const [origin, setOrigin] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [lastInspectionDate, setLastInspectionDate] = useState("");
  const [nextInspectionDate, setNextInspectionDate] = useState("");
  const [inspectionResult, setInspectionResult] = useState("Pass");
  const [inspectionAgency, setInspectionAgency] = useState("");
  const [inspectionCertFile, setInspectionCertFile] = useState("");
  const [documents, setDocuments] = useState<{ name: string; uri: string }[]>([]);
  const [location, setLocation] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [usageStartDate, setUsageStartDate] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [saving, setSaving] = useState(false);

  const [activeDatePicker, setActiveDatePicker] = useState<
    "lastInspectionDate" | "nextInspectionDate" | "purchaseDate" | "usageStartDate" | null
  >(null);
  const [activeSelectPicker, setActiveSelectPicker] = useState<
    "status" | "riskClassification" | "inspectionResult" | null
  >(null);

  const resetToItem = useCallback(() => {
    setName(editItem?.name ?? "");
    setCode(editItem?.code ?? "");
    setCategory(editItem?.category ?? "");
    setStatus(editItem?.status ?? "ready");
    setRiskClassification(editItem?.riskClassification ?? "Chưa phân nhóm");
    setInspectionIntervalMonths(editItem?.inspectionIntervalMonths ? String(editItem.inspectionIntervalMonths) : "12");
    setManufacturer(editItem?.manufacturer ?? "");
    setOrigin(editItem?.origin ?? "");
    setModel(editItem?.model ?? "");
    setSerialNumber(editItem?.serialNumber ?? "");
    setLastInspectionDate(editItem?.lastInspectionDate ? editItem.lastInspectionDate.slice(0, 10) : "");
    setNextInspectionDate(editItem?.nextInspectionDate ? editItem.nextInspectionDate.slice(0, 10) : "");
    setInspectionResult(editItem?.inspectionResult ?? "Pass");
    setInspectionAgency(editItem?.inspectionAgency ?? "");
    setInspectionCertFile(editItem?.inspectionCertFile ?? "");
    setDocuments(editItem?.documents ?? []);
    setLocation(editItem?.location ?? "");
    setPurchaseDate(editItem?.purchaseDate ? editItem.purchaseDate.slice(0, 10) : "");
    setUsageStartDate(editItem?.usageStartDate ? editItem.usageStartDate.slice(0, 10) : "");
    setNotes(editItem?.notes ?? "");
    setImageUri(editItem?.imageUri ?? "");
  }, [editItem]);

  const pickImage = async () => {
    try {
      const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm !== "granted") {
        Alert.alert("Quyền truy cập", "Cần quyền truy cập thư viện để chọn ảnh thiết bị.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Lỗi", "Không thể chọn ảnh.");
    }
  };

  const pickCertFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setInspectionCertFile(result.assets[0].name);
      }
    } catch {
      // ignore
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setDocuments((prev) => [...prev, { name: file.name, uri: file.uri }]);
      }
    } catch {
      // ignore
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên thiết bị.");
      return;
    }
    if (!code.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập mã thiết bị.");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<EquipmentRecord> = {
        name: name.trim(),
        code: code.trim(),
        category: category.trim() || undefined,
        status,
        riskClassification: riskClassification || undefined,
        inspectionIntervalMonths: inspectionIntervalMonths.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        origin: origin.trim() || undefined,
        model: model.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        lastInspectionDate: lastInspectionDate || undefined,
        nextInspectionDate: nextInspectionDate || undefined,
        inspectionResult: inspectionResult || undefined,
        inspectionAgency: inspectionAgency.trim() || undefined,
        inspectionCertFile: inspectionCertFile || undefined,
        documents: documents.length > 0 ? documents : undefined,
        location: location.trim() || undefined,
        purchaseDate: purchaseDate || undefined,
        usageStartDate: usageStartDate || undefined,
        notes: notes.trim() || undefined,
        imageUri: imageUri || undefined,
      };
      if (isEdit && editItem) {
        await equipment.update(editItem._id, payload);
      } else {
        await equipment.create(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thể lưu thiết bị.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onShow={resetToItem} onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.handleBar} />
          <View style={modal.header}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={modal.title}>{isEdit ? "Chỉnh sửa Thiết bị" : "Thêm Thiết bị Mới"}</Text>
              <Text style={modal.subtitle}>Điền thông tin định danh, kỹ thuật, vị trí và chu kỳ kiểm định</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={modal.closeBtn}>
              <Ionicons name="close" size={20} color="#64748b" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
            {/* Ảnh thiết bị */}
            <Pressable style={modal.uploadBox} onPress={pickImage}>
              {imageUri ? (
                <View style={modal.previewWrap}>
                  <Image source={{ uri: imageUri }} style={modal.imagePreview} resizeMode="cover" />
                  <Pressable style={modal.removeImageBtn} onPress={() => setImageUri("")}>
                    <Ionicons name="close-circle" size={22} color="#dc2626" />
                  </Pressable>
                </View>
              ) : (
                <View style={modal.uploadContent}>
                  <View style={modal.uploadIconWrap}>
                    <Ionicons name="image-outline" size={24} color="#64748b" />
                  </View>
                  <Text style={modal.uploadTitle}>Bấm để tải lên ảnh thiết bị</Text>
                  <Text style={modal.uploadSubtitle}>Hỗ trợ PNG, JPG, JPEG, WEBP (tối đa 10MB)</Text>
                </View>
              )}
            </Pressable>

            {/* Thông tin cơ bản */}
            <View style={modal.twoCol}>
              <View style={modal.col}>
                <Text style={modal.label}>Tên thiết bị <Text style={modal.required}>*</Text></Text>
                <TextInput
                  style={modal.input}
                  placeholder="VD: Máy Laser CO2 Fractional"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                />
              </View>
              <View style={modal.col}>
                <Text style={modal.label}>Mã thiết bị <Text style={modal.required}>*</Text></Text>
                <TextInput
                  style={modal.input}
                  placeholder="VD: ML-01"
                  placeholderTextColor="#94a3b8"
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={modal.twoCol}>
              <View style={modal.col}>
                <Text style={modal.label}>Danh mục thiết bị <Text style={modal.required}>*</Text></Text>
                <TextInput
                  style={modal.input}
                  placeholder="VD: Thiết bị laser, Máy soi da..."
                  placeholderTextColor="#94a3b8"
                  value={category}
                  onChangeText={setCategory}
                />
              </View>
              <View style={modal.col}>
                <Text style={modal.label}>Trạng thái vận hành</Text>
                <Pressable style={modal.selector} onPress={() => setActiveSelectPicker("status")}>
                  <Text style={modal.selectorText} numberOfLines={1}>
                    {STATUS_OPTIONS.find((o) => o.value === status)?.label || "Sẵn sàng"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#64748b" />
                </Pressable>
              </View>
            </View>

            {/* HỒ SƠ & PHÂN LOẠI THIẾT BỊ Y TẾ */}
            <View style={modal.sectionGreen}>
              <View style={modal.sectionHeader}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#059669" />
                <Text style={modal.sectionTitleGreen}>HỒ SƠ & PHÂN LOẠI THIẾT BỊ Y TẾ</Text>
              </View>

              <View style={modal.twoCol}>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Phân loại mức độ rủi ro (Bộ Y tế)</Text>
                  <Pressable style={modal.selector} onPress={() => setActiveSelectPicker("riskClassification")}>
                    <Text style={modal.selectorText} numberOfLines={1}>
                      {riskClassification || "Chưa phân nhóm"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748b" />
                  </Pressable>
                </View>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Chu kỳ kiểm định định kỳ (tháng)</Text>
                  <TextInput
                    style={modal.input}
                    placeholder="12"
                    placeholderTextColor="#94a3b8"
                    value={inspectionIntervalMonths}
                    onChangeText={setInspectionIntervalMonths}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={modal.twoCol}>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Hãng sản xuất</Text>
                  <TextInput
                    style={modal.input}
                    placeholder="VD: Lutronic"
                    placeholderTextColor="#94a3b8"
                    value={manufacturer}
                    onChangeText={setManufacturer}
                  />
                </View>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Xuất xứ</Text>
                  <TextInput
                    style={modal.input}
                    placeholder="VD: Hàn Quốc"
                    placeholderTextColor="#94a3b8"
                    value={origin}
                    onChangeText={setOrigin}
                  />
                </View>
              </View>

              <View style={modal.twoCol}>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Ký hiệu Model</Text>
                  <TextInput
                    style={modal.input}
                    placeholder="VD: eCO2 Plus"
                    placeholderTextColor="#94a3b8"
                    value={model}
                    onChangeText={setModel}
                  />
                </View>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Số Seri (Serial No.)</Text>
                  <TextInput
                    style={modal.input}
                    placeholder="VD: SN-2026-99"
                    placeholderTextColor="#94a3b8"
                    value={serialNumber}
                    onChangeText={setSerialNumber}
                  />
                </View>
              </View>
            </View>

            {/* LỊCH KIỂM ĐỊNH & HIỆU CHUẨN & BẢO TRÌ */}
            <View style={modal.sectionGreen}>
              <View style={modal.sectionHeader}>
                <Ionicons name="time-outline" size={16} color="#059669" />
                <Text style={modal.sectionTitleGreen}>LỊCH KIỂM ĐỊNH & HIỆU CHUẨN & BẢO TRÌ</Text>
              </View>

              <View style={modal.twoCol}>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Ngày kiểm định gần nhất</Text>
                  <Pressable style={modal.dateField} onPress={() => setActiveDatePicker("lastInspectionDate")}>
                    <Text style={[modal.dateText, !lastInspectionDate && modal.placeholderText]}>
                      {formatDateDisplay(lastInspectionDate) || "dd/mm/yyyy"}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#64748b" />
                  </Pressable>
                </View>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Ngày đến hạn kiểm định tiếp theo</Text>
                  <Pressable style={modal.dateField} onPress={() => setActiveDatePicker("nextInspectionDate")}>
                    <Text style={[modal.dateText, !nextInspectionDate && modal.placeholderText]}>
                      {formatDateDisplay(nextInspectionDate) || "dd/mm/yyyy"}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#64748b" />
                  </Pressable>
                </View>
              </View>

              <View style={modal.twoCol}>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Kết quả thực hiện</Text>
                  <Pressable style={modal.selector} onPress={() => setActiveSelectPicker("inspectionResult")}>
                    <Text style={modal.selectorText} numberOfLines={1}>
                      {INSPECTION_RESULT_OPTIONS.find((o) => o.value === inspectionResult)?.label || inspectionResult || "✓ Đạt chuẩn (Pass)"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#64748b" />
                  </Pressable>
                </View>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Đơn vị thực hiện</Text>
                  <TextInput
                    style={modal.input}
                    placeholder="VD: Viện Trang thiết bị Y tế..."
                    placeholderTextColor="#94a3b8"
                    value={inspectionAgency}
                    onChangeText={setInspectionAgency}
                  />
                </View>
              </View>

              <View style={{ marginTop: 8 }}>
                <Text style={modal.subLabel}>File biên bản kiểm định / Giấy chứng nhận (PDF hoặc Ảnh)</Text>
                <Pressable style={modal.uploadFileBtn} onPress={pickCertFile}>
                  <Ionicons name="cloud-upload-outline" size={16} color="#059669" />
                  <Text style={modal.uploadFileText} numberOfLines={1}>
                    {inspectionCertFile ? `Đã chọn: ${inspectionCertFile}` : "Tải file biên bản / ảnh..."}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* HÓA ĐƠN, CO/CQ, GIẤY TỜ NHẬP KHẨU */}
            <View style={modal.sectionAmber}>
              <View style={modal.sectionHeaderBetween}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                  <Ionicons name="document-text-outline" size={16} color="#9a3412" />
                  <Text style={modal.sectionTitleAmber} numberOfLines={1}>
                    HÓA ĐƠN, CO/CQ, GIẤY TỜ NHẬP KHẨU ({documents.length})
                  </Text>
                </View>
                <Pressable style={modal.addDocBtn} onPress={pickDocument}>
                  <Text style={modal.addDocBtnText}>+ Thêm hồ sơ / tải ảnh</Text>
                </Pressable>
              </View>

              {documents.length === 0 ? (
                <Text style={modal.emptyDocText}>
                  Chưa đính kèm tài liệu nào. Bấm "Thêm hồ sơ / tải ảnh" để tải lên hóa đơn, CO/CQ hoặc giấy phép.
                </Text>
              ) : (
                <View style={{ gap: 6, marginTop: 8 }}>
                  {documents.map((doc, idx) => (
                    <View key={idx} style={modal.docItem}>
                      <Ionicons name="document-attach-outline" size={16} color="#9a3412" />
                      <Text style={modal.docName} numberOfLines={1}>{doc.name}</Text>
                      <Pressable onPress={() => setDocuments((prev) => prev.filter((_, i) => i !== idx))}>
                        <Ionicons name="trash-outline" size={16} color="#dc2626" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Vị trí phòng & Ngày mua / sử dụng */}
            <Text style={modal.label}>Vị trí phòng (Chi nhánh)</Text>
            <View style={modal.iconInputWrap}>
              <Ionicons name="business-outline" size={16} color="#64748b" style={{ marginLeft: 12, marginRight: 8 }} />
              <TextInput
                style={modal.iconInput}
                placeholder="Chọn phòng đặt thiết bị..."
                placeholderTextColor="#94a3b8"
                value={location}
                onChangeText={setLocation}
              />
            </View>

            <View style={modal.twoCol}>
              <View style={modal.col}>
                <Text style={modal.label}>Ngày mua thiết bị</Text>
                <Pressable style={modal.dateField} onPress={() => setActiveDatePicker("purchaseDate")}>
                  <Text style={[modal.dateText, !purchaseDate && modal.placeholderText]}>
                    {formatDateDisplay(purchaseDate) || "dd/mm/yyyy"}
                  </Text>
                  <Ionicons name="calendar-outline" size={16} color="#64748b" />
                </Pressable>
              </View>
              <View style={modal.col}>
                <Text style={modal.label}>Ngày đưa vào sử dụng</Text>
                <Pressable style={modal.dateField} onPress={() => setActiveDatePicker("usageStartDate")}>
                  <Text style={[modal.dateText, !usageStartDate && modal.placeholderText]}>
                    {formatDateDisplay(usageStartDate) || "dd/mm/yyyy"}
                  </Text>
                  <Ionicons name="calendar-outline" size={16} color="#64748b" />
                </Pressable>
              </View>
            </View>

            {/* Ghi chú */}
            <Text style={modal.label}>Ghi chú</Text>
            <TextInput
              style={[modal.input, { height: 80, textAlignVertical: "top" }]}
              placeholder="Ghi chú thêm về thiết bị..."
              placeholderTextColor="#94a3b8"
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            {/* Nút hành động chân trang */}
            <View style={modal.footerActions}>
              <Pressable style={modal.cancelActionBtn} onPress={onClose} disabled={saving}>
                <Text style={modal.cancelActionText}>Hủy bỏ</Text>
              </Pressable>
              <Pressable
                style={[modal.saveActionBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={modal.saveActionText}>{isEdit ? "Lưu thay đổi" : "Tạo thiết bị mới"}</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* DatePickerModal cho việc chọn ngày tiện lợi, không cần gõ phím */}
      <DatePickerModal
        visible={activeDatePicker !== null}
        onClose={() => setActiveDatePicker(null)}
        value={
          activeDatePicker === "lastInspectionDate"
            ? lastInspectionDate
            : activeDatePicker === "nextInspectionDate"
            ? nextInspectionDate
            : activeDatePicker === "purchaseDate"
            ? purchaseDate
            : activeDatePicker === "usageStartDate"
            ? usageStartDate
            : ""
        }
        onChange={(dateStr) => {
          if (activeDatePicker === "lastInspectionDate") setLastInspectionDate(dateStr);
          else if (activeDatePicker === "nextInspectionDate") setNextInspectionDate(dateStr);
          else if (activeDatePicker === "purchaseDate") setPurchaseDate(dateStr);
          else if (activeDatePicker === "usageStartDate") setUsageStartDate(dateStr);
          setActiveDatePicker(null);
        }}
        title={
          activeDatePicker === "lastInspectionDate"
            ? "Ngày kiểm định gần nhất"
            : activeDatePicker === "nextInspectionDate"
            ? "Ngày đến hạn kiểm định tiếp theo"
            : activeDatePicker === "purchaseDate"
            ? "Ngày mua thiết bị"
            : "Ngày đưa vào sử dụng"
        }
        allowClear
      />

      {/* SelectModal cho các dropdown */}
      <SelectModal
        visible={activeSelectPicker !== null}
        title={
          activeSelectPicker === "status"
            ? "Trạng thái vận hành"
            : activeSelectPicker === "riskClassification"
            ? "Phân loại mức độ rủi ro (Bộ Y tế)"
            : "Kết quả thực hiện"
        }
        options={
          activeSelectPicker === "status"
            ? STATUS_OPTIONS
            : activeSelectPicker === "riskClassification"
            ? RISK_OPTIONS
            : INSPECTION_RESULT_OPTIONS
        }
        selectedValue={
          activeSelectPicker === "status"
            ? status
            : activeSelectPicker === "riskClassification"
            ? riskClassification
            : inspectionResult
        }
        onSelect={(val) => {
          if (activeSelectPicker === "status") setStatus(val);
          else if (activeSelectPicker === "riskClassification") setRiskClassification(val);
          else if (activeSelectPicker === "inspectionResult") setInspectionResult(val);
        }}
        onClose={() => setActiveSelectPicker(null)}
      />
    </Modal>
  );
}

// ── Delete Confirmation Modal ────────────────────────────────────────────────
function DeleteConfirmModal({
  visible,
  itemName,
  onClose,
  onConfirm,
  loading,
}: {
  visible: boolean;
  itemName: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={confirmStyles.overlay}>
        <View style={confirmStyles.dialog}>
          <Text style={confirmStyles.title}>Xóa thiết bị</Text>
          <Text style={confirmStyles.message}>
            Bạn có chắc muốn xóa "{itemName}"?
          </Text>
          <View style={confirmStyles.actions}>
            <Pressable
              style={({ pressed }) => [confirmStyles.cancelBtn, pressed && { opacity: 0.7 }]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={confirmStyles.cancelText}>Hủy</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [confirmStyles.deleteBtn, pressed && { opacity: 0.7 }]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={confirmStyles.deleteText}>Xóa</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function EquipmentScreen() {
  const [items, setItems] = useState<EquipmentRecord[]>([]);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [summary, setSummary] = useState<EquipmentSummary | null>(null);
  const [compliance, setCompliance] = useState<EquipmentComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [revision, setRevision] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<EquipmentRecord | null>(null);
  const [deleteItem, setDeleteItem] = useState<EquipmentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openAdd = () => { setEditItem(null); setModalVisible(true); };
  const openEdit = (item: EquipmentRecord) => { setEditItem(item); setModalVisible(true); };

  const handleDelete = (item: EquipmentRecord) => {
    setDeleteItem(item);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await equipment.delete(deleteItem._id);
      setDeleteItem(null);
      setRevision((v) => v + 1);
    } catch (e) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thể xóa thiết bị.");
    } finally {
      setDeleting(false);
    }
  };

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [sumRes, compRes, listRes] = await Promise.allSettled([
        equipment.getSummary(),
        equipment.getCompliance(),
        equipment.list({ search: search.trim() || undefined, status: selectedFilter !== "all" ? selectedFilter : undefined }),
      ]);
      if (sumRes.status === "fulfilled") setSummary(sumRes.value);
      if (compRes.status === "fulfilled") setCompliance(compRes.value);
      if (listRes.status === "fulfilled") {
        setItems(listRes.value.items || []);
        if (typeof listRes.value.total === "number") setServerTotal(listRes.value.total);
      } else {
        const err = listRes.reason;
        setError(err instanceof Error ? err.message : "Không thể tải danh sách thiết bị.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedFilter]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (active) { setLoading(true); void loadData(); }
      return () => { active = false; };
    }, [loadData, revision]),
  );

  const totalCount = summary?.total ?? serverTotal ?? items.length;
  const countByStatus = (...keywords: string[]) => {
    if (summary?.byStatus && Array.isArray(summary.byStatus)) {
      const found = summary.byStatus.find((s) => keywords.some((k) => s.status.toLowerCase().includes(k.toLowerCase())));
      if (found) return found.count;
    }
    return items.filter((item) => { const s = (item.status || "").toLowerCase(); return keywords.some((k) => s.includes(k.toLowerCase())); }).length;
  };

  const bookedCount = summary?.booked ?? countByStatus("đơn", "booked", "order");
  const readyCount = summary?.ready ?? countByStatus("sẵn", "ready", "avail");
  const usingCount = summary?.using ?? countByStatus("dùng", "using", "in_use");
  const maintenanceCount = summary?.maintenance ?? countByStatus("trì", "maint", "repair");
  const disposedCount = summary?.disposed ?? countByStatus("lý", "dispos", "scrap");

  let computedOverdue = compliance?.overdue ?? 0;
  let computedUpcoming = compliance?.upcoming ?? 0;
  let computedValid = compliance?.valid ?? 0;

  if (!compliance || (computedOverdue === 0 && computedUpcoming === 0 && computedValid === 0)) {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    items.forEach((item) => {
      const cs = (item.complianceStatus || "").toLowerCase();
      if (cs.includes("valid") || cs.includes("đạt")) { computedValid++; return; }
      if (cs.includes("overdue") || cs.includes("quá hạn")) { computedOverdue++; return; }
      if (cs.includes("upcoming") || cs.includes("sắp")) { computedUpcoming++; return; }
      if (item.nextInspectionDate) {
        const time = new Date(item.nextInspectionDate).getTime();
        if (!isNaN(time)) {
          if (time < now) computedOverdue++;
          else if (time <= now + thirtyDaysMs) computedUpcoming++;
          else computedValid++;
        }
      }
    });
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={8}>
          <Image source={require("../../assets/lucide-chevron-right.png")} style={styles.backIcon} resizeMode="contain" />
        </Pressable>
        <Text style={styles.headerTitle}>Quản lý thiết bị</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setRevision((v) => v + 1); }} colors={["#008852"]} tintColor="#008852" />
        }
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <Pressable onPress={() => { setLoading(true); void loadData(); }} style={styles.errorRetryBtn}>
              <Text style={styles.errorRetryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.statusGrid}>
          {[
            { label: "TỔNG SỐ", value: totalCount, filter: "all", cs: styles.cardGray, ct: styles.textGray, vt: styles.textDark },
            { label: "ĐÃ CÓ ĐƠN", value: bookedCount, filter: "booked", cs: styles.cardGreen, ct: styles.textGreen, vt: styles.textGreen },
            { label: "SẴN SÀNG", value: readyCount, filter: "ready", cs: styles.cardGreen, ct: styles.textGreen, vt: styles.textGreen },
            { label: "ĐANG DÙNG", value: usingCount, filter: "using", cs: styles.cardGreen, ct: styles.textGreen, vt: styles.textGreen },
            { label: "BẢO TRÌ", value: maintenanceCount, filter: "maintenance", cs: styles.cardAmber, ct: styles.textAmber, vt: styles.textAmber },
            { label: "THANH LÝ", value: disposedCount, filter: "disposed", cs: styles.cardGray, ct: styles.textGray, vt: styles.textGray },
          ].map((c) => (
            <Pressable key={c.filter} onPress={() => setSelectedFilter(selectedFilter === c.filter ? "all" : c.filter)} style={[styles.statusCard, c.cs, selectedFilter === c.filter && styles.cardActive]}>
              <Text style={[styles.statusLabel, c.ct]} numberOfLines={1}>{c.label}</Text>
              <Text style={[styles.statusValue, c.vt]}>{c.value}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.statusSectionTitle}>Trạng thái</Text>

        <View style={styles.complianceGrid}>
          <View style={[styles.complianceCard, styles.complianceCardRed]}>
            <View style={styles.complianceCardHeader}>
              <Text style={[styles.complianceCardTitle, styles.complianceTextRed]} numberOfLines={1}>Quá hạn</Text>
              <View style={[styles.complianceIconWrap, styles.complianceIconWrapRed]}>
                <Image source={require("../../assets/compliance-clock-badge.png")} style={styles.complianceIcon} resizeMode="contain" />
              </View>
            </View>
            <Text style={[styles.complianceValue, styles.complianceTextRed]}>{computedOverdue}</Text>
            <Text style={[styles.complianceSubtitle, styles.complianceSubRed]} numberOfLines={1}>Cần kiểm định gấp</Text>
          </View>
          <View style={[styles.complianceCard, styles.complianceCardAmber]}>
            <View style={styles.complianceCardHeader}>
              <Text style={[styles.complianceCardTitle, styles.complianceTextAmber]} numberOfLines={1}>Sắp tới hạn</Text>
              <View style={[styles.complianceIconWrap, styles.complianceIconWrapAmber]}>
                <Image source={require("../../assets/compliance-calendar-badge.png")} style={styles.complianceIcon} resizeMode="contain" />
              </View>
            </View>
            <Text style={[styles.complianceValue, styles.complianceTextAmber]}>{computedUpcoming}</Text>
            <Text style={[styles.complianceSubtitle, styles.complianceSubAmber]} numberOfLines={1}>Trong 30 ngày</Text>
          </View>
          <View style={[styles.complianceCard, styles.complianceCardGreen]}>
            <View style={styles.complianceCardHeader}>
              <Text style={[styles.complianceCardTitle, styles.complianceTextGreen]} numberOfLines={1}>Đạt chuẩn</Text>
              <View style={[styles.complianceIconWrap, styles.complianceIconWrapGreen]}>
                <Image source={require("../../assets/compliance-shield-badge.png")} style={styles.complianceIcon} resizeMode="contain" />
              </View>
            </View>
            <Text style={[styles.complianceValue, styles.complianceTextGreen]}>{computedValid}</Text>
            <Text style={[styles.complianceSubtitle, styles.complianceSubGreen]} numberOfLines={1}>Hoạt động an toàn</Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => loadData()} placeholder="Tìm theo tên, mã thiết bị, khoa..." placeholderTextColor="#94a3b8" style={styles.searchInput} returnKeyType="search" />
        </View>

        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Danh sách thiết bị ({items.length})</Text>
            <View style={styles.listHeaderRight}>
              {selectedFilter !== "all" && (
                <Pressable onPress={() => setSelectedFilter("all")} style={{ marginRight: 10 }}>
                  <Text style={styles.resetFilterText}>Xóa lọc</Text>
                </Pressable>
              )}
              <Pressable style={styles.addBtn} onPress={openAdd} accessibilityLabel="Thêm thiết bị">
                <Ionicons name="add" size={20} color="#ffffff" />
              </Pressable>
            </View>
          </View>

          {items.length > 0 && !loading && (
            <Text style={styles.swipeHint}>← Vuốt trái để sửa / xóa</Text>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#008852" />
              <Text style={styles.loadingText}>Đang tải dữ liệu từ máy chủ...</Text>
            </View>
          ) : items.length === 0 ? (
            <EmptyState
              message="Chưa có thiết bị nào"
              subtitle={search ? "Không tìm thấy thiết bị phù hợp với từ khóa." : "Danh sách thiết bị trống trên hệ thống."}
            />
          ) : (
            items.map((item) => (
              <SwipeableItem key={item._id || item.id || item.code} item={item} onEdit={openEdit} onDelete={handleDelete} />
            ))
          )}
        </View>
      </ScrollView>

      <EquipmentModal visible={modalVisible} onClose={() => setModalVisible(false)} onSaved={() => setRevision((v) => v + 1)} editItem={editItem} />
      <DeleteConfirmModal
        visible={!!deleteItem}
        itemName={deleteItem?.name || ""}
        onClose={() => setDeleteItem(null)}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center", transform: [{ rotate: "180deg" }] },
  backIcon: { width: 16, height: 16, tintColor: "#334155" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", fontFamily: "Inter-Bold" },
  headerRightSpacer: { width: 36 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },
  errorBanner: { backgroundColor: "#fff1f2", borderRadius: 12, borderWidth: 1, borderColor: "#fecdd3", padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  errorBannerText: { fontSize: 12, color: "#be123c", fontFamily: "Inter-Medium", flex: 1 },
  errorRetryBtn: { backgroundColor: "#be123c", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  errorRetryText: { fontSize: 11, fontWeight: "700", color: "#ffffff", fontFamily: "Inter-Bold" },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  statusCard: { width: "31.6%", borderRadius: 12, borderWidth: 1.5, paddingVertical: 9, paddingHorizontal: 8, alignItems: "center", justifyContent: "space-between", minHeight: 62 },
  cardActive: { borderColor: "#008852", borderWidth: 2 },
  statusLabel: { fontSize: 9.5, fontWeight: "700", fontFamily: "Inter-Bold", letterSpacing: 0.2, textAlign: "center" },
  statusValue: { fontSize: 20, fontWeight: "800", fontFamily: "Inter-Bold", marginTop: 3, textAlign: "center" },
  statusSectionTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", fontFamily: "Inter-Bold", marginTop: 14, marginBottom: 8 },
  cardGray: { backgroundColor: "#ffffff", borderColor: "#e2e8f0" },
  cardGreen: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  cardAmber: { backgroundColor: "#fffbeb", borderColor: "#fed7aa" },
  textGray: { color: "#64748b" },
  textGreen: { color: "#047857" },
  textAmber: { color: "#b45309" },
  textDark: { color: "#0f172a" },
  complianceGrid: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  complianceCard: { width: "31.6%", borderRadius: 12, borderWidth: 1.5, paddingVertical: 8, paddingHorizontal: 8, justifyContent: "space-between", minHeight: 78 },
  complianceCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  complianceCardTitle: { fontSize: 10, fontWeight: "700", fontFamily: "Inter-Bold", flex: 1 },
  complianceIconWrap: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  complianceIconWrapRed: { backgroundColor: "#ffe4e6" },
  complianceIconWrapAmber: { backgroundColor: "#fef3c7" },
  complianceIconWrapGreen: { backgroundColor: "#dcfce7" },
  complianceIcon: { width: 11, height: 11 },
  complianceValue: { fontSize: 20, fontWeight: "800", fontFamily: "Inter-Bold", marginTop: 3, marginBottom: 2, textAlign: "center" },
  complianceSubtitle: { fontSize: 8.8, fontWeight: "600", fontFamily: "Inter-SemiBold", textAlign: "center" },
  complianceCardRed: { backgroundColor: "#fff1f2", borderColor: "#fecdd3" },
  complianceCardAmber: { backgroundColor: "#fffbeb", borderColor: "#fed7aa" },
  complianceCardGreen: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  complianceTextRed: { color: "#be123c" },
  complianceSubRed: { color: "#e11d48" },
  complianceTextAmber: { color: "#b45309" },
  complianceSubAmber: { color: "#b45309" },
  complianceTextGreen: { color: "#047857" },
  complianceSubGreen: { color: "#059669" },
  searchBar: { backgroundColor: "#ffffff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 12, paddingVertical: 10, marginTop: 12, flexDirection: "row", alignItems: "center" },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter-Medium", color: "#1e293b" },
  listSection: { gap: 8, marginTop: 6 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 2 },
  listHeaderRight: { flexDirection: "row", alignItems: "center" },
  listTitle: { fontSize: 14, fontWeight: "700", color: "#1e293b", fontFamily: "Inter-Bold" },
  resetFilterText: { fontSize: 12, fontWeight: "600", color: "#008852", fontFamily: "Inter-SemiBold" },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#008852", alignItems: "center", justifyContent: "center", shadowColor: "#008852", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  swipeHint: { fontSize: 11, color: "#94a3b8", fontFamily: "Inter-Regular", textAlign: "right", paddingRight: 4, marginTop: -2 },
  loadingContainer: { paddingVertical: 30, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { fontSize: 12, color: "#64748b", fontFamily: "Inter-Regular" },
  swipeWrapper: { position: "relative", borderRadius: 14, overflow: "hidden", marginBottom: 2 },
  actionButtons: { position: "absolute", right: 0, top: 0, bottom: 0, flexDirection: "row", width: 120 },
  editBtn: { flex: 1, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center", gap: 3 },
  deleteBtn: { flex: 1, backgroundColor: "#dc2626", alignItems: "center", justifyContent: "center", gap: 3 },
  actionBtnText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
  itemCard: { backgroundColor: "#ffffff", borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", padding: 14, gap: 10, shadowColor: "#059669", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  itemCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 13.5, fontWeight: "700", color: "#0f172a", fontFamily: "Inter-Bold" },
  itemCode: { fontSize: 11, color: "#64748b", fontFamily: "Inter-Regular" },
  itemBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  itemBadgeText: { fontSize: 10.5, fontWeight: "700", fontFamily: "Inter-Bold" },
  itemFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  itemMeta: { fontSize: 11, color: "#64748b", fontFamily: "Inter-Medium" },
  normalDate: { color: "#334155", fontFamily: "Inter-SemiBold" },
  categoryBadge: { backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  categoryBadgeText: { fontSize: 10, color: "#475569", fontFamily: "Inter-Medium" },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: "94%",
  },
  handleBar: { width: 38, height: 4, borderRadius: 2, backgroundColor: "#e2e8f0", alignSelf: "center", marginBottom: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  title: { fontSize: 18, fontWeight: "800", color: "#0f172a", fontFamily: "Inter-Bold" },
  subtitle: { fontSize: 11.5, color: "#64748b", fontFamily: "Inter-Regular", marginTop: 2 },
  closeBtn: { padding: 4 },
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#fafafa",
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  uploadContent: { alignItems: "center", gap: 4 },
  uploadIconWrap: { width: 42, height: 42, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center", marginBottom: 2 },
  uploadTitle: { fontSize: 12.5, fontWeight: "700", color: "#334155", fontFamily: "Inter-Bold" },
  uploadSubtitle: { fontSize: 10.5, color: "#94a3b8", fontFamily: "Inter-Regular" },
  previewWrap: { position: "relative", width: "100%", height: 140, borderRadius: 10, overflow: "hidden" },
  imagePreview: { width: "100%", height: "100%", borderRadius: 10 },
  removeImageBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "#ffffff", borderRadius: 12 },
  label: { fontSize: 11.5, fontWeight: "700", color: "#334155", fontFamily: "Inter-Bold", marginTop: 10, marginBottom: 4 },
  subLabel: { fontSize: 11, fontWeight: "600", color: "#475569", fontFamily: "Inter-SemiBold", marginTop: 6, marginBottom: 3 },
  required: { color: "#dc2626" },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    color: "#1e293b",
    backgroundColor: "#ffffff",
    fontFamily: "Inter-Medium",
    minHeight: 38,
  },
  selector: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    minHeight: 38,
  },
  selectorText: { fontSize: 12.5, color: "#1e293b", fontFamily: "Inter-Medium", flex: 1 },
  dateField: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    minHeight: 38,
  },
  dateText: { fontSize: 12.5, color: "#1e293b", fontFamily: "Inter-Medium" },
  placeholderText: { color: "#94a3b8" },
  twoCol: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  sectionGreen: {
    borderWidth: 1.2,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    backgroundColor: "#fcfdfc",
    padding: 12,
    marginTop: 12,
    gap: 4,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  sectionTitleGreen: { fontSize: 11.5, fontWeight: "800", color: "#059669", fontFamily: "Inter-Bold" },
  uploadFileBtn: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 8,
    backgroundColor: "#f0fdf4",
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  uploadFileText: { fontSize: 12, fontWeight: "600", color: "#059669", fontFamily: "Inter-SemiBold" },
  sectionAmber: {
    borderWidth: 1.2,
    borderColor: "#fed7aa",
    borderRadius: 12,
    backgroundColor: "#fffbf7",
    padding: 12,
    marginTop: 12,
    gap: 6,
  },
  sectionHeaderBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitleAmber: { fontSize: 11, fontWeight: "800", color: "#9a3412", fontFamily: "Inter-Bold" },
  addDocBtn: { backgroundColor: "#9a3412", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6 },
  addDocBtnText: { color: "#ffffff", fontSize: 11, fontWeight: "700", fontFamily: "Inter-Bold" },
  emptyDocText: { fontSize: 10.8, color: "#94a3b8", fontStyle: "italic", fontFamily: "Inter-Regular", marginTop: 4, lineHeight: 16 },
  docItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#ffffff", padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#fed7aa" },
  docName: { fontSize: 12, color: "#9a3412", fontFamily: "Inter-Medium", flex: 1, marginHorizontal: 8 },
  iconInputWrap: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    minHeight: 38,
  },
  iconInput: { flex: 1, fontSize: 12.5, color: "#1e293b", paddingVertical: 8, paddingRight: 10, fontFamily: "Inter-Medium" },
  footerActions: { flexDirection: "row", gap: 10, marginTop: 22, alignItems: "center" },
  cancelActionBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center" },
  cancelActionText: { fontSize: 13.5, fontWeight: "700", color: "#475569", fontFamily: "Inter-Bold" },
  saveActionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#008852", alignItems: "center", justifyContent: "center" },
  saveActionText: { color: "#ffffff", fontSize: 14, fontWeight: "800", fontFamily: "Inter-Bold" },
});

const selectStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 24 },
  sheet: { width: "100%", maxWidth: 330, backgroundColor: "#ffffff", borderRadius: 20, padding: 18, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 14, elevation: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingBottom: 8 },
  title: { fontSize: 15, fontWeight: "800", color: "#0f172a", fontFamily: "Inter-Bold" },
  optionItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  optionItemActive: { backgroundColor: "#f0fdf4" },
  optionText: { fontSize: 13, color: "#334155", fontFamily: "Inter-Medium" },
  optionTextActive: { color: "#008852", fontWeight: "700", fontFamily: "Inter-Bold" },
});

const confirmStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#475569",
    fontFamily: "Inter-Regular",
    lineHeight: 20,
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  cancelText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#475569",
    fontFamily: "Inter-SemiBold",
  },
  deleteBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: "#dc2626",
    minWidth: 64,
    alignItems: "center",
  },
  deleteText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#ffffff",
    fontFamily: "Inter-Bold",
  },
});
