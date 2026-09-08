import { useCallback, useRef, useState } from "react";
import { Modal, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import type { RecruitmentPipeline } from "../../../src/types/recruitment";
import { recruitment } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { Button, Card, ErrorText, Loading, Page, styles } from "../../src/ui";
import { recruitmentAccess } from "../../src/features/recruitment/access";
import { OUTCOMES } from "../../src/features/recruitment/applicantModel";
import { PipelineForm } from "../../src/features/recruitment/PipelineForm";
export default function Pipeline() {
  const { user, selectedBranch } = useSession();
  const access = recruitmentAccess(user);
  const scopeReady = user?.role === "admin" ? !!selectedBranch?._id : !!user?.branchId;
  const [pipeline, setPipeline] = useState<RecruitmentPipeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const lock = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setPipeline(null);
      setError(null);
      setLoading(false);
      if (!access.read || !scopeReady) return;
      setLoading(true);
      void recruitment
        .getPipeline()
        .then((value) => {
          if (active) setPipeline(value);
        })
        .catch((error) => {
          if (active) setError(messageOf(error));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [access.read, scopeReady, selectedBranch?._id, revision]),
  );
  const close = () => {
    if (lock.current) return;
    setEditing(false);
    setRevision((value) => value + 1);
  };
  if (!access.read || !scopeReady)
    return (
      <Page title="Quy trình tuyển dụng">
        <Text style={styles.text}>Cần quyền đọc tuyển dụng và chi nhánh hợp lệ.</Text>
      </Page>
    );
  return (
    <>
      <Page title="Quy trình tuyển dụng">
        <ErrorText message={error} />
        {loading && <Loading />}
        {pipeline?.stages
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((stage, index) => (
            <Card key={stage.id}>
              <Text style={styles.heading}>
                {index + 1}. {stage.name}
              </Text>
              <Text style={styles.text}>
                {stage.isActive ? "Hoạt động" : "Đã tắt"} ·{" "}
                {stage.terminalOutcome
                  ? OUTCOMES.find((item) => item.value === stage.terminalOutcome)?.label
                  : "Đang tuyển"}
              </Text>
              <Text style={styles.muted}>Màu: {stage.color}</Text>
            </Card>
          ))}
        {access.manage && (
          <Button title="Chỉnh quy trình" disabled={loading || !pipeline} onPress={() => setEditing(true)} />
        )}
        <Button title="Tải lại" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
      </Page>
      <Modal visible={editing && access.manage} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.page}>
          {editing && pipeline && access.manage && (
            <PipelineForm
              pipeline={pipeline}
              setLocked={(value) => {
                lock.current = value;
              }}
              onClose={() => {
                setEditing(false);
                setRevision((value) => value + 1);
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}
