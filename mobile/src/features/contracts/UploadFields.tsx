import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import type { ContractScope, ContractUploadKind } from "../../../../src/services/hrContractService";
import { Button, ErrorText, styles } from "../../ui";
import { messageOf } from "../../auth/SessionProvider";
import { pickContractFile } from "./uploadFile";
import type { ContractUploads } from "./uploadModel";
export function UploadFields({
  scope,
  extension = false,
  value,
  onChange,
  disabled,
  onBusy,
}: {
  scope: ContractScope;
  extension?: boolean;
  value: ContractUploads;
  onChange: (value: ContractUploads) => void;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const lock = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const pick = async (kind: ContractUploadKind) => {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      const file = await pickContractFile(scope, kind);
      if (mounted.current && file) onChange({ ...value, [kind]: file });
    } catch (error) {
      if (mounted.current) setError(messageOf(error));
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  };
  const groups: { kind: ContractUploadKind; title: string }[] = extension
    ? [
        { kind: "extension", title: "Tệp gia hạn" },
        { kind: "extensionSigned", title: "Ảnh phụ lục đã ký" },
      ]
    : [
        { kind: "contract", title: "Tệp hợp đồng" },
        { kind: "signed", title: "Ảnh hợp đồng đã ký" },
      ];
  return (
    <>
      <Text style={styles.muted}>Mỗi mục một tệp, tối đa 10 MB. Tệp được gắn vào hồ sơ khi bấm lưu.</Text>
      {groups.map(({ kind, title }) => (
        <View key={kind}>
          <Text style={styles.text}>
            {title}: {value[kind]?.name || "Chưa chọn"}
          </Text>
          <Button title={`Chọn ${title.toLowerCase()}`} disabled={disabled || busy} onPress={() => void pick(kind)} />
          {!!value[kind] && (
            <Button
              title="Bỏ tệp vừa chọn"
              disabled={disabled || busy}
              onPress={() => {
                const next = { ...value };
                delete next[kind];
                onChange(next);
              }}
            />
          )}
        </View>
      ))}
      {busy && <Text style={styles.muted}>Đang tải tệp…</Text>}
      <ErrorText message={error} />
    </>
  );
}
