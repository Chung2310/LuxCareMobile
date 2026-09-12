import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { departments } from "../../api/services";
import { ChoiceField } from "../leave/ChoiceField";
import { messageOf } from "../../auth/SessionProvider";

export function RecruitmentDepartmentField({ value, onChange, disabled }: {
  value: string; onChange: (value: string) => void; disabled: boolean;
}) {
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    departments.list().then(items => {
      if (active) setNames([...new Set(items.filter(item => item.isActive).map(item => item.name))]);
    }).catch(err => { if (active) setError(messageOf(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const options = value && !names.includes(value) ? [value, ...names] : names;
  return <View style={{ gap: 6 }}>
    <ChoiceField label="Phòng ban" value={value} onChange={onChange} disabled={disabled || loading}
      choices={[{ value: "", label: "Chưa chọn phòng ban" }, ...options.map(name => ({ value: name, label: name }))]} />
    {loading && <Text>Đang tải phòng ban...</Text>}
    {!!error && <View>
      <Text style={{ color: "#b91c1c" }}>{error}</Text>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => setRevision(v => v + 1)}>
        <Text style={{ color: "#059669" }}>Tải lại phòng ban</Text>
      </Pressable>
    </View>}
  </View>;
}
