import { useCallback, useState } from "react";
import { Alert, Image, ImageBackground, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { DashboardSummary, DashboardActionItems } from "../../../src/types/dashboard";
import type { HRTask } from "../../../src/types/hr";
import type { DashboardSummaryParams } from "../../../src/services/dashboardService";
import { dashboard, kanban } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { Card, ErrorText, Loading, styles } from "../../src/ui";
import { canUseModule } from "../../src/auth/access";


export default function Home() {
  const { user, selectedBranch } = useSession();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [params] = useState<DashboardSummaryParams>({ filter: "day" });
  const [actions, setActions] = useState<DashboardActionItems | null>(null);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionsRevision, setActionsRevision] = useState(0);
  const [tasks, setTasks] = useState<HRTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
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
      if (!allowed) return;
      setActionsLoading(true);
      void dashboard
        .getActionItems()
        .then((value) => {
          if (active) setActions(value);
        })
        .catch(() => {
          if (active) setActions(null);
        })
        .finally(() => {
          if (active) setActionsLoading(false);
        });
      if (canUseModule(user, "hr")) {
        setTasksLoading(true);
        void kanban
          .listTasks(selectedBranch?._id)
          .then((items) => {
            if (active) setTasks(items);
          })
          .catch(() => {
            if (active) setTasks([]);
          })
          .finally(() => {
            if (active) setTasksLoading(false);
          });
      }
      return () => {
        active = false;
      };
    }, [allowed, user?.uid, selectedBranch?._id, actionsRevision, revision]),
  );

  const myTasks = tasks.filter(
    (task) =>
      (task.assigneeUid === user?.uid ||
        task.subtasks?.some((sub) => sub.assigneeUid === user?.uid)) &&
      task.status !== "Done" &&
      task.status !== "Archived",
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
          refreshControl={
            <RefreshControl
              refreshing={loading || actionsLoading}
              onRefresh={() => {
                setRevision((v) => v + 1);
                setActionsRevision((v) => v + 1);
              }}
              colors={["#008852"]}
              tintColor="#008852"
            />
          }
        >
          {/* Top Bar with Settings on the left, User and Bell on the right */}
          <View style={localStyles.topBar}>
            <Pressable
              onPress={() => router.push("/(tabs)/profile")}
              style={({ pressed }) => [
                localStyles.iconButton,
                pressed && localStyles.iconButtonPressed,
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
                  pressed && localStyles.iconButtonPressed,
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
                  pressed && localStyles.iconButtonPressed,
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
            pressed && localStyles.cardActiveBorder,
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

        {/* Nút Chấm công nổi bật màu xanh lá #008852 có hiệu ứng khi click */}
        <Pressable
          onPress={() => router.push("/(tabs)/attendance")}
          style={({ pressed }) => [
            localStyles.checkInButton,
            pressed && localStyles.checkInButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Chấm công, để bắt đầu công việc thôi nào !"
        >
          <View style={localStyles.checkInContent}>
            <View style={localStyles.checkInIconContainer}>
              <Image
                source={require("../../assets/lucide-fingerprint.png")}
                style={localStyles.checkInIcon}
                resizeMode="contain"
              />
            </View>
            <View style={localStyles.checkInTextContainer}>
              <Text style={localStyles.checkInTitle}>Chấm công</Text>
              <Text style={localStyles.checkInSubtitle}>
                để bắt đầu công việc thôi nào !
              </Text>
            </View>
          </View>
          <Image
            source={require("../../assets/lucide-chevron-right.png")}
            style={localStyles.checkInChevron}
            resizeMode="contain"
          />
        </Pressable>

        {!allowed ? (
          <Card>
            <Text style={styles.text}>Tài khoản của bạn chưa được cấp quyền xem tổng quan.</Text>
          </Card>
        ) : (
        <>
          {/* Lưới 6 thẻ KPI (3 thẻ/hàng), không nền icon, kích thước nhỏ gọn */}
          <View style={localStyles.metricsGrid}>
            {/* 1. Nhân sự đi làm */}
            <Pressable
              onPress={() => router.push("/(tabs)/attendance")}
              style={({ pressed }) => [
                localStyles.metricCard,
                pressed && localStyles.cardActiveBorder,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Nhân sự đi làm"
            >
              <View style={localStyles.metricCardTop}>
                <Image
                  source={require("../../assets/metric-users.png")}
                  style={localStyles.metricIcon}
                  resizeMode="contain"
                />
                <Text style={localStyles.metricLabel} numberOfLines={1}>
                  Nhân sự
                </Text>
              </View>
              <Text style={[localStyles.metricValue, { color: "#059669" }]} numberOfLines={1}>
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
                pressed && localStyles.cardActiveBorder,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Task đang làm"
            >
              <View style={localStyles.metricCardTop}>
                <Image
                  source={require("../../assets/metric-activity.png")}
                  style={localStyles.metricIcon}
                  resizeMode="contain"
                />
                <Text style={localStyles.metricLabel} numberOfLines={1}>
                  Đang làm
                </Text>
              </View>
              <Text style={[localStyles.metricValue, { color: "#10b981" }]} numberOfLines={1}>
                {data?.projects?.tasks?.doing ?? 0}
              </Text>
            </Pressable>

            {/* 3. Task quá hạn */}
            <Pressable
              onPress={() => router.push("/(tabs)/work")}
              style={({ pressed }) => [
                localStyles.metricCard,
                pressed && localStyles.cardActiveBorder,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Task quá hạn"
            >
              <View style={localStyles.metricCardTop}>
                <Image
                  source={require("../../assets/metric-clock.png")}
                  style={localStyles.metricIcon}
                  resizeMode="contain"
                />
                <Text style={localStyles.metricLabel} numberOfLines={1}>
                  Quá hạn
                </Text>
              </View>
              <Text style={[localStyles.metricValue, { color: "#dc2626" }]} numberOfLines={1}>
                {data?.projects?.overdueTasks ?? 0}
              </Text>
            </Pressable>

            {/* 4. Đơn phép */}
            <Pressable
              onPress={() => {
                if (canUseModule(user, "hr")) {
                  router.push("/(tabs)/leave");
                } else {
                  Alert.alert("Đơn phép", `Hiện có ${actions?.pendingApprovals?.length ?? 0} đơn chờ duyệt.`);
                }
              }}
              style={({ pressed }) => [
                localStyles.metricCard,
                pressed && localStyles.cardActiveBorder,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Đơn phép"
            >
              <View style={localStyles.metricCardTop}>
                <Image
                  source={require("../../assets/metric-calendar.png")}
                  style={localStyles.metricIcon}
                  resizeMode="contain"
                />
                <Text style={localStyles.metricLabel} numberOfLines={1}>
                  Đơn phép
                </Text>
              </View>
              <Text
                style={[
                  localStyles.metricValue,
                  { color: (actions?.pendingApprovals?.length ?? 0) > 0 ? "#ea580c" : "#059669" },
                ]}
                numberOfLines={1}
              >
                {actions?.pendingApprovals?.length ?? 0}
              </Text>
            </Pressable>

            {/* 5. Khóa đào tạo */}
            <Pressable
              onPress={() => Alert.alert("Đào tạo", `Hiện có ${data?.training?.totalCourses ?? 0} khóa đào tạo.`)}
              style={({ pressed }) => [
                localStyles.metricCard,
                pressed && localStyles.cardActiveBorder,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Khóa đào tạo"
            >
              <View style={localStyles.metricCardTop}>
                <Image
                  source={require("../../assets/metric-graduation.png")}
                  style={localStyles.metricIcon}
                  resizeMode="contain"
                />
                <Text style={localStyles.metricLabel} numberOfLines={1}>
                  Đào tạo
                </Text>
              </View>
              <Text style={[localStyles.metricValue, { color: "#ea580c" }]} numberOfLines={1}>
                {data?.training?.totalCourses ?? 0}
              </Text>
            </Pressable>

            {/* 6. Thiết bị */}
            <Pressable
              onPress={() => router.push("/(tabs)/equipment")}
              style={({ pressed }) => [
                localStyles.metricCard,
                pressed && localStyles.cardActiveBorder,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Thiết bị"
            >
              <View style={localStyles.metricCardTop}>
                <Image
                  source={require("../../assets/metric-file-text.png")}
                  style={localStyles.metricIcon}
                  resizeMode="contain"
                />
                <Text style={localStyles.metricLabel} numberOfLines={1}>
                  Thiết bị
                </Text>
              </View>
              <Text style={[localStyles.metricValue, { color: "#059669" }]} numberOfLines={1}>
                {data?.equipment?.total ?? 0}
              </Text>
            </Pressable>
          </View>

          {/* Section: Công việc cần làm hôm nay */}
          <View style={localStyles.taskSection}>
            <View style={localStyles.taskSectionHeader}>
              <Text style={localStyles.taskSectionTitle}>Công việc cần làm hôm nay</Text>
              {myTasks.length > 0 && (
                <Pressable
                  onPress={() => router.push("/(tabs)/work")}
                  hitSlop={8}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={localStyles.taskSectionLink}>Xem tất cả ({myTasks.length})</Text>
                </Pressable>
              )}
            </View>

            {tasksLoading ? (
              <Loading />
            ) : myTasks.length === 0 ? (
              <View style={localStyles.taskEmptyBannerContainer}>
                <Image
                  source={require("../../public/thong-bao-khong-co-viec-can-lam.png")}
                  style={localStyles.taskEmptyBanner}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={localStyles.taskListContainer}>
                {myTasks.slice(0, 5).map((task) => {
                  const isOverdue = task.dueDate && new Date(task.dueDate).getTime() < Date.now();
                  const statusLabel =
                    task.status === "In Progress" || task.status === "doing"
                      ? "Đang làm"
                      : task.status === "Not Started" || task.status === "todo"
                        ? "Chưa bắt đầu"
                        : task.status === "Review/Testing"
                          ? "Chờ kiểm tra"
                          : task.status;

                  return (
                    <Pressable
                      key={task.id}
                      onPress={() => router.push("/(tabs)/work")}
                      style={({ pressed }) => [
                        localStyles.taskItemCard,
                        pressed && localStyles.cardActiveBorder,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={task.title}
                    >
                      <View style={localStyles.taskItemLeft}>
                        <View
                          style={[
                            localStyles.taskPriorityIndicator,
                            {
                              backgroundColor:
                                task.priority === "High" || task.priority === "Cao"
                                  ? "#ef4444"
                                  : task.priority === "Medium" || task.priority === "Trung bình"
                                    ? "#f59e0b"
                                    : "#10b981",
                            },
                          ]}
                        />
                        <View style={localStyles.taskItemInfo}>
                          <Text style={localStyles.taskItemTitle} numberOfLines={1}>
                            {task.title}
                          </Text>
                          <View style={localStyles.taskItemMeta}>
                            <Text
                              style={[
                                localStyles.taskItemDueDate,
                                isOverdue && localStyles.taskItemOverdue,
                              ]}
                            >
                              {task.dueDate
                                ? `Hạn chót: ${new Date(task.dueDate).toLocaleDateString("vi-VN")}`
                                : "Không có hạn"}
                            </Text>
                            <Text style={localStyles.taskItemDot}>·</Text>
                            <Text style={localStyles.taskItemStatus}>{statusLabel}</Text>
                          </View>
                        </View>
                      </View>
                      <Image
                        source={require("../../assets/lucide-chevron-right.png")}
                        style={localStyles.taskItemChevron}
                        resizeMode="contain"
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
          {loading && <Loading />}
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
    borderWidth: 1.5,
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
  checkInButton: {
    backgroundColor: "#008852",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#008852",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    marginTop: 2,
    marginBottom: 6,
  },
  checkInButtonPressed: {
    backgroundColor: "#004d2e", // Đổi sang màu xanh lá đậm hơn khi click vào
    transform: [{ scale: 0.98 }],
  },
  checkInContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  checkInIconContainer: {
    width: 32,
    height: 32,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  checkInIcon: {
    width: 24,
    height: 24,
    tintColor: "#ffffff",
  },
  checkInTextContainer: {
    flex: 1,
  },
  checkInTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    fontFamily: "Inter-Bold",
    letterSpacing: 0.2,
  },
  checkInSubtitle: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 11,
    fontWeight: "500",
    fontFamily: "Inter-Medium",
    marginTop: 1,
  },
  checkInChevron: {
    width: 16,
    height: 16,
    tintColor: "rgba(255, 255, 255, 0.8)",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    marginTop: 2,
    marginBottom: 4,
  },
  metricCard: {
    width: "31.6%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    minHeight: 66,
    justifyContent: "space-between",
  },
  cardActiveBorder: {
    borderColor: "#008852",
    borderWidth: 1.5,
    shadowColor: "#008852",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
    transform: [{ scale: 0.96 }],
  },

  metricCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metricIcon: {
    width: 15,
    height: 15,
  },
  metricLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: "600",
    color: "#475569",
    fontFamily: "Inter-SemiBold",
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "800",
    fontFamily: "Inter-Bold",
    marginTop: 4,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.18)", // Siêu mờ nhạt, trong suốt nhìn rõ trọn vẹn background
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.35)", // Viền mờ nhẹ nhàng tinh tế
  },
  iconButtonPressed: {
    borderColor: "#008852",
    borderWidth: 1.5,
    backgroundColor: "rgba(0, 136, 82, 0.15)",
    transform: [{ scale: 0.94 }],
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
  taskSection: {
    marginTop: 6,
    gap: 8,
    marginBottom: 8,
  },
  taskSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  taskSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  taskSectionLink: {
    fontSize: 12,
    fontWeight: "600",
    color: "#008852",
    fontFamily: "Inter-SemiBold",
  },
  taskEmptyBannerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  taskEmptyBanner: {
    width: 280,
    height: 140,
  },
  taskListContainer: {
    gap: 8,
  },
  taskItemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  taskItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  taskPriorityIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
  },
  taskItemInfo: {
    flex: 1,
    gap: 3,
  },
  taskItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
    fontFamily: "Inter-Bold",
  },
  taskItemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  taskItemDueDate: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748b",
    fontFamily: "Inter-Medium",
  },
  taskItemOverdue: {
    color: "#dc2626",
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  taskItemDot: {
    fontSize: 11,
    color: "#94a3b8",
  },
  taskItemStatus: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
    fontFamily: "Inter-SemiBold",
  },
  taskItemChevron: {
    width: 14,
    height: 14,
    tintColor: "#94a3b8",
  },
});
