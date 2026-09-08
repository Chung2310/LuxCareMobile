import { useRef, useState } from "react";
import { Alert } from "react-native";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, ErrorText } from "../../ui";
export function TrashAction({
  kind,
  id,
  version,
  title,
  deleted,
  onSaved,
  setBusy,
}: {
  kind: "applicant" | "interview";
  id: string;
  version: number;
  title: string;
  deleted: boolean;
  onSaved: () => void;
  setBusy: (value: boolean) => void;
}) {
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const run = async () => {
    if (lock.current || blocked) return;
    lock.current = true;
    setBlocked(true);
    setBusy(true);
    setError(null);
    try {
      const action =
        kind === "applicant"
          ? deleted
            ? recruitment.restoreApplicant
            : recruitment.deleteApplicant
          : deleted
            ? recruitment.restoreInterview
            : recruitment.deleteInterview;
      await action(id, version);
      onSaved();
    } catch (error) {
      setError(`${messageOf(error)} Tải lại danh sách trước khi thao tác tiếp.`);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <ErrorText message={error} />
      <Button
        title={deleted ? "Khôi phục" : "Chuyển vào thùng rác"}
        disabled={blocked}
        onPress={() =>
          Alert.alert(deleted ? "Khôi phục bản ghi?" : "Xóa mềm bản ghi?", title, [
            { text: "Hủy", style: "cancel" },
            { text: "Xác nhận", style: deleted ? "default" : "destructive", onPress: () => void run() },
          ])
        }
      />
    </>
  );
}
