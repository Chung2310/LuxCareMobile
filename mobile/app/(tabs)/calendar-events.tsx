import { useCallback, useMemo, useState } from "react";
import { Text } from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { CalendarItem } from "../../../src/services/hrCalendarService";
import { currentKpiPeriod, validateKpiPeriod } from "../../../src/services/monthlyKpiService";
import { hrCalendar } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { canUseModule } from "../../src/auth/access";
import { Button, Card, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { calendarEvents, EVENT_TYPES } from "../../src/features/calendar/events";
export default function CalendarEvents() {
  const { user, selectedBranch } = useSession();
  const allowed = canUseModule(user, "hr") && !!user?.companyCode;
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [period, setPeriod] = useState(currentKpiPeriod);
  const [draft, setDraft] = useState(period);
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setItems([]);
      setExpanded(null);
      setError(null);
      setLoading(false);
      if (!allowed || !user?.companyCode) return;
      setLoading(true);
      void hrCalendar
        .list(user.companyCode)
        .then((rows) => {
          if (active) setItems(rows);
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
    }, [allowed, user?.companyCode, selectedBranch?._id, revision]),
  );
  const rows = useMemo(
    () => calendarEvents(items, period, type, search, mine ? user?.uid : undefined),
    [items, period, type, search, mine, user?.uid],
  );
  if (!allowed)
    return (
      <Page title="Lịch nhân sự">
        <Text style={styles.text}>Cần doanh nghiệp và phân hệ nhân sự.</Text>
      </Page>
    );
  const time = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  return (
    <Page title="Lịch nhân sự">
      <Text style={styles.muted}>
        Giờ Việt Nam. Các mục chờ duyệt được xem trong Đơn từ; không xuất hiện trên lịch này.
      </Text>
      <Field label="Tháng (YYYY-MM)" value={draft} onChangeText={setDraft} />
      <ErrorText message={inputError} />
      <Button
        title="Xem tháng"
        onPress={() => {
          try {
            setPeriod(validateKpiPeriod(draft.trim()));
            setInputError(null);
            setExpanded(null);
          } catch (error) {
            setInputError(messageOf(error));
          }
        }}
      />
      <ChoiceField label="Loại lịch" value={type} choices={EVENT_TYPES} onChange={setType} />
      <Field label="Tìm tiêu đề, nội dung hoặc nhân viên" value={search} onChangeText={setSearch} />
      <Button
        title={mine ? "✓ Liên quan đến tôi" : "Tất cả trong phạm vi"}
        onPress={() => setMine((value) => !value)}
      />
      {loading && <Loading />}
      <ErrorText message={error} />
      {!loading && !error && (
        <Text style={styles.muted}>
          {rows.length} mục trong tháng {period}
        </Text>
      )}
      {rows.map((item, index) => {
        const id = item.id || item._id || String(index);
        return (
          <Card key={id}>
            <Text style={styles.heading}>{item.title}</Text>
            <Text style={styles.muted}>
              {EVENT_TYPES.find((type) => type.value === item.type)?.label || item.type} ·{" "}
              {
                { approved: "Đã duyệt", completed: "Hoàn tất", active: "Đang hoạt động", pending: "Chờ duyệt" }[
                  item.status
                ]
              }
            </Text>
            <Text style={styles.text}>
              {time(item.startDate)} → {time(item.endDate)}
            </Text>
            {!!item.employeeName && <Text style={styles.text}>{item.employeeName}</Text>}
            <Button
              title={expanded === id ? "Thu gọn" : "Xem chi tiết"}
              onPress={() => setExpanded(expanded === id ? null : id)}
            />
            {expanded === id && (
              <>
                <Text style={styles.text}>{item.description || "Không có mô tả."}</Text>
                <Text style={styles.muted}>
                  Người tạo: {item.creatorId}
                  {item.assigneeId ? `\nNgười được giao: ${item.assigneeId}` : ""}
                </Text>
                {(item.leaveApplicationId || item.type === "leave" || item.type === "wfh") && (
                  <Button title="Mở danh sách đơn từ" onPress={() => router.push("/(tabs)/leave")} />
                )}
              </>
            )}
          </Card>
        );
      })}
      <Button title="Tải lại" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
    </Page>
  );
}
