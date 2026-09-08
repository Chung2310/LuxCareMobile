import { useEffect, useState } from "react";
import { Text } from "react-native";
import { roster } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { hasPermission } from "../../auth/access";
import { Button, Card, ErrorText, Field, styles } from "../../ui";
import { recruitmentPeople } from "./peopleModel";
export function PeoplePicker({
  title,
  selected,
  onChange,
  multiple = false,
  disabled = false,
}: {
  title: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const { user, selectedBranch } = useSession();
  const branch = user?.role === "admin" ? selectedBranch?._id : user?.branchId;
  const allowed = hasPermission(user, "user:read") || hasPermission(user, "hr:read");
  const [people, setPeople] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setPeople([]);
    setError(null);
    setLoading(false);
    if (!allowed || !user?.companyCode || !branch) return;
    setLoading(true);
    void roster
      .list(user.companyCode, branch)
      .then((rows) => {
        if (active) setPeople(recruitmentPeople(rows, user.companyCode!, branch));
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
  }, [allowed, user?.companyCode, branch, revision]);
  return (
    <Card>
      <Text style={styles.heading}>{title}</Text>
      {selected.map((id) => (
        <Button
          key={id}
          title={`✓ ${people.find((item) => item.value === id)?.label || id} · Bỏ chọn`}
          disabled={disabled}
          onPress={() => onChange(selected.filter((value) => value !== id))}
        />
      ))}
      {!selected.length && <Text style={styles.muted}>Chưa phân công.</Text>}
      {!allowed ? (
        <Text style={styles.muted}>
          Cần quyền đọc nhân sự để chọn người. Các phân công hiện tại được giữ nếu bạn không đổi.
        </Text>
      ) : (
        <>
          <Field label="Tìm theo tên hoặc email" value={search} onChangeText={setSearch} editable={!disabled} />
          <ErrorText message={error} />
          {loading && <Text style={styles.muted}>Đang tải nhân sự…</Text>}
          {people
            .filter((item) => !selected.includes(item.value) && item.label.toLowerCase().includes(search.toLowerCase()))
            .map((item) => (
              <Button
                key={item.value}
                title={item.label}
                disabled={disabled || loading}
                onPress={() => onChange(multiple ? [...selected, item.value] : [item.value])}
              />
            ))}
          {!loading && !error && !people.length && (
            <Text style={styles.muted}>Không có nhân sự đang hoạt động trong chi nhánh.</Text>
          )}
          <Button
            title="Tải lại nhân sự"
            disabled={disabled || loading}
            onPress={() => setRevision((value) => value + 1)}
          />
        </>
      )}
    </Card>
  );
}
