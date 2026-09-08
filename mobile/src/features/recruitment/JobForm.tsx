import { useRef, useState } from "react";
import { Switch, Text, View } from "react-native";
import type { RecruitmentJob } from "../../../../src/types/recruitment";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, ErrorText, Field, Page, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { jobDraft, jobPayload } from "./jobModel";
import { usePublicUpload } from "./usePublicUpload";
export function JobForm({
  job,
  onClose,
  setLocked,
}: {
  job?: RecruitmentJob;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => jobDraft(job));
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const publicFile = usePublicUpload();
  const upload = async () => {
    if (lock.current || blocked) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const file = await publicFile.pick();
      if (file) setDraft((current) => ({ ...current, jdFileUrl: file.url }));
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const save = async () => {
    if (lock.current) return;
    let payload: Partial<RecruitmentJob>;
    try {
      payload = jobPayload(draft, job);
      Object.assign(payload, publicFile.uploads.patch("job", draft.jdFileUrl));
    } catch (error) {
      setError(messageOf(error));
      return;
    }
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    publicFile.uploads.dispatched(draft.jdFileUrl);
    try {
      if (job) await recruitment.updateJob(job._id, { ...payload, version: job.version });
      else await recruitment.createJob(payload);
      onClose();
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
      if (!status || status >= 500 || status === 409 || /phiên bản|version/i.test(messageOf(error))) {
        setBlocked(true);
        setError(`${messageOf(error)} Đóng và tải lại danh sách trước khi lưu tiếp.`);
      } else setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const disabled = busy || blocked;
  const fields = [
    { key: "code", label: "Mã tin" },
    { key: "title", label: "Tiêu đề" },
    { key: "department", label: "Phòng ban" },
    { key: "headcount", label: "Số lượng tuyển" },
    { key: "description", label: "Mô tả công việc" },
    { key: "requirements", label: "Yêu cầu" },
    { key: "benefits", label: "Quyền lợi" },
    { key: "salaryMin", label: "Lương tối thiểu (để trống nếu chưa xác định)" },
    { key: "salaryMax", label: "Lương tối đa" },
    { key: "employmentType", label: "Loại hợp đồng (ví dụ full_time, part_time)" },
    { key: "location", label: "Địa điểm" },
    { key: "deadline", label: "Hạn nộp (YYYY-MM-DD HH:mm, giờ Việt Nam)" },
    { key: "jdFileUrl", label: "Liên kết JD công khai (HTTP/HTTPS)" },
  ] as const;
  return (
    <Page title={job ? "Sửa tin tuyển dụng" : "Tạo tin tuyển dụng"}>
      <Text style={styles.muted}>
        {job
          ? "Giữ trạng thái hiện tại khi lưu. Thay đổi trạng thái trong danh sách tin."
          : "Tin mới được lưu ở dạng bản nháp. Mở tuyển sau khi kiểm tra đủ thông tin."}
      </Text>
      {fields.map(({ key, label }) => (
        <Field
          key={key}
          label={label}
          value={draft[key]}
          editable={!disabled}
          multiline={["description", "requirements", "benefits"].includes(key)}
          keyboardType={["headcount", "salaryMin", "salaryMax"].includes(key) ? "numeric" : "default"}
          onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))}
        />
      ))}
      <ChoiceField
        label="Hình thức làm việc"
        value={draft.workplaceType}
        choices={[
          { value: "onsite", label: "Tại chỗ" },
          { value: "hybrid", label: "Kết hợp" },
          { value: "remote", label: "Từ xa" },
        ]}
        disabled={disabled}
        onChange={(value) => setDraft((current) => ({ ...current, workplaceType: value }))}
      />
      <View style={styles.row}>
        <Text style={styles.text}>Công khai lương</Text>
        <Switch
          value={draft.showSalary}
          disabled={disabled}
          onValueChange={(value) => setDraft((current) => ({ ...current, showSalary: value }))}
        />
      </View>
      <Text style={styles.muted}>
        Để trống liên kết JD để gỡ. Khi thay/gỡ liên kết, LuxCare có thể xóa tệp công khai cũ do hệ thống lưu trữ.
      </Text>
      <ErrorText message={error} />
      <Text style={styles.muted}>
        Tệp tải lên ở đây là công khai: người có liên kết có thể xem. Hỗ trợ PDF, DOC, DOCX, tối đa 10 MB.
      </Text>
      <Button title="Chọn và tải JD công khai" disabled={disabled} onPress={() => void upload()} />
      <Button title={busy ? "Đang lưu…" : "Lưu tin"} disabled={disabled} onPress={() => void save()} />
      <Button title="Đóng và tải lại" disabled={busy} onPress={onClose} />
    </Page>
  );
}
