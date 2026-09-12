import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  Award,
  Briefcase,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  GitFork,
  Mail,
  Phone,
  User,
  X,
} from "lucide-react-native";
import type {
  RecruitmentApplicant,
  RecruitmentHistory,
  RecruitmentJob,
  RecruitmentStage,
} from "../../../../src/types/recruitment";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { ErrorText, Field, Loading } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { RecruitmentModal } from "./RecruitmentModal";
import { formatDate, formatOutcome } from "./recruitmentModel";

export function ApplicantDetail({
  applicant,
  jobs = [],
  stages = [],
  canManage,
  manage,
  onClose,
  onChanged,
  setLocked,
}: {
  applicant: RecruitmentApplicant;
  jobs?: RecruitmentJob[];
  stages?: RecruitmentStage[];
  canManage?: boolean;
  manage?: boolean;
  onClose: () => void;
  onChanged?: () => Promise<void> | void;
  setLocked?: (value: boolean) => void;
}) {
  const isManage = canManage ?? manage ?? false;
  const [history, setHistory] = useState<RecruitmentHistory[]>([]);
  const [stageId, setStageId] = useState(applicant.stageId);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    recruitment
      .applicantHistory(applicant._id)
      .then((value) => {
        if (active) setHistory(value);
      })
      .catch((err) => {
        if (active) setError(messageOf(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applicant._id]);

  const transition = async () => {
    if (!isManage || !stageId || stageId === applicant.stageId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await recruitment.transitionApplicant(applicant._id, applicant.version, stageId, note.trim());
      await onChanged?.();
      onClose();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const job = jobs.find((j) => j._id === applicant.jobId);
  const currentStage = stages.find((s) => s.id === applicant.stageId);

  return (
    <RecruitmentModal
      title={applicant.fullName}
      subtitle={`Ứng tuyển: ${job?.title || "Chưa gán vị trí"}`}
      visible
      onClose={onClose}
    >
      {/* Card 1: Thông tin ứng viên */}
      <View style={dtStyles.card}>
        <View style={dtStyles.cardHeader}>
          <View style={dtStyles.iconBox}>
            <User size={15} color="#059669" />
          </View>
          <Text style={dtStyles.cardTitle}>Hồ sơ ứng viên</Text>
          <View style={[dtStyles.stagePill, { backgroundColor: currentStage?.color ? `${currentStage.color}20` : "#ecfdf5", borderColor: currentStage?.color || "#059669" }]}>
            <Text style={[dtStyles.stagePillText, { color: currentStage?.color || "#059669" }]}>
              {currentStage?.name || "Giai đoạn ứng tuyển"}
            </Text>
          </View>
        </View>

        <View style={dtStyles.infoList}>
          <View style={dtStyles.infoRow}>
            <Briefcase size={14} color="#64748b" />
            <Text style={dtStyles.infoLabel}>Vị trí:</Text>
            <Text style={dtStyles.infoValue}>{job?.title || "—"}</Text>
          </View>

          {!!applicant.email && (
            <View style={dtStyles.infoRow}>
              <Mail size={14} color="#64748b" />
              <Text style={dtStyles.infoLabel}>Email:</Text>
              <Text style={dtStyles.infoValue}>{applicant.email}</Text>
            </View>
          )}

          {!!applicant.phone && (
            <View style={dtStyles.infoRow}>
              <Phone size={14} color="#64748b" />
              <Text style={dtStyles.infoLabel}>Điện thoại:</Text>
              <Text style={dtStyles.infoValue}>{applicant.phone}</Text>
            </View>
          )}

          {!!applicant.source && (
            <View style={dtStyles.infoRow}>
              <FileText size={14} color="#64748b" />
              <Text style={dtStyles.infoLabel}>Nguồn:</Text>
              <Text style={dtStyles.infoValue}>{applicant.source}</Text>
            </View>
          )}

          {applicant.skills && applicant.skills.length > 0 && (
            <View style={dtStyles.infoRow}>
              <Award size={14} color="#64748b" />
              <Text style={dtStyles.infoLabel}>Kỹ năng:</Text>
              <Text style={dtStyles.infoValue}>{applicant.skills.join(", ")}</Text>
            </View>
          )}

          {!!applicant.experience && (
            <View style={dtStyles.infoRow}>
              <FileText size={14} color="#64748b" />
              <Text style={dtStyles.infoLabel}>Kinh nghiệm:</Text>
              <Text style={dtStyles.infoValue}>{applicant.experience}</Text>
            </View>
          )}

          {!!applicant.availableDate && (
            <View style={dtStyles.infoRow}>
              <Calendar size={14} color="#64748b" />
              <Text style={dtStyles.infoLabel}>Nhận việc:</Text>
              <Text style={dtStyles.infoValue}>{formatDate(applicant.availableDate)}</Text>
            </View>
          )}

          <View style={dtStyles.infoRow}>
            <CheckCircle2 size={14} color="#059669" />
            <Text style={dtStyles.infoLabel}>Kết quả:</Text>
            <Text style={[dtStyles.infoValue, { color: "#059669", fontWeight: "700" }]}>
              {formatOutcome(applicant.outcome)}
            </Text>
          </View>
        </View>

        {!!applicant.cvUrl && (
          <Pressable
            style={dtStyles.cvBtn}
            onPress={() => {
              const url = applicant.cvUrl;
              if (!url) return;
              if (url.startsWith("http")) {
                void Linking.openURL(url);
              } else {
                router.push(url as never);
              }
            }}
          >
            <ExternalLink size={14} color="#0284c7" />
            <Text style={dtStyles.cvBtnText}>Xem tệp CV đính kèm</Text>
          </Pressable>
        )}
      </View>

      {/* Card 2: Chuyển giai đoạn (nếu có quyền quản lý) */}
      {isManage && (
        <View style={dtStyles.card}>
          <View style={dtStyles.cardHeader}>
            <View style={dtStyles.iconBox}>
              <GitFork size={15} color="#059669" />
            </View>
            <Text style={dtStyles.cardTitle}>Chuyển giai đoạn tuyển dụng</Text>
          </View>

          <ChoiceField
            label="Giai đoạn tiếp theo"
            value={stageId}
            choices={stages
              .filter((stage) => stage.isActive)
              .map((stage) => ({ value: stage.id, label: stage.name }))}
            disabled={busy}
            onChange={setStageId}
          />

          <Field
            label="Ghi chú chuyển bước"
            value={note}
            multiline
            editable={!busy}
            onChangeText={setNote}
          />

          <Pressable
            style={({ pressed }) => [
              dtStyles.saveStageBtn,
              (busy || stageId === applicant.stageId) && { opacity: 0.5 },
              pressed && !busy && stageId !== applicant.stageId && { opacity: 0.85 },
            ]}
            disabled={busy || stageId === applicant.stageId}
            onPress={() => void transition()}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Check size={15} color="#ffffff" />
            )}
            <Text style={dtStyles.saveStageBtnText}>
              {busy ? "Đang chuyển..." : "Xác nhận chuyển giai đoạn"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Card 3: Lịch sử quy trình */}
      <View style={dtStyles.card}>
        <View style={dtStyles.cardHeader}>
          <View style={dtStyles.iconBox}>
            <Clock size={15} color="#059669" />
          </View>
          <Text style={dtStyles.cardTitle}>Lịch sử quy trình</Text>
        </View>

        {loading && <Loading />}
        {!loading && !history.length && (
          <Text style={dtStyles.emptyHistoryText}>Chưa có lịch sử chuyển bước nào.</Text>
        )}

        <View style={{ gap: 10 }}>
          {history.map((item) => (
            <View key={item._id} style={dtStyles.historyItem}>
              <View style={dtStyles.historyBullet} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={dtStyles.historyStageText}>
                  {item.fromStageName ? `${item.fromStageName} → ` : ""}
                  <Text style={{ fontWeight: "700" }}>{item.toStageName}</Text>
                </Text>
                <Text style={dtStyles.historyDateText}>
                  {new Date(item.createdAt).toLocaleString("vi-VN")}
                </Text>
                {!!item.note && <Text style={dtStyles.historyNoteText}>{item.note}</Text>}
              </View>
            </View>
          ))}
        </View>

        <ErrorText message={error} />
      </View>

      {/* Actions Row */}
      <View style={dtStyles.actionsRow}>
        <Pressable
          style={({ pressed }) => [dtStyles.cancelBtn, pressed && { opacity: 0.7 }]}
          onPress={onClose}
        >
          <X size={15} color="#475569" />
          <Text style={dtStyles.cancelBtnText}>Đóng</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [dtStyles.interviewBtn, pressed && { opacity: 0.85 }]}
          onPress={() => {
            onClose();
            router.push({
              pathname: "/(tabs)/interviews",
              params: { applicantId: applicant._id, jobId: applicant.jobId },
            });
          }}
        >
          <CalendarPlus size={15} color="#ffffff" />
          <Text style={dtStyles.interviewBtnText}>Lên lịch phỏng vấn</Text>
        </Pressable>
      </View>
    </RecruitmentModal>
  );
}

const dtStyles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  stagePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  stagePillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  infoList: {
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748b",
    minWidth: 70,
  },
  infoValue: {
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "500",
    flex: 1,
  },
  cvBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  cvBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284c7",
  },
  saveStageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#059669",
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 4,
  },
  saveStageBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  emptyHistoryText: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
    paddingVertical: 6,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#059669",
  },
  historyBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#059669",
    marginTop: 6,
  },
  historyStageText: {
    fontSize: 12,
    color: "#0f172a",
  },
  historyDateText: {
    fontSize: 11,
    color: "#64748b",
  },
  historyNoteText: {
    fontSize: 12,
    color: "#334155",
    backgroundColor: "#ffffff",
    padding: 6,
    borderRadius: 6,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  interviewBtn: {
    flex: 1.8,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#0284c7",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  interviewBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
