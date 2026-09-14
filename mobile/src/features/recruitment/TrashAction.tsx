import { useAppAlert } from "../../components/AppAlert";
import { useRef, useState } from "react";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button } from "../../ui";
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
  const { showAlert, alertView } = useAppAlert();
  const [blocked, setBlocked] = useState(false);
  const lock = useRef(false);
  const run = async () => {
    if (lock.current || blocked) return;
    lock.current = true;
    setBlocked(true);
    setBusy(true);
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
      showAlert(
        "Không thể thực hiện",
        `${messageOf(error)}\nVui lòng tải lại danh sách trước khi thao tác tiếp.`,
        [{ text: "Đã hiểu" }],
        "error",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        title={deleted ? "Khôi phục" : "Chuyển vào thùng rác"}
        disabled={blocked}
        onPress={() =>
          showAlert(deleted ? "Khôi phục bản ghi?" : "Xóa mềm bản ghi?", title, [
            { text: "Hủy", style: "cancel" },
            { text: "Xác nhận", style: deleted ? "default" : "destructive", onPress: () => void run() },
          ])
        }
      />
      {alertView}
    </>
  );
}
