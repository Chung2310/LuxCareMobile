import { useCallback, useState } from "react";
import { Alert, Image, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { DashboardSummary, DashboardActionItems } from "../../../src/types/dashboard";
import type { DashboardSummaryParams } from "../../../src/services/dashboardService";
import { dashboard } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { Card, ErrorText, Field, Loading, colors, styles } from "../../src/ui";
import { customDashboardRange } from "../../src/features/dashboard/range";
import { canUseModule } from "../../src/auth/access";

function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        localStyles.roundedButton,
        disabled && localStyles.roundedButtonDisabled,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={localStyles.roundedButtonText}>{title}</Text>
    </Pressable>
  );
}
export default function Home() {
  const { user, selectedBranch } = useSession();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [params, setParams] = useState<DashboardSummaryParams>({ filter: "day" });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [actions, setActions] = useState<DashboardActionItems | null>(null);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionsRevision, setActionsRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const allowed = user?.permissions?.some((p) => p === "*" || p === "dashboard:read") ?? false;
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setData(null);
      setError(null);
      if (!allowed) return;
      setLoading(true);
      void dashboard
        .getSummary(params)
        .then((value) => {
          if (active) setData(value);
        })
        .catch((error) => {
          if (active) setError(messageOf(error));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [params, revision, allowed, user?.uid]),
  );
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setActions(null);
      setActionsError(null);
      if (!allowed) return;
      setActionsLoading(true);
      void dashboard
        .getActionItems()
        .then((value) => {
          if (active) setActions(value);
        })
        .catch((error) => {
          if (active) setActionsError(messageOf(error));
        })
        .finally(() => {
          if (active) setActionsLoading(false);
        });
      return () => {
        active = false;
      };
    }, [allowed, user?.uid, selectedBranch?._id, actionsRevision]),
  );
  return (
    <View style={localStyles.container}>
      {/* 1/4 Gradient xanh lá phía trên, nhạt dần xuống màu trắng */}
      <Image
        source={require("../../assets/gradient-top.png")}
        style={localStyles.topGradient}
        resizeMode="stretch"
      />

      <SafeAreaView edges={["top"]} style={localStyles.safeArea}>
        <ScrollView
          style={localStyles.scrollView}
          contentContainerStyle={localStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Bar with Settings on the left, User and Bell on the right */}
          <View style={localStyles.topBar}>
            <Pressable
              onPress={() => router.push("/(tabs)/profile")}
              style={({ pressed }) => [
                localStyles.iconButton,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cài đặt"
            >
              <Image
                source={require("../../assets/lucide-settings.png")}
                style={localStyles.topBarIcon}
                resizeMode="contain"
              />
            </Pressable>

            <View style={localStyles.topBarRight}>
              <Pressable
                onPress={() => router.push("/(tabs)/profile")}
                style={({ pressed }) => [
                  localStyles.iconButton,
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tài khoản"
              >
                <Image
                  source={require("../../assets/lucide-user.png")}
                  style={localStyles.topBarIcon}
                  resizeMode="contain"
                />
              </Pressable>
              <Pressable
                onPress={() => router.push("/(tabs)/notifications")}
                style={({ pressed }) => [
                  localStyles.iconButton,
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Thông báo"
              >
                <Image
                  source={require("../../assets/lucide-bell.png")}
                  style={localStyles.topBarIcon}
                  resizeMode="contain"
                />
              </Pressable>
            </View>
          </View>

          {/* Greeting Header Card with bg-hello-dashboard.png */}
        <View style={localStyles.greetingCard}>
          <ImageBackground
            source={require("../../public/bg-hello-dashboard.png")}
            style={localStyles.greetingBackground}
            imageStyle={localStyles.greetingBackgroundImage}
            resizeMode="cover"
          >
            <View style={localStyles.greetingContent}>
              <Text style={localStyles.greetingTitle}>
                <Text style={localStyles.greetingCursive}>Xin chào</Text>,{" "}
                <Text style={localStyles.greetingUserName}>{user?.displayName || "bạn"}!</Text>
              </Text>
              <Text style={localStyles.greetingSubtitle}>
                Chúc bạn có một ngày làm việc hiệu quả!
              </Text>
              {(user?.companyName || selectedBranch?.name || user?.branchName) && (
                <Text style={localStyles.greetingMeta}>
                  {user?.companyName || ""}
                  {selectedBranch?.name || user?.branchName
                    ? ` · ${selectedBranch?.name || user?.branchName}`
                    : ""}
                </Text>
              )}
            </View>
          </ImageBackground>
        </View>

        {/* Thẻ Đi đến bảng tin nằm ngay dưới Card Hello */}
        <Pressable
          onPress={() => Alert.alert("Bảng tin", "Tính năng bảng tin đang được hoàn thiện.")}
          style={({ pressed }) => [
            localStyles.newsfeedCard,
            pressed && { opacity: 0.8 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Đi đến bảng tin"
        >
          <View style={localStyles.newsfeedCardLeft}>
            <Image
              source={require("../../assets/lucide-megaphone.png")}
              style={localStyles.newsfeedIcon}
              resizeMode="contain"
            />
            <Text style={localStyles.newsfeedText}>Đi đến bảng tin</Text>
          </View>
          <Image
            source={require("../../assets/lucide-chevron-right.png")}
            style={localStyles.newsfeedChevronIcon}
            resizeMode="contain"
          />
        </Pressable>

        {!allowed ? (
          <Card>
            <Text style={styles.text}>Tài khoản của bạn chưa được cấp quyền xem tổng quan.</Text>
          </Card>
        ) : (
        <>
          {/* 5 Thẻ thống kê KPI tổng quan ngay phía dưới bảng tin */}
          <View style={localStyles.metricsGrid}>
            {/* 1. Nhân sự đi làm */}
            <Pressable
              onPress={() => router.push("/(tabs)/attendance")}
              style={({ pressed }) => [
                localStyles.metricCard,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Nhân sự đi làm"
            >
              <View style={localStyles.metricCardTop}>
                <View style={[localStyles.metricBadge, { backgroundColor: "#ecfdf5" }]}>
                  <Image
                    source={require("../../assets/metric-users.png")}
                    style={localStyles.metricIcon}
                    resizeMode="contain"
                  />
                </View>
                <Text style={localStyles.metricLabel} numberOfLines={1}>
                  NHÂN SỰ ĐI LÀM
                </Text>
              </View>
              <Text style={[localStyles.metricValue, { color: "#059669" }]}>
                {data?.timekeeping
                  ? `${data.timekeeping.checkedInToday}/${data.timekeeping.totalEmployees}`
                  : "0/0"}
              </Text>
            </Pressable>

            {/* 2. Task đang làm */}
            <Pressable
              onPress={() => router.push("/(tabs)/work")}
              style={({ pressed }) => [
                localStyles.metricCard,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Task đang làm"
            >
              <View style={localStyles.metricCardTop}>
                <View style={[localStyles.metricBadge, { backgroundColor: "#eff6ff" }]}>
                  <Image
                    source={require("../../assets/metric-activity.png")}
                    style={localStyles.metricIcon}
                    resizeMode="contain"
                  />
                </View>
                <Text style={localStyles.metricLabel} numberOfLines={1}>
                  TASK ĐANG LÀM
                </Text>
              </View>
              <Text style={[localStyles.metricValue, { color: "#10b981" }]}>
                {data?.projects?.tasks?.doing ?? 0}
              </Text>
            </Pressable>

            {/* 3. Task quá hạn */}
            <Pressable
              onPress={() => router.push("/(tabs)/work")}
              style={({ pressed }) => [
                localStyles.metricCard,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Task quá hạn"
            >
              <View style={localStyles.metricCardTop}>
                <View style={[localStyles.metricBadge, { backgroundColor: "#fef2f2" }]}>
                  <Image
                    source={require("../../assets/metric-clock.png")}
                    style={localStyles.metricIcon}
                    resizeMode="contain"
                  />
                </View>
                <Text style={localStyles.metricLabel} numberOfLines={1}>
                  TASK QUÁ HẠN
                </Text>
              </View>
              <Text style={[localStyles.metricValue, { color: "#dc2626" }]}>
                {data?.projects?.overdueTasks ?? 0}
              </Text>
            </Pressable>

            {/* 4. Khóa đào tạo */}
            <Pressable
              onPress={() => Alert.alert("Đào tạo", `Hiện có ${data?.training?.totalCourses ?? 0} khóa đào tạo.`)}
              style={({ pressed }) => [
                localStyles.metricCard,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Khóa đào tạo"
            >
              <View style={localStyles.metricCardTop}>
                <View style={[localStyles.metricBadge, { backgroundColor: "#fffbeb" }]}>
                  <Image
                    source={require("../../assets/metric-graduation.png")}
                    style={localStyles.metricIcon}
                    resizeMode="contain"
                  />
                </View>
                <Text style={localStyles.metricLabel} numberOfLines={1}>
                  KHÓA ĐÀO TẠO
                </Text>
              </View>
              <Text style={[localStyles.metricValue, { color: "#ea580c" }]}>
                {data?.training?.totalCourses ?? 0}
              </Text>
            </Pressable>

            {/* 5. Thiết bị */}
            <Pressable
              onPress={() => Alert.alert("Thiết bị", `Hiện có ${data?.equipment?.total ?? 0} thiết bị trong hệ thống.`)}
              style={({ pressed }) => [
                localStyles.metricCard,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Thiết bị"
            >
              <View style={localStyles.metricCardTop}>
                <View style={[localStyles.metricBadge, { backgroundColor: "#f5f3ff" }]}>
                  <Image
                    source={require("../../assets/metric-file-text.png")}
                    style={localStyles.metricIcon}
                    resizeMode="contain"
                  />
                </View>
                <Text style={localStyles.metricLabel} numberOfLines={1}>
                  THIẾT BỊ
                </Text>
              </View>
              <Text style={[localStyles.metricValue, { color: "#059669" }]}>
                {data?.equipment?.total ?? 0}
              </Text>
            </Pressable>
          </View>

          <View style={localStyles.filterRow}>
            {(["day", "week", "year"] as const).map((value, i) => (
              <View key={value} style={{ flex: 1 }}>
                <Button
                  title={["Hôm nay", "Tuần", "Năm"][i]}
                  disabled={params.filter === value}
                  onPress={() => {
                    setParams({ filter: value });
                    setRangeError(null);
                  }}
                />
              </View>
            ))}
          </View>
          <Card>
            <Text style={styles.heading}>Khoảng ngày tùy chọn</Text>
            <Field label="Từ ngày (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} />
            <Field label="Đến ngày (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} />
            <ErrorText message={rangeError} />
            <Button
              title="Áp dụng khoảng ngày"
              onPress={() => {
                try {
                  setParams(customDashboardRange(startDate.trim(), endDate.trim()));
                  setRangeError(null);
                } catch (error) {
                  setRangeError(messageOf(error));
                }
              }}
            />
          </Card>
          <Text style={styles.muted}>
            Bộ lọc:{" "}
            {params.filter === "custom"
              ? `${params.startDate} – ${params.endDate}`
              : params.filter === "day"
                ? "Hôm nay"
                : params.filter === "week"
                  ? "7 ngày gần nhất"
                  : "Năm nay"}
            . Công việc và đào tạo là trạng thái hiện tại; chấm công theo hôm nay. Tài liệu mới tải lên áp dụng khoảng
            ngày.
          </Text>
          <ErrorText message={error} />
          {loading && <Loading />}
          {data && (
            <>
              <Card>
                <Text style={styles.heading}>Công việc</Text>
                <Text style={styles.title}>{data.projects.tasks.total}</Text>
                <Text style={styles.text}>
                  {data.projects.tasks.doing} đang làm · {data.projects.tasks.done} hoàn thành
                </Text>
                <Text style={styles.muted}>{data.projects.overdueTasks} quá hạn</Text>
                <Text style={styles.text}>{data.projects.activeProjects} dự án đang hoạt động</Text>
                {canUseModule(user, "hr") && (
                  <Button title="Mở công việc" onPress={() => router.push("/(tabs)/work")} />
                )}
              </Card>
              <Card>
                <Text style={styles.heading}>Chấm công hôm nay</Text>
                <Text style={styles.title}>
                  {data.timekeeping.checkedInToday} / {data.timekeeping.totalEmployees}
                </Text>
                <Text style={styles.muted}>{data.timekeeping.lateToday} đi muộn</Text>
              </Card>
              <Card>
                <Text style={styles.heading}>Tài nguyên & giao tiếp</Text>
                <Text style={styles.text}>
                  {data.resources.fileCount} tài liệu · {data.chat.unreadMessages} tin nhắn chưa đọc
                </Text>
                <Text style={styles.muted}>
                  {data.resources.recentUploads} tài liệu mới trong khoảng ngày · {data.chat.roomCount} phòng trò chuyện
                </Text>
              </Card>
              <Card>
                <Text style={styles.heading}>Đào tạo</Text>
                <Text style={styles.text}>
                  {data.training.totalCourses} khóa học · {data.training.ongoingCourses} đang diễn ra
                </Text>
                <Text style={styles.muted}>
                  {data.training.enrollments.completed}/{data.training.enrollments.total} lượt học hoàn thành
                </Text>
              </Card>
            </>
          )}
          <Card>
            <Text style={styles.heading}>Việc cần xử lý hôm nay</Text>
            <Text style={styles.muted}>Danh sách ưu tiên từ hệ thống, độc lập với bộ lọc ngày ở trên.</Text>
            <ErrorText message={actionsError} />
            {actionsLoading && <Loading />}
            {actions?.overdueTasks.map((item) => (
              <View key={`task:${item.id}`} style={{ gap: 8 }}>
                <Text style={styles.text}>Quá hạn: {item.title}</Text>
                <Text style={styles.muted}>{new Date(item.dueDate).toLocaleString("vi-VN")}</Text>
              </View>
            ))}
            {!!actions?.overdueTasks.length && canUseModule(user, "hr") && (
              <Button title="Xem danh sách công việc" onPress={() => router.push("/(tabs)/work")} />
            )}
            {actions?.pendingApprovals.map((item) => (
              <View key={`leave:${item.id}`} style={{ gap: 8 }}>
                <Text style={styles.text}>Đơn chờ duyệt: {item.employeeName}</Text>
                <Text style={styles.muted}>Từ {new Date(item.since).toLocaleDateString("vi-VN")}</Text>
              </View>
            ))}
            {!!actions?.pendingApprovals.length && canUseModule(user, "hr") && (
              <Button title="Mở đơn từ để xem và duyệt" onPress={() => router.push("/(tabs)/leave")} />
            )}
            {actions && !actions.overdueTasks.length && !actions.pendingApprovals.length && (
              <Text style={styles.muted}>Không có mục cần xử lý trong danh sách ưu tiên.</Text>
            )}
            {actionsError && (
              <Button
                title="Tải lại việc cần xử lý"
                disabled={actionsLoading}
                onPress={() => setActionsRevision((value) => value + 1)}
              />
            )}
          </Card>
          <Button
            title="Tải lại"
            disabled={loading || actionsLoading}
            onPress={() => {
              setRevision((v) => v + 1);
              setActionsRevision((value) => value + 1);
            }}
          />
        </>
      )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff", // 3/4 màn hình còn lại màu trắng
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    width: "100%", // Kéo dãn 100% chiều ngang màn hình
    height: 350, // Chiều cao bao trọn cả thanh icon và Card Xin chào
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 36,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: -4,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  newsfeedCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8, // Viền vuông bo góc tinh tế
    backgroundColor: "transparent", // Trong suốt hoàn toàn, không màu nền
    borderWidth: 1,
    borderColor: "rgba(6, 95, 70, 0.25)", // Viền vuông tinh tế
    marginTop: -4,
  },
  newsfeedCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  newsfeedIcon: {
    width: 20,
    height: 20,
    tintColor: "#065f46",
  },
  newsfeedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    letterSpacing: 0.1,
  },
  newsfeedChevronIcon: {
    width: 16,
    height: 16,
    tintColor: "#065f46",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 92,
    justifyContent: "space-between",
  },
  metricCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metricBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  metricIcon: {
    width: 18,
    height: 18,
  },
  metricLabel: {
    flex: 1,
    fontSize: 9,
    fontWeight: "800",
    color: "#334155",
    fontFamily: "Inter-Bold",
    letterSpacing: 0.2,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "800",
    marginTop: 8,
    fontFamily: "Inter-Bold",
    letterSpacing: -0.5,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.18)", // Siêu mờ nhạt, trong suốt nhìn rõ trọn vẹn background
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)", // Viền mờ nhẹ nhàng tinh tế
  },
  topBarIcon: {
    width: 22,
    height: 22,
    tintColor: "#0f172a", // Icon màu đậm nét, tương phản rõ trên nền trong suốt
  },
  greetingCard: {
    borderRadius: 22, // Bo góc mềm mại
    overflow: "hidden",
    backgroundColor: "#ffffff",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3, // Card nổi
    marginBottom: 4,
  },
  greetingBackground: {
    padding: 18,
    minHeight: 120,
    justifyContent: "center",
  },
  greetingBackgroundImage: {
    borderRadius: 22,
  },
  greetingContent: {
    gap: 4,
  },
  greetingCursive: {
    fontFamily: Platform.select({ ios: "Snell Roundhand", android: "cursive" }),
    fontSize: 24,
    fontWeight: "bold",
    color: "#065f46",
  },
  greetingTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a", // Màu đen đậm dứt khoát
    fontFamily: "Inter-Bold",
    marginBottom: 2,
    textShadowColor: "rgba(255, 255, 255, 0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  greetingUserName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a", // Tên user màu đen đậm
    fontFamily: "Inter-Bold",
  },
  greetingSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a", // Lời chúc màu đen đậm, rõ nét
    fontFamily: "Inter-SemiBold",
    textShadowColor: "rgba(255, 255, 255, 0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  greetingMeta: {
    fontSize: 10,
    fontWeight: "600",
    color: "#047857",
    fontFamily: "Inter-SemiBold",
    marginTop: 4,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  roundedButton: {
    backgroundColor: "#059669",
    borderRadius: 24, // Bo tròn toàn bộ
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  roundedButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  roundedButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
    fontFamily: "Inter-Bold",
    letterSpacing: 0.2,
  },
});
