import { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { currentKpiPeriod, validateKpiPeriod, type MonthlyKpiReport } from "../../../src/services/monthlyKpiService";
import { monthlyKpi } from "../../src/api/services";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { Button, Card, EmptyState, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
export default function Kpi() {
  const { user, selectedBranch } = useSession();
  const allowed = canUseModule(user, "hr") && hasPermission(user, "work:read");
  const [period, setPeriod] = useState(() => currentKpiPeriod());
  const [draft, setDraft] = useState(period);
  const [report, setReport] = useState<MonthlyKpiReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setReport(null);
      if (!allowed) return;
      setLoading(true);
      setError(null);
      void monthlyKpi
        .report(period, selectedBranch?._id)
        .then((data) => {
          if (active) setReport(data);
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
    }, [allowed, period, selectedBranch?._id, user?.uid, revision]),
  );
  if (!allowed)
    return (
      <Page title="KPI tháng">
        <Text style={styles.text}>Bạn chưa có quyền xem KPI công việc.</Text>
      </Page>
    );
  const rows = (report?.rows || []).filter((row) =>
    row.employeeName.toLocaleLowerCase("vi-VN").includes(search.trim().toLocaleLowerCase("vi-VN")),
  );
  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(row) => row.employeeId}
      refreshing={loading}
      onRefresh={() => setRevision((value) => value + 1)}
      ListHeaderComponent={
        <View style={{ gap: 14 }}>
          <Text style={styles.title}>KPI công việc</Text>
          <Text style={styles.muted}>
            Công việc hoàn thành đúng hạn trên tổng công việc đến hạn trong tháng. Kỳ tính theo giờ Việt Nam.
          </Text>
          <Field label="Tháng (YYYY-MM)" value={draft} onChangeText={setDraft} maxLength={7} />
          <ErrorText message={inputError} />
          <Button
            title="Xem báo cáo"
            onPress={() => {
              try {
                const next = validateKpiPeriod(draft.trim());
                setPeriod(next);
                setRevision((value) => value + 1);
                setInputError(null);
              } catch (error) {
                setInputError(messageOf(error));
              }
            }}
          />
          <Text style={styles.heading}>
            Kỳ {period}
            {report ? ` · ${report.periodStatus === "closed" ? "Đã chốt" : "Tạm tính"}` : ""}
          </Text>
          {!!report?.closedAt && (
            <Text style={styles.muted}>
              Chốt lúc {new Date(report.closedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
            </Text>
          )}
          <Field label="Tìm nhân viên trong báo cáo" value={search} onChangeText={setSearch} />
          <ErrorText message={error} />
          {error && <Button title="Tải lại" onPress={() => setRevision((value) => value + 1)} />}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <Loading />
        ) : !error ? (
          <EmptyState
            message="Không có nhân viên phù hợp"
            subtitle="Không tìm thấy nhân viên trong phạm vi báo cáo."
          />
        ) : null
      }
      renderItem={({ item }) => (
        <Card>
          <Text style={styles.heading}>{item.employeeName}</Text>
          <Text style={styles.title}>
            {item.percent === null ? "Chưa có công việc" : `${item.percent.toLocaleString("vi-VN")}%`}
          </Text>
          <Text style={styles.text}>
            Đúng hạn: {item.completedTasks} · Tổng: {item.totalTasks}
          </Text>
          <Text style={styles.muted}>Chưa đạt KPI: {item.pendingTasks}</Text>
        </Card>
      )}
    />
  );
}
