import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { DashboardSummary, DashboardActionItems } from "../../../src/types/dashboard";
import type { DashboardSummaryParams } from "../../../src/services/dashboardService";
import { dashboard } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { Button, Card, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
import { customDashboardRange } from "../../src/features/dashboard/range";
import { canUseModule } from "../../src/auth/access";
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
    <Page title={`Xin chào, ${user?.displayName || "bạn"}`}>
      <Text style={styles.muted}>
        {user?.companyName || "LuxCare"}
        {selectedBranch?.name || user?.branchName ? ` · ${selectedBranch?.name || user?.branchName}` : ""}
      </Text>
      {!allowed ? (
        <Card>
          <Text style={styles.text}>Tài khoản của bạn chưa được cấp quyền xem tổng quan.</Text>
        </Card>
      ) : (
        <>
          <View style={styles.row}>
            {(["day", "week", "year"] as const).map((value, i) => (
              <Button
                key={value}
                title={["Hôm nay", "Tuần", "Năm"][i]}
                disabled={params.filter === value}
                onPress={() => {
                  setParams({ filter: value });
                  setRangeError(null);
                }}
              />
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
    </Page>
  );
}
