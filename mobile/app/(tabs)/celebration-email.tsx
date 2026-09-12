import { useAppAlert } from "../../src/components/AppAlert";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { companyEmail } from "../../src/api/services";
import { useSession } from "../../src/auth/SessionProvider";
import { hasPermission } from "../../src/auth/access";
import type {
  CelebrationConfig,
  CelebrationDeliveryRecord,
  CelebrationStats,
} from "../../../src/services/companyEmailService";

const defaultCelebrationConfig: CelebrationConfig = {
  birthdayEnabled: true,
  holidayEnabled: true,
  sendTime: "08:00",
  birthdayTemplate: {
    subject: "Chúc mừng sinh nhật {{employeeName}}",
    html: "<p>Chúc mừng sinh nhật <strong>{{employeeName}}</strong>! Chúc bạn tuổi mới nhiều sức khỏe, niềm vui và thành công cùng {{companyName}}.</p>",
  },
  holidayTemplate: {
    subject: "Chúc mừng {{holidayName}}",
    html: "<p>{{companyName}} thân gửi lời chúc tốt đẹp nhất nhân dịp {{holidayName}}. Chúc bạn và gia đình có một kỳ nghỉ thật ấm áp và hạnh phúc!</p>",
  },
  holidayOverrides: [],
};

export default function CelebrationEmailScreen() {
  const { showAlert, alertView } = useAppAlert();
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const { user } = useSession();
  const isManager = ["admin", "superadmin", "branch_owner", "manager"].includes(user?.role || "");
  const canAccess = isManager || hasPermission(user, "company-email:manage");

  const [activeTab, setActiveTab] = useState<"config" | "history">("config");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [config, setConfig] = useState<CelebrationConfig | null>(null);
  const [stats, setStats] = useState<CelebrationStats>({ totalEmployees: 0, missingBirthDate: 0 });
  const [history, setHistory] = useState<CelebrationDeliveryRecord[]>([]);

  // Preview Modal
  const [previewItem, setPreviewItem] = useState<{
    title: string;
    subject: string;
    content: string;
  } | null>(null);

  // Edit Template Modal
  const [editingTemplate, setEditingTemplate] = useState<{
    type: "birthday" | "holiday";
    title: string;
    subject: string;
    html: string;
  } | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editHtml, setEditHtml] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Time Picker Modal
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [customTime, setCustomTime] = useState("");

  const loadData = useCallback(async () => {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [confRes, statsRes, histRes] = await Promise.allSettled([
        companyEmail.getCelebration(),
        companyEmail.getStats(),
        companyEmail.getHistory(),
      ]);

      if (confRes.status === "fulfilled") {
        setConfig(confRes.value || defaultCelebrationConfig);
      }
      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value);
      }
      if (histRes.status === "fulfilled") {
        setHistory(histRes.value || []);
      }
    } catch (e: any) {
      setError(e.message || "Không thể tải dữ liệu email chúc mừng.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canAccess]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadData();
    }, [loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const stripHtml = (html?: string) => {
    if (!html) return "";
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  };

  const handleToggleBirthday = async (value: boolean) => {
    if (!config) return;
    const nextConfig: CelebrationConfig = { ...config, birthdayEnabled: value };
    setConfig(nextConfig);
    try {
      await companyEmail.saveCelebration(nextConfig);
    } catch (err: any) {
      setConfig(config);
      showAlert("Lỗi", err.message || "Không thể cập nhật cấu hình.", undefined, "error");
    }
  };

  const handleToggleHoliday = async (value: boolean) => {
    if (!config) return;
    const nextConfig: CelebrationConfig = { ...config, holidayEnabled: value };
    setConfig(nextConfig);
    try {
      await companyEmail.saveCelebration(nextConfig);
    } catch (err: any) {
      setConfig(config);
      showAlert("Lỗi", err.message || "Không thể cập nhật cấu hình.", undefined, "error");
    }
  };

  const handleSaveSendTime = async (time: string) => {
    if (!config) return;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      showAlert("Lỗi", "Giờ gửi phải đúng định dạng HH:mm (ví dụ 08:00).", undefined, "error");
      return;
    }
    const nextConfig: CelebrationConfig = { ...config, sendTime: time };
    setConfig(nextConfig);
    try {
      await companyEmail.saveCelebration(nextConfig);
      setTimePickerOpen(false);
      showAlert("Thành công", `Đã đặt giờ gửi tự động là ${time}.`, undefined, "success");
    } catch (err: any) {
      setConfig(config);
      showAlert("Lỗi", err.message || "Không thể cập nhật giờ gửi.", undefined, "error");
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate || !config) return;
    if (!editSubject.trim()) {
      showAlert("Lỗi", "Tiêu đề thư không được để trống.", undefined, "error");
      return;
    }
    if (!editHtml.trim()) {
      showAlert("Lỗi", "Nội dung thư không được để trống.", undefined, "error");
      return;
    }
    setSavingTemplate(true);
    try {
      const updatedConfig: CelebrationConfig = {
        ...config,
        birthdayTemplate:
          editingTemplate.type === "birthday"
            ? { subject: editSubject.trim(), html: editHtml.trim() }
            : config.birthdayTemplate,
        holidayTemplate:
          editingTemplate.type === "holiday"
            ? { subject: editSubject.trim(), html: editHtml.trim() }
            : config.holidayTemplate,
      };
      await companyEmail.saveCelebration(updatedConfig);
      setConfig(updatedConfig);
      setEditingTemplate(null);
      showAlert("Thành công", "Đã lưu mẫu thư chúc mừng.", undefined, "success");
    } catch (err: any) {
      showAlert("Lỗi", err.message || "Không thể lưu cấu hình mẫu thư.", undefined, "error");
    } finally {
      setSavingTemplate(false);
    }
  };

  const insertVariableTag = (tag: string) => {
    setEditHtml((prev) => prev + ` {{${tag}}}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (params.from === "modules") router.replace("/(tabs)/modules");
            else if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/modules");
          }}
          style={styles.backBtn}
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Email chúc mừng</Text>
          <Text style={styles.headerSubtitle}>Tự động gửi lời chúc sinh nhật & ngày lễ</Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color="#0284c7" />
        </Pressable>
      </View>

      {!canAccess ? (
        <View style={styles.unauthorizedWrap}>
          <Ionicons name="lock-closed-outline" size={48} color="#94a3b8" />
          <Text style={styles.unauthorizedTitle}>Chưa được phân quyền</Text>
          <Text style={styles.unauthorizedDesc}>
            Bạn cần quyền quản lý email chúc mừng hoặc tài khoản quản trị để xem phân hệ này.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0284c7"]} />}
        >
          {/* Stats Section */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
              <View style={styles.statIconWrap}>
                <Ionicons name="people" size={20} color="#16a34a" />
              </View>
              <Text style={styles.statNumber}>{stats.totalEmployees}</Text>
              <Text style={styles.statLabel}>Tổng nhân sự</Text>
            </View>

            <View
              style={[
                styles.statCard,
                stats.missingBirthDate > 0
                  ? { backgroundColor: "#fff1f2", borderColor: "#fecdd3" }
                  : { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" },
              ]}
            >
              <View style={styles.statIconWrap}>
                <Ionicons
                  name={stats.missingBirthDate > 0 ? "alert-circle" : "checkmark-circle"}
                  size={20}
                  color={stats.missingBirthDate > 0 ? "#e11d48" : "#10b981"}
                />
              </View>
              <Text
                style={[
                  styles.statNumber,
                  stats.missingBirthDate > 0 ? { color: "#e11d48" } : { color: "#1e293b" },
                ]}
              >
                {stats.missingBirthDate}
              </Text>
              <Text style={styles.statLabel}>Thiếu ngày sinh</Text>
            </View>

            <Pressable
              onPress={() => setTimePickerOpen(true)}
              style={[styles.statCard, { backgroundColor: "#f0f9ff", borderColor: "#bae6fd" }]}
            >
              <View style={styles.statIconWrap}>
                <Ionicons name="time" size={20} color="#0284c7" />
              </View>
              <Text style={styles.statNumber}>{config?.sendTime || "08:00"}</Text>
              <Text style={styles.statLabel}>Giờ gửi VN ⚙️</Text>
            </Pressable>
          </View>

          {stats.missingBirthDate > 0 && (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={18} color="#d97706" style={{ marginTop: 2 }} />
              <Text style={styles.warningText}>
                Có <Text style={{ fontWeight: "700" }}>{stats.missingBirthDate}</Text> nhân sự chưa có ngày sinh. Hệ thống
                chỉ tự động gửi thư khi nhân sự được cập nhật ngày sinh trong hồ sơ.
              </Text>
            </View>
          )}

          {/* Tab Selection */}
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => setActiveTab("config")}
              style={[styles.tabItem, activeTab === "config" && styles.tabItemActive]}
            >
              <Ionicons
                name="settings-outline"
                size={16}
                color={activeTab === "config" ? "#0284c7" : "#64748b"}
              />
              <Text style={[styles.tabText, activeTab === "config" && styles.tabTextActive]}>
                Cấu hình & Mẫu thư
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("history")}
              style={[styles.tabItem, activeTab === "history" && styles.tabItemActive]}
            >
              <Ionicons
                name="time-outline"
                size={16}
                color={activeTab === "history" ? "#0284c7" : "#64748b"}
              />
              <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>
                Lịch sử gửi ({history.length})
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#0284c7" />
              <Text style={styles.loadingText}>Đang tải cấu hình email...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={24} color="#e11d48" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : activeTab === "config" ? (
            /* Tab: Cấu hình & Mẫu */
            <View style={styles.tabContent}>
              {/* Automation Toggles Card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Tự động hóa hệ thống</Text>

                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <Text style={styles.switchTitle}>Tự động gửi sinh nhật</Text>
                    <Text style={styles.switchDesc}>Quét và gửi email chúc mừng theo ngày sinh nhân sự</Text>
                  </View>
                  <Switch
                    value={config?.birthdayEnabled ?? true}
                    onValueChange={handleToggleBirthday}
                    trackColor={{ false: "#cbd5e1", true: "#bae6fd" }}
                    thumbColor={config?.birthdayEnabled ? "#0284c7" : "#f1f5f9"}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <Text style={styles.switchTitle}>Tự động gửi lễ / Tết</Text>
                    <Text style={styles.switchDesc}>Gửi thư chúc mừng các ngày lễ theo lịch công ty</Text>
                  </View>
                  <Switch
                    value={config?.holidayEnabled ?? true}
                    onValueChange={handleToggleHoliday}
                    trackColor={{ false: "#cbd5e1", true: "#bae6fd" }}
                    thumbColor={config?.holidayEnabled ? "#0284c7" : "#f1f5f9"}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <Text style={styles.switchTitle}>Khung giờ gửi tự động</Text>
                    <Text style={styles.switchDesc}>Hệ thống quét định kỳ và gửi sau thời gian này</Text>
                  </View>
                  <Pressable onPress={() => setTimePickerOpen(true)} style={styles.timePill}>
                    <Ionicons name="alarm-outline" size={14} color="#0284c7" />
                    <Text style={styles.timePillText}>{config?.sendTime || "08:00"} hàng ngày ✎</Text>
                  </Pressable>
                </View>
              </View>

              {/* Birthday Template Card */}
              <View style={styles.card}>
                <View style={styles.cardHeaderWithAction}>
                  <View style={styles.cardHeaderLeft}>
                    <Ionicons name="gift-outline" size={18} color="#db2777" />
                    <Text style={styles.cardTitle}>Mẫu thư sinh nhật</Text>
                  </View>
                  <View style={styles.actionButtonsRow}>
                    <Pressable
                      onPress={() =>
                        setPreviewItem({
                          title: "Mẫu chúc mừng sinh nhật",
                          subject: config?.birthdayTemplate?.subject || "Chúc mừng sinh nhật {{employeeName}}",
                          content: config?.birthdayTemplate?.html || "Chúc mừng sinh nhật bạn!",
                        })
                      }
                      style={styles.previewBtn}
                    >
                      <Ionicons name="eye-outline" size={14} color="#0284c7" />
                      <Text style={styles.previewBtnText}>Xem</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setEditingTemplate({
                          type: "birthday",
                          title: "Chỉnh sửa mẫu thư sinh nhật",
                          subject: config?.birthdayTemplate?.subject || "Chúc mừng sinh nhật {{employeeName}}",
                          html: config?.birthdayTemplate?.html || "",
                        });
                        setEditSubject(config?.birthdayTemplate?.subject || "Chúc mừng sinh nhật {{employeeName}}");
                        setEditHtml(config?.birthdayTemplate?.html || "");
                      }}
                      style={styles.editBtn}
                    >
                      <Ionicons name="create-outline" size={14} color="#ffffff" />
                      <Text style={styles.editBtnText}>Sửa mẫu</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.templateField}>
                  <Text style={styles.fieldLabel}>Tiêu đề thư:</Text>
                  <Text style={styles.fieldValueBold}>
                    {config?.birthdayTemplate?.subject || "Chúc mừng sinh nhật {{employeeName}}"}
                  </Text>
                </View>

                <View style={styles.templateField}>
                  <Text style={styles.fieldLabel}>Nội dung thư:</Text>
                  <Text style={styles.fieldValueSnippet} numberOfLines={4}>
                    {stripHtml(config?.birthdayTemplate?.html) || "Chưa có nội dung mẫu."}
                  </Text>
                </View>
              </View>

              {/* Holiday Template Card */}
              <View style={styles.card}>
                <View style={styles.cardHeaderWithAction}>
                  <View style={styles.cardHeaderLeft}>
                    <Ionicons name="sparkles-outline" size={18} color="#ea580c" />
                    <Text style={styles.cardTitle}>Mẫu thư lễ & Tết</Text>
                  </View>
                  <View style={styles.actionButtonsRow}>
                    <Pressable
                      onPress={() =>
                        setPreviewItem({
                          title: "Mẫu chúc mừng Lễ / Tết",
                          subject: config?.holidayTemplate?.subject || "Chúc mừng {{holidayName}}",
                          content: config?.holidayTemplate?.html || "Kính chúc bạn một kỳ nghỉ vui vẻ!",
                        })
                      }
                      style={styles.previewBtn}
                    >
                      <Ionicons name="eye-outline" size={14} color="#0284c7" />
                      <Text style={styles.previewBtnText}>Xem</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setEditingTemplate({
                          type: "holiday",
                          title: "Chỉnh sửa mẫu thư lễ & Tết",
                          subject: config?.holidayTemplate?.subject || "Chúc mừng {{holidayName}}",
                          html: config?.holidayTemplate?.html || "",
                        });
                        setEditSubject(config?.holidayTemplate?.subject || "Chúc mừng {{holidayName}}");
                        setEditHtml(config?.holidayTemplate?.html || "");
                      }}
                      style={styles.editBtn}
                    >
                      <Ionicons name="create-outline" size={14} color="#ffffff" />
                      <Text style={styles.editBtnText}>Sửa mẫu</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.templateField}>
                  <Text style={styles.fieldLabel}>Tiêu đề thư:</Text>
                  <Text style={styles.fieldValueBold}>
                    {config?.holidayTemplate?.subject || "Chúc mừng {{holidayName}}"}
                  </Text>
                </View>

                <View style={styles.templateField}>
                  <Text style={styles.fieldLabel}>Nội dung thư:</Text>
                  <Text style={styles.fieldValueSnippet} numberOfLines={4}>
                    {stripHtml(config?.holidayTemplate?.html) || "Chưa có nội dung mẫu."}
                  </Text>
                </View>
              </View>

              <View style={styles.tipBox}>
                <Ionicons name="bulb-outline" size={16} color="#0284c7" />
                <Text style={styles.tipText}>
                  💡 Các biến tự động hỗ trợ: <Text style={{ fontWeight: "700" }}>{"{{employeeName}}"}</Text>,{" "}
                  <Text style={{ fontWeight: "700" }}>{"{{companyName}}"}</Text>,{" "}
                  <Text style={{ fontWeight: "700" }}>{"{{holidayName}}"}</Text>. Nhấn "Sửa mẫu" để thay đổi lời chúc theo phong cách của công ty.
                </Text>
              </View>
            </View>
          ) : (
            /* Tab: Lịch sử gửi */
            <View style={styles.tabContent}>
              {history.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="mail-unread-outline" size={48} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>Chưa có lịch sử gửi</Text>
                  <Text style={styles.emptySubtitle}>
                    Khi đến giờ chạy hoặc ngày lễ/sinh nhật của nhân sự, nhật ký gửi thư sẽ xuất hiện tại đây.
                  </Text>
                </View>
              ) : (
                history.map((item) => {
                  const isSuccess = item.status === "sent";
                  const isFailed = item.status === "failed";
                  return (
                    <View key={item._id} style={styles.historyCard}>
                      <View style={styles.historyCardHeader}>
                        <View style={styles.historyEventTag}>
                          <Ionicons
                            name={item.eventType === "birthday" ? "gift" : "sparkles"}
                            size={12}
                            color={item.eventType === "birthday" ? "#db2777" : "#ea580c"}
                          />
                          <Text
                            style={[
                              styles.historyEventText,
                              item.eventType === "birthday" ? { color: "#db2777" } : { color: "#ea580c" },
                            ]}
                          >
                            {item.eventType === "birthday" ? "Sinh nhật" : "Ngày lễ"}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.badge,
                            isSuccess && styles.badgeSuccess,
                            isFailed && styles.badgeFailed,
                            !isSuccess && !isFailed && styles.badgePending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              isSuccess && styles.badgeTextSuccess,
                              isFailed && styles.badgeTextFailed,
                              !isSuccess && !isFailed && styles.badgeTextPending,
                            ]}
                          >
                            {isSuccess ? "ĐÃ GỬI" : isFailed ? "THẤT BẠI" : "ĐANG GỬI"}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.historySubject} numberOfLines={1}>
                        {item.subject}
                      </Text>

                      <View style={styles.historyDetails}>
                        <Text style={styles.historyRecipient}>
                          <Ionicons name="mail-outline" size={12} color="#64748b" /> {item.recipientEmail}
                        </Text>
                        <Text style={styles.historyDate}>
                          <Ionicons name="calendar-outline" size={12} color="#64748b" /> {item.eventDate}
                        </Text>
                      </View>

                      {item.error ? (
                        <View style={styles.historyErrorBox}>
                          <Text style={styles.historyErrorText} numberOfLines={2}>
                            Lỗi: {item.error}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Edit Template Modal */}
      <Modal visible={!!editingTemplate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: "92%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons
                  name={editingTemplate?.type === "birthday" ? "gift" : "sparkles"}
                  size={18}
                  color={editingTemplate?.type === "birthday" ? "#db2777" : "#ea580c"}
                />
                <Text style={styles.modalTitle}>{editingTemplate?.title}</Text>
              </View>
              <Pressable onPress={() => setEditingTemplate(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={styles.inputLabel}>Tiêu đề thư *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Nhập tiêu đề thư..."
                placeholderTextColor="#94a3b8"
                value={editSubject}
                onChangeText={setEditSubject}
              />

              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputLabel}>Chèn biến động nhanh:</Text>
                <View style={styles.variableChipsRow}>
                  <Pressable onPress={() => insertVariableTag("employeeName")} style={styles.variableChip}>
                    <Text style={styles.variableChipText}>+ Tên nhân viên</Text>
                  </Pressable>
                  <Pressable onPress={() => insertVariableTag("companyName")} style={styles.variableChip}>
                    <Text style={styles.variableChipText}>+ Tên công ty</Text>
                  </Pressable>
                  {editingTemplate?.type === "holiday" && (
                    <Pressable onPress={() => insertVariableTag("holidayName")} style={styles.variableChip}>
                      <Text style={styles.variableChipText}>+ Tên ngày lễ</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Nội dung email (Văn bản / HTML) *</Text>
              <TextInput
                style={[styles.textInput, { height: 180, textAlignVertical: "top" }]}
                placeholder="Nhập nội dung thư chúc mừng..."
                placeholderTextColor="#94a3b8"
                multiline
                value={editHtml}
                onChangeText={setEditHtml}
              />

              <View style={styles.tipBox}>
                <Ionicons name="information-circle-outline" size={16} color="#0284c7" />
                <Text style={styles.tipText}>
                  Bạn có thể dùng thẻ HTML cơ bản như &lt;p&gt;, &lt;strong&gt;, &lt;br/&gt; hoặc văn bản thuần. Các biến như {"{{employeeName}}"}, {"{{companyName}}"} sẽ tự động được thế giá trị khi gửi thư.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() =>
                    setPreviewItem({
                      title: `Xem trước: ${editingTemplate?.title}`,
                      subject: editSubject,
                      content: editHtml,
                    })
                  }
                  style={styles.modalSecondaryBtn}
                >
                  <Ionicons name="eye-outline" size={16} color="#0284c7" />
                  <Text style={styles.modalSecondaryBtnText}>Xem trước</Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveTemplate}
                  disabled={savingTemplate || !editSubject.trim() || !editHtml.trim()}
                  style={[
                    styles.modalPrimaryBtn,
                    { flex: 1 },
                    (!editSubject.trim() || !editHtml.trim() || savingTemplate) && { backgroundColor: "#94a3b8" },
                  ]}
                >
                  {savingTemplate ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Lưu mẫu thư</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Send Time Picker Modal */}
      <Modal visible={timePickerOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: 360 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn giờ gửi tự động</Text>
              <Pressable onPress={() => setTimePickerOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>

            <View style={styles.modalContent}>
              <Text style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                Chọn khung giờ hệ thống sẽ quét và gửi thư chúc mừng mỗi ngày:
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {["07:00", "07:30", "08:00", "08:30", "09:00", "09:30"].map((time) => (
                  <Pressable
                    key={time}
                    onPress={() => handleSaveSendTime(time)}
                    style={[
                      styles.timeOptionPill,
                      config?.sendTime === time && styles.timeOptionPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeOptionText,
                        config?.sendTime === time && styles.timeOptionTextActive,
                      ]}
                    >
                      {time}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.inputLabel}>Hoặc nhập giờ khác (HH:mm)</Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="VD: 08:15"
                  placeholderTextColor="#94a3b8"
                  value={customTime}
                  onChangeText={setCustomTime}
                  maxLength={5}
                />
                <Pressable
                  onPress={() => handleSaveSendTime(customTime.trim())}
                  disabled={!customTime.trim()}
                  style={[styles.modalPrimaryBtn, { paddingHorizontal: 16, height: 44, justifyContent: "center" }]}
                >
                  <Text style={styles.modalPrimaryBtnText}>Áp dụng</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Modal visible={!!previewItem} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{previewItem?.title}</Text>
              <Pressable onPress={() => setPreviewItem(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.previewMetaBox}>
                <Text style={styles.previewMetaLine}>
                  <Text style={{ fontWeight: "700" }}>Từ:</Text> LuxCare &lt;noreply@luxcare.vn&gt;
                </Text>
                <Text style={styles.previewMetaLine}>
                  <Text style={{ fontWeight: "700" }}>Đến:</Text> nguyenvana@doanhnghiep.vn
                </Text>
                <Text style={styles.previewMetaSubject}>
                  {previewItem?.subject
                    ?.replace(/{{employeeName}}/g, "Nguyễn Văn An")
                    ?.replace(/{{companyName}}/g, user?.companyName || "LuxCare Hospital")
                    ?.replace(/{{holidayName}}/g, "Tết Nguyên Đán")}
                </Text>
              </View>

              <View style={styles.previewBodyBox}>
                <Text style={styles.previewBodyText}>
                  {stripHtml(
                    previewItem?.content
                      ?.replace(/{{employeeName}}/g, "Nguyễn Văn An")
                      ?.replace(/{{companyName}}/g, user?.companyName || "LuxCare Hospital")
                      ?.replace(/{{holidayName}}/g, "Tết Nguyên Đán"),
                  )}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable onPress={() => setPreviewItem(null)} style={styles.modalPrimaryBtn}>
                <Text style={styles.modalPrimaryBtnText}>Đóng xem trước</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {alertView}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
    borderRadius: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f0f9ff",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  statIconWrap: {
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 2,
    textAlign: "center",
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400e",
    lineHeight: 18,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  tabTextActive: {
    color: "#0284c7",
    fontWeight: "700",
  },
  tabContent: {
    gap: 14,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardHeaderWithAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284c7",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#0284c7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  switchInfo: {
    flex: 1,
    paddingRight: 12,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  switchDesc: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 10,
  },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  timePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284c7",
  },
  timeOptionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  timeOptionPillActive: {
    backgroundColor: "#0284c7",
    borderColor: "#0284c7",
  },
  timeOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  timeOptionTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  templateField: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 2,
  },
  fieldValueBold: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  fieldValueSnippet: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
  historyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  historyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  historyEventTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyEventText: {
    fontSize: 12,
    fontWeight: "700",
  },
  historySubject: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  historyDetails: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  historyRecipient: {
    fontSize: 11,
    color: "#64748b",
  },
  historyDate: {
    fontSize: 11,
    color: "#64748b",
  },
  historyErrorBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#fff1f2",
    borderRadius: 6,
  },
  historyErrorText: {
    fontSize: 11,
    color: "#e11d48",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeSuccess: {
    backgroundColor: "#dcfce7",
  },
  badgeFailed: {
    backgroundColor: "#fee2e2",
  },
  badgePending: {
    backgroundColor: "#fef3c7",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  badgeTextSuccess: {
    color: "#16a34a",
  },
  badgeTextFailed: {
    color: "#dc2626",
  },
  badgeTextPending: {
    color: "#d97706",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
  },
  errorBox: {
    alignItems: "center",
    padding: 24,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: "#e11d48",
    textAlign: "center",
  },
  emptyWrap: {
    alignItems: "center",
    padding: 36,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475569",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
  },
  unauthorizedWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  unauthorizedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
  },
  unauthorizedDesc: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalContent: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  variableChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  variableChip: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  variableChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  previewMetaBox: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
    gap: 4,
  },
  previewMetaLine: {
    fontSize: 12,
    color: "#475569",
  },
  previewMetaSubject: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 6,
  },
  previewBodyBox: {
    padding: 14,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  previewBodyText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 20,
  },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  modalPrimaryBtn: {
    backgroundColor: "#0284c7",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  modalSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0f9ff",
    borderColor: "#bae6fd",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  modalSecondaryBtnText: {
    color: "#0284c7",
    fontWeight: "700",
    fontSize: 14,
  },
});
