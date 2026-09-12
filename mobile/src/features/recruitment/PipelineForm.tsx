import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import * as Crypto from "expo-crypto";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  GitFork,
  Info,
  Plus,
  Trash2,
  X,
} from "lucide-react-native";
import type { RecruitmentPipeline, RecruitmentStage } from "../../../../src/types/recruitment";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { useAppAlert } from "../../components/AppAlert";
import { ErrorText, Field } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { moveStage, pipelinePayload } from "./pipelineModel";

const QUICK_COLORS = [
  "#3b82f6", // Blue
  "#059669", // Emerald
  "#10b981", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#64748b", // Slate
];

export function PipelineForm({
  pipeline,
  onClose,
  setLocked,
}: {
  pipeline: RecruitmentPipeline;
  onClose: () => void;
  setLocked?: (value: boolean) => void;
}) {
  const { showAlert, alertView } = useAppAlert();
  const [stages, setStages] = useState(() =>
    pipeline.stages
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((stage) => ({ ...stage })),
  );
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const change = (id: string, patch: Partial<RecruitmentStage>) =>
    setStages((rows) => rows.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)));

  const save = async (input: RecruitmentStage[]) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked?.(true);
    setError(null);
    try {
      await recruitment.savePipeline(pipeline.version, input);
      onClose();
    } catch (error) {
      const msg = messageOf(error);
      const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
      if (!status || status >= 500 || status === 409 || /phiên bản|version/i.test(msg)) setBlocked(true);
      setError(msg);
      showAlert("Không thể lưu quy trình", msg, [{ text: "Đã hiểu" }], "error");
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked?.(false);
    }
  };

  const disabled = busy || blocked;

  const handleValidateAndSave = () => {
    const emptyStages = stages.filter((s) => !s.name.trim());
    if (emptyStages.length > 0) {
      showAlert(
        "Thiếu thông tin bắt buộc",
        `Có ${emptyStages.length} giai đoạn chưa có tên. Vui lòng nhập tên cho tất cả các giai đoạn trong quy trình.`,
        undefined,
        "error",
      );
      setError("Vui lòng nhập tên cho tất cả các giai đoạn.");
      return;
    }
    if (!stages.some((stage) => stage.isActive)) {
      showAlert(
        "Thiếu thông tin bắt buộc",
        "Quy trình tuyển dụng cần ít nhất một giai đoạn đang hoạt động.",
        undefined,
        "error",
      );
      setError("Cần ít nhất một giai đoạn đang hoạt động.");
      return;
    }
    try {
      const input = pipelinePayload(stages);
      showAlert(
        "Lưu quy trình tuyển dụng?",
        input.map((stage, index) => `${index + 1}. ${stage.name}${stage.isActive ? "" : " (tắt)"}`).join("\n"),
        [
          { text: "Hủy", style: "cancel" },
          { text: "Xác nhận lưu", onPress: () => void save(input) },
        ],
      );
    } catch (error) {
      const msg = messageOf(error);
      showAlert("Thông tin chưa hợp lệ", msg, undefined, "error");
      setError(msg);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      {/* Tip Banner */}
      <View style={pipeStyles.tipBanner}>
        <Info size={16} color="#0284c7" />
        <Text style={pipeStyles.tipBannerText}>
          Thứ tự giai đoạn được sắp xếp từ trên xuống dưới. Giai đoạn có ứng viên đang xử lý không được xóa.
        </Text>
      </View>

      {/* Stage Cards */}
      {stages.map((stage, index) => (
        <View key={stage.id} style={pipeStyles.stageCard}>
          {/* Card Header */}
          <View style={pipeStyles.cardHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <View style={[pipeStyles.stepBadge, { backgroundColor: stage.color || "#059669" }]}>
                <Text style={pipeStyles.stepBadgeText}>#{index + 1}</Text>
              </View>
              <Text style={pipeStyles.stageCardTitle} numberOfLines={1}>
                {stage.name || `Giai đoạn #${index + 1}`}
              </Text>
            </View>

            {/* Stage Order & Delete Controls */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Pressable
                style={[pipeStyles.controlBtn, (disabled || index === 0) && pipeStyles.controlBtnDisabled]}
                disabled={disabled || index === 0}
                onPress={() => setStages((rows) => moveStage(rows, index, -1))}
              >
                <ChevronUp size={16} color={disabled || index === 0 ? "#cbd5e1" : "#475569"} />
              </Pressable>

              <Pressable
                style={[pipeStyles.controlBtn, (disabled || index === stages.length - 1) && pipeStyles.controlBtnDisabled]}
                disabled={disabled || index === stages.length - 1}
                onPress={() => setStages((rows) => moveStage(rows, index, 1))}
              >
                <ChevronDown size={16} color={disabled || index === stages.length - 1 ? "#cbd5e1" : "#475569"} />
              </Pressable>

              <Pressable
                style={[pipeStyles.controlBtn, disabled && pipeStyles.controlBtnDisabled]}
                disabled={disabled}
                onPress={() =>
                  showAlert("Xóa giai đoạn?", `Bạn có chắc muốn bỏ giai đoạn "${stage.name || `Giai đoạn #${index + 1}`}"?`, [
                    { text: "Hủy", style: "cancel" },
                    {
                      text: "Xóa khỏi bản lưu",
                      style: "destructive",
                      onPress: () => setStages((rows) => rows.filter((item) => item.id !== stage.id)),
                    },
                  ])
                }
              >
                <Trash2 size={15} color="#ef4444" />
              </Pressable>
            </View>
          </View>

          {/* Form Fields */}
          <Field
            label="Tên giai đoạn *"
            value={stage.name}
            editable={!disabled}
            onChangeText={(name) => change(stage.id, { name })}
          />

          {/* Quick Color Palette */}
          <View>
            <Text style={pipeStyles.fieldLabel}>Màu sắc đại diện</Text>
            <View style={pipeStyles.paletteRow}>
              {QUICK_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => change(stage.id, { color: c })}
                  style={[
                    pipeStyles.colorDot,
                    { backgroundColor: c },
                    stage.color?.toLowerCase() === c.toLowerCase() && pipeStyles.colorDotSelected,
                  ]}
                >
                  {stage.color?.toLowerCase() === c.toLowerCase() && (
                    <Check size={12} color="#ffffff" strokeWidth={3} />
                  )}
                </Pressable>
              ))}
            </View>
            <View style={{ marginTop: 8 }}>
              <Field
                label="Mã màu HEX"
                value={stage.color}
                editable={!disabled}
                onChangeText={(color) => change(stage.id, { color })}
              />
            </View>
          </View>

          <ChoiceField
            label="Kết quả chuyển giao"
            value={stage.terminalOutcome || ""}
            disabled={disabled}
            choices={[
              { value: "", label: "Đang tuyển (Không chốt kết quả)" },
              { value: "hired", label: "Đã tuyển (Trúng tuyển)" },
              { value: "rejected", label: "Từ chối (Không đạt)" },
              { value: "withdrawn", label: "Rút hồ sơ (Ứng viên tự rút)" },
            ]}
            onChange={(value) =>
              change(stage.id, { terminalOutcome: value ? (value as RecruitmentStage["terminalOutcome"]) : null })
            }
          />

          <View style={pipeStyles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={pipeStyles.switchLabel}>Kích hoạt giai đoạn này</Text>
              <Text style={pipeStyles.switchDesc}>Cho phép chuyển ứng viên vào bước này</Text>
            </View>
            <Switch
              value={stage.isActive}
              disabled={disabled}
              onValueChange={(isActive) => change(stage.id, { isActive })}
              trackColor={{ false: "#cbd5e1", true: "#a7f3d0" }}
              thumbColor={stage.isActive ? "#059669" : "#f8fafc"}
            />
          </View>
        </View>
      ))}

      {/* Add Stage Button */}
      <Pressable
        style={({ pressed }) => [
          pipeStyles.addStageBtn,
          disabled && { opacity: 0.6 },
          pressed && !disabled && { opacity: 0.8 },
        ]}
        disabled={disabled}
        onPress={() =>
          setStages((rows) => [
            ...rows,
            {
              id: Crypto.randomUUID(),
              name: "",
              color: "#64748b",
              position: rows.length,
              isActive: true,
              terminalOutcome: null,
            },
          ])
        }
      >
        <Plus size={16} color="#059669" />
        <Text style={pipeStyles.addStageBtnText}>Thêm giai đoạn mới</Text>
      </Pressable>

      <ErrorText message={error} />
      {blocked && (
        <Text style={{ fontSize: 12, color: "#dc2626", textAlign: "center" }}>
          Đóng và tải lại quy trình trước khi lưu tiếp.
        </Text>
      )}

      {/* Actions Row */}
      <View style={pipeStyles.actionsRow}>
        <Pressable
          style={({ pressed }) => [pipeStyles.cancelBtn, pressed && { opacity: 0.7 }]}
          disabled={busy}
          onPress={onClose}
        >
          <X size={15} color="#475569" />
          <Text style={pipeStyles.cancelBtnText}>Hủy</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            pipeStyles.submitBtn,
            disabled && { opacity: 0.6 },
            pressed && !disabled && { opacity: 0.85 },
          ]}
          disabled={disabled}
          onPress={handleValidateAndSave}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Check size={16} color="#ffffff" />
          )}
          <Text style={pipeStyles.submitBtnText}>
            {busy ? "Đang lưu..." : "Lưu quy trình"}
          </Text>
        </Pressable>
      </View>

      {alertView}
    </View>
  );
}

const pipeStyles = StyleSheet.create({
  tipBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f0f9ff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  tipBannerText: {
    fontSize: 12,
    color: "#0369a1",
    lineHeight: 18,
    flex: 1,
  },
  stageCard: {
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
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  stepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  stageCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  controlBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnDisabled: {
    opacity: 0.4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  paletteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  colorDotSelected: {
    borderWidth: 2,
    borderColor: "#0f172a",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
  },
  switchDesc: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  addStageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 12,
    paddingVertical: 12,
  },
  addStageBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
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
  submitBtn: {
    flex: 1.8,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
