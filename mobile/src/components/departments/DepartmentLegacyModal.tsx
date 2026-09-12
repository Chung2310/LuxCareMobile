import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppButton } from "../common";
import { departments } from "../../api/services";
import type { DepartmentRecord } from "./types";

interface DepartmentLegacyModalProps {
  visible: boolean;
  departmentList: DepartmentRecord[];
  onClose: () => void;
  onMergedSuccess: () => void;
}

export const DepartmentLegacyModal: React.FC<DepartmentLegacyModalProps> = ({
  visible,
  departmentList,
  onClose,
  onMergedSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === "ios" ? 48 : (StatusBar.currentHeight || 0));
  const [unmappedList, setUnmappedList] = useState<Array<{ name: string; count: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [targetDeptId, setTargetDeptId] = useState<string>("");
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    departments
      .getUnmapped()
      .then((res) => {
        if (active) {
          setUnmappedList(res || []);
          setSelectedNames([]);
          setTargetDeptId("");
        }
      })
      .catch((err) => {
        if (active) {
          Alert.alert("Lỗi nạp dữ liệu", err.message || "Không thể tải danh sách tên phòng ban cũ.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [visible]);

  const toggleSelect = (name: string) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleSelectAll = () => {
    if (selectedNames.length === unmappedList.length) {
      setSelectedNames([]);
    } else {
      setSelectedNames(unmappedList.map((item) => item.name));
    }
  };

  const handleMerge = async () => {
    if (selectedNames.length === 0) {
      Alert.alert("Chưa chọn phòng ban", "Vui lòng chọn ít nhất một tên phòng ban cũ cần chuẩn hóa.");
      return;
    }
    if (!targetDeptId) {
      Alert.alert("Chưa chọn đích", "Vui lòng chọn phòng ban chuẩn đích để gộp vào.");
      return;
    }

    const targetDept = departmentList.find((d) => d._id === targetDeptId);

    Alert.alert(
      "Xác nhận hợp nhất",
      `Bạn có chắc chắn muốn chuẩn hóa ${selectedNames.length} tên phòng ban cũ vào phòng ban "${targetDept?.name}"?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xác nhận gộp",
          style: "default",
          onPress: async () => {
            setMerging(true);
            try {
              const res = await departments.merge(selectedNames, targetDeptId);
              Alert.alert(
                "Chuẩn hóa thành công!",
                `Đã cập nhật ${res?.modifiedCount ?? selectedNames.length} hồ sơ nhân sự sang phòng ban "${targetDept?.name}".`
              );
              onMergedSuccess();
              onClose();
            } catch (err: any) {
              Alert.alert("Lỗi hợp nhất", err.message || "Không thể chuẩn hóa tên phòng ban.");
            } finally {
              setMerging(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.screen, { paddingTop: topInset }]}
        edges={["bottom"]}
      >
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.headerLeft}>
            <View style={styles.iconBox}>
              <Ionicons name="git-merge" size={18} color="#059669" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Chuẩn hóa phòng ban cũ</Text>
              <Text style={styles.headerSubtitle}>
                Chuyển đổi dữ liệu chuỗi text cũ sang danh mục phòng ban chuẩn
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>Đang kiểm tra dữ liệu chưa chuẩn hóa...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Banner hướng dẫn */}
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={20} color="#0284c7" />
              <Text style={styles.infoBannerText}>
                Các tên phòng ban dưới đây được nhập dạng chữ tự do trong hồ sơ nhân sự trước đây. Chọn các tên tương đương và gán vào một phòng ban chuẩn duy nhất.
              </Text>
            </View>

            {unmappedList.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="checkmark-circle" size={44} color="#16a34a" />
                <Text style={styles.emptyTitle}>Dữ liệu hoàn toàn đồng bộ!</Text>
                <Text style={styles.emptyText}>
                  Không phát hiện tên phòng ban cũ chưa được chuẩn hóa trong hệ thống.
                </Text>
              </View>
            ) : (
              <>
                {/* BƯỚC 1: Chọn các tên cũ */}
                <View style={styles.sectionBox}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      1. Chọn tên phòng ban cũ ({selectedNames.length}/{unmappedList.length})
                    </Text>
                    <TouchableOpacity onPress={handleSelectAll}>
                      <Text style={styles.selectAllText}>
                        {selectedNames.length === unmappedList.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.nameList}>
                    {unmappedList.map((item) => {
                      const isSelected = selectedNames.includes(item.name);
                      return (
                        <TouchableOpacity
                          key={item.name}
                          style={[styles.nameItem, isSelected && styles.nameItemSelected]}
                          onPress={() => toggleSelect(item.name)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              isSelected && styles.checkboxActive,
                            ]}
                          >
                            {isSelected && (
                              <Ionicons name="checkmark" size={14} color="#ffffff" />
                            )}
                          </View>
                          <Text style={styles.nameText} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{item.count} nhân sự</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* BƯỚC 2: Chọn phòng ban chuẩn đích */}
                <View style={styles.sectionBox}>
                  <Text style={styles.sectionTitle}>2. Chọn phòng ban chuẩn đích</Text>
                  <Text style={styles.sectionSubtitle}>
                    Toàn bộ nhân sự thuộc các tên được chọn sẽ được chuyển sang phòng ban này:
                  </Text>

                  <ScrollView style={styles.targetList} nestedScrollEnabled>
                    {departmentList
                      .filter((d) => d.isActive)
                      .map((dept) => {
                        const isTarget = dept._id === targetDeptId;
                        return (
                          <TouchableOpacity
                            key={dept._id}
                            style={[
                              styles.targetItem,
                              isTarget && styles.targetItemSelected,
                            ]}
                            onPress={() => setTargetDeptId(dept._id)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.targetCodeBadge}>
                              <Text style={styles.targetCodeText}>{dept.code}</Text>
                            </View>
                            <View style={styles.targetInfo}>
                              <Text style={styles.targetName}>{dept.name}</Text>
                              <Text style={styles.targetMeta}>
                                Hiện có {dept.employeeCount ?? 0} nhân sự
                              </Text>
                            </View>
                            {isTarget && (
                              <Ionicons
                                name="checkmark-circle"
                                size={20}
                                color="#059669"
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                </View>

                {/* Submit Action */}
                <View style={styles.footerAction}>
                  <AppButton
                    title={`Chuẩn hóa (${selectedNames.length} mục đã chọn)`}
                    variant="primary"
                    onPress={handleMerge}
                    loading={merging}
                    disabled={selectedNames.length === 0 || !targetDeptId}
                    icon="git-merge-outline"
                  />
                </View>
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15.5,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#64748b",
  },
  closeBtn: {
    padding: 6,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748b",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#f0f9ff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
    marginBottom: 16,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12.5,
    color: "#0369a1",
    lineHeight: 18,
  },
  emptyBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#166534",
    marginTop: 14,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
  sectionBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionSubtitle: {
    fontSize: 11.5,
    color: "#64748b",
    marginBottom: 12,
    marginTop: 2,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },
  nameList: {
    gap: 8,
  },
  nameItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  nameItemSelected: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  nameText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  countBadge: {
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0369a1",
  },
  targetList: {
    maxHeight: 220,
  },
  targetItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 8,
    gap: 10,
  },
  targetItemSelected: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  targetCodeBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  targetCodeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },
  targetInfo: {
    flex: 1,
  },
  targetName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  targetMeta: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  footerAction: {
    marginTop: 8,
  },
});
