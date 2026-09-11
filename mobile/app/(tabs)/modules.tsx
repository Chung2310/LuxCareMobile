import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// Tái sử dụng các components đã tách biệt theo phong cách MoMo
import {
  CategoryTabs,
  DEFAULT_PINNED_IDS,
  EditPinnedModal,
  getAccessibleModules,
  getAllServicesFlat,
  LUXCARE_MODULES,
  ModuleSection,
  PinnedServicesSection,
  SearchBar,
  type CategoryTabItem,
  type ServiceItem,
  type ServiceModule,
} from "../../src/components";
import { useSession } from "../../src/auth/SessionProvider";
import { useAppLoading } from "../../src/context/LoadingContext";
import { BranchSelector } from "../../src/features/branches/BranchSelector";

export default function ModulesScreen() {
  const { user, selectedBranch } = useSession();
  const isOwner = ["admin", "superadmin", "branch_owner"].includes(user?.role || "");
  const { navigateWithLoading } = useAppLoading();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>(DEFAULT_PINNED_IDS);

  // Danh sách phân hệ đã lọc theo quyền người dùng
  const accessibleModules = useMemo(() => {
    return getAccessibleModules(user, LUXCARE_MODULES);
  }, [user]);

  // Danh sách phẳng tất cả dịch vụ người dùng có quyền
  const allServicesList = useMemo(() => getAllServicesFlat(accessibleModules, user), [accessibleModules, user]);

  // Danh sách các dịch vụ được ghim hiện tại (chỉ giữ dịch vụ có quyền)
  const pinnedServices = useMemo(() => {
    return pinnedIds
      .map((id) => allServicesList.find((s) => s.id === id))
      .filter((s): s is ServiceItem => Boolean(s));
  }, [pinnedIds, allServicesList]);

  // Danh sách tabs lọc phân hệ (chỉ hiển thị phân hệ có dịch vụ khả dụng)
  const categoryTabs: CategoryTabItem[] = useMemo(() => {
    return [
      { id: "all", label: "Tất cả" },
      ...accessibleModules.map((mod) => ({
        id: mod.id,
        label: mod.shortTitle,
      })),
    ];
  }, [accessibleModules]);

  // Bộ lọc danh mục & tìm kiếm
  const filteredModules = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return accessibleModules
      .map((mod) => {
        if (selectedCategory !== "all" && mod.id !== selectedCategory) {
          return null;
        }

        if (!q) return mod;

        const matchedItems = mod.items.filter((item) =>
          item.title.toLowerCase().replace("\n", " ").includes(q),
        );

        if (matchedItems.length === 0) return null;

        return {
          ...mod,
          items: matchedItems,
        };
      })
      .filter((m): m is ServiceModule => Boolean(m));
  }, [accessibleModules, selectedCategory, searchQuery]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push("/(tabs)");
    }
  };

  const handleItemPress = (item: ServiceItem) => {
    if (item.status === "coming_soon") {
      Alert.alert(
        item.title.replace(/\n/g, " "),
        "Phân hệ này đang được hoàn thiện và đồng bộ từ phiên bản LuxCare Web. Sẽ sớm sẵn sàng trong bản cập nhật kế tiếp!",
        [{ text: "Đã hiểu", style: "default" }]
      );
      return;
    }
    const targetRoute = item.route.includes("?")
      ? `${item.route}&from=modules`
      : `${item.route}?from=modules`;

    navigateWithLoading(targetRoute, {
      title: item.title.replace(/\n/g, " "),
      subtitle: `Đang kết nối và nạp dữ liệu ${item.title.replace(/\n/g, " ")}...`,
      icon: item.icon,
      color: item.color,
      bgColor: item.bgColor,
    });
  };

  const togglePinItem = (id: string) => {
    if (pinnedIds.includes(id)) {
      if (pinnedIds.length <= 1) return;
      setPinnedIds(pinnedIds.filter((p) => p !== id));
    } else {
      if (pinnedIds.length >= 8) return;
      setPinnedIds([...pinnedIds, id]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Component SearchBar dùng chung */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onBack={handleBack}
        placeholder="Tìm mọi dịch vụ trên LuxCare"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Branch Selector for Business Owners */}
        {isOwner && !searchQuery.trim() && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
            <BranchSelector
              renderCustomTrigger={(open) => (
                <Pressable
                  style={styles.branchSelectTrigger}
                  onPress={open}
                  accessibilityRole="button"
                  accessibilityLabel="Chọn chi nhánh làm việc"
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                    <Ionicons name="business" size={15} color="#059669" />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748b" }}>Chi nhánh:</Text>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#0f172a", flex: 1 }} numberOfLines={1}>
                      {selectedBranch?.name || "Toàn hệ thống (Tất cả chi nhánh)"}
                    </Text>
                  </View>
                  <View style={styles.branchChangeBadge}>
                    <Text style={styles.branchChangeText}>Đổi ▾</Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        )}

        {/* Component Dịch vụ được ghim */}
        {!searchQuery.trim() && (
          <PinnedServicesSection
            pinnedServices={pinnedServices}
            onEditPress={() => setIsEditModalOpen(true)}
            onItemPress={handleItemPress}
          />
        )}

        {/* Component Thanh phân loại ngang */}
        {!searchQuery.trim() && (
          <CategoryTabs
            categories={categoryTabs}
            selectedId={selectedCategory}
            onSelect={setSelectedCategory}
          />
        )}

        {/* Phản hồi khi đang tìm kiếm */}
        {searchQuery.trim().length > 0 && (
          <View style={styles.searchFeedback}>
            <Text style={styles.searchFeedbackText}>
              Kết quả tìm kiếm cho "{searchQuery}":
            </Text>
          </View>
        )}

        {/* Danh sách từng Module với 4 cột icon */}
        {filteredModules.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Không tìm thấy dịch vụ nào</Text>
            <Text style={styles.emptySubtitle}>
              Vui lòng kiểm tra lại từ khóa hoặc chuyển sang danh mục khác
            </Text>
          </View>
        ) : (
          filteredModules.map((mod) => (
            <ModuleSection
              key={mod.id}
              module={mod}
              onItemPress={handleItemPress}
            />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Component Modal Tùy Chỉnh Dịch Vụ Ghim */}
      <EditPinnedModal
        visible={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        allServices={allServicesList}
        pinnedIds={pinnedIds}
        onTogglePin={togglePinItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollContent: {
    paddingBottom: 30,
  },
  searchFeedback: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchFeedbackText: {
    fontSize: 14,
    color: "#64748b",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
  },
  branchSelectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  branchChangeBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  branchChangeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
});