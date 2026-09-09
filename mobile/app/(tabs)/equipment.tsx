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
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("ready");
  const [location, setLocation] = useState("");
  const [nextInspectionDate, setNextInspectionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const resetToItem = useCallback(() => {
    setName(editItem?.name ?? "");
    setCode(editItem?.code ?? "");
    setCategory(editItem?.category ?? "");
    setDepartment(editItem?.department ?? "");
    setStatus(editItem?.status ?? "ready");
    setLocation(editItem?.location ?? "");
    setNextInspectionDate(editItem?.nextInspectionDate ? editItem.nextInspectionDate.slice(0, 10) : "");
    setNotes(editItem?.notes ?? "");
  }, [editItem]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("Thiếu thông tin", "Vui lòng nhập tên thiết bị."); return; }
    setSaving(true);
    try {
      const payload: Partial<EquipmentRecord> = {
        name: name.trim(),
        code: code.trim() || undefined,
        category: category.trim() || undefined,
        department: department.trim() || undefined,
        status,
        location: location.trim() || undefined,
        nextInspectionDate: nextInspectionDate || undefined,
        notes: notes.trim() || undefined,
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
    <Modal visible={visible} animationType="slide" transparent onShow={resetToItem}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.handleBar} />
          <View style={modal.header}>
            <Text style={modal.title}>{isEdit ? "Chỉnh sửa thiết bị" : "Thêm thiết bị mới"}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#64748b" />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={modal.label}>Tên thiết bị <Text style={{ color: "#dc2626" }}>*</Text></Text>
            <TextInput style={modal.input} placeholder="VD: Máy thở CPAP" value={name} onChangeText={setName} />

            <Text style={modal.label}>Mã thiết bị</Text>
            <TextInput style={modal.input} placeholder="VD: TB-001" value={code} onChangeText={setCode} autoCapitalize="characters" />

            <View style={modal.row}>
              <View style={{ flex: 1 }}>
                <Text style={modal.label}>Danh mục</Text>
                <TextInput style={modal.input} placeholder="VD: Hô hấp" value={category} onChangeText={setCategory} />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={modal.label}>Khoa / Phòng</Text>
                <TextInput style={modal.input} placeholder="VD: ICU" value={department} onChangeText={setDepartment} />
              </View>
            </View>

            <Text style={modal.label}>Trạng thái</Text>
            <View style={modal.statusRow}>
              {STATUS_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[modal.statusChip, status === opt.value && modal.statusChipActive]}
                  onPress={() => setStatus(opt.value)}
                >
                  <Text style={[modal.statusChipText, status === opt.value && modal.statusChipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={modal.label}>Vị trí lưu trữ</Text>
            <TextInput style={modal.input} placeholder="VD: Tầng 3, Phòng 302" value={location} onChangeText={setLocation} />

            <Text style={modal.label}>Ngày kiểm định tiếp theo</Text>
            <TextInput style={modal.input} placeholder="YYYY-MM-DD" value={nextInspectionDate} onChangeText={setNextInspectionDate} keyboardType="numeric" />

            <Text style={modal.label}>Ghi chú</Text>
            <TextInput
              style={[modal.input, { height: 80, textAlignVertical: "top" }]}
              placeholder="Ghi chú thêm về thiết bị..."
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <Pressable style={[modal.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name={isEdit ? "checkmark-circle" : "add-circle"} size={18} color="#fff" />
                  <Text style={modal.saveBtnText}>{isEdit ? "Lưu thay đổi" : "Thêm thiết bị"}</Text>
                </>
              )}
            </Pressable>
            <View style={{ height: 24 }} />
          </ScrollView>
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

  const openAdd = () => { setEditItem(null); setModalVisible(true); };
  const openEdit = (item: EquipmentRecord) => { setEditItem(item); setModalVisible(true); };

  const handleDelete = (item: EquipmentRecord) => {
    Alert.alert(
      "Xóa thiết bị",
      `Bạn có chắc muốn xóa "${item.name}"?\nThao tác này không thể hoàn tác.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await equipment.delete(item._id);
              setRevision((v) => v + 1);
            } catch (e) {
              Alert.alert("Lỗi", e instanceof Error ? e.message : "Không thể xóa thiết bị.");
            }
          },
        },
      ],
    );
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
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: "92%" },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#e2e8f0", alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  title: { fontSize: 17, fontWeight: "800", color: "#0f172a", fontFamily: "Inter-Bold" },
  label: { fontSize: 12, fontWeight: "700", color: "#475569", fontFamily: "Inter-Bold", marginBottom: 5, marginTop: 12 },
  input: { borderWidth: 1.2, borderColor: "#e2e8f0", borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: "#1e293b", backgroundColor: "#f8fafc" },
  row: { flexDirection: "row", alignItems: "flex-start" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  statusChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: "#e2e8f0", backgroundColor: "#f8fafc" },
  statusChipActive: { borderColor: "#008852", backgroundColor: "#f0fdf4" },
  statusChipText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  statusChipTextActive: { color: "#008852", fontWeight: "700" },
  saveBtn: { backgroundColor: "#008852", borderRadius: 14, paddingVertical: 14, marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#008852", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  saveBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "800", fontFamily: "Inter-Bold" },
});
