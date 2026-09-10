import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../../src/auth/SessionProvider";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { recruitmentAccess } from "../../src/features/recruitment/access";
import { canReadContracts } from "../../src/features/contracts/model";
import { canReadCredentials } from "../../src/features/credentials/model";
import { canReadPayslips } from "../../src/features/payroll/model";
import { canReadPayrollRuns } from "../../src/features/payroll/runModel";
import { workflowAccess } from "../../src/features/workflow/access";
import { trainingAccess } from "../../src/features/training/access";

interface ModuleItem {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  route: string;
  badge?: string;
  visible: boolean;
  category: "hr" | "attendance" | "work" | "recruitment" | "operations";
}

interface ModuleCategory {
  id: "all" | "hr" | "attendance" | "work" | "recruitment" | "operations";
  title: string;
  shortTitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const CATEGORIES: ModuleCategory[] = [
  { id: "all", title: "Tất cả chức năng", shortTitle: "Tất cả", icon: "apps", color: "#059669" },
  { id: "hr", title: "Nhân sự & Lương thưởng", shortTitle: "Nhân sự & Lương", icon: "people", color: "#0284c7" },
  { id: "attendance", title: "Chấm công & Ca trực", shortTitle: "Chấm công & Ca", icon: "time", color: "#10b981" },
  { id: "work", title: "Công việc & Dự án", shortTitle: "Công việc & Dự án", icon: "briefcase", color: "#2563eb" },
  { id: "recruitment", title: "Tuyển dụng & Đào tạo", shortTitle: "Tuyển dụng & Đào tạo", icon: "school", color: "#8b5cf6" },
  { id: "operations", title: "Vận hành & Khách hàng", shortTitle: "Vận hành & Y tế", icon: "medkit", color: "#ea580c" },
];

export default function Modules() {
  const { user, selectedBranch } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ModuleCategory["id"]>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Permissions
  const hrModule = canUseModule(user, "hr");
  const hasCompany = !!user?.companyCode;
  const isTimekeepingManager = hrModule && hasCompany && hasPermission(user, "timekeeping:manage");
  const recruitment = recruitmentAccess(user).read;
  const workflow = workflowAccess(user).read;
  const training = trainingAccess(user).read;
  const payslips = canReadPayslips(user);
  const payrollRuns = canReadPayrollRuns(user);
  const contracts = canReadContracts(user);
  const credentials = canReadCredentials(user);

  // Master function list with mobile-tailored metadata
  const allItems: ModuleItem[] = useMemo(
    () => [
      // 1. NHÂN SỰ & LƯƠNG THƯỞNG
      {
        id: "payslips",
        title: "Phiếu lương\ncá nhân",
        subtitle: "Tra cứu thu nhập, bảng lương chi tiết hàng tháng",
        icon: "wallet",
        color: "#059669",
        bgColor: "#ecfdf5",
        route: "/(tabs)/payslips",
        badge: "Của tôi",
        visible: payslips || payrollRuns,
        category: "hr",
      },
      {
        id: "payroll-runs",
        title: "Kỳ tính\nlương",
        subtitle: "Quy trình tính, kiểm tra, chốt & thanh toán lương",
        icon: "calculator",
        color: "#10b981",
        bgColor: "#ecfdf5",
        route: "/(tabs)/payroll-runs",
        badge: "Quản trị",
        visible: payrollRuns,
        category: "hr",
      },
      {
        id: "employees",
        title: "Danh bạ\nnhân sự",
        subtitle: "Danh sách nhân viên, thông tin liên hệ và chức vụ",
        icon: "people",
        color: "#0284c7",
        bgColor: "#f0f9ff",
        route: "/(tabs)/employees",
        visible: !!user,
        category: "hr",
      },
      {
        id: "contracts",
        title: "Hợp đồng\nlao động",
        subtitle: "Hợp đồng, thời hạn và lịch sử gia hạn hợp đồng",
        icon: "newspaper",
        color: "#047857",
        bgColor: "#ecfdf5",
        route: "/(tabs)/contracts",
        visible: contracts,
        category: "hr",
      },
      {
        id: "credentials",
        title: "Văn bằng\nchứng chỉ",
        subtitle: "Hồ sơ chuyên môn, thời hạn hành nghề & chứng chỉ y tế",
        icon: "ribbon",
        color: "#d97706",
        bgColor: "#fffbeb",
        route: "/(tabs)/credentials",
        visible: credentials,
        category: "hr",
      },
      {
        id: "departments",
        title: "Sơ đồ\nphòng ban",
        subtitle: "Danh mục các phòng ban, khối chuyên môn trong viện",
        icon: "business",
        color: "#6366f1",
        bgColor: "#eef2ff",
        route: "/(tabs)/departments",
        visible: !!user,
        category: "hr",
      },
      {
        id: "org-chart",
        title: "Cơ cấu\ntổ chức",
        subtitle: "Sơ đồ phân cấp cây tổ chức nhân sự chi nhánh",
        icon: "git-network",
        color: "#8b5cf6",
        bgColor: "#f5f3ff",
        route: "/(tabs)/org-chart",
        visible: !!user,
        category: "hr",
      },

      // 2. CHẤM CÔNG & CA TRỰC
      {
        id: "attendance",
        title: "Chấm công\nhàng ngày",
        subtitle: "Check-in/Check-out GPS, khuôn mặt và xem lịch sử chấm công",
        icon: "finger-print",
        color: "#059669",
        bgColor: "#ecfdf5",
        route: "/(tabs)/attendance",
        badge: "Hàng ngày",
        visible: !!user,
        category: "attendance",
      },
      {
        id: "leave",
        title: "Đơn từ\nnghỉ phép",
        subtitle: "Tạo đơn xin nghỉ, đi muộn về sớm, công tác và theo dõi duyệt",
        icon: "receipt",
        color: "#0d9488",
        bgColor: "#f0fdfa",
        route: "/(tabs)/leave",
        visible: !!user,
        category: "attendance",
      },
      {
        id: "attendance-mgmt",
        title: "Quản lý\nduyệt công",
        subtitle: "Duyệt công, điều chỉnh trạng thái công và bảng công",
        icon: "calendar-clear",
        color: "#0284c7",
        bgColor: "#f0f9ff",
        route: "/(tabs)/attendance-management",
        badge: "Quản lý",
        visible: isTimekeepingManager,
        category: "attendance",
      },
      {
        id: "shifts",
        title: "Quản lý\nphân ca",
        subtitle: "Phân ca làm việc, quản lý ca trực của các khoa phòng",
        icon: "swap-horizontal",
        color: "#10b981",
        bgColor: "#ecfdf5",
        route: "/(tabs)/shifts",
        visible: isTimekeepingManager,
        category: "attendance",
      },
      {
        id: "calendar-events",
        title: "Lịch trực\n& Nghỉ lễ",
        subtitle: "Lịch trình công việc, ca trực và ngày nghỉ lễ của công ty",
        icon: "calendar",
        color: "#0891b2",
        bgColor: "#ecfeff",
        route: "/(tabs)/calendar-events",
        visible: hrModule && hasCompany,
        category: "attendance",
      },
      {
        id: "work-calendar",
        title: "Lịch doanh\nnghiệp",
        subtitle: "Lịch nghỉ lễ, làm bù và lịch làm việc toàn công ty",
        icon: "today",
        color: "#f59e0b",
        bgColor: "#fffbeb",
        route: "/(tabs)/work-calendar",
        visible: !!user,
        category: "attendance",
      },

      // 3. CÔNG VIỆC & DỰ ÁN
      {
        id: "work",
        title: "Công việc\ncần làm",
        subtitle: "Nhiệm vụ cá nhân, phân công công việc và đánh giá KPI",
        icon: "checkbox",
        color: "#2563eb",
        bgColor: "#eff6ff",
        route: "/(tabs)/work",
        badge: "Thiết yếu",
        visible: hrModule,
        category: "work",
      },
      {
        id: "projects",
        title: "Dự án\nđang chạy",
        subtitle: "Theo dõi tiến độ, thành viên và tài liệu các dự án",
        icon: "folder-open",
        color: "#7c3aed",
        bgColor: "#f5f3ff",
        route: "/(tabs)/projects",
        visible: !!user,
        category: "work",
      },
      {
        id: "workflow",
        title: "Quy trình\nlàm việc",
        subtitle: "Quy chuẩn SOP, các bước giải quyết và phân luồng nghiệp vụ",
        icon: "git-branch",
        color: "#4f46e5",
        bgColor: "#eef2ff",
        route: "/(tabs)/workflow",
        visible: workflow,
        category: "work",
      },

      // 4. TUYỂN DỤNG & ĐÀO TẠO
      {
        id: "recruitment",
        title: "Tin tuyển\ndụng",
        subtitle: "Quản lý tin tuyển, JD công việc và nhu cầu nhân sự",
        icon: "briefcase",
        color: "#059669",
        bgColor: "#ecfdf5",
        route: "/(tabs)/recruitment",
        visible: recruitment,
        category: "recruitment",
      },
      {
        id: "applicants",
        title: "Hồ sơ\nứng viên",
        subtitle: "Tiếp nhận CV, đánh giá và lọc ứng viên theo từng vị trí",
        icon: "person-add",
        color: "#2563eb",
        bgColor: "#eff6ff",
        route: "/(tabs)/applicants",
        visible: recruitment,
        category: "recruitment",
      },
      {
        id: "interviews",
        title: "Lịch hẹn\nphỏng vấn",
        subtitle: "Lên lịch phỏng vấn, nhắc hẹn và kết quả tuyển dụng",
        icon: "calendar",
        color: "#d97706",
        bgColor: "#fffbeb",
        route: "/(tabs)/interviews",
        visible: recruitment,
        category: "recruitment",
      },
      {
        id: "recruitment-pipeline",
        title: "Quy trình\ntuyển dụng",
        subtitle: "Theo dõi phễu ứng viên qua các vòng tuyển chọn",
        icon: "git-merge",
        color: "#7c3aed",
        bgColor: "#f5f3ff",
        route: "/(tabs)/recruitment-pipeline",
        visible: recruitment,
        category: "recruitment",
      },
      {
        id: "training",
        title: "Đào tạo\nnội bộ",
        subtitle: "Khóa học, bài giảng video, quy chuẩn y khoa và tiến độ học",
        icon: "school",
        color: "#9333ea",
        bgColor: "#faf5ff",
        route: "/(tabs)/training",
        badge: "Mới",
        visible: training,
        category: "recruitment",
      },

      // 5. VẬN HÀNH & Y TẾ
      {
        id: "customers",
        title: "Khách hàng\n& Tiếp nhận",
        subtitle: "Tiếp nhận Leads, tư vấn & chăm sóc khách hàng y tế",
        icon: "people",
        color: "#059669",
        bgColor: "#ecfdf5",
        route: "/(tabs)/customers",
        badge: "CRM",
        visible: !!user,
        category: "operations",
      },
      {
        id: "inventory",
        title: "Vật tư &\nDược phẩm",
        subtitle: "Quản lý tồn kho, nhập xuất và cấp phát thuốc, vật tư",
        icon: "cube",
        color: "#10b981",
        bgColor: "#ecfdf5",
        route: "/(tabs)/inventory",
        badge: "ERP",
        visible: !!user,
        category: "operations",
      },
      {
        id: "equipment",
        title: "Thiết bị\ny tế",
        subtitle: "Quản lý tài sản máy móc, thiết bị y khoa và bảo trì",
        icon: "medkit",
        color: "#0284c7",
        bgColor: "#f0f9ff",
        route: "/(tabs)/equipment",
        visible: !!user,
        category: "operations",
      },
      {
        id: "resources",
        title: "Tài nguyên\nchuyên môn",
        subtitle: "Tài liệu kỹ thuật, video hướng dẫn và cẩm nang y tế",
        icon: "folder",
        color: "#0891b2",
        bgColor: "#ecfeff",
        route: "/(tabs)/resources",
        visible: !!user,
        category: "operations",
      },
      {
        id: "chat",
        title: "Trò chuyện\nnội bộ",
        subtitle: "Tin nhắn tức thời, trao đổi theo nhóm và ca trực",
        icon: "chatbubble-ellipses",
        color: "#ec4899",
        bgColor: "#fdf2f8",
        route: "/(tabs)/chat",
        badge: "Chat",
        visible: !!user,
        category: "operations",
      },
      {
        id: "notifications",
        title: "Thông báo\nhệ thống",
        subtitle: "Thông báo toàn viện, cập nhật chính sách và đơn từ",
        icon: "notifications",
        color: "#f59e0b",
        bgColor: "#fffbeb",
        route: "/(tabs)/notifications",
        visible: !!user,
        category: "operations",
      },
      {
        id: "profile",
        title: "Tài khoản\n& Hồ sơ",
        subtitle: "Thông tin cá nhân, chọn chi nhánh và cài đặt ứng dụng",
        icon: "person-circle",
        color: "#64748b",
        bgColor: "#f8fafc",
        route: "/(tabs)/profile",
        visible: !!user,
        category: "operations",
      },
    ],
    [
      user,
      hrModule,
      hasCompany,
      isTimekeepingManager,
      recruitment,
      workflow,
      training,
      payslips,
      payrollRuns,
      contracts,
      credentials,
    ],
  );

  // Filter visible items
  const visibleItems = useMemo(() => allItems.filter((i) => i.visible), [allItems]);

  // Filter by category & search query
  const filteredItems = useMemo(() => {
    let list = visibleItems;
    if (selectedCategory !== "all") {
      list = list.filter((i) => i.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.subtitle.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [visibleItems, selectedCategory, searchQuery]);

  // Grouped items by category for sectioned view
  const groupedSections = useMemo(() => {
    if (selectedCategory !== "all" || searchQuery.trim()) {
      return null;
    }
    const groups: Array<{ category: ModuleCategory; items: ModuleItem[] }> = [];
    for (const cat of CATEGORIES) {
      if (cat.id === "all") continue;
      const items = visibleItems.filter((i) => i.category === cat.id);
      if (items.length > 0) {
        groups.push({ category: cat, items });
      }
    }
    return groups;
  }, [visibleItems, selectedCategory, searchQuery]);

  const handleOpenItem = (item: ModuleItem) => {
    try {
      router.push(item.route as any);
    } catch {
      Alert.alert("Thông báo", "Chức năng đang được cập nhật.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.push("/(tabs)");
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#0f172a" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Tất cả chức năng</Text>
            <Text style={styles.headerSubtitle}>
              {selectedBranch?.name || "Hệ sinh thái LuxCare"} · {visibleItems.length} dịch vụ
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === "grid" && styles.toggleBtnActive]}
            onPress={() => setViewMode("grid")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="grid"
              size={17}
              color={viewMode === "grid" ? "#059669" : "#64748b"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === "list" && styles.toggleBtnActive]}
            onPress={() => setViewMode("list")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="list"
              size={18}
              color={viewMode === "list" ? "#059669" : "#64748b"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input Box */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm chức năng, phân hệ, nghiệp vụ..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearSearchBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills (Filter Chips) */}
      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const count =
              cat.id === "all"
                ? visibleItems.length
                : visibleItems.filter((i) => i.category === cat.id).length;

            if (cat.id !== "all" && count === 0) return null;

            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.chip,
                  isSelected && styles.chipActive,
                  isSelected && { borderColor: cat.color },
                ]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={isSelected ? cat.color : "#64748b"}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.chipText, isSelected && { color: cat.color, fontWeight: "700" }]}>
                  {cat.shortTitle}
                </Text>
                <View
                  style={[
                    styles.chipBadge,
                    isSelected && { backgroundColor: `${cat.color}20` },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipBadgeText,
                      isSelected && { color: cat.color, fontWeight: "700" },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* If grouped view (All categories & No search query) */}
        {groupedSections ? (
          groupedSections.map(({ category, items }) => (
            <View key={category.id} style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: `${category.color}15` }]}>
                  <Ionicons name={category.icon} size={16} color={category.color} />
                </View>
                <Text style={styles.sectionTitle}>{category.title}</Text>
                <View style={styles.sectionCountPill}>
                  <Text style={styles.sectionCountText}>{items.length}</Text>
                </View>
              </View>

              {viewMode === "grid" ? (
                <View style={styles.gridRow}>
                  {items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.gridItem}
                      onPress={() => handleOpenItem(item)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.gridIconBox, { backgroundColor: item.bgColor }]}>
                        <Ionicons name={item.icon} size={24} color={item.color} />
                        {Boolean(item.badge) && (
                          <View style={styles.badgeWrapper}>
                            <Text style={styles.badgeText}>{item.badge}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.gridTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {items.map((item, idx) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.listItem,
                        idx < items.length - 1 && styles.listItemBorder,
                      ]}
                      onPress={() => handleOpenItem(item)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.listIconBox, { backgroundColor: item.bgColor }]}>
                        <Ionicons name={item.icon} size={20} color={item.color} />
                      </View>
                      <View style={styles.listTextContent}>
                        <View style={styles.listTitleRow}>
                          <Text style={styles.listTitle}>
                            {item.title.replace("\n", " ")}
                          </Text>
                          {Boolean(item.badge) && (
                            <View style={styles.listBadge}>
                              <Text style={styles.listBadgeText}>{item.badge}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.listSubtitle} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))
        ) : (
          /* Filtered view by category or search */
          <View style={styles.sectionContainer}>
            {searchQuery.trim() ? (
              <Text style={styles.searchResultNotice}>
                Kết quả tìm kiếm cho "{searchQuery}" ({filteredItems.length})
              </Text>
            ) : null}

            {filteredItems.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>Không tìm thấy chức năng</Text>
                <Text style={styles.emptyDesc}>
                  Thử tìm kiếm với từ khóa khác như "lương", "ca trực", "tuyển dụng"...
                </Text>
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resetBtnText}>Xem tất cả chức năng</Text>
                </TouchableOpacity>
              </View>
            ) : viewMode === "grid" ? (
              <View style={styles.gridRow}>
                {filteredItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.gridItem}
                    onPress={() => handleOpenItem(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.gridIconBox, { backgroundColor: item.bgColor }]}>
                      <Ionicons name={item.icon} size={24} color={item.color} />
                      {Boolean(item.badge) && (
                        <View style={styles.badgeWrapper}>
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.gridTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.listContainer}>
                {filteredItems.map((item, idx) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.listItem,
                      idx < filteredItems.length - 1 && styles.listItemBorder,
                    ]}
                    onPress={() => handleOpenItem(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.listIconBox, { backgroundColor: item.bgColor }]}>
                      <Ionicons name={item.icon} size={20} color={item.color} />
                    </View>
                    <View style={styles.listTextContent}>
                      <View style={styles.listTitleRow}>
                        <Text style={styles.listTitle}>
                          {item.title.replace("\n", " ")}
                        </Text>
                        {Boolean(item.badge) && (
                          <View style={styles.listBadge}>
                            <Text style={styles.listBadgeText}>{item.badge}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.listSubtitle} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  toggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },

  // Search
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: "#ffffff",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 6,
  },
  clearSearchBtn: {
    padding: 4,
  },

  // Category Filter Chips
  chipsWrapper: {
    backgroundColor: "#ffffff",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  chipBadge: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 6,
  },
  chipBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
  },

  // Scroll Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
    gap: 16,
  },

  // Section
  sectionContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  sectionCountPill: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },

  // Grid view (4 columns)
  gridRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 16,
  },
  gridItem: {
    width: "25%",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  gridIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    position: "relative",
  },
  badgeWrapper: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: "#e11d48",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "800",
  },
  gridTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    textAlign: "center",
    lineHeight: 14,
  },

  // List view
  listContainer: {
    gap: 2,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 4,
    gap: 12,
  },
  listItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  listIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  listTextContent: {
    flex: 1,
  },
  listTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  listBadge: {
    backgroundColor: "#e11d48",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  listBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700",
  },
  listSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },

  // Empty State & Search notice
  searchResultNotice: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 4,
  },
  emptyDesc: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 18,
  },
  resetBtn: {
    marginTop: 10,
    backgroundColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  resetBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
});