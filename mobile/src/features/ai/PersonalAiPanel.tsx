import { errorDetails } from "../../../../shared/error-details";
import { AiSharingNotice } from "./AiSharingNotice";
import { useAiSharing } from "./useAiSharing";
import { useSession } from "../../auth/SessionProvider";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { aiAccess } from "../../api/services";
import { Button, Card, Field, styles } from "../../ui";
import type { PersonalAiMessage, PersonalAiStatus } from "../../../../shared/ai-access";
const timeOf = (value?: string | null) => value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "";
export function PersonalAiPanel() {
  const { user } = useSession();
  const sharing = useAiSharing("personal", user?.uid || "");
  const [quota, setQuota] = useState<PersonalAiStatus | null>(null);
  const [history, setHistory] = useState<PersonalAiMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [resetAt, setResetAt] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let active = true;
    Promise.all([aiAccess.status(), aiAccess.history()]).then(([status, rows]) => {
      if (active) { setQuota(status); setHistory(rows); }
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  async function send() {
    if (!sharing.accepted || busy || question.trim().length < 2) return;
    setBusy(true); setError("");
    if (!key.current) key.current = `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    try {
      const submitted = question.trim();
      const result = await aiAccess.ask(submitted, key.current);
      setQuota(result.status);
      setHistory((previous) => [{ id: key.current!, question: submitted, answer: result.answer,
        createdAt: new Date().toISOString() }, ...previous].slice(0, 30));
      setQuestion(""); key.current = null; setResetAt(null);
    } catch (error: unknown) { const failure = errorDetails(error); if (failure.code === "AI_CONSENT_REQUIRED") sharing.refresh(); setError(failure.message || "Không thể hoàn tất yêu cầu AI."); setResetAt(failure.resetAt || null); if (failure.status) key.current = null; }
    finally { setBusy(false); }
  }
  return <Card>
    <Text style={styles.title}>Trợ lý AI cá nhân</Text>
    <Text style={styles.text}>Hỏi về kiến thức chung và công việc. Trợ lý không truy cập dữ liệu doanh nghiệp.</Text>
    {quota && <Text style={styles.text}>Còn {quota.remaining.hour}/{quota.limits.hour} lượt trong 60 phút, {quota.remaining.day}/{quota.limits.day} hôm nay và {quota.remaining.month}/{quota.limits.month} tháng này.</Text>}
    {quota?.resetAt && new Date(quota.resetAt).getTime() > clock && <Text style={styles.text}>Đã hết lượt. Dùng lại sau {timeOf(quota.resetAt)}.</Text>}
    {!!error && <Text accessibilityRole="alert" style={[styles.text, { color: "#b45309" }]}>{error}{resetAt ? ` Dùng lại sau ${timeOf(resetAt)}.` : ""}</Text>}
    <AiSharingNotice sharing={sharing} />
    <Field label="Câu hỏi của bạn" value={question} onChangeText={(value) => { setQuestion(value); key.current = null; }} multiline maxLength={1200} />
    <Button title={busy ? "Đang trả lời…" : "Gửi câu hỏi"} disabled={!sharing.accepted || busy || question.trim().length < 2 || Boolean((quota?.resetAt && new Date(quota.resetAt).getTime() > clock) || (resetAt && new Date(resetAt).getTime() > clock))} onPress={() => void send()} />
    {history.map((row) => <View key={row.id} style={{ borderTopWidth: 1, borderColor: "#e2e8f0", paddingTop: 12 }}>
      <Text style={[styles.text, { color: "#64748b" }]}>{timeOf(row.createdAt)}</Text>
      <Text style={[styles.text, { fontWeight: "700" }]}>{row.question}</Text>
      <Text style={styles.text}>{row.answer}</Text>
    </View>)}
  </Card>;
}
