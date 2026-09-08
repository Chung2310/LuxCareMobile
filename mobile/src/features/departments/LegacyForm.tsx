import { useEffect, useRef, useState } from "react";
import { Alert, Text } from "react-native";
import type { DepartmentRecord } from "../../../../src/services/departmentService";
import { departments } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Loading, Page, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
export function LegacyForm({ onClose, setLocked }: { onClose: () => void; setLocked: (value: boolean) => void }) {
  const [items, setItems] = useState<{ name: string; count: number }[]>([]);
  const [targets, setTargets] = useState<DepartmentRecord[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSelected([]);
    setTarget("");
    setItems([]);
    setTargets([]);
    void Promise.all([departments.getUnmapped(), departments.list({ activeOnly: true })])
      .then(([legacy, list]) => {
        if (active) {
          setItems(legacy);
          setTargets(list);
        }
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
  }, [revision]);
  const merge = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const response = await departments.merge(selected, target);
      setResult(response.modifiedCount);
      setRevision((value) => value + 1);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  return (
    <Page title="Chuẩn hóa phòng ban">
      <Text style={styles.muted}>
        Chuyển nhân sự đang dùng các tên cũ được chọn sang phòng ban chuẩn trong doanh nghiệp. Thao tác áp dụng trên
        toàn doanh nghiệp.
      </Text>
      {result !== null && <Text style={styles.text}>Đã cập nhật {result} hồ sơ nhân sự.</Text>}
      {loading ? (
        <Loading />
      ) : (
        <>
          {items.map((item) => (
            <Card key={item.name}>
              <Text style={styles.text}>
                {item.name} · {item.count} hồ sơ chưa gắn mã
              </Text>
              <Button
                title={selected.includes(item.name) ? "Bỏ chọn" : "Chọn tên cũ"}
                disabled={busy}
                onPress={() =>
                  setSelected((value) =>
                    value.includes(item.name) ? value.filter((name) => name !== item.name) : [...value, item.name],
                  )
                }
              />
            </Card>
          ))}
          {!items.length && !error && <Text style={styles.muted}>Không có tên phòng ban cũ cần chuẩn hóa.</Text>}
          <ChoiceField
            label="Phòng ban đích"
            value={target}
            choices={[
              { value: "", label: "Chọn phòng ban" },
              ...targets.map((item) => ({ value: item._id, label: item.name })),
            ]}
            disabled={busy}
            onChange={setTarget}
          />
          <Button
            title="Chuẩn hóa tên đã chọn"
            disabled={busy || !selected.length || !target}
            onPress={() =>
              Alert.alert(
                "Xác nhận chuẩn hóa",
                `Chuyển mọi hồ sơ có tên phòng ban khớp (không phân biệt hoa/thường):\n${selected.join(", ")}\nsang ${targets.find((item) => item._id === target)?.name}. Các hồ sơ đã có mã phòng ban nhưng cùng tên cũng thuộc phạm vi cập nhật.`,
                [
                  { text: "Hủy", style: "cancel" },
                  { text: "Chuẩn hóa", onPress: () => void merge() },
                ],
              )
            }
          />
        </>
      )}
      <ErrorText message={error} />
      {error && <Button title="Tải lại dữ liệu" disabled={busy} onPress={() => setRevision((value) => value + 1)} />}
      <Button title="Đóng" disabled={busy} onPress={onClose} />
    </Page>
  );
}
