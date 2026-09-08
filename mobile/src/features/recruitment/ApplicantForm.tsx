import { useRef, useState } from "react";
import { Text } from "react-native";
import type { RecruitmentApplicant } from "../../../../src/types/recruitment";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Page, styles } from "../../ui";
import { applicantDraft, applicantPayload } from "./applicantFormModel";
import { PeoplePicker } from "./PeoplePicker";
import { recruiterPatch } from "./peopleModel";
import { usePublicUpload } from "./usePublicUpload";
type Duplicate = Pick<RecruitmentApplicant, "_id" | "fullName" | "email" | "phone" | "jobId">;
export function ApplicantForm({
  applicant,
  jobId,
  onClose,
  setLocked,
}: {
  applicant?: RecruitmentApplicant;
  jobId: string;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => applicantDraft(applicant));
  const [recruiters, setRecruiters] = useState<string[]>(applicant?.recruiterId ? [applicant.recruiterId] : []);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null);
  const lock = useRef(false);
  const publicFile = usePublicUpload();
  const upload = async () => {
    if (lock.current || blocked || duplicates !== null) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const file = await publicFile.pick();
      if (file) setDraft((current) => ({ ...current, cvUrl: file.url }));
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const save = async (confirmDuplicate = false) => {
    if (lock.current || (confirmDuplicate && duplicates === null)) return;
    let payload: ReturnType<typeof applicantPayload>;
    try {
      payload = applicantPayload(draft, applicant);
      Object.assign(payload, publicFile.uploads.patch("applicant", draft.cvUrl));
      if (!jobId) throw new Error("Chọn tin tuyển dụng trước khi thêm ứng viên.");
    } catch (error) {
      setError(messageOf(error));
      return;
    }
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    publicFile.uploads.dispatched(draft.cvUrl);
    try {
      if (applicant)
        await recruitment.updateApplicant(applicant._id, {
          ...payload,
          ...recruiterPatch(applicant.recruiterId, recruiters),
          version: applicant.version,
        });
      else {
        const result = await recruitment.createApplicant({
          ...payload,
          ...recruiterPatch(undefined, recruiters),
          jobId,
          ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
        });
        if (result?.duplicateWarning) {
          publicFile.uploads.duplicate(draft.cvUrl);
          setDuplicates(result.matches || []);
          return;
        }
        if (!result?._id) throw new Error("Chưa xác nhận hồ sơ đã được tạo.");
      }
      onClose();
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
      if (!status || status >= 500 || status === 409 || /phiên bản|version/i.test(messageOf(error))) {
        setBlocked(true);
        setError(`${messageOf(error)} Đóng và tải lại trước khi lưu tiếp.`);
      } else setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const fields = [
    { key: "fullName", label: "Họ tên" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Điện thoại" },
    { key: "birthDate", label: "Ngày sinh (YYYY-MM-DD)" },
    { key: "address", label: "Địa chỉ" },
    { key: "experience", label: "Kinh nghiệm" },
    { key: "education", label: "Học vấn" },
    { key: "skills", label: "Kỹ năng (cách nhau bằng dấu phẩy)" },
    { key: "expectedSalary", label: "Lương mong muốn" },
    { key: "availableDate", label: "Ngày có thể đi làm (YYYY-MM-DD)" },
    { key: "source", label: "Nguồn ứng viên" },
    { key: "notes", label: "Ghi chú" },
    { key: "cvUrl", label: "Liên kết CV công khai (HTTP/HTTPS)" },
  ] as const;
  return (
    <Page title={applicant ? "Sửa hồ sơ ứng viên" : "Thêm ứng viên"}>
      <Text style={styles.muted}>
        Tin tuyển dụng: {jobId}. Hồ sơ mới cần tin đang mở và pipeline có giai đoạn hoạt động.
      </Text>
      {fields.map(({ key, label }) => (
        <Field
          key={key}
          label={label}
          value={draft[key]}
          editable={!busy && !blocked && duplicates === null}
          multiline={["experience", "education", "notes"].includes(key)}
          keyboardType={key === "email" ? "email-address" : key === "expectedSalary" ? "numeric" : "default"}
          onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))}
        />
      ))}
      <PeoplePicker
        title="Người phụ trách tuyển dụng"
        selected={recruiters}
        onChange={setRecruiters}
        disabled={busy || blocked || duplicates !== null}
      />
      <Text style={styles.muted}>
        Để trống liên kết CV để gỡ. Khi thay/gỡ liên kết, LuxCare có thể xóa tệp công khai cũ do hệ thống lưu trữ.
      </Text>
      <ErrorText message={error} />
      <Text style={styles.muted}>
        Tệp tải lên ở đây là công khai: người có liên kết có thể xem. Hỗ trợ PDF, DOC, DOCX, tối đa 10 MB.
      </Text>
      <Button
        title="Chọn và tải CV công khai"
        disabled={busy || blocked || duplicates !== null}
        onPress={() => void upload()}
      />
      {duplicates !== null ? (
        <Card>
          <Text style={styles.heading}>Có hồ sơ trùng email hoặc điện thoại</Text>
          <Text style={styles.muted}>Hồ sơ mới chưa được tạo. Kiểm tra danh sách trước khi quyết định tạo thêm.</Text>
          {duplicates.map((item) => (
            <Text key={item._id} style={styles.text}>
              {item.fullName} · {item.email} · {item.phone}
              {"\n"}Tin: {item.jobId}
            </Text>
          ))}
          <Button title="Xác nhận vẫn tạo hồ sơ mới" disabled={busy || blocked} onPress={() => void save(true)} />
          <Button title="Quay lại sửa thông tin" disabled={busy || blocked} onPress={() => setDuplicates(null)} />
        </Card>
      ) : (
        <Button title="Lưu hồ sơ" disabled={busy || blocked} onPress={() => void save()} />
      )}
      <Button title="Đóng và tải lại" disabled={busy} onPress={onClose} />
    </Page>
  );
}
