import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  BatchesView,
  BatchStockModal,
  CategoriesView,
  InventoryCard,
  InventoryStatCards,
  InventoryTabsNav,
  SuppliersView,
  SupplyDetailModal,
  SupplyFormModal,
  TransactionsView,
  WarehousesView,
  type InventoryCategory,
  type InventorySectionTab,
  type InventoryStats,
  type InventorySupplier,
  type InventorySupply,
  type InventoryTransaction,
  type InventoryWarehouse,
} from "../../src/components/inventory";
import { SearchInput } from "../../src/components/common";
import { supplyApi, type BatchStockPayload } from "../../src/api/supplyApi";



export default function InventoryScreen() {
  // Tab điều hướng chính
  const [activeTab, setActiveTab] = useState<InventorySectionTab>("supplies");

  // Dữ liệu thực từ API
  const [supplies, setSupplies] = useState<InventorySupply[]>([]);
  const [stats, setStats] = useState<InventoryStats>({
    totalItems: 0,
    totalQuantity: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    expiredCount: 0,
    expiringSoonCount: 0,
    totalValue: 0,
  });
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; code?: string }>>([]);

  // Loading states
  const [loadingSupplies, setLoadingSupplies] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Bộ lọc của tab Vật tư
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Bộ lọc của tab Giao dịch
  const [txTypeFilter, setTxTypeFilter] = useState<"all" | "in" | "out">("all");
  const [txSearchQuery, setTxSearchQuery] = useState("");

  // Modal actions
  const [batchModal, setBatchModal] = useState<{
    visible: boolean;
    type: "in" | "out";
    initialSupply?: InventorySupply | null;
  }>({
    visible: false,
    type: "in",
    initialSupply: null,
  });

  const [detailModalItem, setDetailModalItem] = useState<InventorySupply | null>(null);
  const [formModal, setFormModal] = useState<{
    visible: boolean;
    item: InventorySupply | null;
  }>({
    visible: false,
    item: null,
  });
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");

  // Tải danh sách vật tư & thống kê từ server
  const loadSuppliesData = useCallback(async () => {
    setLoadingSupplies(true);
    try {
      const serverCategory =
        selectedCategory !== "all" &&
        selectedCategory !== "low-stock" &&
        selectedCategory !== "expiring"
          ? selectedCategory
          : undefined;

      const [suppliesRes, statsRes] = await Promise.all([
        supplyApi.getSupplies({ search: searchQuery, category: serverCategory }),
        supplyApi.getStats().catch((e) => {
          console.log("[INVENTORY] getStats err:", e);
          return null;
        }),
      ]);
      console.log("[INVENTORY] supplies loaded:", suppliesRes?.data?.length);
      setSupplies(suppliesRes.data);

      if (statsRes) {
        setStats(statsRes);
      } else {
        // Tự động tính toán thống kê nếu endpoint stats lỗi
        const totalItems = suppliesRes.data.length;
        let totalQuantity = 0;
        let lowStockCount = 0;
        let outOfStockCount = 0;
        let expiredCount = 0;
        let expiringSoonCount = 0;
        let totalValue = 0;
        const now = Date.now();

        for (const item of suppliesRes.data) {
          totalQuantity += item.quantity;
          totalValue += item.quantity * (item.unitPrice || 0);
          if (item.quantity === 0) outOfStockCount++;
          else if (item.quantity <= item.minQuantity) lowStockCount++;

          if (item.expiryDate) {
            const exp = new Date(item.expiryDate).getTime();
            const diffDays = (exp - now) / (1000 * 60 * 60 * 24);
            if (diffDays < 0) expiredCount++;
            else if (diffDays <= 60) expiringSoonCount++;
          }
        }

        setStats({
          totalItems,
          totalQuantity,
          lowStockCount,
          outOfStockCount,
          expiredCount,
          expiringSoonCount,
          totalValue,
        });
      }
    } catch (err: any) {
      console.log("[INVENTORY] loadSuppliesData error:", err);
      // Nếu server chưa có dữ liệu, hiển thị danh sách rỗng sạch
      setSupplies([]);
    } finally {
      setLoadingSupplies(false);
    }
  }, [searchQuery, selectedCategory]);

  // Tải lịch sử nhập xuất
  const loadTransactionsData = useCallback(async () => {
    setLoadingTransactions(true);
    try {
      const res = await supplyApi.getTransactions({
        type: txTypeFilter === "all" ? undefined : txTypeFilter,
        search: txSearchQuery,
      });
      setTransactions(res.data);
    } catch {
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  }, [txTypeFilter, txSearchQuery]);

  // Tải nhà cung cấp
  const loadSuppliersData = useCallback(async () => {
    setLoadingSuppliers(true);
    try {
      const list = await supplyApi.getSuppliers();
      setSuppliers(list);
    } catch {
      setSuppliers([]);
    } finally {
      setLoadingSuppliers(false);
    }
  }, []);

  // Tải danh sách kho lưu trữ
  const loadWarehousesData = useCallback(async () => {
    setLoadingWarehouses(true);
    try {
      const list = await supplyApi.getWarehouses();
      setWarehouses(list);
    } catch {
      setWarehouses([]);
    } finally {
      setLoadingWarehouses(false);
    }
  }, []);

  // Tải phân loại danh mục
  const loadCategoriesData = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const list = await supplyApi.getCategories();
      setCategories(list);
    } catch {
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  // Tải danh sách khoa / phòng ban thực tế
  const loadDepartmentsData = useCallback(async () => {
    try {
      const list = await supplyApi.getDepartments();
      setDepartments(list);
    } catch {
      setDepartments([]);
    }
  }, []);

  // Tải ban đầu các danh mục, kho bãi, nhà cung cấp và phòng ban
  useEffect(() => {
    void loadCategoriesData();
    void loadWarehousesData();
    void loadSuppliersData();
    void loadDepartmentsData();
  }, [loadCategoriesData, loadWarehousesData, loadSuppliersData, loadDepartmentsData]);

  // Effect tải dữ liệu tương ứng khi đổi tab
  useEffect(() => {
    if (activeTab === "supplies" || activeTab === "batches") {
      void loadSuppliesData();
    } else if (activeTab === "transactions") {
      void loadTransactionsData();
    } else if (activeTab === "suppliers") {
      void loadSuppliersData();
    } else if (activeTab === "warehouses") {
      void loadWarehousesData();
    } else if (activeTab === "categories") {
      void loadCategoriesData();
    }
  }, [
    activeTab,
    loadSuppliesData,
    loadTransactionsData,
    loadSuppliersData,
    loadWarehousesData,
    loadCategoriesData,
  ]);

  // Danh mục phân loại động (lấy từ dữ liệu thật trong cơ sở dữ liệu)
  const dynamicCategoryFilters = useMemo(() => {
    const list: Array<{ id: string; label: string }> = [{ id: "all", label: "Tất cả" }];
    const seen = new Set<string>();
    for (const cat of categories) {
      const name = (cat.name || "").trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push({ id: name, label: name });
      }
    }
    for (const sup of supplies) {
      const catName = (sup.category || "").trim();
      if (catName && catName !== "Chưa phân loại" && !seen.has(catName.toLowerCase())) {
        seen.add(catName.toLowerCase());
        list.push({ id: catName, label: catName });
      }
    }
    list.push({ id: "low-stock", label: "Cảnh báo sắp hết" });
    list.push({ id: "expiring", label: "Sắp hết hạn" });
    return list;
  }, [categories, supplies]);

  // Bộ lọc danh sách vật tư hiển thị
  const filteredSupplies = useMemo(() => {
    let list = supplies;

    if (selectedCategory === "low-stock") {
      list = list.filter((s) => s.quantity <= s.minQuantity);
    } else if (selectedCategory === "expiring") {
      const now = Date.now();
      list = list.filter((s) => {
        if (!s.expiryDate) return false;
        const diff = (new Date(s.expiryDate).getTime() - now) / (1000 * 60 * 60 * 24);
        return diff <= 60;
      });
    } else if (selectedCategory !== "all") {
      list = list.filter((s) => s.category === selectedCategory);
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.batchNumber.toLowerCase().includes(q) ||
        s.warehouseLocation.toLowerCase().includes(q),
    );
  }, [supplies, selectedCategory, searchQuery]);

  const handleStockIn = (item: InventorySupply) => {
    setBatchModal({
      visible: true,
      type: "in",
      initialSupply: item,
    });
  };

  const handleStockOut = (item: InventorySupply) => {
    setBatchModal({
      visible: true,
      type: "out",
      initialSupply: item,
    });
  };

  // Xác nhận nhập/xuất kho theo lô đa mặt hàng (Batch Stock)
  const handleBatchStockSubmit = async (payload: BatchStockPayload) => {
    try {
      await supplyApi.batchStock(payload);

      Alert.alert(
        "Thành công",
        payload.type === "in"
          ? `Đã hoàn tất lập phiếu nhập kho (${payload.items.length} mặt hàng).`
          : `Đã hoàn tất lập phiếu xuất cấp (${payload.items.length} mặt hàng).`,
        [{ text: "Đóng", style: "default" }],
      );

      // Tải lại dữ liệu sau khi nhập/xuất
      void loadSuppliesData();
      void loadTransactionsData();
    } catch (err: any) {
      Alert.alert("Lỗi thao tác", err.message || "Không thể thực hiện lập phiếu.");
      throw err;
    }
  };

  const handleCreateSupply = () => {
    setFormModal({
      visible: true,
      item: null,
    });
  };

  const handleEditSupply = (item: InventorySupply) => {
    setFormModal({
      visible: true,
      item,
    });
  };

  const handleDeleteSupply = (item: InventorySupply) => {
    Alert.alert(
      "Xác nhận xóa vật tư",
      `Bạn có chắc chắn muốn xóa/ngừng sử dụng "${item.name}" (Mã: ${item.code}) không?\nThao tác này sẽ cập nhật trạng thái trong hệ thống kho.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await supplyApi.deleteSupply(item.id);
              Alert.alert("Thành công", `Đã xóa vật tư "${item.name}".`);
              void loadSuppliesData();
            } catch (err: any) {
              Alert.alert("Lỗi", err.message || "Không thể xóa vật tư.");
            }
          },
        },
      ]
    );
  };

  const handleFormSubmit = async (formData: Partial<InventorySupply>) => {
    try {
      if (formModal.item) {
        await supplyApi.updateSupply(formModal.item.id, formData);
        Alert.alert("Thành công", `Đã cập nhật thông tin "${formData.name}".`);
      } else {
        await supplyApi.createSupply(formData);
        Alert.alert("Thành công", `Đã thêm mới vật tư "${formData.name}".`);
      }
      void loadSuppliesData();
    } catch (err: any) {
      Alert.alert("Lỗi", err.message || "Không thể lưu dữ liệu.");
      throw err;
    }
  };

  const handleBarcodeSearch = () => {
    if (!barcodeInput.trim()) return;
    setSearchQuery(barcodeInput.trim());
    setIsScannerOpen(false);
    setBarcodeInput("");
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push("/(tabs)");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* 1. Header phân hệ y tế */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            Vật tư & Dược phẩm
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
            Quản lý tồn kho & cấp phát
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerIconBtnAdd}
            onPress={handleCreateSupply}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={20} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtnScan}
            onPress={() => setIsScannerOpen(true)}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Ionicons name="barcode-outline" size={18} color="#059669" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Thanh Tabs Phân Hệ Ngang (Vật tư, Nhập/Xuất, Tồn theo lô, Nhà cung cấp, Kho, Danh mục) */}
      <InventoryTabsNav activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* 3. Render nội dung theo Tab đang chọn */}
      {activeTab === "supplies" && (
        <View style={styles.tabContentContainer}>
          {/* Thanh Search Bar */}
          <View style={styles.searchSection}>
            <SearchInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm tên thuốc, mã vật tư, số lô..."
            />
          </View>

          {/* Danh sách vật tư */}
          <FlatList
            data={filteredSupplies}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <InventoryCard
                item={item}
                onDetail={setDetailModalItem}
                onEdit={handleEditSupply}
                onDelete={handleDeleteSupply}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={loadingSupplies}
                onRefresh={loadSuppliesData}
                colors={["#059669"]}
                tintColor="#059669"
              />
            }
            ListHeaderComponent={
              <View style={styles.listHeader}>
                {/* 4 Thẻ KPI Kho */}
                <InventoryStatCards
                  stats={stats}
                  selectedFilter={selectedCategory}
                  onSelectFilter={setSelectedCategory}
                />

                {/* 2 Nút Lập phiếu Nhập / Xuất Kho theo lô */}
                <View style={styles.quickVoucherBar}>
                  <TouchableOpacity
                    style={styles.quickVoucherBtnIn}
                    onPress={() => setBatchModal({ visible: true, type: "in", initialSupply: null })}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="arrow-down-circle" size={16} color="#059669" />
                    <Text style={styles.quickVoucherTextIn}>+ Nhập kho</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickVoucherBtnOut}
                    onPress={() => setBatchModal({ visible: true, type: "out", initialSupply: null })}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="arrow-up-circle" size={16} color="#0284c7" />
                    <Text style={styles.quickVoucherTextOut}>+ Xuất cấp</Text>
                  </TouchableOpacity>
                </View>

                {/* Bộ lọc ngang danh mục lấy từ dữ liệu thật */}
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={dynamicCategoryFilters}
                  keyExtractor={(cat) => cat.id}
                  contentContainerStyle={styles.categoryFilterList}
                  renderItem={({ item: cat }) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.categoryFilterChip,
                          isSelected && styles.categoryFilterChipActive,
                        ]}
                        onPress={() => setSelectedCategory(cat.id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.categoryFilterText,
                            isSelected && styles.categoryFilterTextActive,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />

                {/* Tiêu đề danh sách & số lượng */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    Danh sách ({filteredSupplies.length} mặt hàng)
                  </Text>
                  {selectedCategory !== "all" && (
                    <TouchableOpacity onPress={() => setSelectedCategory("all")}>
                      <Text style={styles.clearFilterText}>Xóa lọc</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            }
            ListEmptyComponent={
              loadingSupplies ? (
                <View style={styles.emptyContainer}>
                  <ActivityIndicator size="large" color="#059669" />
                  <Text style={styles.loadingText}>Đang tải dữ liệu từ máy chủ...</Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="cube-outline" size={54} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>Không tìm thấy mặt hàng nào</Text>
                  <Text style={styles.emptySubtitle}>
                    Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc danh mục
                  </Text>
                </View>
              )
            }
          />

          {/* Nút nổi thêm mới vật tư (FAB) */}
          <TouchableOpacity
            style={styles.fabBtn}
            onPress={handleCreateSupply}
            activeOpacity={0.85}
            accessibilityLabel="Thêm vật tư"
          >
            <Ionicons name="add" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Tab: Nhập / Xuất kho */}
      {activeTab === "transactions" && (
        <TransactionsView
          transactions={transactions}
          loading={loadingTransactions}
          onRefresh={loadTransactionsData}
          typeFilter={txTypeFilter}
          onChangeTypeFilter={setTxTypeFilter}
          searchQuery={txSearchQuery}
          onChangeSearch={setTxSearchQuery}
          onNewTransactionPress={(type) =>
            setBatchModal({ visible: true, type, initialSupply: null })
          }
        />
      )}

      {/* Tab: Tồn theo lô & Hạn dùng FEFO */}
      {activeTab === "batches" && (
        <BatchesView
          supplies={supplies}
          loading={loadingSupplies}
          onRefresh={loadSuppliesData}
        />
      )}

      {/* Tab: Nhà cung cấp */}
      {activeTab === "suppliers" && (
        <SuppliersView
          suppliers={suppliers}
          loading={loadingSuppliers}
          onRefresh={loadSuppliersData}
          onAddSupplier={async (data) => {
            await supplyApi.createSupplier(data);
            Alert.alert("Thành công", `Đã tạo nhà cung cấp "${data.name}".`);
            await loadSuppliersData();
          }}
          onEditSupplier={async (id, data) => {
            await supplyApi.updateSupplier(id, data);
            Alert.alert("Thành công", `Đã cập nhật nhà cung cấp "${data.name}".`);
            await loadSuppliersData();
          }}
          onDeleteSupplier={async (sup) => {
            try {
              await supplyApi.deleteSupplier(sup.id);
              Alert.alert("Thành công", `Đã xóa nhà cung cấp "${sup.name}".`);
              await loadSuppliersData();
            } catch (err: any) {
              Alert.alert("Lỗi", err.message || "Không thể xóa nhà cung cấp.");
            }
          }}
        />
      )}

      {/* Tab: Kho lưu trữ */}
      {activeTab === "warehouses" && (
        <WarehousesView
          warehouses={warehouses}
          loading={loadingWarehouses}
          onRefresh={loadWarehousesData}
          onSelectWarehouse={(wh) => {
            setSearchQuery(wh.name);
            setActiveTab("supplies");
          }}
          onAddWarehouse={async (data) => {
            await supplyApi.createWarehouse(data);
            Alert.alert("Thành công", `Đã tạo kho "${data.name}".`);
            await loadWarehousesData();
          }}
          onEditWarehouse={async (id, data) => {
            await supplyApi.updateWarehouse(id, data);
            Alert.alert("Thành công", `Đã cập nhật kho "${data.name}".`);
            await loadWarehousesData();
          }}
          onDeleteWarehouse={async (wh) => {
            try {
              await supplyApi.deleteWarehouse(wh.id);
              Alert.alert("Thành công", `Đã xóa kho "${wh.name}".`);
              await loadWarehousesData();
            } catch (err: any) {
              Alert.alert("Lỗi", err.message || "Không thể xóa kho lưu trữ.");
            }
          }}
        />
      )}

      {/* Tab: Phân loại / Danh mục */}
      {activeTab === "categories" && (
        <CategoriesView
          categories={categories}
          loading={loadingCategories}
          onRefresh={loadCategoriesData}
          onSelectCategory={(catName) => {
            setSelectedCategory(catName);
            setActiveTab("supplies");
          }}
          onAddCategory={async (data) => {
            await supplyApi.createCategory(data);
            Alert.alert("Thành công", `Đã tạo phân loại "${data.name}".`);
            await loadCategoriesData();
          }}
          onEditCategory={async (id, data) => {
            await supplyApi.updateCategory(id, data);
            Alert.alert("Thành công", `Đã cập nhật phân loại "${data.name}".`);
            await loadCategoriesData();
          }}
          onDeleteCategory={async (cat) => {
            try {
              await supplyApi.deleteCategory(cat.id);
              Alert.alert("Thành công", `Đã xóa phân loại "${cat.name}".`);
              await loadCategoriesData();
            } catch (err: any) {
              Alert.alert("Lỗi", err.message || "Không thể xóa phân loại.");
            }
          }}
        />
      )}

      {/* 4. Modal Lập Phiếu Nhập / Xuất Kho Đa Mặt Hàng */}
      <BatchStockModal
        visible={batchModal.visible}
        initialType={batchModal.type}
        initialSupply={batchModal.initialSupply}
        supplies={supplies}
        suppliers={suppliers}
        warehouses={warehouses}
        departments={departments}
        onClose={() => setBatchModal((prev) => ({ ...prev, visible: false, initialSupply: null }))}
        onSubmit={handleBatchStockSubmit}
      />

      {/* 5. Modal Xem Chi Tiết Vật Tư Y Tế */}
      <SupplyDetailModal
        item={detailModalItem}
        visible={Boolean(detailModalItem)}
        onClose={() => setDetailModalItem(null)}
        onStockIn={handleStockIn}
        onStockOut={handleStockOut}
        onEdit={(item) => {
          setDetailModalItem(null);
          handleEditSupply(item);
        }}
        onDelete={(item) => {
          setDetailModalItem(null);
          handleDeleteSupply(item);
        }}
      />

      {/* 5.1 Modal Form Thêm Mới / Chỉnh Sửa Vật Tư (Có Dropdown Categories, Warehouses, Suppliers) */}
      <SupplyFormModal
        visible={formModal.visible}
        item={formModal.item}
        onClose={() => setFormModal({ visible: false, item: null })}
        onSubmit={handleFormSubmit}
        categories={categories}
        warehouses={warehouses}
        suppliers={suppliers}
        onAddCategory={async (catData) => {
          await supplyApi.createCategory(catData);
          await loadCategoriesData();
        }}
        onAddWarehouse={async (whData) => {
          await supplyApi.createWarehouse(whData);
          await loadWarehousesData();
        }}
        onAddSupplier={async (supData) => {
          await supplyApi.createSupplier(supData);
          await loadSuppliersData();
        }}
      />

      {/* 6. Modal Quét Barcode / QR Giả Lập Nhanh */}
      <Modal visible={isScannerOpen} transparent animationType="fade">
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerCard}>
            <View style={styles.scannerHeader}>
              <View style={styles.scannerTitleRow}>
                <Ionicons name="scan-circle" size={24} color="#059669" />
                <Text style={styles.scannerTitle}>Quét Mã Vạch Y Tế</Text>
              </View>
              <TouchableOpacity onPress={() => setIsScannerOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.scannerDesc}>
              Nhập mã vạch sản phẩm, số lô LOT hoặc mã định danh để tra cứu ngay lập tức:
            </Text>

            <TextInput
              style={styles.scannerInput}
              placeholder="VD: LOT-2026B12 hoặc VT-GTYT-75"
              placeholderTextColor="#94a3b8"
              value={barcodeInput}
              onChangeText={setBarcodeInput}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleBarcodeSearch}
            />

            <View style={styles.scannerActions}>
              <TouchableOpacity
                style={styles.scannerCancelBtn}
                onPress={() => setIsScannerOpen(false)}
              >
                <Text style={styles.scannerCancelText}>Đóng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.scannerConfirmBtn}
                onPress={handleBarcodeSearch}
              >
                <Text style={styles.scannerConfirmText}>Tra Cứu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  headerTitleBox: {
    flex: 1,
    marginHorizontal: 10,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtnAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  headerIconBtnScan: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  fabBtn: {
    position: "absolute",
    bottom: 20,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  tabContentContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  searchSection: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
  },
  listContent: {
    paddingBottom: 100,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  quickVoucherBar: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  quickVoucherBtnIn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    borderWidth: 1.5,
    borderColor: "#a7f3d0",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  quickVoucherTextIn: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#059669",
  },
  quickVoucherBtnOut: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f0f9ff",
    borderWidth: 1.5,
    borderColor: "#bae6fd",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  quickVoucherTextOut: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0284c7",
  },
  categoryFilterList: {
    gap: 8,
    paddingVertical: 12,
  },
  categoryFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  categoryFilterChipActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  categoryFilterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  categoryFilterTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  clearFilterText: {
    fontSize: 13,
    color: "#059669",
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  scannerCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  scannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  scannerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scannerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  scannerDesc: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
    marginBottom: 14,
  },
  scannerInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0f172a",
    marginBottom: 18,
  },
  scannerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  scannerCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  scannerCancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  scannerConfirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#059669",
  },
  scannerConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
