import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BranchRecord } from "../../../../src/services/branchService";
import { branches } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Ionicons } from "@expo/vector-icons";

export function BranchSelector({
  allowAll = true,
  triggerStyle,
  renderCustomTrigger,
}: {
  allowAll?: boolean;
  triggerStyle?: any;
  renderCustomTrigger?: (open: () => void, currentName: string) => React.ReactNode;
} = {}) {
  const { user, selectedBranch, selectBranch } = useSession();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === "ios" ? 48 : (StatusBar.currentHeight || 0));
  const bottomInset = Math.max(insets.bottom, 20);

  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<BranchRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const revision = useRef(0);

  const isOwner = ["admin", "superadmin", "branch_owner"].includes(user?.role || "");
  if (!isOwner || !user) return null;

  const load = async () => {
    const request = ++revision.current;
    setVisible(true);
    setLoading(true);
    setError(null);
    try {
      const data = await branches.list();
      if (request === revision.current) setItems(data.filter((item) => item.isActive));
    } catch (err) {
      if (request === revision.current) setError(messageOf(err));
    } finally {
      if (request === revision.current) setLoading(false);
    }
  };

  const choose = (branch: BranchRecord | null) => {
    try {
      selectBranch(branch);
      setVisible(false);
      revision.current++;
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const currentBranchName =
    selectedBranch?.name || (allowAll ? "Toàn hệ thống (Tất cả chi nhánh)" : "Chọn chi nhánh");

  return (
    <>
      {renderCustomTrigger ? (
        renderCustomTrigger(() => void load(), currentBranchName)
      ) : (
        <Pressable
          style={({ pressed }) => [
            styles.cardTrigger,
            triggerStyle,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => void load()}
        >
          <View style={styles.triggerIconBox}>
            <Ionicons name="location-outline" size={18} color="#059669" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.triggerLabel}>Chi nhánh làm việc</Text>
            <Text style={styles.triggerValue} numberOfLines={1}>
              {currentBranchName}
            </Text>
          </View>

          <View style={styles.changeBadge}>
            <Text style={styles.changeBadgeText}>Đổi</Text>
            <Ionicons name="chevron-forward" size={12} color="#059669" />
          </View>
        </Pressable>
      )}

      {/* Branch Selection Modal */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => {
          setVisible(false);
          revision.current++;
        }}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop Dismiss */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setVisible(false);
              revision.current++;
            }}
          />

          {/* Bottom Sheet Modal Sheet */}
          <View
            style={[
              styles.sheetContainer,
              {
                paddingBottom: bottomInset + 10,
                marginTop: topInset + 24,
              },
            ]}
          >
            {/* Top Drag Handle */}
            <View style={styles.dragHandleContainer}>
              <View style={styles.dragHandle} />
            </View>

            {/* Header Bar */}
            <View style={styles.modalHeader}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalCloseBtn,
                  pressed && { opacity: 0.7, backgroundColor: "#e2e8f0" },
                ]}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                onPress={() => {
                  setVisible(false);
                  revision.current++;
                }}
              >
                <Ionicons name="close" size={20} color="#475569" />
              </Pressable>

              <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 6 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  Chọn chi nhánh làm việc
                </Text>
                <Text style={styles.modalSub} numberOfLines={1}>
                  Phạm vi dữ liệu sẽ thay đổi theo chi nhánh
                </Text>
              </View>

              <View style={{ width: 36 }} />
            </View>

            <ScrollView
              style={{ flexGrow: 0 }}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {allowAll && (
              <Pressable
                style={({ pressed }) => [
                  styles.branchCard,
                  !selectedBranch && styles.branchCardSelected,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => choose(null)}
              >
                <View
                  style={[
                    styles.codeBadge,
                    {
                      backgroundColor: "#ecfdf5",
                      borderColor: "#a7f3d0",
                      borderWidth: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    },
                  ]}
                >
                  <Ionicons name="globe-outline" size={13} color="#047857" />
                  <Text style={[styles.codeBadgeText, { color: "#047857" }]}>TẤT CẢ</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.branchName,
                      !selectedBranch && { color: "#047857", fontWeight: "800" },
                    ]}
                  >
                    Toàn hệ thống (Tất cả chi nhánh)
                  </Text>
                  <Text style={styles.branchAddress}>
                    Xem dữ liệu tổng hợp toàn doanh nghiệp
                  </Text>
                </View>

                <View
                  style={[
                    styles.radioCircle,
                    !selectedBranch && styles.radioCircleActive,
                  ]}
                >
                  {!selectedBranch && <View style={styles.radioDot} />}
                </View>
              </Pressable>

              )}

              {loading && (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#059669" />
                  <Text style={styles.loadingText}>Đang tải danh sách chi nhánh...</Text>
                </View>
              )}

              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color="#e11d48" />
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable style={styles.retryBtn} onPress={() => void load()}>
                    <Text style={styles.retryBtnText}>Thử lại</Text>
                  </Pressable>
                </View>
              )}

              {!loading &&
                items.map((item) => {
                  const isSelected = selectedBranch?._id === item._id;

                  return (
                    <Pressable
                      key={item._id}
                      style={({ pressed }) => [
                        styles.branchCard,
                        isSelected && styles.branchCardSelected,
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={() => choose(item)}
                    >
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>{item.code}</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.branchName,
                            isSelected && { color: "#047857", fontWeight: "800" },
                          ]}
                        >
                          {item.name}
                        </Text>
                        {!!item.address && (
                          <Text style={styles.branchAddress} numberOfLines={2}>
                            {item.address}
                          </Text>
                        )}
                      </View>

                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && styles.radioCircleActive,
                        ]}
                      >
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    </Pressable>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  cardTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  triggerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  triggerIcon: {
    fontSize: 18,
  },
  triggerLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  triggerValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 1,
  },
  changeBadge: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  changeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 24,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  modalSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    textAlign: "center",
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 10,
  },
  branchCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  branchCardSelected: {
    borderColor: "#059669",
    backgroundColor: "#ecfdf5",
  },
  codeBadge: {
    backgroundColor: "#e0f2fe",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0284c7",
  },
  branchName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  branchAddress: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    lineHeight: 16,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleActive: {
    borderColor: "#059669",
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#059669",
  },
  loadingBox: {
    alignItems: "center",
    paddingVertical: 30,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
  },
  errorBox: {
    backgroundColor: "#fff1f2",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
    gap: 8,
  },
  errorText: {
    color: "#e11d48",
    fontSize: 13,
    fontWeight: "600",
  },
  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#e11d48",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  retryBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
});
