import {
  AlertTriangle,
  Banknote,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileEdit,
  FileText,
  Gift,
  Lock,
  MapPin,
  Paperclip,
  PauseCircle,
  Pencil,
  RotateCcw,
  Tag,
  Target,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RecruitmentJob, RecruitmentJobStatus } from "../../../../src/types/recruitment";
import { AttachmentPanel } from "./AttachmentPanel";
import { PublicDocumentLink } from "./PublicDocumentLink";
import { RecruitmentModal } from "./RecruitmentModal";
import { JOB_STATUSES } from "./access";
import {
  EMPLOYMENT_TYPE_LABELS,
  formatDeadline,
  formatMoney,
  formatSalaryRange,
  getJobStatusBadgeInfo,
  WORKPLACE_LABELS,
} from "./recruitmentModel";

export {
  EMPLOYMENT_TYPE_LABELS,
  formatDeadline,
  formatMoney,
  formatSalaryRange,
  getJobStatusBadgeInfo,
  WORKPLACE_LABELS,
};

export function getJobStatusBadge(
  jobStatus: string,
  isDeleted?: boolean,
): { label: string; bg: string; border: string; color: string; Icon: LucideIcon } {
  const info = getJobStatusBadgeInfo(jobStatus, isDeleted);
  let Icon: LucideIcon = Tag;
  if (isDeleted) Icon = Trash2;
  else if (jobStatus === "open") Icon = CheckCircle2;
  else if (jobStatus === "draft") Icon = FileEdit;
  else if (jobStatus === "paused") Icon = PauseCircle;
  else if (jobStatus === "closed") Icon = Lock;
  return { ...info, Icon };
}

export function JobDetail({
  job,
  deleted = false,
  canManage = false,
  disabled = false,
  onClose,
  onEdit,
  onViewApplicants,
  onChangeStatus,
  onDelete,
  onRestore,
}: {
  job: RecruitmentJob;
  deleted?: boolean;
  canManage?: boolean;
  disabled?: boolean;
  onClose: () => void;
  onEdit?: (job: RecruitmentJob) => void;
  onViewApplicants?: (job: RecruitmentJob) => void;
  onChangeStatus?: (job: RecruitmentJob, status: RecruitmentJobStatus) => void;
  onDelete?: (job: RecruitmentJob) => void;
  onRestore?: (job: RecruitmentJob) => void;
}) {
  const badge = getJobStatusBadge(job.status, deleted);
  const deadline = formatDeadline(job.applicationDeadline);
  const workplace = WORKPLACE_LABELS[job.workplaceType] || job.workplaceType || "Tại chỗ";
  const employmentType =
    EMPLOYMENT_TYPE_LABELS[job.employmentType] || job.employmentType || "Toàn thời gian";

  return (
    <RecruitmentModal
      title={job.title}
      subtitle={`Mã tin: #${job.code} · ${badge.label}`}
      visible
      onClose={onClose}
    >
      {/* Card 1: Thông tin vị trí tuyển dụng */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <Briefcase size={16} color="#059669" />
          </View>
          <Text style={styles.cardTitle}>Thông tin vị trí</Text>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: badge.bg, borderColor: badge.border },
            ]}
          >
            <badge.Icon size={12} color={badge.color} />
            <Text style={[styles.statusPillText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        <View style={styles.infoList}>
          <View style={styles.infoRow}>
            <Tag size={14} color="#64748b" />
            <Text style={styles.infoLabel}>Mã tin tuyển dụng:</Text>
            <Text style={[styles.infoValue, styles.infoValueBold]}>#{job.code}</Text>
          </View>

          <View style={styles.infoRow}>
            <Building2 size={14} color="#64748b" />
            <Text style={styles.infoLabel}>Phòng ban / Bộ phận:</Text>
            <Text style={styles.infoValue}>{job.department || "Chưa phân loại"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Users size={14} color="#64748b" />
            <Text style={styles.infoLabel}>Số lượng cần tuyển:</Text>
            <Text style={[styles.infoValue, styles.infoValueBold]}>{job.headcount} người</Text>
          </View>

          <View style={styles.infoRow}>
            <Banknote size={14} color="#64748b" />
            <Text style={styles.infoLabel}>Mức lương:</Text>
            <Text style={[styles.infoValue, { color: "#047857", fontWeight: "700" }]}>
              {formatSalaryRange(job)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Clock size={14} color="#64748b" />
            <Text style={styles.infoLabel}>Hình thức làm việc:</Text>
            <Text style={styles.infoValue}>{employmentType}</Text>
          </View>

          <View style={styles.infoRow}>
            <MapPin size={14} color="#64748b" />
            <Text style={styles.infoLabel}>Nơi làm việc:</Text>
            <Text style={styles.infoValue}>
              {workplace}
              {job.location ? ` (${job.location})` : ""}
            </Text>
          </View>

          <View style={styles.infoRow}>
            {deadline.isExpired ? (
              <AlertTriangle size={14} color="#dc2626" />
            ) : deadline.isNear ? (
              <Clock size={14} color="#d97706" />
            ) : (
              <Calendar size={14} color="#64748b" />
            )}
            <Text style={styles.infoLabel}>Hạn ứng tuyển:</Text>
            <Text
              style={[
                styles.infoValue,
                deadline.isExpired && { color: "#dc2626", fontWeight: "700" },
                deadline.isNear && { color: "#d97706", fontWeight: "700" },
              ]}
            >
              {deadline.text}
            </Text>
          </View>
        </View>
      </View>

      {/* Card 2: Tài liệu đính kèm */}
      {(Boolean(job.jdFileUrl) || (!deleted && canManage)) && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Paperclip size={16} color="#0284c7" />
            </View>
            <Text style={styles.cardTitle}>Tài liệu đính kèm</Text>
          </View>

          <View style={{ gap: 8 }}>
            <PublicDocumentLink title="Mô tả công việc (JD File)" url={job.jdFileUrl} />
            {!deleted && (
              <AttachmentPanel
                kind="job"
                id={job._id}
                manage={canManage}
                hasJdFile={Boolean(job.jdFileUrl)}
              />
            )}
          </View>
        </View>
      )}

      {/* Card 3: Mô tả công việc */}
      {!!job.description && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <FileText size={16} color="#059669" />
            </View>
            <Text style={styles.cardTitle}>Mô tả công việc</Text>
          </View>
          <Text style={styles.bodyText}>{job.description}</Text>
        </View>
      )}

      {/* Card 4: Yêu cầu ứng viên */}
      {!!job.requirements && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Target size={16} color="#0284c7" />
            </View>
            <Text style={styles.cardTitle}>Yêu cầu ứng viên</Text>
          </View>
          <Text style={styles.bodyText}>{job.requirements}</Text>
        </View>
      )}

      {/* Card 5: Quyền lợi đãi ngộ */}
      {!!job.benefits && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Gift size={16} color="#059669" />
            </View>
            <Text style={styles.cardTitle}>Quyền lợi đãi ngộ</Text>
          </View>
          <Text style={styles.bodyText}>{job.benefits}</Text>
        </View>
      )}

      {/* Card 6: Thao tác & Quản lý */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <CheckCircle2 size={16} color="#475569" />
          </View>
          <Text style={styles.cardTitle}>Thao tác</Text>
        </View>

        <View style={{ gap: 10 }}>
          {/* Xem ứng viên */}
          {!deleted && (
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => onViewApplicants?.(job)}
            >
              <Users size={16} color="#ffffff" />
              <Text style={styles.primaryBtnText}>Xem danh sách ứng viên</Text>
            </Pressable>
          )}

          {/* Sửa tin */}
          {canManage && !deleted && (
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                disabled && styles.btnDisabled,
                pressed && { opacity: 0.8 },
              ]}
              disabled={disabled}
              onPress={() => onEdit?.(job)}
            >
              <Pencil size={15} color="#334155" />
              <Text style={styles.secondaryBtnText}>Chỉnh sửa tin tuyển dụng</Text>
            </Pressable>
          )}

          {/* Chuyển trạng thái tin */}
          {canManage && !deleted && (
            <View style={styles.statusSection}>
              <Text style={styles.statusSectionLabel}>Chuyển trạng thái tin:</Text>
              <View style={styles.statusRow}>
                {JOB_STATUSES.filter((item) => item.value !== job.status).map((item) => (
                  <Pressable
                    key={item.value}
                    style={({ pressed }) => [
                      styles.statusOptionBtn,
                      disabled && styles.btnDisabled,
                      pressed && { opacity: 0.75 },
                    ]}
                    disabled={disabled}
                    onPress={() => onChangeStatus?.(job, item.value as RecruitmentJobStatus)}
                  >
                    {item.value === "open" && <CheckCircle2 size={13} color="#047857" />}
                    {item.value === "draft" && <FileEdit size={13} color="#b45309" />}
                    {item.value === "paused" && <PauseCircle size={13} color="#c2410c" />}
                    {item.value === "closed" && <Lock size={13} color="#475569" />}
                    <Text style={styles.statusOptionBtnText}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Xóa tin / Khôi phục */}
          {canManage && (
            <>
              {deleted ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.restoreBtn,
                    disabled && styles.btnDisabled,
                    pressed && { opacity: 0.8 },
                  ]}
                  disabled={disabled}
                  onPress={() => onRestore?.(job)}
                >
                  <RotateCcw size={15} color="#047857" />
                  <Text style={styles.restoreBtnText}>Khôi phục tin tuyển dụng</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    disabled && styles.btnDisabled,
                    pressed && { opacity: 0.8 },
                  ]}
                  disabled={disabled}
                  onPress={() => onDelete?.(job)}
                >
                  <Trash2 size={15} color="#b91c1c" />
                  <Text style={styles.deleteBtnText}>Chuyển vào thùng rác</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>

      {/* Nút đóng */}
      <Pressable
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
        onPress={onClose}
      >
        <X size={16} color="#475569" />
        <Text style={styles.closeBtnText}>Đóng</Text>
      </Pressable>
    </RecruitmentModal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  infoList: {
    gap: 9,
    paddingTop: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: "#64748b",
    minWidth: 125,
  },
  infoValue: {
    fontSize: 13,
    color: "#1e293b",
    flex: 1,
  },
  infoValueBold: {
    fontWeight: "700",
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#334155",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#059669",
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 11,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  statusSection: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  statusSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statusOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  statusOptionBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingVertical: 10,
    borderRadius: 10,
  },
  deleteBtnText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "700",
  },
  restoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingVertical: 10,
    borderRadius: 10,
  },
  restoreBtnText: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  closeBtnText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
});
