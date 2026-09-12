import { shareApiFile, resolveFileUrl } from "../../src/files/shareFile";
import { resolveFileFormat } from "../../src/files/fileFormat";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Linking from "expo-linking";
import { DatePickerModal } from "../../src/features/credentials/DatePickerModal";
import { EmptyState } from "../../src/ui";
import { equipment, departments } from "../../src/api/services";
import { useSession } from "../../src/auth/SessionProvider";
import { hasPermission } from "../../../src/utils/permissionUtils";
import type {
  EquipmentRecord,
  EquipmentSummary,
  EquipmentComplianceSummary,
} from "../../../src/types/equipment";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("using") || s.includes("in-use") || s.includes("dùng") || s.includes("đang"))
    return { label: "Đang dùng", color: "#047857", bg: "#f0fdf4" };
  if (s.includes("avail") || s.includes("ready") || s.includes("sẵn"))
    return { label: "Sẵn sàng", color: "#0284c7", bg: "#f0f9ff" };
  if (s.includes("request") || s.includes("booked") || s.includes("đơn") || s.includes("đặt"))
    return { label: "Đã có đơn", color: "#6366f1", bg: "#eef2ff" };
  if (s.includes("maint") || s.includes("bảo trì") || s.includes("sửa"))
    return { label: "Bảo trì", color: "#b45309", bg: "#fffbeb" };
  if (s.includes("retire") || s.includes("dispos") || s.includes("thanh lý") || s.includes("hỏng"))
    return { label: "Thanh lý", color: "#64748b", bg: "#f8fafc" };
  return { label: status || "Khác", color: "#475569", bg: "#f1f5f9" };
}

const STATUS_OPTIONS = [
  { label: "Sẵn sàng", value: "available" },
  { label: "Bảo trì", value: "maintenance" },
  { label: "Thanh lý", value: "retired" },
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
  { label: "Chờ đánh giá (Pending)", value: "Pending" },
];

const DOC_TYPE_OPTIONS = [
  { label: "Giấy chứng nhận CO/CQ", value: "Giấy chứng nhận xuất xứ & chất lượng (CO/CQ)" },
  { label: "Hóa đơn mua bán thiết bị", value: "Hóa đơn mua bán thiết bị" },
  { label: "Giấy phép nhập khẩu thiết bị y tế", value: "Giấy phép nhập khẩu thiết bị y tế" },
  { label: "Tờ khai hải quan", value: "Tờ khai hải quan" },
  { label: "Biên bản bàn giao & nghiệm thu", value: "Biên bản bàn giao & nghiệm thu" },
  { label: "Hồ sơ kỹ thuật / Hướng dẫn sử dụng", value: "Hồ sơ kỹ thuật / Hướng dẫn sử dụng" },
  { label: "Khác", value: "Khác" },
];

export interface ClinicRoom {
  id: string;
  name: string;
  code: string;
  category: string;
  floor: string;
}

const DEFAULT_CLINIC_ROOMS: ClinicRoom[] = [
  { id: "p101", name: "Lễ Tân", code: "P101", category: "Văn phòng / Làm việc", floor: "Tầng 1" },
  { id: "p102", name: "Phòng HCNS", code: "P102", category: "Văn phòng / Làm việc", floor: "Tầng 1" },
  { id: "p103", name: "Phòng Họp", code: "P103", category: "Phòng họp / Hội chẩn", floor: "Tầng 1" },
  { id: "p104", name: "Phòng Khám Mắt", code: "P104", category: "Phòng khám", floor: "Tầng 1" },
  { id: "p201", name: "Phòng Khám Da Liễu", code: "P201", category: "Phòng khám", floor: "Tầng 2" },
  { id: "p202", name: "Phòng Laser & Thẩm mỹ", code: "P202", category: "Phòng thủ thuật", floor: "Tầng 2" },
  { id: "p203", name: "Phòng Chăm Sóc Da", code: "P203", category: "Phòng dịch vụ", floor: "Tầng 2" },
  { id: "p301", name: "Phòng Xét Nghiệm", code: "P301", category: "Cận lâm sàng", floor: "Tầng 3" },
  { id: "k101", name: "Kho Dược & Thiết bị", code: "K101", category: "Kho vật tư", floor: "Tầng 1" },
];

// ── App Rounded Alert Modal ──────────────────────────────────────────────────
function AppAlertModal({
  visible,
  title,
  message,
  type = "info",
  onClose,
}: {
  visible: boolean;
  title: string;
  message: string;
  type?: "error" | "warning" | "success" | "info";
  onClose: () => void;
}) {
  const isError = type === "error";
  const isSuccess = type === "success";
  const isWarning = type === "warning";

  const iconName = isError
    ? "alert-circle"
    : isSuccess
    ? "checkmark-circle"
    : isWarning
    ? "warning"
    : "information-circle";

  const iconColor = isError
    ? "#dc2626"
    : isSuccess
    ? "#059669"
    : isWarning
    ? "#d97706"
    : "#2563eb";

  const iconBg = isError
    ? "#fee2e2"
    : isSuccess
    ? "#dcfce7"
    : isWarning
    ? "#fef3c7"
    : "#e0f2fe";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={alertStyles.overlay}>
        <View style={alertStyles.dialog}>
          <View style={[alertStyles.iconCircle, { backgroundColor: iconBg }]}>
            <Ionicons name={iconName} size={30} color={iconColor} />
          </View>
          <Text style={alertStyles.title}>{title}</Text>
          <Text style={alertStyles.message}>{message}</Text>
          <Pressable
            style={({ pressed }) => [alertStyles.confirmBtn, pressed && { opacity: 0.7 }]}
            onPress={onClose}
          >
            <Text style={alertStyles.confirmText}>Đã hiểu</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── File & Image Preview Modal ────────────────────────────────────────────────
function FilePreviewModal({
  visible,
  file,
  onClose,
}: {
  visible: boolean;
  file: { name: string; uri?: string; type?: string } | null;
  onClose: () => void;
}) {
  if (!file) return null;

  const uri = file.uri || "";
  const name = file.name || "Tài liệu đính kèm";

  const isImage =
    uri.startsWith("data:image") ||
    uri.startsWith("file://") ||
    uri.startsWith("content://") ||
    uri.startsWith("http://") ||
    uri.startsWith("https://") ||
    /\.(jpg|jpeg|png|webp|gif|heic)$/i.test(name) ||
    /\.(jpg|jpeg|png|webp|gif|heic)$/i.test(uri);

  const handleShareOrOpen = async () => {
    if (!uri) {
      Alert.alert("Thông báo", "Tệp này chỉ có tên ghi chép, chưa có đường dẫn tệp đính kèm.");
      return;
    }
    try {
      if (/^https?:/i.test(uri) || uri.startsWith("/")) {
        await shareApiFile(resolveFileUrl(uri), name);
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: resolveFileFormat({ name, url: uri }).mimeType });
      } else {
        await Linking.openURL(uri);
      }
    } catch (e: any) {
      Alert.alert("Không thể mở tệp", e.message || "Không thể khởi động trình xem hoặc chia sẻ tệp.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={previewModalStyles.overlay}>
        <SafeAreaView edges={["top"]} style={previewModalStyles.topBar}>
          <View style={previewModalStyles.headerContent}>
            <Text style={previewModalStyles.fileName} numberOfLines={1}>
              {name}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {uri ? (
                <Pressable style={previewModalStyles.actionIconBtn} onPress={handleShareOrOpen}>
                  <Ionicons name="share-outline" size={20} color="#ffffff" />
                </Pressable>
              ) : null}
              <Pressable style={previewModalStyles.actionIconBtn} onPress={onClose}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>

        <View style={previewModalStyles.body}>
          {isImage && uri ? (
            <Image source={{ uri }} style={previewModalStyles.fullImage} resizeMode="contain" />
          ) : (
            <View style={previewModalStyles.docPlaceholder}>
              <View style={previewModalStyles.docIconBg}>
                <Ionicons
                  name={name.toLowerCase().includes("pdf") ? "document-text" : "document-attach"}
                  size={54}
                  color="#008852"
                />
              </View>
              <Text style={previewModalStyles.docTitle}>{name}</Text>
              <Text style={previewModalStyles.docSubtitle}>
                {uri ? "Tệp đính kèm văn bản / PDF" : "Hồ sơ đính kèm"}
              </Text>

              {uri ? (
                <Pressable style={previewModalStyles.openBtn} onPress={handleShareOrOpen}>
                  <Ionicons name="open-outline" size={18} color="#ffffff" />
                  <Text style={previewModalStyles.openBtnText}>Mở / Chia sẻ tệp</Text>
                </Pressable>
              ) : (
                <Text style={previewModalStyles.noUriText}>
                  (Tệp chưa có liên kết tin đính kèm trực tiếp)
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function formatDateDisplay(isoStr?: string): string {
  if (!isoStr) return "";
  const clean = isoStr.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoStr;
}

function parseEquipmentNotes(rawNotes?: string) {
  if (!rawNotes) return { cleanNotes: "", meta: {} as Record<string, string> };
  const lines = rawNotes.split("\n");
  const cleanLines: string[] = [];
  const meta: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^\[(.*?):\s*(.*)\]$/);
    if (match) {
      meta[match[1]] = match[2];
    } else {
      cleanLines.push(line);
    }
  }

  return { cleanNotes: cleanLines.join("\n").trim(), meta };
}

// ── SwipeableItem ─────────────────────────────────────────────────────────────
function SwipeableItem({
  item,
  onEdit,
  onDelete,
  onViewDetail,
}: {
  item: EquipmentRecord;
  onEdit: (item: EquipmentRecord) => void;
  onDelete: (item: EquipmentRecord) => void;
  onViewDetail: (item: EquipmentRecord) => void;
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
        <Pressable
          onPress={() => {
            if (isOpen.current) {
              close();
            } else {
              onViewDetail(item);
            }
          }}
          style={{ width: "100%" }}
        >
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
        </Pressable>
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

// ── Media Source Selector Modal (Camera / Library / Files) ───────────────────
interface MediaSourceModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  allowDocument?: boolean;
  onTakePhoto: () => void;
  onChooseGallery: () => void;
  onChooseDocument?: () => void;
  onClose: () => void;
}

function MediaSourceModal({
  visible,
  title,
  subtitle,
  allowDocument = false,
  onTakePhoto,
  onChooseGallery,
  onChooseDocument,
  onClose,
}: MediaSourceModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={mediaModalStyles.overlay} onPress={onClose}>
        <Pressable style={mediaModalStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={mediaModalStyles.handleBar} />
          <Text style={mediaModalStyles.title}>{title}</Text>
          {subtitle ? <Text style={mediaModalStyles.subtitle}>{subtitle}</Text> : null}

          <View style={mediaModalStyles.btnList}>
            {/* Chụp ảnh mới */}
            <Pressable style={mediaModalStyles.optionBtn} onPress={onTakePhoto}>
              <View style={[mediaModalStyles.iconWrap, { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }]}>
                <Ionicons name="camera" size={22} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={mediaModalStyles.optionTitle}>Chụp ảnh mới</Text>
                <Text style={mediaModalStyles.optionDesc}>Sử dụng camera điện thoại chụp trực tiếp</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>

            {/* Chọn từ thư viện */}
            <Pressable style={mediaModalStyles.optionBtn} onPress={onChooseGallery}>
              <View style={[mediaModalStyles.iconWrap, { backgroundColor: "#f0f9ff", borderColor: "#bae6fd" }]}>
                <Ionicons name="images" size={22} color="#0284c7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={mediaModalStyles.optionTitle}>Chọn từ thư viện ảnh</Text>
                <Text style={mediaModalStyles.optionDesc}>Chọn ảnh có sẵn trong album thiết bị</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>

            {/* Chọn tệp tài liệu PDF */}
            {allowDocument && onChooseDocument && (
              <Pressable style={mediaModalStyles.optionBtn} onPress={onChooseDocument}>
                <View style={[mediaModalStyles.iconWrap, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
                  <Ionicons name="document-text" size={22} color="#d97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mediaModalStyles.optionTitle}>Chọn file tài liệu / PDF</Text>
                  <Text style={mediaModalStyles.optionDesc}>Tải lên tệp PDF hoặc tài liệu quét từ máy</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </Pressable>
            )}
          </View>

          <Pressable style={mediaModalStyles.cancelBtn} onPress={onClose}>
            <Text style={mediaModalStyles.cancelText}>Hủy bỏ</Text>
          </Pressable>
        </Pressable>
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
  const [status, setStatus] = useState("available");
  const [formPreviewFile, setFormPreviewFile] = useState<{ name: string; uri?: string; type?: string } | null>(null);
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
  const [inspectionCertFileName, setInspectionCertFileName] = useState("");
  const [documents, setDocuments] = useState<{ name: string; uri: string; type?: string; code?: string; issueDate?: string; expiryDate?: string }[]>([]);
  const [location, setLocation] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [usageStartDate, setUsageStartDate] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [saving, setSaving] = useState(false);

  // Subform thêm hồ sơ / tải ảnh
  const [showDocForm, setShowDocForm] = useState(false);
  const [newDocType, setNewDocType] = useState("Giấy chứng nhận xuất xứ & chất lượng (CO/CQ)");
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocCode, setNewDocCode] = useState("");
  const [newDocIssueDate, setNewDocIssueDate] = useState("");
  const [newDocExpiryDate, setNewDocExpiryDate] = useState("");
  const [newDocFile, setNewDocFile] = useState<{ name: string; uri: string } | null>(null);

  // Vị trí phòng ban
  const [roomList, setRoomList] = useState<ClinicRoom[]>(DEFAULT_CLINIC_ROOMS);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const [deptSearch, setDeptSearch] = useState("");

  useEffect(() => {
    let active = true;
    departments
      .list({ activeOnly: true })
      .then((data) => {
        if (!active || !data || data.length === 0) return;
        const mapped: ClinicRoom[] = data.map((d, idx) => ({
          id: d._id || `dept_${idx}`,
          name: d.name,
          code: d.code || `P${101 + idx}`,
          category: d.description?.includes("/")
            ? d.description
            : d.name.toLowerCase().includes("khám")
            ? "Phòng khám"
            : d.name.toLowerCase().includes("họp")
            ? "Phòng họp / Hội chẩn"
            : "Văn phòng / Làm việc",
          floor: d.description?.toLowerCase().includes("tầng") ? d.description : "Tầng 1",
        }));
        const merged = [...mapped];
        DEFAULT_CLINIC_ROOMS.forEach((def) => {
          if (!merged.some((m) => m.name.toLowerCase() === def.name.toLowerCase())) {
            merged.push(def);
          }
        });
        setRoomList(merged);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const filteredRooms = roomList.filter((r) => {
    if (!deptSearch.trim()) return true;
    const q = deptSearch.trim().toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.floor.toLowerCase().includes(q)
    );
  });

  // Rounded Alert
  const [formAlert, setFormAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type?: "error" | "warning" | "success" | "info";
  }>({ visible: false, title: "", message: "", type: "info" });

  const showFormAlert = (title: string, message: string, type: "error" | "warning" | "success" | "info" = "info") => {
    setFormAlert({ visible: true, title, message, type });
  };

  const [activeDatePicker, setActiveDatePicker] = useState<
    "lastInspectionDate" | "nextInspectionDate" | "purchaseDate" | "usageStartDate" | "newDocIssueDate" | "newDocExpiryDate" | null
  >(null);
  const [activeSelectPicker, setActiveSelectPicker] = useState<
    "status" | "riskClassification" | "inspectionResult" | "docType" | null
  >(null);

  const resetToItem = useCallback(() => {
    setName(editItem?.name ?? "");
    setCode(editItem?.code ?? "");
    setCategory(editItem?.category ?? "");
    const rawStatus = (editItem?.status ?? "available").toLowerCase();
    setStatus(
      rawStatus.includes("maint") ? "maintenance" : rawStatus.includes("retire") || rawStatus.includes("dispos") ? "retired" : "available"
    );

    // Trích xuất metadata từ trường notes nếu có
    const rawNotes = editItem?.notes ?? "";
    const cleanLines: string[] = [];
    const meta: Record<string, string> = {};
    if (rawNotes) {
      for (const line of rawNotes.split("\n")) {
        const trimmed = line.trim();
        const match = trimmed.match(/^\[(.*?):\s*(.*)\]$/);
        if (match) {
          meta[match[1]] = match[2];
        } else {
          cleanLines.push(line);
        }
      }
    }

    setRiskClassification(editItem?.riskClassification || meta["Phân loại rủi ro"] || "Chưa phân nhóm");
    setInspectionIntervalMonths(
      editItem?.inspectionIntervalMonths
        ? String(editItem.inspectionIntervalMonths)
        : meta["Chu kỳ kiểm định"] ? meta["Chu kỳ kiểm định"].replace(/\D/g, "") || "12" : "12"
    );
    setManufacturer(editItem?.manufacturer || meta["Hãng SX"] || "");
    setOrigin(editItem?.origin || meta["Xuất xứ"] || "");
    setModel(editItem?.model || meta["Model"] || "");
    setSerialNumber(editItem?.serialNumber || meta["Serial"] || "");
    setLastInspectionDate(
      editItem?.lastInspectionDate
        ? editItem.lastInspectionDate.slice(0, 10)
        : meta["Kiểm định gần nhất"] || ""
    );
    setNextInspectionDate(
      editItem?.nextInspectionDate
        ? editItem.nextInspectionDate.slice(0, 10)
        : meta["Hạn kiểm định tiếp theo"] || ""
    );
    setInspectionResult(editItem?.inspectionResult || meta["Kết quả"] || "Pass");
    setInspectionAgency(editItem?.inspectionAgency || meta["Đơn vị kiểm định"] || "");
    const certFileVal = editItem?.inspectionCertFile || meta["Biên bản"] || "";
    setInspectionCertFile(certFileVal);
    setInspectionCertFileName(certFileVal ? (certFileVal.startsWith("data:") ? "Biên bản đã tải lên" : certFileVal.split("/").pop() || "Biên bản") : "");

    let docs = (editItem?.documents as any) ?? [];
    if (docs.length === 0 && meta["Tài liệu JSON"]) {
      try {
        docs = JSON.parse(meta["Tài liệu JSON"]);
      } catch {}
    }
    if (docs.length === 0 && meta["Hồ sơ"]) {
      docs = meta["Hồ sơ"].split(",").map((dName: string) => ({ name: dName.trim(), uri: "" }));
    }
    setDocuments(docs);

    setLocation(editItem?.location ?? "");
    setPurchaseDate(editItem?.purchaseDate ? editItem.purchaseDate.slice(0, 10) : "");
    setUsageStartDate(
      editItem?.usageStartDate
        ? editItem.usageStartDate.slice(0, 10)
        : meta["Ngày sử dụng"] || ""
    );
    setNotes(cleanLines.join("\n").trim());

    const initialImg = editItem?.imageUri || (editItem as any)?.imageUrl || meta["Ảnh thiết bị"] || "";
    setImageUri(initialImg);
    setShowDocForm(false);
    setDeptDropdownOpen(false);
    setDeptSearch("");
  }, [editItem]);

  const [mediaPickerTarget, setMediaPickerTarget] = useState<"equipmentImage" | "certFile" | "docFile" | null>(null);

  const handleTakePhoto = async () => {
    const target = mediaPickerTarget;
    setMediaPickerTarget(null);
    if (!target) return;

    try {
      const { status: perm } = await ImagePicker.requestCameraPermissionsAsync();
      if (perm !== "granted") {
        showFormAlert("Quyền máy ảnh", "Ứng dụng cần quyền camera để chụp ảnh trực tiếp.", "warning");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: target === "equipmentImage",
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const filename = asset.fileName || `camera_${Date.now()}.jpg`;
        const fileUri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        if (target === "equipmentImage") {
          setImageUri(fileUri);
        } else if (target === "certFile") {
          setInspectionCertFile(fileUri);
          setInspectionCertFileName(filename);
        } else if (target === "docFile") {
          setNewDocFile({ name: filename, uri: fileUri });
        }
      }
    } catch {
      showFormAlert("Lỗi máy ảnh", "Không thể khởi động camera trên thiết bị.", "error");
    }
  };

  const handleChooseGallery = async () => {
    const target = mediaPickerTarget;
    setMediaPickerTarget(null);
    if (!target) return;

    try {
      const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm !== "granted") {
        showFormAlert("Quyền thư viện", "Cần quyền truy cập thư viện để chọn ảnh.", "warning");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: target === "equipmentImage",
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const filename = asset.fileName || `image_${Date.now()}.jpg`;
        const fileUri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        if (target === "equipmentImage") {
          setImageUri(fileUri);
        } else if (target === "certFile") {
          setInspectionCertFile(fileUri);
          setInspectionCertFileName(filename);
        } else if (target === "docFile") {
          setNewDocFile({ name: filename, uri: fileUri });
        }
      }
    } catch {
      showFormAlert("Lỗi thư viện", "Không thể chọn ảnh từ thiết bị.", "error");
    }
  };

  const handleChooseDocument = async () => {
    const target = mediaPickerTarget;
    setMediaPickerTarget(null);
    if (!target) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        let fileUri = file.uri;
        try {
          if (file.uri && !file.uri.startsWith("data:")) {
            const base64 = await FileSystem.readAsStringAsync(file.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const mime = file.mimeType || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
            fileUri = `data:${mime};base64,${base64}`;
          }
        } catch {
          fileUri = file.uri;
        }

        if (target === "certFile") {
          setInspectionCertFile(fileUri);
          setInspectionCertFileName(file.name);
        } else if (target === "docFile") {
          setNewDocFile({ name: file.name, uri: fileUri });
        }
      }
    } catch {
      // ignore
    }
  };

  const handleAddDocument = () => {
    if (!newDocTitle.trim()) {
      showFormAlert("Thiếu thông tin", "Vui lòng nhập tên tài liệu / văn bản.", "warning");
      return;
    }
    if (!newDocFile) {
      showFormAlert("Thiếu tệp đính kèm", "Vui lòng chọn ảnh hoặc tệp tài liệu đính kèm.", "warning");
      return;
    }
    setDocuments((prev) => [
      ...prev,
      {
        name: newDocTitle.trim(),
        type: newDocType,
        code: newDocCode.trim() || undefined,
        issueDate: newDocIssueDate || undefined,
        expiryDate: newDocExpiryDate || undefined,
        uri: newDocFile.uri,
      },
    ]);
    setNewDocTitle("");
    setNewDocCode("");
    setNewDocIssueDate("");
    setNewDocExpiryDate("");
    setNewDocFile(null);
    setShowDocForm(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showFormAlert("Thiếu thông tin", "Vui lòng nhập tên thiết bị.", "warning");
      return;
    }
    if (!code.trim()) {
      showFormAlert("Thiếu thông tin", "Vui lòng nhập mã thiết bị.", "warning");
      return;
    }
    if (!category.trim()) {
      showFormAlert("Thiếu thông tin", "Vui lòng nhập danh mục thiết bị.", "warning");
      return;
    }

    setSaving(true);
    try {
      const serverStatus = ["available", "maintenance", "retired"].includes(status)
        ? status
        : "available";

      const payload: Record<string, any> = {
        name: name.trim(),
        code: code.trim(),
        category: category.trim(),
        status: serverStatus,
      };

      if (location.trim()) payload.location = location.trim();
      if (purchaseDate) payload.purchaseDate = purchaseDate;

      if (imageUri.trim()) {
        payload.imageUri = imageUri.trim();
        payload.imageUrl = imageUri.trim();
      }
      if (inspectionCertFile.trim()) {
        payload.inspectionCertFile = inspectionCertFile.trim();
      }
      if (documents.length > 0) {
        payload.documents = documents;
      }

      // Đóng gói thông tin kỹ thuật & y tế vào notes để lưu trữ an toàn
      const metaLines: string[] = [];
      if (notes.trim()) metaLines.push(notes.trim());
      if (imageUri.trim()) metaLines.push(`[Ảnh thiết bị: ${imageUri.trim()}]`);
      if (riskClassification && riskClassification !== "Chưa phân nhóm")
        metaLines.push(`[Phân loại rủi ro: ${riskClassification}]`);
      if (inspectionIntervalMonths && inspectionIntervalMonths !== "12")
        metaLines.push(`[Chu kỳ kiểm định: ${inspectionIntervalMonths} tháng]`);
      if (manufacturer.trim()) metaLines.push(`[Hãng SX: ${manufacturer.trim()}]`);
      if (origin.trim()) metaLines.push(`[Xuất xứ: ${origin.trim()}]`);
      if (model.trim()) metaLines.push(`[Model: ${model.trim()}]`);
      if (serialNumber.trim()) metaLines.push(`[Serial: ${serialNumber.trim()}]`);
      if (lastInspectionDate) metaLines.push(`[Kiểm định gần nhất: ${lastInspectionDate}]`);
      if (nextInspectionDate) metaLines.push(`[Hạn kiểm định tiếp theo: ${nextInspectionDate}]`);
      if (inspectionResult) metaLines.push(`[Kết quả: ${inspectionResult}]`);
      if (inspectionAgency.trim()) metaLines.push(`[Đơn vị kiểm định: ${inspectionAgency.trim()}]`);
      if (inspectionCertFile.trim()) metaLines.push(`[Biên bản: ${inspectionCertFile.trim()}]`);
      if (usageStartDate) metaLines.push(`[Ngày sử dụng: ${usageStartDate}]`);
      if (documents.length > 0) {
        metaLines.push(`[Hồ sơ: ${documents.map((d) => d.name).join(", ")}]`);
        try {
          metaLines.push(`[Tài liệu JSON: ${JSON.stringify(documents)}]`);
        } catch {}
      }

      if (metaLines.length > 0) {
        payload.notes = metaLines.join("\n");
      }

      if (isEdit && editItem) {
        const equipId = editItem._id || editItem.id || "";
        if (!equipId) throw new Error("Không xác định được ID thiết bị. Vui lòng thử lại.");
        await equipment.update(equipId, payload);
      } else {
        await equipment.create(payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      showFormAlert("Không thể lưu thiết bị", e.message || "Lỗi xử lý dữ liệu từ máy chủ.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onShow={resetToItem} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={modal.overlay}
      >
        <View style={modal.sheet}>
          {/* Header */}
          <View style={modal.header}>
            <View style={{ flex: 1 }}>
              <Text style={modal.title}>{isEdit ? "Sửa thiết bị" : "Thêm thiết bị"}</Text>
              <Text style={modal.subtitle}>
                {isEdit ? "Cập nhật hồ sơ & thông số thiết bị y tế" : "Thêm mới hồ sơ trang thiết bị y tế"}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={modal.closeBtn}>
              <Ionicons name="close" size={20} color="#64748b" />
            </Pressable>
          </View>

          {/* Form nội dung cuộn */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            {/* Ảnh thiết bị gọn */}
            <Pressable style={modal.uploadBoxCompact} onPress={() => setMediaPickerTarget("equipmentImage")}>
              {imageUri ? (
                <View style={modal.previewWrap}>
                  <Image source={{ uri: imageUri }} style={modal.imagePreview} resizeMode="cover" />
                  <Pressable style={modal.removeImageBtn} onPress={() => setImageUri("")}>
                    <Ionicons name="close-circle" size={20} color="#dc2626" />
                  </Pressable>
                </View>
              ) : (
                <View style={modal.uploadContentCompact}>
                  <Ionicons name="camera-outline" size={18} color="#64748b" />
                  <Text style={modal.uploadTitleCompact}>Tải ảnh thiết bị</Text>
                </View>
              )}
            </Pressable>

            {/* Thông tin cơ bản */}
            <View style={modal.twoCol}>
              <View style={modal.col}>
                <Text style={modal.label}>Tên thiết bị <Text style={modal.required}>*</Text></Text>
                <TextInput
                  style={modal.input}
                  placeholder="VD: Máy Laser CO2 Fractional..."
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
                  placeholder="VD: Thiết bị laser, Máy thẩm mỹ..."
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
                  <Ionicons name="chevron-down" size={15} color="#64748b" />
                </Pressable>
              </View>
            </View>

            {/* HỒ SƠ & PHÂN LOẠI THIẾT BỊ Y TẾ */}
            <View style={modal.sectionGreen}>
              <View style={modal.sectionHeader}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#059669" />
                <Text style={modal.sectionTitleGreen}>HỒ SƠ & PHÂN LOẠI THIẾT BỊ Y TẾ</Text>
              </View>

              <View style={modal.twoCol}>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Phân loại mức độ rủi ro</Text>
                  <Pressable style={modal.selector} onPress={() => setActiveSelectPicker("riskClassification")}>
                    <Text style={modal.selectorText} numberOfLines={1}>
                      {riskClassification || "Chưa phân nhóm"}
                    </Text>
                    <Ionicons name="chevron-down" size={15} color="#64748b" />
                  </Pressable>
                </View>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Chu kỳ kiểm định (tháng) </Text>
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
                  <Text style={modal.subLabel}>Số Seri </Text>
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
                <Ionicons name="time-outline" size={14} color="#059669" />
                <Text style={modal.sectionTitleGreen}>LỊCH KIỂM ĐỊNH & BẢO TRÌ</Text>
              </View>

              <View style={modal.twoCol}>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Ngày kiểm định gần nhất</Text>
                  <Pressable style={modal.dateField} onPress={() => setActiveDatePicker("lastInspectionDate")}>
                    <Text style={[modal.dateText, !lastInspectionDate && modal.placeholderText]}>
                      {formatDateDisplay(lastInspectionDate) || "dd/mm/yyyy"}
                    </Text>
                    <Ionicons name="calendar-outline" size={15} color="#64748b" />
                  </Pressable>
                </View>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Hạn kiểm định tiếp theo</Text>
                  <Pressable style={modal.dateField} onPress={() => setActiveDatePicker("nextInspectionDate")}>
                    <Text style={[modal.dateText, !nextInspectionDate && modal.placeholderText]}>
                      {formatDateDisplay(nextInspectionDate) || "dd/mm/yyyy"}
                    </Text>
                    <Ionicons name="calendar-outline" size={15} color="#64748b" />
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
                    <Ionicons name="chevron-down" size={15} color="#64748b" />
                  </Pressable>
                </View>
                <View style={modal.col}>
                  <Text style={modal.subLabel}>Đơn vị thực hiện kiểm định</Text>
                  <TextInput
                    style={modal.input}
                    placeholder="VD: Trung tâm kiểm định KTAT KV2..."
                    placeholderTextColor="#94a3b8"
                    value={inspectionAgency}
                    onChangeText={setInspectionAgency}
                  />
                </View>
              </View>

              <View style={{ marginTop: 6 }}>
                <Text style={modal.subLabel}>Biên bản kiểm định / Giấy chứng nhận (PDF hoặc Ảnh)</Text>
                <Pressable style={modal.uploadFileBtn} onPress={() => setMediaPickerTarget("certFile")}>
                  <Ionicons
                    name={inspectionCertFile ? "checkmark-circle-outline" : "cloud-upload-outline"}
                    size={15}
                    color={inspectionCertFile ? "#008852" : "#059669"}
                  />
                  <Text
                    style={[modal.uploadFileText, inspectionCertFile ? { color: "#008852", fontWeight: "700" } : {}]}
                    numberOfLines={1}
                  >
                    {inspectionCertFileName || (inspectionCertFile ? "Biên bản đã tải lên" : "Tải lên biên bản / giấy chứng nhận...")}
                  </Text>
                  {inspectionCertFile ? (
                    <Pressable
                      onPress={(e) => { e.stopPropagation?.(); setInspectionCertFile(""); setInspectionCertFileName(""); }}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={16} color="#ef4444" />
                    </Pressable>
                  ) : null}
                </Pressable>
              </View>
            </View>

            {/* HÓA ĐƠN, CO/CQ, GIẤY TỜ NHẬP KHẨU & HỒ SƠ */}
            <View style={modal.sectionAmber}>
              <View style={modal.sectionHeaderBetween}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                  <Ionicons name="document-text-outline" size={14} color="#008852" />
                  <Text style={modal.sectionTitleAmber} numberOfLines={1}>
                    HÓA ĐƠN, CO/CQ,GIẤY TỜ ({documents.length})
                  </Text>
                </View>
                <Pressable
                  style={[modal.addDocBtn, showDocForm && modal.closeDocBtn]}
                  onPress={() => setShowDocForm((v) => !v)}
                >
                  <Text style={modal.addDocBtnText}>{showDocForm ? "Đóng" : "+ Thêm hồ sơ"}</Text>
                </Pressable>
              </View>

              {/* Form thêm hồ sơ mở rộng */}
              {showDocForm && (
                <View style={modal.subFormCard}>
                  {/* 1. Loại hồ sơ 1 hàng riêng để hiển thị trọn vẹn tên văn bản dài */}
                  <View>
                    <Text style={modal.subLabel}>Loại hồ sơ <Text style={modal.required}>*</Text></Text>
                    <Pressable style={modal.selector} onPress={() => setActiveSelectPicker("docType")}>
                      <Text style={modal.selectorText} numberOfLines={1}>
                        {DOC_TYPE_OPTIONS.find((o) => o.value === newDocType)?.label || newDocType || "Chọn loại hồ sơ..."}
                      </Text>
                      <Ionicons name="chevron-down" size={15} color="#64748b" />
                    </Pressable>
                  </View>

                  {/* 2. Tên tài liệu & Số hiệu (2 cột cân đối 50% - 50%) */}
                  <View style={modal.twoCol}>
                    <View style={modal.col}>
                      <Text style={modal.subLabel}>Tên tài liệu <Text style={modal.required}>*</Text></Text>
                      <TextInput
                        style={modal.input}
                        placeholder="VD: Hóa đơn GTGT số..."
                        placeholderTextColor="#94a3b8"
                        value={newDocTitle}
                        onChangeText={setNewDocTitle}
                      />
                    </View>
                    <View style={modal.col}>
                      <Text style={modal.subLabel}>Số hiệu / Ký hiệu</Text>
                      <TextInput
                        style={modal.input}
                        placeholder="VD: INV-2024-88..."
                        placeholderTextColor="#94a3b8"
                        value={newDocCode}
                        onChangeText={setNewDocCode}
                      />
                    </View>
                  </View>

                  {/* 3. Ngày phát hành & Ngày hết hạn (Tách riêng 1 hàng 2 cột rộng rãi, không bị đè chữ) */}
                  <View style={modal.twoCol}>
                    <View style={modal.col}>
                      <Text style={modal.subLabel}>Ngày phát hành</Text>
                      <Pressable style={modal.dateField} onPress={() => setActiveDatePicker("newDocIssueDate")}>
                        <Text style={[modal.dateText, !newDocIssueDate && modal.placeholderText]} numberOfLines={1}>
                          {formatDateDisplay(newDocIssueDate) || "dd/mm/yyyy"}
                        </Text>
                        <Ionicons name="calendar-outline" size={15} color="#64748b" />
                      </Pressable>
                    </View>
                    <View style={modal.col}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={modal.subLabel}>Ngày hết hạn</Text>
                        {newDocExpiryDate ? (
                          <Pressable onPress={() => setNewDocExpiryDate("")} hitSlop={6}>
                            <Text style={{ fontSize: 9.5, color: "#94a3b8", fontFamily: "Inter-Medium" }}>Xóa</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <Pressable style={modal.dateField} onPress={() => setActiveDatePicker("newDocExpiryDate")}>
                        <Text style={[modal.dateText, !newDocExpiryDate && modal.placeholderText]} numberOfLines={1}>
                          {formatDateDisplay(newDocExpiryDate) || "dd/mm/yyyy"}
                        </Text>
                        <Ionicons name="calendar-outline" size={15} color="#64748b" />
                      </Pressable>
                    </View>
                  </View>

                  <View style={{ marginTop: 4 }}>
                    <Text style={modal.subLabel}>Tệp đính kèm văn bản *</Text>
                    <Pressable style={modal.uploadFileBtnAmber} onPress={() => setMediaPickerTarget("docFile")}>
                      <Ionicons name="cloud-upload-outline" size={15} color="#b45309" />
                      <Text style={modal.uploadFileTextAmber} numberOfLines={1}>
                        {newDocFile ? newDocFile.name : "Tải lên tệp tài liệu / Ảnh..."}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={modal.subFormFooter}>
                    <Pressable style={modal.subFormCancelBtn} onPress={() => setShowDocForm(false)}>
                      <Text style={modal.subFormCancelText}>Hủy</Text>
                    </Pressable>
                    <Pressable style={modal.subFormSubmitBtn} onPress={handleAddDocument}>
                      <Text style={modal.subFormSubmitText}>Thêm hồ sơ</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {documents.length === 0 && !showDocForm ? (
                <Text style={modal.emptyDocText}>
                  Chưa có tài liệu / hóa đơn đính kèm. Bấm "+ Thêm hồ sơ" để tải lên giấy tờ.
                </Text>
              ) : (
                <View style={{ gap: 5, marginTop: 6 }}>
                  {documents.map((doc, idx) => (
                    <View key={idx} style={modal.docItem}>
                      <Ionicons name="document-attach-outline" size={15} color="#9a3412" />
                      <Text style={modal.docName} numberOfLines={1}>{doc.name}</Text>
                      <Pressable onPress={() => setDocuments((prev) => prev.filter((_, i) => i !== idx))}>
                        <Ionicons name="trash-outline" size={15} color="#dc2626" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Vị trí phòng (Chi nhánh) */}
            <Text style={modal.label}>Vị trí phòng </Text>
            <Pressable
              style={[
                modal.selector,
                deptDropdownOpen && {
                  borderColor: "#008852",
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                },
              ]}
              onPress={() => setDeptDropdownOpen((v) => !v)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Ionicons name="business-outline" size={15} color={location ? "#008852" : "#94a3b8"} />
                <Text style={[modal.selectorText, !location && modal.placeholderText]} numberOfLines={1}>
                  {location || "Chọn phòng đặt thiết bị..."}
                </Text>
              </View>
              {location ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setLocation("");
                  }}
                  hitSlop={8}
                  style={{ marginRight: 6 }}
                >
                  <Ionicons name="close-circle" size={15} color="#94a3b8" />
                </Pressable>
              ) : null}
              <Ionicons name={deptDropdownOpen ? "chevron-up" : "chevron-down"} size={15} color="#64748b" />
            </Pressable>

            {/* Dropdown danh sách phòng ban có tìm kiếm */}
            {deptDropdownOpen && (
              <View style={modal.deptDropdownContainer}>
                <View style={modal.deptSearchWrap}>
                  <Ionicons name="search-outline" size={15} color="#64748b" />
                  <TextInput
                    style={modal.deptSearchInput}
                    placeholder="Tìm mã hoặc tên phòng..."
                    placeholderTextColor="#94a3b8"
                    value={deptSearch}
                    onChangeText={setDeptSearch}
                    autoCapitalize="none"
                  />
                  {deptSearch ? (
                    <Pressable onPress={() => setDeptSearch("")} hitSlop={6}>
                      <Ionicons name="close-circle" size={15} color="#94a3b8" />
                    </Pressable>
                  ) : null}
                </View>

                <View style={modal.deptList}>
                  {filteredRooms.length === 0 ? (
                    <View style={{ padding: 12, alignItems: "center" }}>
                      <Text style={{ fontSize: 11.5, color: "#94a3b8", fontStyle: "italic" }}>
                        Không tìm thấy phòng phù hợp
                      </Text>
                    </View>
                  ) : (
                    filteredRooms.map((room) => {
                      const isSelected =
                        location === `${room.name} (${room.code})` || location === room.name;
                      return (
                        <Pressable
                          key={room.id}
                          style={({ pressed }) => [
                            modal.deptItem,
                            isSelected && { backgroundColor: "#f0fdf4" },
                            pressed && { backgroundColor: "#f1f5f9" },
                          ]}
                          onPress={() => {
                            setLocation(`${room.name} (${room.code})`);
                            setDeptDropdownOpen(false);
                            setDeptSearch("");
                          }}
                        >
                          <View style={modal.deptItemHeader}>
                            <Text style={modal.deptItemName}>{room.name}</Text>
                            <View style={modal.deptCodeBadge}>
                              <Text style={modal.deptCodeText}>{room.code}</Text>
                            </View>
                            <View style={modal.deptCategoryBadge}>
                              <Text style={modal.deptCategoryText}>{room.category}</Text>
                            </View>
                          </View>
                          <Text style={modal.deptFloorText}>{room.floor}</Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>
            )}

            <View style={modal.twoCol}>
              <View style={modal.col}>
                <Text style={modal.label}>Ngày mua thiết bị</Text>
                <Pressable style={modal.dateField} onPress={() => setActiveDatePicker("purchaseDate")}>
                  <Text style={[modal.dateText, !purchaseDate && modal.placeholderText]}>
                    {formatDateDisplay(purchaseDate) || "dd/mm/yyyy"}
                  </Text>
                  <Ionicons name="calendar-outline" size={15} color="#64748b" />
                </Pressable>
              </View>
              <View style={modal.col}>
                <Text style={modal.label}>Ngày đưa vào sử dụng</Text>
                <Pressable style={modal.dateField} onPress={() => setActiveDatePicker("usageStartDate")}>
                  <Text style={[modal.dateText, !usageStartDate && modal.placeholderText]}>
                    {formatDateDisplay(usageStartDate) || "dd/mm/yyyy"}
                  </Text>
                  <Ionicons name="calendar-outline" size={15} color="#64748b" />
                </Pressable>
              </View>
            </View>

            {/* Ghi chú */}
            <Text style={modal.label}>Ghi chú thêm</Text>
            <TextInput
              style={[modal.input, { height: 56, textAlignVertical: "top" }]}
              placeholder="Ghi chú tình trạng, linh kiện kèm theo..."
              placeholderTextColor="#94a3b8"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </ScrollView>

          {/* Chân trang CỐ ĐỊNH - Luôn hiển thị trên màn hình */}
          <View style={modal.stickyFooter}>
            <Pressable style={modal.cancelActionBtn} onPress={onClose} disabled={saving}>
              <Text style={modal.cancelActionText}>Hủy</Text>
            </Pressable>
            <Pressable
              style={[modal.saveActionBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={modal.saveActionText}>{isEdit ? "Lưu thay đổi" : "Tạo thiết bị"}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

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
            : activeDatePicker === "newDocIssueDate"
            ? newDocIssueDate
            : activeDatePicker === "newDocExpiryDate"
            ? newDocExpiryDate
            : ""
        }
        onChange={(dateStr) => {
          if (activeDatePicker === "lastInspectionDate") setLastInspectionDate(dateStr);
          else if (activeDatePicker === "nextInspectionDate") setNextInspectionDate(dateStr);
          else if (activeDatePicker === "purchaseDate") setPurchaseDate(dateStr);
          else if (activeDatePicker === "usageStartDate") setUsageStartDate(dateStr);
          else if (activeDatePicker === "newDocIssueDate") setNewDocIssueDate(dateStr);
          else if (activeDatePicker === "newDocExpiryDate") setNewDocExpiryDate(dateStr);
          setActiveDatePicker(null);
        }}
        title={
          activeDatePicker === "lastInspectionDate"
            ? "Ngày kiểm định gần nhất"
            : activeDatePicker === "nextInspectionDate"
            ? "Ngày đến hạn kiểm định"
            : activeDatePicker === "purchaseDate"
            ? "Ngày mua"
            : activeDatePicker === "usageStartDate"
            ? "Ngày đưa vào sử dụng"
            : activeDatePicker === "newDocIssueDate"
            ? "Ngày phát hành"
            : "Ngày hết hạn"
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
            ? "Phân loại rủi ro"
            : activeSelectPicker === "docType"
            ? "Loại hồ sơ"
            : "Kết quả thực hiện"
        }
        options={
          activeSelectPicker === "status"
            ? STATUS_OPTIONS
            : activeSelectPicker === "riskClassification"
            ? RISK_OPTIONS
            : activeSelectPicker === "docType"
            ? DOC_TYPE_OPTIONS
            : INSPECTION_RESULT_OPTIONS
        }
        selectedValue={
          activeSelectPicker === "status"
            ? status
            : activeSelectPicker === "riskClassification"
            ? riskClassification
            : activeSelectPicker === "docType"
            ? newDocType
            : inspectionResult
        }
        onSelect={(val) => {
          if (activeSelectPicker === "status") setStatus(val);
          else if (activeSelectPicker === "riskClassification") setRiskClassification(val);
          else if (activeSelectPicker === "docType") setNewDocType(val);
          else if (activeSelectPicker === "inspectionResult") setInspectionResult(val);
        }}
        onClose={() => setActiveSelectPicker(null)}
      />

      {/* Custom Rounded Alert Modal cho form */}
      <AppAlertModal
        visible={formAlert.visible}
        title={formAlert.title}
        message={formAlert.message}
        type={formAlert.type}
        onClose={() => setFormAlert((prev) => ({ ...prev, visible: false }))}
      />

      {/* Modal chọn nguồn Ảnh / Chụp Camera / Tài liệu */}
      <MediaSourceModal
        visible={mediaPickerTarget !== null}
        title={
          mediaPickerTarget === "equipmentImage"
            ? "Tải lên ảnh thiết bị"
            : mediaPickerTarget === "certFile"
            ? "Tải lên biên bản kiểm định"
            : "Tải lên tài liệu / hóa đơn"
        }
        subtitle={
          mediaPickerTarget === "equipmentImage"
            ? "Chụp ảnh thiết bị trực tiếp bằng máy ảnh hoặc chọn từ thư viện"
            : "Chụp ảnh giấy tờ trực tiếp, chọn từ thư viện hoặc tải lên tệp PDF"
        }
        allowDocument={mediaPickerTarget !== "equipmentImage"}
        onTakePhoto={handleTakePhoto}
        onChooseGallery={handleChooseGallery}
        onChooseDocument={handleChooseDocument}
        onClose={() => setMediaPickerTarget(null)}
      />

      {/* Modal xem / xem trước tệp tài liệu trong form */}
      <FilePreviewModal
        visible={formPreviewFile !== null}
        file={formPreviewFile}
        onClose={() => setFormPreviewFile(null)}
      />
    </Modal>
  );
}

// ── Equipment Detail Modal ───────────────────────────────────────────────────
function EquipmentDetailModal({
  visible,
  item,
  onClose,
  onEdit,
}: {
  visible: boolean;
  item: EquipmentRecord | null;
  onClose: () => void;
  onEdit: (item: EquipmentRecord) => void;
}) {
  if (!item) return null;

  const [previewFile, setPreviewFile] = useState<{ name: string; uri?: string; type?: string } | null>(null);

  const badge = getStatusBadge(item.status);
  const { cleanNotes, meta } = parseEquipmentNotes(item.notes);

  const displayImageUri = item.imageUri || (item as any)?.imageUrl || meta["Ảnh thiết bị"] || "";
  const risk = item.riskClassification || meta["Phân loại rủi ro"] || "Chưa phân nhóm";
  const interval = item.inspectionIntervalMonths || (meta["Chu kỳ kiểm định"] ? meta["Chu kỳ kiểm định"].replace(/\D/g, "") : "") || "12";
  const manufacturer = item.manufacturer || meta["Hãng SX"] || "-";
  const origin = item.origin || meta["Xuất xứ"] || "-";
  const model = item.model || meta["Model"] || "-";
  const serial = item.serialNumber || meta["Serial"] || "-";
  const lastInspection = item.lastInspectionDate ? formatDateDisplay(item.lastInspectionDate.slice(0, 10)) : meta["Kiểm định gần nhất"] ? formatDateDisplay(meta["Kiểm định gần nhất"]) : "-";
  const nextInspection = item.nextInspectionDate ? formatDateDisplay(item.nextInspectionDate.slice(0, 10)) : meta["Hạn kiểm định tiếp theo"] ? formatDateDisplay(meta["Hạn kiểm định tiếp theo"]) : "-";
  const result = item.inspectionResult || meta["Kết quả"] || "Pass";
  const agency = item.inspectionAgency || meta["Đơn vị kiểm định"] || "-";
  const certFile = item.inspectionCertFile || meta["Biên bản"] || "";
  const purchase = item.purchaseDate ? formatDateDisplay(item.purchaseDate.slice(0, 10)) : "-";
  const usageStart = item.usageStartDate ? formatDateDisplay(item.usageStartDate.slice(0, 10)) : meta["Ngày sử dụng"] ? formatDateDisplay(meta["Ngày sử dụng"]) : "-";

  let docs = (item.documents as any) ?? [];
  if (docs.length === 0 && meta["Tài liệu JSON"]) {
    try {
      docs = JSON.parse(meta["Tài liệu JSON"]);
    } catch {}
  }
  if (docs.length === 0 && meta["Hồ sơ"]) {
    docs = meta["Hồ sơ"].split(",").map((dName: string) => ({ name: dName.trim() }));
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={detailStyles.overlay}>
        <View style={detailStyles.sheet}>
          <View style={detailStyles.handleBar} />

          {/* Header */}
          <View style={detailStyles.header}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={detailStyles.headerTitle} numberOfLines={1}>Chi tiết thiết bị</Text>
              <Text style={detailStyles.headerSubtitle}>Mã: {item.code || "N/A"}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={detailStyles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748b" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
            {/* Ảnh thiết bị nếu có */}
            {displayImageUri ? (
              <Pressable
                style={detailStyles.imageWrap}
                onPress={() => setPreviewFile({ name: item.name, uri: displayImageUri })}
              >
                <Image source={{ uri: displayImageUri }} style={detailStyles.image} resizeMode="cover" />
                <View style={detailStyles.imageOverlayHint}>
                  <Ionicons name="expand-outline" size={14} color="#ffffff" />
                  <Text style={detailStyles.imageHintText}>Xem ảnh gốc</Text>
                </View>
              </Pressable>
            ) : null}

            {/* Thẻ định danh & Trạng thái */}
            <View style={detailStyles.cardBasic}>
              <View style={detailStyles.rowBetween}>
                <Text style={detailStyles.nameText}>{item.name}</Text>
                <View style={[detailStyles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[detailStyles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              </View>
              <View style={detailStyles.tagsRow}>
                {item.category ? (
                  <View style={detailStyles.tag}>
                    <Ionicons name="pricetag-outline" size={12} color="#475569" />
                    <Text style={detailStyles.tagText}>{item.category}</Text>
                  </View>
                ) : null}
                {item.location ? (
                  <View style={detailStyles.tag}>
                    <Ionicons name="business-outline" size={12} color="#475569" />
                    <Text style={detailStyles.tagText}>{item.location}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Thông số kỹ thuật y tế */}
            <View style={detailStyles.sectionGreen}>
              <View style={detailStyles.sectionHeader}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#059669" />
                <Text style={detailStyles.sectionTitleGreen}>HỒ SƠ & PHÂN LOẠI THIẾT BỊ Y TẾ</Text>
              </View>
              <View style={detailStyles.grid2}>
                <View style={detailStyles.infoItem}>
                  <Text style={detailStyles.infoLabel}>Phân loại rủi ro (BYT)</Text>
                  <Text style={detailStyles.infoValue}>{risk}</Text>
                </View>
                <View style={detailStyles.infoItem}>
                  <Text style={detailStyles.infoLabel}>Chu kỳ kiểm định</Text>
                  <Text style={detailStyles.infoValue}>{interval} tháng</Text>
                </View>
                <View style={detailStyles.infoItem}>
                  <Text style={detailStyles.infoLabel}>Hãng sản xuất</Text>
                  <Text style={detailStyles.infoValue}>{manufacturer}</Text>
                </View>
                <View style={detailStyles.infoItem}>
                  <Text style={detailStyles.infoLabel}>Xuất xứ</Text>
                  <Text style={detailStyles.infoValue}>{origin}</Text>
                </View>
                <View style={detailStyles.infoItem}>
                  <Text style={detailStyles.infoLabel}>Model</Text>
                  <Text style={detailStyles.infoValue}>{model}</Text>
                </View>
                <View style={detailStyles.infoItem}>
                  <Text style={detailStyles.infoLabel}>Số Serial</Text>
                  <Text style={detailStyles.infoValue}>{serial}</Text>
                </View>
              </View>
            </View>

            {/* Lịch kiểm định & Hiệu chuẩn */}
            <View style={detailStyles.sectionGreen}>
              <View style={detailStyles.sectionHeader}>
                <Ionicons name="time-outline" size={16} color="#059669" />
                <Text style={detailStyles.sectionTitleGreen}>LỊCH KIỂM ĐỊNH & BẢO TRÌ</Text>
              </View>
              <View style={detailStyles.grid2}>
                <View style={detailStyles.infoItem}>
                  <Text style={detailStyles.infoLabel}>Kiểm định gần nhất</Text>
                  <Text style={detailStyles.infoValue}>{lastInspection}</Text>
                </View>
                <View style={detailStyles.infoItem}>
                  <Text style={detailStyles.infoLabel}>Hạn tiếp theo</Text>
                  <Text style={[detailStyles.infoValue, { color: "#008852", fontWeight: "800" }]}>{nextInspection}</Text>
                </View>
                <View style={detailStyles.infoItem}>
                  <Text style={detailStyles.infoLabel}>Kết quả thực hiện</Text>
                  <Text style={detailStyles.infoValue}>{result}</Text>
                </View>
                <View style={detailStyles.infoItem}>
                  <Text style={detailStyles.infoLabel}>Đơn vị thực hiện</Text>
                  <Text style={detailStyles.infoValue}>{agency}</Text>
                </View>
              </View>
              {certFile ? (
                <Pressable
                  style={detailStyles.fileAttachBox}
                  onPress={() =>
                    setPreviewFile({
                      name: `Biên bản: ${certFile}`,
                      uri: certFile.includes("/") || certFile.includes(":") ? certFile : "",
                    })
                  }
                >
                  <Ionicons name="document-attach-outline" size={16} color="#059669" />
                  <Text style={detailStyles.fileAttachText} numberOfLines={1}>Biên bản: {certFile}</Text>
                  <Ionicons name="eye-outline" size={16} color="#059669" />
                </Pressable>
              ) : null}
            </View>

            {/* Hóa đơn, CO/CQ, Hồ sơ */}
            <View style={detailStyles.sectionAmber}>
              <View style={detailStyles.sectionHeader}>
                <Ionicons name="document-text-outline" size={16} color="#9a3412" />
                <Text style={detailStyles.sectionTitleAmber}>HỒ SƠ, HÓA ĐƠN & CO/CQ ({docs.length})</Text>
              </View>
              {docs.length === 0 ? (
                <Text style={detailStyles.emptyText}>Chưa có tài liệu / hóa đơn đính kèm.</Text>
              ) : (
                <View style={{ gap: 6, marginTop: 4 }}>
                  {docs.map((doc: any, i: number) => (
                    <Pressable
                      key={i}
                      style={detailStyles.docRow}
                      onPress={() =>
                        setPreviewFile({
                          name: doc.name || `Tài liệu ${i + 1}`,
                          uri: doc.uri || (doc.name?.includes("/") || doc.name?.includes(":") ? doc.name : ""),
                        })
                      }
                    >
                      <Ionicons name="document-attach-outline" size={15} color="#9a3412" />
                      <Text style={detailStyles.docText} numberOfLines={1}>{doc.name}</Text>
                      <Ionicons name="eye-outline" size={15} color="#9a3412" />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Vị trí, thời gian & ghi chú */}
            <View style={detailStyles.sectionCard}>
              <View style={detailStyles.grid2}>
                <View style={detailStyles.infoItem}>
                  <Text style={detailStyles.infoLabel}>Ngày mua thiết bị</Text>
                  <Text style={detailStyles.infoValue}>{purchase}</Text>
                </View>
                <View style={detailStyles.infoItem}>
                  <Text style={detailStyles.infoLabel}>Ngày đưa vào sử dụng</Text>
                  <Text style={detailStyles.infoValue}>{usageStart}</Text>
                </View>
              </View>
              {cleanNotes ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={detailStyles.infoLabel}>Ghi chú thêm</Text>
                  <Text style={detailStyles.notesText}>{cleanNotes}</Text>
                </View>
              ) : null}
            </View>

            {/* Footer Buttons */}
            <View style={detailStyles.footer}>
              <Pressable style={detailStyles.closeBtnBottom} onPress={onClose}>
                <Text style={detailStyles.closeBtnText}>Đóng</Text>
              </Pressable>
              <Pressable
                style={detailStyles.editBtnBottom}
                onPress={() => {
                  onClose();
                  onEdit(item);
                }}
              >
                <Ionicons name="pencil" size={16} color="#ffffff" />
                <Text style={detailStyles.editBtnText}>Chỉnh sửa</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* File & Image Preview Modal */}
      <FilePreviewModal
        visible={previewFile !== null}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
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

// ── Donut Chart Component ───────────────────────────────────────────────────
interface ChartSlice {
  label: string;
  count: number;
  color: string;
  filter?: string;
}

function DonutChart({
  items,
  total,
  size = 180,
  strokeWidth = 26,
}: {
  items: ChartSlice[];
  total: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const validItems = items.filter((i) => i.count > 0);
  const sum = validItems.reduce((acc, i) => acc + i.count, 0) || total;

  if (sum === 0) {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={center}
            cy={center}
            r={radius - strokeWidth / 2}
            fill="#ffffff"
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: 11, color: "#64748b", fontFamily: "Inter-Medium" }}>Tổng số</Text>
          <Text style={{ fontSize: 24, fontWeight: "800", color: "#0f172a", fontFamily: "Inter-Bold" }}>0</Text>
          <Text style={{ fontSize: 11, color: "#64748b", fontFamily: "Inter-Regular" }}>thiết bị</Text>
        </View>
      </View>
    );
  }

  if (validItems.length === 1) {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={validItems[0].color}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={center}
            cy={center}
            r={radius - strokeWidth / 2}
            fill="#ffffff"
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: 11, color: "#64748b", fontFamily: "Inter-Medium" }}>Tổng số</Text>
          <Text style={{ fontSize: 24, fontWeight: "800", color: "#0f172a", fontFamily: "Inter-Bold" }}>{total}</Text>
          <Text style={{ fontSize: 11, color: "#64748b", fontFamily: "Inter-Regular" }}>thiết bị</Text>
        </View>
      </View>
    );
  }

  let accumulatedAngle = 0;
  const slices = validItems.map((item) => {
    const percentage = item.count / sum;
    const angle = percentage * 360;
    const startAngle = accumulatedAngle;
    accumulatedAngle += angle;
    return {
      ...item,
      percentage,
      startAngle,
      endAngle: accumulatedAngle,
    };
  });

  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const describeArc = (startAngle: number, endAngle: number) => {
    const sweep = endAngle - startAngle;
    const safeEnd = sweep >= 360 ? startAngle + 359.99 : endAngle;
    const start = polarToCartesian(center, center, radius, safeEnd);
    const end = polarToCartesian(center, center, radius, startAngle);
    const largeArcFlag = sweep > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        {slices.map((slice, idx) => (
          <Path
            key={idx}
            d={describeArc(slice.startAngle, slice.endAngle)}
            stroke={slice.color}
            strokeWidth={strokeWidth}
            fill="none"
          />
        ))}
        {/* White circle in the center */}
        <Circle
          cx={center}
          cy={center}
          r={radius - strokeWidth / 2}
          fill="#ffffff"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ fontSize: 11, color: "#64748b", fontFamily: "Inter-Medium" }}>Tổng số</Text>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#0f172a", fontFamily: "Inter-Bold" }}>{total}</Text>
        <Text style={{ fontSize: 11, color: "#64748b", fontFamily: "Inter-Regular" }}>thiết bị</Text>
      </View>
    </View>
  );
}

// ── Equipment Borrow & Return Modal ──────────────────────────────────────────
function EquipmentBorrowReturnModal({
  visible,
  initialTab = "borrow",
  equipmentList,
  onClose,
  onSaved,
  showAlert,
}: {
  visible: boolean;
  initialTab?: "borrow" | "return";
  equipmentList: EquipmentRecord[];
  onClose: () => void;
  onSaved: (updatedItem?: EquipmentRecord, newReq?: EquipmentRequestRecord) => void;
  showAlert: (title: string, message: string, type?: "error" | "warning" | "success" | "info") => void;
}) {
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState<"borrow" | "return">(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<EquipmentRecord | null>(null);
  const [reason, setReason] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
    setSelectedDevice(null);
    setSearchQuery("");
    setReason("");
    setReturnDate("");
    setReturnNotes("");
    setShowDevicePicker(false);
    setShowDatePicker(false);
  }, [visible, initialTab]);

  // Filter available devices for "borrow"
  const availableDevices = equipmentList.filter((item) => {
    const s = (item.status || "").toLowerCase();
    const isAvail = !s.includes("using") && !s.includes("dùng") && !s.includes("booked") && !s.includes("mượn") && !s.includes("đơn") && !s.includes("maint") && !s.includes("trì") && !s.includes("retire") && !s.includes("lý");
    if (!isAvail) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.code || "").toLowerCase().includes(q) ||
      (item.department || "").toLowerCase().includes(q)
    );
  });

  // Filter borrowed / in-use devices for "return"
  const borrowedDevices = equipmentList.filter((item) => {
    const s = (item.status || "").toLowerCase();
    const isBorrowed = s.includes("using") || s.includes("dùng") || s.includes("booked") || s.includes("mượn") || s.includes("đơn") || s.includes("maint") || s.includes("trì");
    if (!isBorrowed) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.code || "").toLowerCase().includes(q) ||
      (item.department || "").toLowerCase().includes(q)
    );
  });

  const activeDeviceList = activeTab === "borrow" ? availableDevices : borrowedDevices;

  const handleSubmit = async () => {
    if (!selectedDevice) {
      showAlert("Thiếu thông tin", `Vui lòng chọn thiết bị cần ${activeTab === "borrow" ? "mượn" : "trả"}.`, "warning");
      return;
    }

    if (activeTab === "borrow" && !reason.trim()) {
      showAlert("Thiếu thông tin", "Vui lòng nhập lý do mượn thiết bị.", "warning");
      return;
    }

    const deviceId = selectedDevice._id || selectedDevice.id;
    if (!deviceId) {
      showAlert("Lỗi", "Không tìm thấy ID thiết bị.", "error");
      return;
    }

    setSubmitting(true);
    try {
      if (activeTab === "borrow") {
        const updatedNotes = `${selectedDevice.notes || ""}\n[Mượn thiết bị: ${reason.trim()}${returnDate ? ` | Hạn trả: ${returnDate}` : ""}]`.trim();
        const updatedRes = await equipment.update(deviceId, {
          ...selectedDevice,
          status: "booked",
          assignedToName: user?.displayName || user?.email || "Nhân viên",
          notes: updatedNotes,
        });
        const newReq: EquipmentRequestRecord = {
          id: "req-" + Date.now(),
          equipmentId: deviceId,
          equipmentName: selectedDevice.name,
          equipmentCode: selectedDevice.code || "100015",
          type: "borrow",
          requesterName: user?.displayName || user?.email || "Igen Test",
          requesterDepartment: selectedDevice.department || "DDD",
          status: "pending",
          createdAt: "Vừa xong",
          reason: reason.trim(),
        };
        showAlert("Thành công", `Đã gửi yêu cầu mượn thiết bị "${selectedDevice.name}" thành công! Phiếu đang chờ duyệt.`, "success");
        onSaved({ ...selectedDevice, ...updatedRes, status: "booked", assignedToName: user?.displayName || "Nhân viên", notes: updatedNotes }, newReq);
      } else {
        const updatedNotes = `${selectedDevice.notes || ""}\n[Trả thiết bị: ${returnNotes.trim() || "Hoàn trả đầy đủ"}]`.trim();
        const updatedRes = await equipment.update(deviceId, {
          ...selectedDevice,
          status: "ready",
          assignedToName: "",
          notes: updatedNotes,
        });
        const newReq: EquipmentRequestRecord = {
          id: "req-" + Date.now(),
          equipmentId: deviceId,
          equipmentName: selectedDevice.name,
          equipmentCode: selectedDevice.code || "100015",
          type: "return",
          requesterName: user?.displayName || user?.email || "Igen Test",
          requesterDepartment: selectedDevice.department || "DDD",
          status: "pending",
          createdAt: "Vừa xong",
          reason: returnNotes.trim(),
        };
        showAlert("Thành công", `Đã gửi yêu cầu trả thiết bị "${selectedDevice.name}" thành công! Phiếu đang chờ duyệt.`, "success");
        onSaved({ ...selectedDevice, ...updatedRes, status: "ready", assignedToName: "", notes: updatedNotes }, newReq);
      }
      onClose();
    } catch (e: any) {
      showAlert("Thất bại", e.message || "Không thể gửi yêu cầu.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={borrowModalStyles.overlay} onPress={onClose}>
        <Pressable style={borrowModalStyles.dialog} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={borrowModalStyles.header}>
            <View style={borrowModalStyles.headerIconWrap}>
              <Ionicons name="swap-horizontal" size={22} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={borrowModalStyles.title}>Tạo phiếu mượn / trả thiết bị</Text>
              <Text style={borrowModalStyles.subtitle}>Gửi yêu cầu mượn hoặc hoàn trả thiết bị trong hệ thống</Text>
            </View>
            <Pressable onPress={onClose} style={borrowModalStyles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color="#64748b" />
            </Pressable>
          </View>

          {/* Segmented Tab Switcher */}
          <View style={borrowModalStyles.tabSwitcher}>
            <Pressable
              style={[borrowModalStyles.tabBtn, activeTab === "borrow" && borrowModalStyles.tabBtnActive]}
              onPress={() => {
                setActiveTab("borrow");
                setSelectedDevice(null);
              }}
            >
              <Ionicons name="hand-left-outline" size={17} color={activeTab === "borrow" ? "#059669" : "#64748b"} />
              <Text style={[borrowModalStyles.tabBtnText, activeTab === "borrow" && borrowModalStyles.tabBtnTextActive]}>
                Mượn thiết bị
              </Text>
            </Pressable>

            <Pressable
              style={[borrowModalStyles.tabBtn, activeTab === "return" && borrowModalStyles.tabBtnActive]}
              onPress={() => {
                setActiveTab("return");
                setSelectedDevice(null);
              }}
            >
              <Ionicons name="refresh-outline" size={17} color={activeTab === "return" ? "#059669" : "#64748b"} />
              <Text style={[borrowModalStyles.tabBtnText, activeTab === "return" && borrowModalStyles.tabBtnTextActive]}>
                Trả thiết bị
              </Text>
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {/* 1. Search Bar */}
            <Text style={borrowModalStyles.fieldLabel}>Tìm kiếm thiết bị nhanh</Text>
            <View style={borrowModalStyles.searchWrap}>
              <Ionicons name="search-outline" size={16} color="#94a3b8" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={activeTab === "borrow" ? "Lọc theo tên, mã thiết bị sẵn sàng..." : "Lọc theo tên, mã thiết bị đang dùng..."}
                placeholderTextColor="#94a3b8"
                style={borrowModalStyles.searchInput}
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery("")} hitSlop={6}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </Pressable>
              ) : null}
            </View>

            {/* 2. Select Device Dropdown */}
            <Text style={borrowModalStyles.fieldLabel}>
              Chọn thiết bị <Text style={{ color: "#dc2626" }}>*</Text>
            </Text>
            <Pressable
              style={borrowModalStyles.selectBtn}
              onPress={() => setShowDevicePicker(true)}
            >
              <Text style={[borrowModalStyles.selectBtnText, selectedDevice && { color: "#0f172a", fontWeight: "700" }]}>
                {selectedDevice
                  ? `${selectedDevice.name} (${selectedDevice.code || "N/A"})`
                  : activeTab === "borrow"
                  ? `-- Chọn thiết bị cần mượn (${availableDevices.length} khả dụng) --`
                  : `-- Chọn thiết bị cần trả (${borrowedDevices.length} thiết bị) --`}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#64748b" />
            </Pressable>

            {/* Form Fields for Borrow */}
            {activeTab === "borrow" ? (
              <>
                <Text style={borrowModalStyles.fieldLabel}>
                  Lý do mượn <Text style={{ color: "#dc2626" }}>*</Text>
                </Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={3}
                  placeholder="Nhập lý do sử dụng, ca điều trị, phòng thực hiện hoặc mục đích mượn thiết bị..."
                  placeholderTextColor="#94a3b8"
                  style={borrowModalStyles.textAreaInput}
                />

                <Text style={borrowModalStyles.fieldLabel}>Ngày dự kiến trả (không bắt buộc)</Text>
                <Pressable style={borrowModalStyles.dateInputBtn} onPress={() => setShowDatePicker(true)}>
                  <TextInput
                    value={returnDate}
                    onChangeText={setReturnDate}
                    placeholder="dd/mm/yyyy"
                    placeholderTextColor="#94a3b8"
                    style={{ flex: 1, fontSize: 13, color: "#0f172a", padding: 0 }}
                    editable={false}
                    pointerEvents="none"
                  />
                  <Ionicons name="calendar-outline" size={18} color="#64748b" />
                </Pressable>
              </>
            ) : (
              <>
                <Text style={borrowModalStyles.fieldLabel}>Ghi chú khi trả / Tình trạng bàn giao</Text>
                <TextInput
                  value={returnNotes}
                  onChangeText={setReturnNotes}
                  multiline
                  numberOfLines={3}
                  placeholder="Ghi chú tình trạng thiết bị khi hoàn trả, phụ kiện đi kèm (nếu có)..."
                  placeholderTextColor="#94a3b8"
                  style={borrowModalStyles.textAreaInput}
                />
              </>
            )}

            <Text style={borrowModalStyles.footerNote}>
              Bạn có thể theo dõi hoặc Hủy yêu cầu tại tab Yêu cầu mượn/trả.
            </Text>
          </ScrollView>

          {/* Footer Actions */}
          <View style={borrowModalStyles.footerActions}>
            <Pressable style={borrowModalStyles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={borrowModalStyles.cancelBtnText}>Đóng</Text>
            </Pressable>
            <Pressable
              style={[borrowModalStyles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={borrowModalStyles.submitBtnText}>
                  {activeTab === "borrow" ? "Gửi yêu cầu mượn" : "Gửi yêu cầu trả"}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Select Device Modal Sheet */}
          <Modal visible={showDevicePicker} transparent animationType="fade" onRequestClose={() => setShowDevicePicker(false)}>
            <Pressable style={borrowModalStyles.pickerOverlay} onPress={() => setShowDevicePicker(false)}>
              <View style={borrowModalStyles.pickerSheet} onStartShouldSetResponder={() => true}>
                <View style={borrowModalStyles.pickerHeader}>
                  <Text style={borrowModalStyles.pickerTitle}>
                    {activeTab === "borrow" ? "Chọn thiết bị cần mượn" : "Chọn thiết bị cần trả"}
                  </Text>
                  <Pressable onPress={() => setShowDevicePicker(false)} hitSlop={8}>
                    <Ionicons name="close" size={20} color="#64748b" />
                  </Pressable>
                </View>

                <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                  {activeDeviceList.length === 0 ? (
                    <Text style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 13 }}>
                      {activeTab === "borrow" ? "Không có thiết bị sẵn sàng để mượn." : "Không có thiết bị đang mượn để trả."}
                    </Text>
                  ) : (
                    activeDeviceList.map((dev) => {
                      const isSelected = selectedDevice?._id === dev._id || selectedDevice?.id === dev.id;
                      return (
                        <Pressable
                          key={dev._id || dev.id || dev.code}
                          style={[borrowModalStyles.pickerItem, isSelected && borrowModalStyles.pickerItemActive]}
                          onPress={() => {
                            setSelectedDevice(dev);
                            setShowDevicePicker(false);
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[borrowModalStyles.pickerItemName, isSelected && { color: "#008852" }]}>
                              {dev.name}
                            </Text>
                            <Text style={borrowModalStyles.pickerItemMeta}>
                              Mã: {dev.code || "N/A"} {dev.department ? `· Khoa: ${dev.department}` : ""}
                            </Text>
                          </View>
                          {isSelected && <Ionicons name="checkmark-circle" size={20} color="#008852" />}
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>

          {/* Date Picker Modal for Return Date */}
          <DatePickerModal
            visible={showDatePicker}
            title="Chọn ngày dự kiến trả"
            value={returnDate}
            onChange={(dateStr: string) => {
              setReturnDate(dateStr);
              setShowDatePicker(false);
            }}
            onClose={() => setShowDatePicker(false)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const borrowModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  dialog: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 500,
    padding: 18,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "800", color: "#0f172a", fontFamily: "Inter-Bold" },
  subtitle: { fontSize: 11, color: "#64748b", fontFamily: "Inter-Regular", marginTop: 2 },
  closeBtn: { padding: 4, borderRadius: 16, backgroundColor: "#f1f5f9" },
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: { fontSize: 13, fontWeight: "600", color: "#64748b", fontFamily: "Inter-SemiBold" },
  tabBtnTextActive: { color: "#059669", fontWeight: "700", fontFamily: "Inter-Bold" },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#334155", fontFamily: "Inter-Bold", marginTop: 10, marginBottom: 4 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 12.5, color: "#0f172a", fontFamily: "Inter-Medium" },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectBtnText: { fontSize: 12.5, color: "#64748b", fontFamily: "Inter-Medium", flex: 1 },
  textAreaInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12.5,
    color: "#0f172a",
    fontFamily: "Inter-Medium",
    textAlignVertical: "top",
    minHeight: 80,
  },
  dateInputBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footerNote: { fontSize: 11, color: "#94a3b8", fontFamily: "Inter-Regular", marginTop: 14, textAlign: "left" },
  footerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  cancelBtn: { backgroundColor: "#f1f5f9", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  cancelBtnText: { fontSize: 13, fontWeight: "700", color: "#334155", fontFamily: "Inter-Bold" },
  submitBtn: { backgroundColor: "#10b981", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  submitBtnText: { fontSize: 13, fontWeight: "700", color: "#ffffff", fontFamily: "Inter-Bold" },
  pickerOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.4)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  pickerSheet: { backgroundColor: "#ffffff", borderRadius: 16, width: "100%", maxWidth: 460, padding: 14, gap: 10 },
  pickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  pickerTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a", fontFamily: "Inter-Bold" },
  pickerItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, borderBottomWidth: 1, borderBottomColor: "#f8fafc" },
  pickerItemActive: { backgroundColor: "#f0fdf4" },
  pickerItemName: { fontSize: 13, fontWeight: "700", color: "#0f172a", fontFamily: "Inter-Bold" },
  pickerItemMeta: { fontSize: 11, color: "#64748b", fontFamily: "Inter-Regular", marginTop: 2 },
});

export interface EquipmentRequestRecord {
  id: string;
  equipmentId?: string;
  equipmentName: string;
  equipmentCode: string;
  type: "borrow" | "return";
  requesterName: string;
  requesterDepartment: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
  reason?: string;
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function EquipmentScreen() {
  const { user } = useSession();
  const [items, setItems] = useState<EquipmentRecord[]>([]);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [globalItems, setGlobalItems] = useState<EquipmentRecord[]>([]);
  const [globalTotal, setGlobalTotal] = useState<number | null>(null);
  const [summary, setSummary] = useState<EquipmentSummary | null>(null);
  const [compliance, setCompliance] = useState<EquipmentComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Danh sách phiếu mượn / trả thiết bị (Duyệt & Hủy)
  const [requests, setRequests] = useState<EquipmentRequestRecord[]>([
    {
      id: "req-100015",
      equipmentName: "Máy nước nóng lạnh Kangaroo",
      equipmentCode: "100015",
      type: "borrow",
      requesterName: "Igen Test",
      requesterDepartment: "DDD",
      status: "pending",
      createdAt: "Vừa xong",
      reason: "Mượn sử dụng ca làm việc",
    },
    {
      id: "req-100016",
      equipmentName: "Máy siêu âm 4D Chison",
      equipmentCode: "SA-204",
      type: "return",
      requesterName: "Nguyễn Văn Nam",
      requesterDepartment: "Khoa Chẩn đoán hình ảnh",
      status: "pending",
      createdAt: "15 phút trước",
      reason: "Hoàn trả thiết bị sau ca làm việc",
    },
  ]);

  // Phân quyền tài khoản thực tế dựa trên Role & Permissions hệ thống
  const canApprove =
    hasPermission(user, "equipment:approve") ||
    hasPermission(user, "equipment:manage") ||
    user?.role === "superadmin" ||
    user?.role === "branch_owner" ||
    (user as any)?.role === "admin" ||
    (user as any)?.role === "manager";

  const canManageEquipment =
    hasPermission(user, "equipment:manage") ||
    user?.role === "superadmin" ||
    user?.role === "branch_owner" ||
    (user as any)?.role === "admin" ||
    (user as any)?.role === "manager";

  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [revision, setRevision] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<EquipmentRecord | null>(null);
  const [viewDetailItem, setViewDetailItem] = useState<EquipmentRecord | null>(null);
  const [deleteItem, setDeleteItem] = useState<EquipmentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [borrowReturnModalVisible, setBorrowReturnModalVisible] = useState(false);
  const [borrowReturnTab, setBorrowReturnTab] = useState<"borrow" | "return">("borrow");

  const openBorrowModal = () => {
    setBorrowReturnTab("borrow");
    setBorrowReturnModalVisible(true);
  };

  const openReturnModal = () => {
    setBorrowReturnTab("return");
    setBorrowReturnModalVisible(true);
  };

  // Screen Rounded Alert Modal
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type?: "error" | "warning" | "success" | "info";
  }>({ visible: false, title: "", message: "", type: "info" });

  const showAlert = (title: string, message: string, type: "error" | "warning" | "success" | "info" = "info") => {
    setAlertState({ visible: true, title, message, type });
  };

  const openAdd = () => { setEditItem(null); setModalVisible(true); };
  const openEdit = (item: EquipmentRecord) => { setEditItem(item); setModalVisible(true); };

  const handleDelete = (item: EquipmentRecord) => {
    setDeleteItem(item);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const equipId = deleteItem._id || deleteItem.id || "";
      if (!equipId) throw new Error("Không xác định được ID thiết bị.");
      await equipment.delete(equipId);
      setDeleteItem(null);
      setRevision((v) => v + 1);
    } catch (e: any) {
      showAlert("Lỗi xóa thiết bị", e.message || "Không thể xóa thiết bị.", "error");
    } finally {
      setDeleting(false);
    }
  };

  // ── Xử lý Duyệt / Từ chối / Hủy phiếu ────────────────────────────────────
  const handleApproveRequest = (req: EquipmentRequestRecord) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: "approved" } : r))
    );

    const isBorrow = req.type === "borrow";
    const targetStatus = isBorrow ? "booked" : "ready";
    const targetAssignee = isBorrow ? req.requesterName : "";

    const updatedDevPayload: Partial<EquipmentRecord> = {
      status: targetStatus,
      assignedToName: targetAssignee,
    };

    setItems((prev) =>
      prev.map((i) => {
        if (i.code === req.equipmentCode || i.name === req.equipmentName || i._id === req.equipmentId || i.id === req.equipmentId) {
          const updated = { ...i, ...updatedDevPayload };
          const key = i._id || i.id || i.code;
          if (key) localOverridesRef.current[key] = updated;
          return updated;
        }
        return i;
      })
    );

    setGlobalItems((prev) =>
      prev.map((i) => {
        if (i.code === req.equipmentCode || i.name === req.equipmentName || i._id === req.equipmentId || i.id === req.equipmentId) {
          return { ...i, ...updatedDevPayload };
        }
        return i;
      })
    );

    showAlert(
      "Đã duyệt phiếu",
      `Đã duyệt phiếu ${isBorrow ? "mượn" : "trả"} thiết bị "${req.equipmentName}" (${req.equipmentCode}) thành công!`,
      "success"
    );
  };

  const handleRejectRequest = (req: EquipmentRequestRecord) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: "rejected" } : r))
    );
    showAlert(
      "Đã từ chối phiếu",
      `Đã từ chối phiếu ${req.type === "borrow" ? "mượn" : "trả"} thiết bị "${req.equipmentName}".`,
      "warning"
    );
  };

  const handleCancelRequest = (req: EquipmentRequestRecord) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: "cancelled" } : r))
    );
    showAlert(
      "Đã hủy phiếu",
      `Đã tự hủy phiếu ${req.type === "borrow" ? "mượn" : "trả"} thiết bị "${req.equipmentName}".`,
      "info"
    );
  };

  // Local overrides store to preserve device borrow/return/edit updates across API re-fetches
  const localOverridesRef = useRef<Record<string, Partial<EquipmentRecord>>>({});

  const handleItemSaved = (updatedDev?: EquipmentRecord, newReq?: EquipmentRequestRecord) => {
    if (newReq) {
      setRequests((prev) => [newReq, ...prev]);
    }
    if (updatedDev) {
      const key = updatedDev._id || updatedDev.id || updatedDev.code;
      if (key) {
        localOverridesRef.current[key] = updatedDev;
      }
      setItems((prev) =>
        prev.map((i) =>
          (i._id && i._id === updatedDev._id) || (i.id && i.id === updatedDev.id) || (i.code && i.code === updatedDev.code)
            ? { ...i, ...updatedDev }
            : i
        )
      );
      setGlobalItems((prev) =>
        prev.map((i) =>
          (i._id && i._id === updatedDev._id) || (i.id && i.id === updatedDev.id) || (i.code && i.code === updatedDev.code)
            ? { ...i, ...updatedDev }
            : i
        )
      );
    }
    setRevision((v) => v + 1);
  };

  const loadData = useCallback(async () => {
    setError(null);
    const isSearching = !!search.trim();
    try {
      const promises: Promise<any>[] = [
        equipment.getSummary(),
        equipment.getCompliance(),
        equipment.list({ search: isSearching ? search.trim() : undefined }),
      ];

      // Nếu đang tìm kiếm, luôn tải song song danh sách đầy đủ để 6 thẻ thống kê luôn chính xác
      if (isSearching) {
        promises.push(equipment.list());
      }

      const results = await Promise.allSettled(promises);
      const [sumRes, compRes, listRes, fullRes] = results;

      if (sumRes.status === "fulfilled" && sumRes.value) setSummary(sumRes.value);
      if (compRes.status === "fulfilled" && compRes.value) setCompliance(compRes.value);

      if (listRes.status === "fulfilled") {
        let fetchedItems: EquipmentRecord[] = listRes.value.items || [];
        // Apply local overrides (borrow/return/edit updates)
        fetchedItems = fetchedItems.map((item) => {
          const key = item._id || item.id || item.code;
          return key && localOverridesRef.current[key] ? { ...item, ...localOverridesRef.current[key] } : item;
        });

        setItems(fetchedItems);
        if (typeof listRes.value.total === "number") setServerTotal(listRes.value.total);

        // Nếu không có tìm kiếm, danh sách này chính là danh sách toàn bộ thiết bị
        if (!isSearching) {
          setGlobalItems(fetchedItems);
          setGlobalTotal(typeof listRes.value.total === "number" ? listRes.value.total : fetchedItems.length);
        }
      } else {
        const err = listRes.reason;
        setError(err instanceof Error ? err.message : "Không thể tải danh sách thiết bị.");
      }

      // Nhận kết quả danh sách toàn cục khi đang tìm kiếm
      if (fullRes && fullRes.status === "fulfilled") {
        let fullItems: EquipmentRecord[] = fullRes.value.items || [];
        fullItems = fullItems.map((item) => {
          const key = item._id || item.id || item.code;
          return key && localOverridesRef.current[key] ? { ...item, ...localOverridesRef.current[key] } : item;
        });
        setGlobalItems(fullItems);
        setGlobalTotal(typeof fullRes.value.total === "number" ? fullRes.value.total : fullItems.length);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (active) { setLoading(true); void loadData(); }
      return () => { active = false; };
    }, [loadData, revision]),
  );

  // Dữ liệu cho 6 thẻ thống kê trên cùng và 3 thẻ tuân thủ:
  // Luôn tính toán động trực tiếp từ baseItemsForStats để cập nhật ngay lập tức khi mượn/trả
  const baseItemsForStats = globalItems.length > 0 ? globalItems : items;
  const totalCount = baseItemsForStats.length > 0 ? baseItemsForStats.length : (summary?.total ?? globalTotal ?? (serverTotal ?? items.length));

  const countByStatus = (...keywords: string[]) => {
    return baseItemsForStats.filter((item) => {
      const s = (item.status || "").toLowerCase();
      return keywords.some((k) => s.includes(k.toLowerCase()));
    }).length;
  };

  const bookedCount = countByStatus("đơn", "booked", "order", "request", "mượn");
  const readyCount = countByStatus("sẵn", "ready", "avail", "available");
  const usingCount = countByStatus("dùng", "using", "in_use", "in-use");
  const maintenanceCount = countByStatus("trì", "maint", "repair");
  const disposedCount = countByStatus("lý", "dispos", "scrap", "retire");

  const displayedItems = items.filter((item) => {
    if (selectedFilter === "all") return true;
    const s = (item.status || "").toLowerCase();
    if (selectedFilter === "booked") return s.includes("đơn") || s.includes("booked") || s.includes("order") || s.includes("request");
    if (selectedFilter === "ready") return s.includes("sẵn") || s.includes("ready") || s.includes("avail");
    if (selectedFilter === "using") return s.includes("dùng") || s.includes("using") || s.includes("in_use") || s.includes("in-use");
    if (selectedFilter === "maintenance") return s.includes("trì") || s.includes("maint") || s.includes("repair");
    if (selectedFilter === "disposed") return s.includes("lý") || s.includes("dispos") || s.includes("scrap") || s.includes("retire");
    return true;
  });

  let computedOverdue = compliance?.overdue ?? 0;
  let computedUpcoming = compliance?.upcoming ?? 0;
  let computedValid = compliance?.valid ?? 0;

  if (!compliance || (computedOverdue === 0 && computedUpcoming === 0 && computedValid === 0)) {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    baseItemsForStats.forEach((item) => {
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

  const [showAllCategories, setShowAllCategories] = useState(true);

  const chartItems: ChartSlice[] = [
    { label: "Có sẵn", count: readyCount, color: "#10b981", filter: "ready" },
    { label: "Đang dùng", count: usingCount, color: "#0284c7", filter: "using" },
    { label: "Đơn mượn", count: bookedCount, color: "#8b5cf6", filter: "booked" },
    { label: "Bảo trì", count: maintenanceCount, color: "#f59e0b", filter: "maintenance" },
    { label: "Thanh lý", count: disposedCount, color: "#ef4444", filter: "disposed" },
  ];

  const statusCards = [
    {
      label: "TỔNG SỐ",
      value: totalCount,
      filter: "all",
      icon: "layers-outline" as const,
      color: "#2563eb",
      bgColor: "#eff6ff",
    },
    {
      label: "CÓ SẴN",
      value: readyCount,
      filter: "ready",
      icon: "checkmark-circle-outline" as const,
      color: "#10b981",
      bgColor: "#ecfdf5",
    },
    {
      label: "ĐANG DÙNG",
      value: usingCount,
      filter: "using",
      icon: "pulse-outline" as const,
      color: "#0284c7",
      bgColor: "#f0f9ff",
    },
    {
      label: "ĐƠN MƯỢN",
      value: bookedCount,
      filter: "booked",
      icon: "receipt-outline" as const,
      color: "#8b5cf6",
      bgColor: "#f5f3ff",
    },
    {
      label: "BẢO TRÌ",
      value: maintenanceCount,
      filter: "maintenance",
      icon: "construct-outline" as const,
      color: "#f59e0b",
      bgColor: "#fffbeb",
    },
    {
      label: "THANH LÝ",
      value: disposedCount,
      filter: "disposed",
      icon: "trash-outline" as const,
      color: "#ef4444",
      bgColor: "#fef2f2",
    },
  ];

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* App Bar / Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color="#0f172a" />
        </Pressable>
        <Text style={styles.headerTitle}>Quản lý thiết bị</Text>
        <View style={styles.headerIconsRight}>
          <Pressable style={styles.headerIconBtn} onPress={() => {}} hitSlop={6}>
            <Ionicons name="star-outline" size={19} color="#475569" />
          </Pressable>
          <Pressable style={styles.headerIconBtn} onPress={() => {}} hitSlop={6}>
            <Ionicons name="headset-outline" size={19} color="#475569" />
          </Pressable>
          <Pressable style={styles.headerIconBtn} onPress={() => router.push("/")} hitSlop={6}>
            <Ionicons name="home-outline" size={19} color="#475569" />
          </Pressable>
        </View>
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

        {/* Top 3 Quick Actions (Thêm / Mượn / Trả) */}
        <View style={styles.topActionsCard}>
          <Pressable style={styles.actionCol} onPress={openAdd}>
            <View style={[styles.actionIconBox, { backgroundColor: "#ecfeff", borderColor: "#a5f3fc" }]}>
              <Ionicons name="add-circle-outline" size={24} color="#0891b2" />
            </View>
            <Text style={styles.actionColLabel}>Thêm thiết bị</Text>
          </Pressable>

          <Pressable style={styles.actionCol} onPress={openBorrowModal}>
            <View style={[styles.actionIconBox, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
              <Ionicons name="hand-left-outline" size={22} color="#16a34a" />
            </View>
            <Text style={styles.actionColLabel}>Mượn thiết bị</Text>
          </Pressable>

          <Pressable style={styles.actionCol} onPress={openReturnModal}>
            <View style={[styles.actionIconBox, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
              <Ionicons name="refresh-outline" size={22} color="#2563eb" />
            </View>
            <Text style={styles.actionColLabel}>Trả thiết bị</Text>
          </Pressable>
        </View>

        {/* Section Header: Tình hình thiết bị */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionHeaderMainTitle}>Tình hình thiết bị</Text>
            <Ionicons name="eye-outline" size={18} color="#db2777" />
          </View>
          <View style={styles.pillToggle}>
            <Ionicons name="pie-chart-outline" size={14} color="#db2777" />
            <Text style={styles.pillToggleText}>Phân bổ</Text>
          </View>
        </View>

        {/* Overview Card with Donut Chart & 6 Stat Cards */}
        <View style={styles.overviewCard}>
          {/* Period/Scope selector */}
          <View style={styles.periodRow}>
            <Ionicons name="chevron-back" size={16} color="#94a3b8" />
            <View style={styles.periodBadge}>
              <Ionicons name="calendar-outline" size={15} color="#0f172a" />
              <Text style={styles.periodText}>Toàn hệ thống cơ sở</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </View>

          {/* Ratio banner */}
          <View style={styles.ratioBanner}>
            <Ionicons name="bar-chart-outline" size={16} color="#0284c7" />
            <Text style={styles.ratioBannerText}>
              {totalCount > 0 ? ((readyCount / totalCount) * 100).toFixed(0) : 0}% thiết bị sẵn sàng so với toàn cơ sở
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
          </View>

          {/* Donut Chart with White Center Circle for Total and Legend */}
          <View style={styles.donutSection}>
            <DonutChart items={chartItems} total={totalCount} size={175} strokeWidth={24} />

            {/* Legend / Callout items beside Donut */}
            <View style={styles.donutLegend}>
              {chartItems.map((item) => {
                const pct = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(0) : 0;
                const isSelected = selectedFilter === item.filter;
                return (
                  <Pressable
                    key={item.label}
                    style={[styles.donutLegendItem, isSelected && styles.donutLegendItemActive]}
                    onPress={() => setSelectedFilter(isSelected ? "all" : (item.filter || "all"))}
                  >
                    <View style={[styles.legendColorDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendPctText}>{pct}%</Text>
                    <Text style={styles.legendLabelText} numberOfLines={1}>
                      {item.label} ({item.count})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Expander toggle button */}
          <Pressable
            style={styles.expandToggleBtn}
            onPress={() => setShowAllCategories((prev) => !prev)}
          >
            <Text style={styles.expandToggleText}>Chi tiết từng danh mục (6)</Text>
            <Ionicons name={showAllCategories ? "chevron-up" : "chevron-down"} size={16} color="#db2777" />
          </Pressable>

          {/* The 6 Stat Cards */}
          {showAllCategories && (
            <View style={styles.statusGrid}>
              {statusCards.map((c) => {
                const isSelected = selectedFilter === c.filter;
                return (
                  <Pressable
                    key={c.filter}
                    onPress={() => setSelectedFilter(isSelected ? "all" : c.filter)}
                    style={[styles.statusCard, isSelected && styles.cardActive]}
                  >
                    <View style={styles.statusIconValRow}>
                      <View style={[styles.statusCardIconCircle, { backgroundColor: c.bgColor }]}>
                        <Ionicons name={c.icon} size={16} color={c.color} />
                      </View>
                      <Text style={[styles.statusValue, { color: c.color }]}>{c.value}</Text>
                    </View>
                    <Text style={styles.statusLabel} numberOfLines={1}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Section: Trạng thái kiểm định (Cards nền trắng bo góc, icon minh họa) */}
        <Text style={styles.statusSectionTitle}>Trạng thái kiểm định</Text>

        <View style={styles.complianceGrid}>
          {/* Quá hạn */}
          <View style={styles.complianceCardWhite}>
            <View style={styles.complianceCardHeader}>
              <Text style={[styles.complianceCardTitle, { color: "#be123c" }]} numberOfLines={1}>Quá hạn</Text>
              <View style={[styles.complianceIconWrap, { backgroundColor: "#fee2e2" }]}>
                <Ionicons name="time-outline" size={16} color="#dc2626" />
              </View>
            </View>
            <Text style={[styles.complianceValue, { color: "#be123c" }]}>{computedOverdue}</Text>
            <Text style={[styles.complianceSubtitle, { color: "#e11d48" }]} numberOfLines={1}>Cần kiểm định gấp</Text>
          </View>

          {/* Sắp tới hạn */}
          <View style={styles.complianceCardWhite}>
            <View style={styles.complianceCardHeader}>
              <Text style={[styles.complianceCardTitle, { color: "#b45309" }]} numberOfLines={1}>Sắp tới hạn</Text>
              <View style={[styles.complianceIconWrap, { backgroundColor: "#fef3c7" }]}>
                <Ionicons name="calendar-outline" size={16} color="#d97706" />
              </View>
            </View>
            <Text style={[styles.complianceValue, { color: "#b45309" }]}>{computedUpcoming}</Text>
            <Text style={[styles.complianceSubtitle, { color: "#b45309" }]} numberOfLines={1}>Trong 30 ngày</Text>
          </View>

          {/* Đạt chuẩn */}
          <View style={styles.complianceCardWhite}>
            <View style={styles.complianceCardHeader}>
              <Text style={[styles.complianceCardTitle, { color: "#047857" }]} numberOfLines={1}>Đạt chuẩn</Text>
              <View style={[styles.complianceIconWrap, { backgroundColor: "#dcfce7" }]}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#059669" />
              </View>
            </View>
            <Text style={[styles.complianceValue, { color: "#047857" }]}>{computedValid}</Text>
            <Text style={[styles.complianceSubtitle, { color: "#059669" }]} numberOfLines={1}>Hoạt động an toàn</Text>
          </View>
        </View>

        {/* SECTION: Danh sách phiếu mượn & trả (Duyệt, Từ chối & Hủy) */}
        <View style={requestStyles.sectionWrap}>
          <View style={requestStyles.sectionHeaderRow}>
            <View style={requestStyles.sectionHeaderLeft}>
              <Ionicons name="clipboard-outline" size={18} color="#008852" />
              <Text style={requestStyles.sectionHeaderTitle}>Danh sách phiếu mượn / trả</Text>
            </View>
            <View style={requestStyles.pendingCountBadge}>
              <Text style={requestStyles.pendingCountText}>
                {requests.filter((r) => r.status === "pending").length} chờ duyệt
              </Text>
            </View>
          </View>

          <View style={requestStyles.requestCardsList}>
            {requests.map((req) => {
              const isPending = req.status === "pending";
              const isApproved = req.status === "approved";
              const isRejected = req.status === "rejected";
              const isCancelled = req.status === "cancelled";
              const isMyRequest = user?.displayName ? req.requesterName.includes(user.displayName) : true;

              return (
                <View key={req.id} style={requestStyles.card}>
                  {/* Row 1: Header (Title, Type Badge, Status Badge) */}
                  <View style={requestStyles.cardHeaderRow}>
                    <View style={requestStyles.titleWrap}>
                      <Text style={requestStyles.cardEquipName} numberOfLines={2}>
                        {req.equipmentName}{" "}
                        <Text style={requestStyles.cardEquipCode}>({req.equipmentCode})</Text>
                      </Text>
                    </View>

                    <View style={requestStyles.badgeGroup}>
                      <View
                        style={[
                          requestStyles.typeBadge,
                          req.type === "borrow"
                            ? { backgroundColor: "#e0f2fe" }
                            : { backgroundColor: "#fef3c7" },
                        ]}
                      >
                        <Text
                          style={[
                            requestStyles.typeBadgeText,
                            req.type === "borrow" ? { color: "#0284c7" } : { color: "#d97706" },
                          ]}
                        >
                          {req.type === "borrow" ? "Mượn" : "Trả"}
                        </Text>
                      </View>

                      <View
                        style={[
                          requestStyles.statusBadge,
                          isPending && { backgroundColor: "#e6f4ea" },
                          isApproved && { backgroundColor: "#dcfce7" },
                          isRejected && { backgroundColor: "#fee2e2" },
                          isCancelled && { backgroundColor: "#f1f5f9" },
                        ]}
                      >
                        <Text
                          style={[
                            requestStyles.statusBadgeText,
                            isPending && { color: "#008852" },
                            isApproved && { color: "#15803d" },
                            isRejected && { color: "#dc2626" },
                            isCancelled && { color: "#64748b" },
                          ]}
                        >
                          {isPending ? "Chờ duyệt" : isApproved ? "Đã duyệt" : isRejected ? "Từ chối" : "Đã hủy"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Row 2: Subtitle (Người tạo) */}
                  <View style={requestStyles.cardSubRow}>
                    <Ionicons name="person-outline" size={13} color="#64748b" />
                    <Text style={requestStyles.cardSubLine}>
                      Người tạo: <Text style={requestStyles.cardRequesterName}>{req.requesterName}</Text> ({req.requesterDepartment})
                    </Text>
                  </View>

                  {/* Row 3: Action Buttons at the bottom */}
                  {isPending ? (
                    <View style={requestStyles.cardBottomActions}>
                      {canApprove ? (
                        <>
                          <Pressable
                            style={requestStyles.approveBtn}
                            onPress={() => handleApproveRequest(req)}
                          >
                            <Ionicons name="checkmark-sharp" size={14} color="#ffffff" />
                            <Text style={requestStyles.approveBtnText}>Duyệt</Text>
                          </Pressable>

                          <Pressable
                            style={requestStyles.rejectBtn}
                            onPress={() => handleRejectRequest(req)}
                          >
                            <Ionicons name="close-circle-outline" size={14} color="#dc2626" />
                            <Text style={requestStyles.rejectBtnText}>Từ chối</Text>
                          </Pressable>
                        </>
                      ) : null}

                      {isMyRequest ? (
                        <Pressable
                          style={requestStyles.cancelBtn}
                          onPress={() => handleCancelRequest(req)}
                        >
                          <Ionicons name="ban-outline" size={14} color="#64748b" />
                          <Text style={requestStyles.cancelBtnText}>Hủy</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    <View style={requestStyles.cardBottomStatus}>
                      <Text
                        style={[
                          requestStyles.statusDoneText,
                          isApproved && { color: "#15803d" },
                          isRejected && { color: "#dc2626" },
                          isCancelled && { color: "#64748b" },
                        ]}
                      >
                        {isApproved ? "✓ Đã phê duyệt" : isRejected ? "✕ Đã từ chối" : "─ Đã hủy phiếu"}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => loadData()}
            placeholder="Tìm theo tên, mã thiết bị, khoa..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => { setSearch(""); void loadData(); }} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>

        {/* List Section */}
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Danh sách thiết bị ({displayedItems.length})</Text>
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

          {displayedItems.length > 0 && !loading && (
            <Text style={styles.swipeHint}>← Vuốt trái để sửa / xóa</Text>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#008852" />
              <Text style={styles.loadingText}>Đang tải dữ liệu từ máy chủ...</Text>
            </View>
          ) : displayedItems.length === 0 ? (
            <EmptyState
              message="Chưa có thiết bị nào"
              subtitle={
                selectedFilter !== "all"
                  ? "Không có thiết bị thuộc trạng thái này."
                  : search
                  ? "Không tìm thấy thiết bị phù hợp với từ khóa."
                  : "Danh sách thiết bị trống trên hệ thống."
              }
            />
          ) : (
            displayedItems.map((item) => (
              <SwipeableItem
                key={item._id || item.id || item.code}
                item={item}
                onEdit={openEdit}
                onDelete={handleDelete}
                onViewDetail={(i) => setViewDetailItem(i)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <EquipmentModal visible={modalVisible} onClose={() => setModalVisible(false)} onSaved={handleItemSaved} editItem={editItem} />
      <EquipmentDetailModal
        visible={!!viewDetailItem}
        item={viewDetailItem}
        onClose={() => setViewDetailItem(null)}
        onEdit={openEdit}
      />
      <DeleteConfirmModal
        visible={!!deleteItem}
        itemName={deleteItem?.name || ""}
        onClose={() => setDeleteItem(null)}
        onConfirm={confirmDelete}
        loading={deleting}
      />
      <AppAlertModal
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onClose={() => setAlertState((prev) => ({ ...prev, visible: false }))}
      />
      <EquipmentBorrowReturnModal
        visible={borrowReturnModalVisible}
        initialTab={borrowReturnTab}
        equipmentList={items}
        onClose={() => setBorrowReturnModalVisible(false)}
        onSaved={handleItemSaved}
        showAlert={showAlert}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a", fontFamily: "Inter-Bold" },
  headerIconsRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },
  errorBanner: {
    backgroundColor: "#fff1f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  errorBannerText: { fontSize: 12, color: "#be123c", fontFamily: "Inter-Medium", flex: 1 },
  errorRetryBtn: { backgroundColor: "#be123c", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  errorRetryText: { fontSize: 11, fontWeight: "700", color: "#ffffff", fontFamily: "Inter-Bold" },

  // Top 4 quick actions
  topActionsCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  actionCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  actionBadgeWrap: { position: "relative" },
  actionRedBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    backgroundColor: "#ef4444",
    borderRadius: 9,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  actionRedBadgeText: { color: "#ffffff", fontSize: 9.5, fontWeight: "800", fontFamily: "Inter-Bold" },
  actionColLabel: { fontSize: 11.5, fontWeight: "700", color: "#334155", fontFamily: "Inter-Bold", textAlign: "center" },

  // Section Header
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionHeaderMainTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  pillToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fdf2f8",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#fbcfe8",
  },
  pillToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#db2777",
    fontFamily: "Inter-Bold",
  },

  // Overview / Donut Card
  overviewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    gap: 12,
  },
  periodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  periodBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  periodText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  highlightRow: {
    flexDirection: "row",
    gap: 10,
  },
  highlightCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  highlightCardPink: {
    borderColor: "#f472b6",
  },
  highlightCardActive: {
    backgroundColor: "#f8fafc",
    borderColor: "#008852",
  },
  highlightCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  highlightIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    fontFamily: "Inter-Bold",
    flex: 1,
  },
  highlightValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  ratioBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  ratioBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "600",
    color: "#334155",
    fontFamily: "Inter-SemiBold",
  },
  donutSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 4,
  },
  donutLegend: {
    flex: 1,
    gap: 6,
  },
  donutLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  donutLegendItemActive: {
    backgroundColor: "#f1f5f9",
  },
  legendColorDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  legendPctText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    width: 32,
  },
  legendLabelText: {
    fontSize: 11.5,
    color: "#475569",
    fontFamily: "Inter-Medium",
    flex: 1,
  },
  expandToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  expandToggleText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#db2777",
    fontFamily: "Inter-Bold",
  },

  // 6 Stat Cards inside overview
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    marginTop: 4,
  },
  statusCard: {
    width: "31.6%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 64,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  cardActive: {
    borderColor: "#008852",
    backgroundColor: "#f0fdf4",
  },
  statusIconValRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  statusCardIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  statusValue: {
    fontSize: 17,
    fontWeight: "800",
    fontFamily: "Inter-Bold",
  },
  statusLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
    color: "#475569",
    textAlign: "center",
    marginTop: 4,
  },

  // Compliance / Status Section
  statusSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    marginTop: 6,
    marginBottom: 2,
  },
  complianceGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  complianceCardWhite: {
    width: "31.6%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: "space-between",
    minHeight: 78,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  complianceCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  complianceCardTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
    flex: 1,
  },
  complianceIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  complianceValue: {
    fontSize: 20,
    fontWeight: "800",
    fontFamily: "Inter-Bold",
    marginTop: 2,
    marginBottom: 2,
    textAlign: "center",
  },
  complianceSubtitle: {
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
    textAlign: "center",
  },

  // Search Bar
  searchBar: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter-Medium", color: "#1e293b", paddingVertical: 2 },

  // List Section
  listSection: { gap: 8, marginTop: 4 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 2 },
  listHeaderRight: { flexDirection: "row", alignItems: "center" },
  listTitle: { fontSize: 14.5, fontWeight: "700", color: "#1e293b", fontFamily: "Inter-Bold" },
  resetFilterText: { fontSize: 12, fontWeight: "600", color: "#008852", fontFamily: "Inter-SemiBold" },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#008852",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#008852",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  swipeHint: { fontSize: 11, color: "#94a3b8", fontFamily: "Inter-Regular", textAlign: "right", paddingRight: 4, marginTop: -2 },
  loadingContainer: { paddingVertical: 30, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { fontSize: 12, color: "#64748b", fontFamily: "Inter-Regular" },
  swipeWrapper: { position: "relative", borderRadius: 14, overflow: "hidden", marginBottom: 2 },
  actionButtons: { position: "absolute", right: 0, top: 0, bottom: 0, flexDirection: "row", width: 120 },
  editBtn: { flex: 1, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center", gap: 3 },
  deleteBtn: { flex: 1, backgroundColor: "#dc2626", alignItems: "center", justifyContent: "center", gap: 3 },
  actionBtnText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
  itemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 10,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  itemCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontWeight: "700", color: "#0f172a", fontFamily: "Inter-Bold" },
  itemCode: { fontSize: 11.5, color: "#64748b", fontFamily: "Inter-Regular" },
  itemBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  itemBadgeText: { fontSize: 11, fontWeight: "700", fontFamily: "Inter-Bold" },
  itemFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  itemMeta: { fontSize: 11.5, color: "#64748b", fontFamily: "Inter-Medium" },
  normalDate: { color: "#334155", fontFamily: "Inter-SemiBold" },
  categoryBadge: { backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  categoryBadgeText: { fontSize: 10.5, color: "#475569", fontFamily: "Inter-Medium" },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 36 : 20,
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 500,
    height: "88%",
    maxHeight: "92%",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#cbd5e1", alignSelf: "center", marginBottom: 8 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  title: { fontSize: 16, fontWeight: "800", color: "#0f172a", fontFamily: "Inter-Bold" },
  subtitle: { fontSize: 11, color: "#64748b", fontFamily: "Inter-Regular", marginTop: 2 },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
  },
  uploadBoxCompact: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  uploadContentCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  uploadTitleCompact: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#475569",
    fontFamily: "Inter-SemiBold",
  },
  previewWrap: { position: "relative", width: "100%", height: 100, borderRadius: 8, overflow: "hidden" },
  imagePreview: { width: "100%", height: "100%", borderRadius: 8 },
  removeImageBtn: { position: "absolute", top: 6, right: 6, backgroundColor: "#ffffff", borderRadius: 12 },
  label: { fontSize: 11, fontWeight: "700", color: "#334155", fontFamily: "Inter-Bold", marginTop: 8, marginBottom: 3 },
  subLabel: { fontSize: 10.5, fontWeight: "600", color: "#475569", fontFamily: "Inter-SemiBold", marginTop: 5, marginBottom: 2 },
  required: { color: "#dc2626" },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11.5,
    color: "#1e293b",
    backgroundColor: "#ffffff",
    fontFamily: "Inter-Medium",
    minHeight: 34,
  },
  selector: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    minHeight: 34,
  },
  selectorText: { fontSize: 11.5, color: "#1e293b", fontFamily: "Inter-Medium", flex: 1 },
  dateField: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    minHeight: 34,
  },
  dateText: { fontSize: 11.5, color: "#1e293b", fontFamily: "Inter-Medium" },
  placeholderText: { color: "#94a3b8" },
  twoCol: { flexDirection: "row", gap: 8 },
  col: { flex: 1 },
  sectionGreen: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 10,
    backgroundColor: "#fcfdfc",
    padding: 9,
    marginTop: 8,
    gap: 3,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  sectionTitleGreen: { fontSize: 10.5, fontWeight: "800", color: "#059669", fontFamily: "Inter-Bold" },
  uploadFileBtn: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 7,
    backgroundColor: "#f0fdf4",
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 3,
  },
  uploadFileText: { fontSize: 11, fontWeight: "600", color: "#059669", fontFamily: "Inter-SemiBold" },
  sectionAmber: {
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 10,
    backgroundColor: "#fffbf7",
    padding: 9,
    marginTop: 8,
    gap: 4,
  },
  sectionHeaderBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitleAmber: { fontSize: 10.5, fontWeight: "800", color: "#9a3412", fontFamily: "Inter-Bold" },
  addDocBtn: { backgroundColor: "#9a3412", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  addDocBtnText: { color: "#ffffff", fontSize: 10.5, fontWeight: "700", fontFamily: "Inter-Bold" },
  closeDocBtn: { backgroundColor: "#7c2d12" },
  subFormCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 9,
    padding: 10,
    marginTop: 6,
    gap: 6,
  },
  uploadFileBtnAmber: {
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 7,
    backgroundColor: "#fffaf5",
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 3,
  },
  uploadFileTextAmber: {
    fontSize: 11,
    fontWeight: "600",
    color: "#b45309",
    fontFamily: "Inter-SemiBold",
  },
  subFormFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#fef3c7",
  },
  subFormCancelBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  subFormCancelText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748b",
    fontFamily: "Inter-SemiBold",
  },
  subFormSubmitBtn: {
    backgroundColor: "#b45309",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  subFormSubmitText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#ffffff",
    fontFamily: "Inter-Bold",
  },
  emptyDocText: { fontSize: 10.5, color: "#94a3b8", fontStyle: "italic", fontFamily: "Inter-Regular", marginTop: 2 },
  docItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#ffffff", padding: 6, borderRadius: 6, borderWidth: 1, borderColor: "#fed7aa" },
  docName: { fontSize: 11, color: "#9a3412", fontFamily: "Inter-Medium", flex: 1, marginHorizontal: 6 },
  iconInputWrap: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    minHeight: 34,
  },
  iconInput: { flex: 1, fontSize: 11.5, color: "#1e293b", paddingVertical: 4, paddingRight: 8, fontFamily: "Inter-Medium" },
  stickyFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  cancelActionBtn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center" },
  cancelActionText: { fontSize: 12.5, fontWeight: "700", color: "#475569", fontFamily: "Inter-Bold" },
  saveActionBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: "#008852", alignItems: "center", justifyContent: "center" },
  saveActionText: { color: "#ffffff", fontSize: 13, fontWeight: "800", fontFamily: "Inter-Bold" },

  // Styles cho dropdown phòng ban
  deptDropdownContainer: {
    borderWidth: 1,
    borderColor: "#10b981",
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: "#ffffff",
    padding: 8,
    marginBottom: 6,
  },
  deptSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.2,
    borderColor: "#10b981",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
    gap: 6,
    backgroundColor: "#ffffff",
  },
  deptSearchInput: {
    flex: 1,
    fontSize: 12,
    color: "#0f172a",
    fontFamily: "Inter-Medium",
    paddingVertical: 0,
  },
  deptList: {
    maxHeight: 220,
  },
  deptItem: {
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    borderRadius: 6,
  },
  deptItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  deptItemName: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  deptCodeBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deptCodeText: {
    fontSize: 10.5,
    color: "#475569",
    fontWeight: "700",
    fontFamily: "Inter-SemiBold",
  },
  deptCategoryBadge: {
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deptCategoryText: {
    fontSize: 10.5,
    color: "#0284c7",
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
  },
  deptFloorText: {
    fontSize: 11,
    color: "#94a3b8",
    fontFamily: "Inter-Regular",
    marginTop: 2,
  },
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

const alertStyles = StyleSheet.create({
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
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 13.5,
    color: "#475569",
    fontFamily: "Inter-Regular",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  confirmBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#008852",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
    fontFamily: "Inter-Bold",
  },
});

const mediaModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12.5,
    color: "#64748b",
    fontFamily: "Inter-Regular",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  btnList: {
    gap: 10,
    marginBottom: 16,
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 11.5,
    color: "#64748b",
    fontFamily: "Inter-Regular",
  },
  cancelBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
    fontFamily: "Inter-Bold",
  },
});

const detailStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingTop: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Inter-Regular",
    marginTop: 2,
  },
  editHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
    marginRight: 8,
  },
  editHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#008852",
    fontFamily: "Inter-Bold",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  imageWrap: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: "#e2e8f0",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  cardBasic: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  nameText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    flex: 1,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11.5,
    color: "#475569",
    fontFamily: "Inter-Medium",
  },
  sectionGreen: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  sectionAmber: {
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  sectionTitleGreen: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#047857",
    fontFamily: "Inter-Bold",
  },
  sectionTitleAmber: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#9a3412",
    fontFamily: "Inter-Bold",
  },
  grid2: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
    justifyContent: "space-between",
  },
  infoItem: {
    width: "48%",
  },
  infoLabel: {
    fontSize: 11,
    color: "#64748b",
    fontFamily: "Inter-Regular",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-SemiBold",
  },
  fileAttachBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#dcfce7",
  },
  fileAttachText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#047857",
    fontFamily: "Inter-SemiBold",
    flex: 1,
  },
  emptyText: {
    fontSize: 11.5,
    color: "#94a3b8",
    fontStyle: "italic",
    fontFamily: "Inter-Regular",
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  docText: {
    fontSize: 12,
    color: "#9a3412",
    fontFamily: "Inter-Medium",
    flex: 1,
  },
  imageOverlayHint: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  imageHintText: {
    color: "#ffffff",
    fontSize: 10.5,
    fontFamily: "Inter-Medium",
  },
  notesText: {
    fontSize: 12.5,
    color: "#334155",
    fontFamily: "Inter-Regular",
    lineHeight: 18,
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 8,
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
  },
  closeBtnBottom: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#64748b",
    fontFamily: "Inter-Bold",
  },
  editBtnBottom: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#008852",
  },
  editBtnText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#ffffff",
    fontFamily: "Inter-Bold",
  },
});

const previewModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    justifyContent: "space-between",
  },
  topBar: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fileName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    fontFamily: "Inter-Bold",
    marginRight: 12,
  },
  actionIconBtn: {
    padding: 6,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  docPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  docIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    textAlign: "center",
    marginBottom: 6,
  },
  docSubtitle: {
    fontSize: 12.5,
    color: "#64748b",
    fontFamily: "Inter-Regular",
    textAlign: "center",
    marginBottom: 20,
  },
  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#008852",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  openBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
    fontFamily: "Inter-Bold",
  },
  noUriText: {
    fontSize: 11.5,
    color: "#94a3b8",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },
});

const requestStyles = StyleSheet.create({
  sectionWrap: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  pendingCountBadge: {
    backgroundColor: "#e6f4ea",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pendingCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#008852",
    fontFamily: "Inter-Bold",
  },
  requestCardsList: {
    gap: 8,
  },
  card: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  titleWrap: {
    flex: 1,
  },
  cardEquipName: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    lineHeight: 18,
  },
  cardEquipCode: {
    fontSize: 12,
    fontWeight: "400",
    color: "#64748b",
    fontFamily: "Inter-Regular",
  },
  badgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  cardSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  cardSubLine: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Inter-Regular",
  },
  cardRequesterName: {
    fontWeight: "700",
    color: "#334155",
    fontFamily: "Inter-Bold",
  },
  cardBottomActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  cardBottomStatus: {
    paddingTop: 4,
  },
  approveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#008852",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    elevation: 2,
  },
  approveBtnText: {
    color: "#ffffff",
    fontSize: 12.5,
    fontWeight: "800",
    fontFamily: "Inter-Bold",
  },
  rejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  rejectBtnText: {
    color: "#dc2626",
    fontSize: 12.5,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  cancelBtnText: {
    color: "#64748b",
    fontSize: 12,
    fontFamily: "Inter-Medium",
  },
  statusDoneText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
});
