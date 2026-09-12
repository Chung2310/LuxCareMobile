import { useAppAlert } from "../../components/AppAlert";
import { useRef, useState } from "react";
import { Switch, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import type { RecruitmentPipeline, RecruitmentStage } from "../../../../src/types/recruitment";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Page, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { moveStage, pipelinePayload } from "./pipelineModel";
export function PipelineForm({
  pipeline,
  onClose,
  setLocked,
}: {
  pipeline: RecruitmentPipeline;
  onClose: () => void;
  setLocked: (value: boolean) => void;
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
    setLocked(true);
    setError(null);
    try {
      await recruitment.savePipeline(pipeline.version, input);
      onClose();
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
      if (!status || status >= 500 || status === 409 || /phiên bản|version/i.test(messageOf(error))) setBlocked(true);
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const disabled = busy || blocked;
  return (
    <Page title="Sửa quy trình tuyển dụng">
      <Text style={styles.muted}>
        Thứ tự từ trên xuống. Backend không cho xóa hoặc tắt giai đoạn đang có ứng viên. Kết quả cuối được áp dụng khi
        chuyển ứng viên vào giai đoạn đó.
      </Text>
      {stages.map((stage, index) => (
        <Card key={stage.id}>
          <Text style={styles.heading}>
            {index + 1}. {stage.name || "Giai đoạn mới"}
          </Text>
          <Field
            label="Tên giai đoạn"
            value={stage.name}
            editable={!disabled}
            onChangeText={(name) => change(stage.id, { name })}
          />
          <Field
            label="Màu (#RRGGBB)"
            value={stage.color}
            editable={!disabled}
            onChangeText={(color) => change(stage.id, { color })}
          />
          <ChoiceField
            label="Kết quả khi chuyển vào"
            value={stage.terminalOutcome || ""}
            disabled={disabled}
            choices={[
              { value: "", label: "Đang tuyển" },
              { value: "hired", label: "Đã tuyển" },
              { value: "rejected", label: "Từ chối" },
              { value: "withdrawn", label: "Rút hồ sơ" },
            ]}
            onChange={(value) =>
              change(stage.id, { terminalOutcome: value ? (value as RecruitmentStage["terminalOutcome"]) : null })
            }
          />
          <View style={styles.row}>
            <Text style={styles.text}>Hoạt động</Text>
            <Switch
              value={stage.isActive}
              disabled={disabled}
              onValueChange={(isActive) => change(stage.id, { isActive })}
            />
          </View>
          <Button
            title="Đưa lên"
            disabled={disabled || index === 0}
            onPress={() => setStages((rows) => moveStage(rows, index, -1))}
          />
          <Button
            title="Đưa xuống"
            disabled={disabled || index === stages.length - 1}
            onPress={() => setStages((rows) => moveStage(rows, index, 1))}
          />
          <Button
            title="Bỏ giai đoạn"
            disabled={disabled}
            onPress={() =>
              showAlert("Bỏ giai đoạn?", stage.name, [
                { text: "Hủy", style: "cancel" },
                {
                  text: "Bỏ khỏi bản chỉnh sửa",
                  style: "destructive",
                  onPress: () => setStages((rows) => rows.filter((item) => item.id !== stage.id)),
                },
              ])
            }
          />
        </Card>
      ))}
      <Button
        title="Thêm giai đoạn"
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
      />
      <ErrorText message={error} />
      {blocked && <Text style={styles.muted}>Đóng và tải lại quy trình trước khi lưu tiếp.</Text>}
      <Button
        title="Lưu quy trình"
        disabled={disabled}
        onPress={() => {
          try {
            const input = pipelinePayload(stages);
            showAlert(
              "Lưu quy trình tuyển dụng?",
              input.map((stage, index) => `${index + 1}. ${stage.name}${stage.isActive ? "" : " (tắt)"}`).join("\n"),
              [
                { text: "Hủy", style: "cancel" },
                { text: "Lưu", onPress: () => void save(input) },
              ],
            );
          } catch (error) {
            setError(messageOf(error));
          }
        }}
      />
      <Button title="Đóng và tải lại" disabled={busy} onPress={onClose} />
      {alertView}
    </Page>
  );
}
