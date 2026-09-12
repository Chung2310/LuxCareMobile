import { useAppAlert } from "../../components/AppAlert";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { DepartmentRecord } from "../../../../src/services/departmentService";
import { departments } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";

export function LegacyForm({
  onClose,
  setLocked,
}: {
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const { showAlert, alertView } = useAppAlert();
  const [items, setItems] = useState<{ name: string; count: number }[]>([]);
  const [targets, setTargets] = useState<DepartmentRecord[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSelected([]);
    setTarget("");
    setItems([]);
    setTargets([]);

    void Promise.all([departments.getUnmapped(), departments.list({ activeOnly: true })])
      .then(([legacy, list]) => {
        if (active) {
          setItems(legacy);
          setTargets(list);
        }
      })
      .catch((err) => {
        if (active) setError(messageOf(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [revision]);

  const toggleSelect = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name],
    );
  };

  const selectAll = () => {
    if (selected.length === items.length) {
      setSelected([]);
    } else {
      setSelected(items.map((i) => i.name));
    }
  };

  const merge = async () => {
    if (lock.current || busy || !selected.length || !target) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const response = await departments.merge(selected, target);
      setResult(response.modifiedCount);
      setRevision((v) => v + 1);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };

  const handleConfirmMerge = () => {
    const targetDept = targets.find((t) => t._id === target);
    showAlert(
      "Xác nhận chuẩn hóa?",
      `Chuyển toàn bộ hồ sơ nhân sự có tên phòng ban cũ:\n${selected.join(", ")}\n\nSang phòng ban chuẩn: "${targetDept?.name}" (${targetDept?.code}). Thao tác này không thể hoàn tác.`,
      [
        { text: "Hủy", style: "cancel" },
        { text: "Đồng ý chuẩn hóa", onPress: () => void merge() },
      ],
    );
  };

  const targetName = targets.find((t) => t._id === target)?.name || "Chạm để chọn";

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={onClose}
          disabled={busy}
        >
          <Text style={styles.backBtnText}>✕</Text>
        </Pressable>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>Chuẩn hóa phòng ban cũ</Text>
          <Text style={styles.headerSub}>Gộp các tên cũ vào mã phòng ban chuẩn</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Success Banner */}
        {result !== null && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>
              ✅ Đã cập nhật thành công {result} hồ sơ nhân sự sang phòng ban chuẩn!
            </Text>
          </View>
        )}

        {/* Error Banner */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Instruction Note */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 Tính năng này giúp quét toàn bộ nhân sự đang có tên phòng ban nhập tự do (chưa gắn mã) và chuyển hàng loạt sang phòng ban chuẩn của doanh nghiệp.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>Đang quét danh sách tên phòng ban cũ...</Text>
          </View>
        ) : (
          <>
            {/* Section 1: Chọn các tên cũ */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>1. Tên phòng ban cũ chưa gắn mã</Text>
                  <Text style={styles.sectionSub}>Chọn các tên cần chuẩn hóa</Text>
                </View>

                {items.length > 0 && (
                  <Pressable style={styles.selectAllBtn} onPress={selectAll}>
                    <Text style={styles.selectAllBtnText}>
                      {selected.length === items.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                    </Text>
                  </Pressable>
                )}
              </View>

              {items.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyIcon}>🎉</Text>
                  <Text style={styles.emptyTitle}>Tất cả dữ liệu đã chuẩn hóa</Text>
                  <Text style={styles.emptyText}>
                    Không tìm thấy hồ sơ nhân sự nào dùng tên phòng ban cũ chưa gắn mã.
                  </Text>
                </View>
              ) : (
                <View style={styles.legacyList}>
                  {items.map((item) => {
                    const isChecked = selected.includes(item.name);
                    return (
                      <Pressable
                        key={item.name}
                        style={[styles.legacyItem, isChecked && styles.legacyItemActive]}
                        onPress={() => toggleSelect(item.name)}
                        disabled={busy}
                      >
                        <View style={[styles.checkbox, isChecked && styles.checkboxActive]}>
                          {isChecked && <Text style={styles.checkmark}>✓</Text>}
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.legacyName}>{item.name}</Text>
                          <Text style={styles.legacyCount}>
                            {item.count} nhân sự đang dùng tên này
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Section 2: Chọn phòng ban chuẩn đích */}
            {items.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>2. Chọn phòng ban chuẩn đích</Text>
                <Text style={styles.sectionSub}>
                  Các nhân sự đã chọn ở trên sẽ được chuyển sang phòng ban này
                </Text>

                <View style={styles.targetList}>
                  {targets.map((dept) => {
                    const isSelected = target === dept._id;
                    return (
                      <Pressable
                        key={dept._id}
                        style={[styles.targetItem, isSelected && styles.targetItemActive]}
                        onPress={() => setTarget(dept._id)}
                        disabled={busy}
                      >
                        <View style={styles.targetCodeBadge}>
                          <Text style={styles.targetCodeText}>{dept.code}</Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.targetName}>{dept.name}</Text>
                          <Text style={styles.targetSub}>
                            Hiện có {dept.employeeCount ?? 0} nhân sự
                          </Text>
                        </View>

                        <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                          {isSelected && <View style={styles.radioDot} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Action button */}
            {items.length > 0 && (
              <View style={styles.bottomActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.mergeBtn,
                    (!selected.length || !target || busy) && styles.mergeBtnDisabled,
                    pressed && { opacity: 0.88 },
                  ]}
                  disabled={!selected.length || !target || busy}
                  onPress={handleConfirmMerge}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.mergeBtnText}>
                      Chuẩn hóa {selected.length} tên sang "{targetName}"
                    </Text>
                  )}
                </Pressable>

                <Pressable style={styles.closeBtn} disabled={busy} onPress={onClose}>
                  <Text style={styles.closeBtnText}>Đóng</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
      {alertView}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  successBanner: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  successText: {
    color: "#065f46",
    fontSize: 13,
    fontWeight: "700",
  },
  errorBanner: {
    backgroundColor: "#fff1f2",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorText: {
    color: "#e11d48",
    fontSize: 13,
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  infoText: {
    color: "#1e40af",
    fontSize: 12,
    lineHeight: 18,
  },
  loadingBox: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  selectAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
  },
  selectAllBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 6,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyText: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  legacyList: {
    gap: 8,
  },
  legacyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  legacyItemActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  checkboxActive: {
    borderColor: "#059669",
    backgroundColor: "#059669",
  },
  checkmark: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  legacyName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  legacyCount: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  targetList: {
    gap: 8,
  },
  targetItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  targetItemActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  targetCodeBadge: {
    backgroundColor: "#e0f2fe",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  targetCodeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0284c7",
  },
  targetName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  targetSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleActive: {
    borderColor: "#3b82f6",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3b82f6",
  },
  bottomActions: {
    gap: 10,
    marginTop: 4,
  },
  mergeBtn: {
    backgroundColor: "#059669",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  mergeBtnDisabled: {
    opacity: 0.5,
  },
  mergeBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  closeBtn: {
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeBtnText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
  },
});
