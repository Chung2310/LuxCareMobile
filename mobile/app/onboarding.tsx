import { useCallback, useEffect, useState } from "react";
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession, messageOf } from "../src/auth/SessionProvider";
import { onboarding } from "../src/api/services";
import { Page, Field, Button, ErrorText, Card, styles } from "../src/ui";
import { PersonalAiPanel } from "../src/features/ai/PersonalAiPanel";
import { AuthLayout, AuthField, AuthButton, AuthFeedback, authStyles } from "../src/features/auth/AuthForm";
import type { CompanyApplication, CompanyApplicationInput, OnboardingState } from "../../shared/onboarding";
const empty: CompanyApplicationInput = {
  companyName: "",
  taxCode: "",
  address: "",
  phone: "",
  businessType: "general",
  purpose: "",
};
const labels: Record<string, string> = {
  pending: "Chờ xét duyệt",
  needs_information: "Cần bổ sung",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};
export default function Onboarding() {
  const { user, refreshProfile, logout, deleteAccount } = useSession();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [input, setInput] = useState(empty);
  const [editing, setEditing] = useState<CompanyApplication | undefined>();
  const [security, setSecurity] = useState(false);
  const [password, setPassword] = useState("");
  const [companyFormOpen, setCompanyFormOpen] = useState(false);
  const [emailAction, setEmailAction] = useState<"verify" | "resend" | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const load = async () => {
        try {
          const next = await onboarding.state();
          if (alive) setState(next);
          await refreshProfile();
        } catch (e) {
          if (alive) setError(messageOf(e));
        }
      };
      void load();
      const timer = setInterval(() => void load(), 30000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [user?.uid]),
  );
  if (!user) return <Redirect href="/login" />;
  async function act(task: () => Promise<unknown>, success = "Đã cập nhật.") {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await task();
      setMessage(success);
      setState(await onboarding.state());
      await refreshProfile();
    } catch (e) {
      if ((e as { code?: string })?.code === "EMAIL_COOLDOWN") setResendSeconds(60);
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  const update = (key: keyof CompanyApplicationInput, value: string) => setInput((v) => ({ ...v, [key]: value }));
  const active = state?.applications.find((v) => ["pending", "needs_information"].includes(v.status));
  function submit() {
    if (
      input.companyName.trim().length < 2 ||
      input.address.trim().length < 5 ||
      !/^\+?[0-9 ()-]{8,20}$/.test(input.phone) ||
      input.purpose.trim().length < 20
    ) {
      setError("Nhập tên doanh nghiệp, địa chỉ, điện thoại hợp lệ và nhu cầu tối thiểu 20 ký tự.");
      return;
    }
    void act(async () => {
      await onboarding.submit(input, editing);
      setEditing(undefined);
      setInput(empty);
      setCompanyFormOpen(false);
    }, "Đã gửi đơn xét duyệt.");
  }
  // Keep verification separate so account/company controls cannot crowd the code form.
  if (!user.companyCode && !(state?.emailVerified ?? Boolean(user.emailVerifiedAt))) {
    const loading = !state && !error;
    return (
      <AuthLayout title="Xác minh email" icon="mail-open-outline" headerAction={
        <Pressable accessibilityRole="button" accessibilityLabel="Quản lý tài khoản" disabled={busy}
          onPress={() => router.push("/account-security")} style={localStyles.accountAction}>
          <Ionicons name="person-circle-outline" size={25} color="#64748b" />
          <Text style={localStyles.accountActionText}>Tài khoản</Text>
        </Pressable>
      }>
        <View style={{ gap: 4 }}>
          <Text style={authStyles.description}>Nhập mã 6 chữ số đã gửi đến</Text>
          <Text style={authStyles.email}>{user.email}</Text>
        </View>
        <AuthField
          label="Mã xác minh"
          placeholder="000000"
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
          keyboardType="number-pad"
          maxLength={6}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          editable={!busy}
          style={localStyles.verificationCode}
        />
        <Text style={localStyles.codeHint}>Mã có hiệu lực trong 15 phút.</Text>
        <AuthFeedback message={error} error />
        <AuthFeedback message={message} />
        <AuthButton
          title={emailAction === "verify" ? "Đang xác minh…" : "Xác minh"}
          loading={emailAction === "verify"}
          disabled={busy || loading || code.length !== 6}
          onPress={() => {
            if (busy) return;
            Keyboard.dismiss();
            setEmailAction("verify");
            void act(async () => { await onboarding.verifyEmail(code); setCode(""); }, "Email đã được xác minh.")
              .finally(() => setEmailAction(null));
          }}
        />
        <AuthButton
          title={emailAction === "resend" ? "Đang gửi…" : resendSeconds > 0 ? `Gửi lại mã (${resendSeconds}s)` : "Gửi lại mã"}
          secondary
          loading={emailAction === "resend"}
          disabled={busy || loading || resendSeconds > 0}
          onPress={() => {
            if (busy) return;
            setEmailAction("resend");
            void act(async () => { await onboarding.resendCode(); setResendSeconds(60); }, "Đã gửi mã xác minh mới.")
              .finally(() => setEmailAction(null));
          }}
        />
      </AuthLayout>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <Page title="Tài khoản LuxCare" showBack={Boolean(user.companyCode)} onBack={() => router.replace("/(tabs)")}>
        <Text style={styles.text}>{user.email}</Text>
        <ErrorText message={error} />
        {message ? (
          <Text accessibilityRole="alert" style={styles.text}>
            {message}
          </Text>
        ) : null}
        {!state ? (
          <Button title="Tải lại" onPress={() => void act(async () => {})} disabled={busy} />
        ) : (
          <>
            {state.emailVerified && !user.companyCode && (
              <>
                {state.personalAiEnabled && <PersonalAiPanel />}
                {state.invitations.length > 0 && <Card>
                  <Text style={styles.title}>Lời mời vào doanh nghiệp</Text>
                  <Text style={styles.text}>
                    Tham gia với vai trò nhân viên. Chủ doanh nghiệp quản lý dữ liệu công việc trong doanh nghiệp đó.
                  </Text>
                  {state.invitations.map((v) => (
                    <Card key={v._id}>
                      <Text style={styles.text}>
                        {v.companyName} ({v.companyCode})
                      </Text>
                      <Text style={styles.text}>Hết hạn: {new Date(v.expiresAt).toLocaleString("vi-VN")}</Text>
                      <Button
                        title="Xác nhận tham gia"
                        disabled={busy}
                        onPress={() =>
                          Alert.alert(
                            "Tham gia doanh nghiệp?",
                            "Bạn sẽ trở thành nhân viên của " +
                              v.companyName +
                              ". Đơn mở công ty đang chờ sẽ được hủy.",
                            [
                              { text: "Hủy", style: "cancel" },
                              {
                                text: "Xác nhận",
                                onPress: () =>
                                  void act(async () => {
                                    await onboarding.answerInvite(v._id, true);
                                    await refreshProfile();
                                    router.replace("/(tabs)");
                                  }),
                              },
                            ],
                          )
                        }
                      />
                      <Button
                        title="Từ chối"
                        disabled={busy}
                        onPress={() => void act(() => onboarding.answerInvite(v._id, false))}
                      />
                    </Card>
                  ))}
                </Card>}
                <Card>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: companyFormOpen || Boolean(editing), disabled: busy }}
                    disabled={busy}
                    onPress={() => { setCompanyFormOpen(!(companyFormOpen || Boolean(editing))); setEditing(undefined); }}
                    style={({ pressed }) => [localStyles.sectionToggle, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="business-outline" size={21} color="#047857" />
                    <Text style={[styles.heading, { flex: 1 }]}>Đăng ký doanh nghiệp</Text>
                    <Ionicons name={companyFormOpen || editing ? "chevron-up" : "chevron-down"} size={18} color="#64748b" />
                  </Pressable>
                  {state.applications.map((v) => (
                    <Card key={v._id}>
                      <Text style={styles.text}>
                        {v.companyName} · {labels[v.status]}
                      </Text>
                      {v.reviewerNote && <Text style={styles.text}>Phản hồi: {v.reviewerNote}</Text>}
                      {v.status === "needs_information" && (
                        <Button
                          title="Bổ sung thông tin"
                          disabled={busy}
                          onPress={() => {
                            setEditing(v);
                            setInput({
                              companyName: v.companyName,
                              taxCode: v.taxCode,
                              address: v.address,
                              phone: v.phone,
                              businessType: v.businessType,
                              purpose: v.purpose,
                            });
                          }}
                        />
                      )}
                      {["pending", "needs_information"].includes(v.status) && (
                        <Button
                          title="Hủy đơn"
                          disabled={busy}
                          onPress={() =>
                            Alert.alert("Hủy đơn?", "Hủy đơn đăng ký doanh nghiệp này?", [
                              { text: "Giữ lại", style: "cancel" },
                              {
                                text: "Hủy đơn",
                                style: "destructive",
                                onPress: () => void act(() => onboarding.cancel(v._id)),
                              },
                            ])
                          }
                        />
                      )}
                    </Card>
                  ))}
                  {(!active || editing) && (companyFormOpen || editing) && (
                    <>
                      <Text style={styles.muted}>Gửi thông tin doanh nghiệp để LuxCare xét duyệt.</Text>
                      <Field
                        label="Tên doanh nghiệp"
                        placeholder="Nhập tên doanh nghiệp"
                        value={input.companyName}
                        onChangeText={(v) => update("companyName", v)}
                        maxLength={160}
                      />
                      <Field
                        label="Mã số thuế (nếu có)"
                        placeholder="Nhập mã số thuế"
                        value={input.taxCode}
                        onChangeText={(v) => update("taxCode", v)}
                        maxLength={32}
                      />
                      <Field
                        label="Địa chỉ"
                        placeholder="Nhập địa chỉ doanh nghiệp"
                        value={input.address}
                        onChangeText={(v) => update("address", v)}
                        maxLength={400}
                      />
                      <Field
                        label="Điện thoại"
                        placeholder="Nhập số điện thoại liên hệ"
                        value={input.phone}
                        onChangeText={(v) => update("phone", v)}
                        keyboardType="phone-pad"
                        maxLength={20}
                      />
                      <Text style={styles.text}>Loại hình doanh nghiệp</Text>
                      <View style={localStyles.businessTypes}>
                        {(["general", "service", "recruitment"] as const).map((key) => (
                          <Pressable
                            key={key}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: input.businessType === key, disabled: busy }}
                            disabled={busy}
                            onPress={() => update("businessType", key)}
                            style={({ pressed }) => [localStyles.businessType, input.businessType === key && localStyles.businessTypeSelected, pressed && { opacity: 0.7 }]}
                          >
                            <Text style={[styles.text, input.businessType === key && localStyles.businessTypeText]}>
                              {{ general: "Doanh nghiệp", service: "Dịch vụ", recruitment: "Tuyển dụng" }[key]}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Field
                        label="Nhu cầu sử dụng"
                        placeholder="Mô tả nhu cầu sử dụng (tối thiểu 20 ký tự)"
                        value={input.purpose}
                        onChangeText={(v) => update("purpose", v)}
                        multiline
                        maxLength={2000}
                      />
                      <Button title="Gửi xét duyệt" onPress={submit} disabled={busy} />
                      {editing && (
                        <Button title="Đóng chỉnh sửa" onPress={() => setEditing(undefined)} disabled={busy} />
                      )}
                    </>
                  )}
                </Card>
              </>
            )}
            {user.companyCode && (
              <Button title="Vào doanh nghiệp" onPress={() => router.replace("/(tabs)")} disabled={busy} />
            )}
            {state.deletionRequest && (
              <Card>
                <Text style={styles.title}>Yêu cầu xóa tài khoản</Text>
                <Text style={styles.text}>
                  Đang chờ xử lý. Hạn xử lý: {new Date(state.deletionRequest.dueAt).toLocaleDateString("vi-VN")}.
                </Text>
                <Button
                  title="Hủy yêu cầu xóa"
                  disabled={busy}
                  onPress={() => void act(() => onboarding.cancelDeletion())}
                />
              </Card>
            )}
            {!user.companyCode && (
              <Card>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: security }}
                  onPress={() => setSecurity(!security)}
                  style={({ pressed }) => [localStyles.sectionToggle, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="lock-closed-outline" size={19} color="#64748b" />
                  <Text style={[styles.text, { flex: 1 }]}>Bảo mật tài khoản</Text>
                  <Ionicons name={security ? "chevron-up" : "chevron-down"} size={17} color="#64748b" />
                </Pressable>
                {security && (
                  <>
                    <Text style={styles.text}>Xóa tài khoản sẽ xóa hồ sơ, các đơn đăng ký và lời mời của bạn.</Text>
                    <Field
                      label="Mật khẩu xác nhận"
                      placeholder="Nhập mật khẩu của bạn"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoComplete="current-password"
                    />
                    <Button
                      title="Xóa tài khoản"
                      disabled={busy || !password}
                      onPress={() =>
                        Alert.alert("Xóa tài khoản?", "Thao tác này không thể hoàn tác.", [
                          { text: "Hủy", style: "cancel" },
                          {
                            text: "Xóa",
                            style: "destructive",
                            onPress: async () => {
                              setBusy(true);
                              try {
                                await deleteAccount(password);
                              } catch (e) {
                                setError(messageOf(e));
                              } finally {
                                setBusy(false);
                              }
                            },
                          },
                        ])
                      }
                    />
                  </>
                )}
              </Card>
            )}
          </>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void logout().catch((e) => setError(messageOf(e)))}
          style={({ pressed }) => [localStyles.logout, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.muted}>Đăng xuất</Text>
        </Pressable>
      </Page>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  accountAction: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 6 },
  accountActionText: { color: "#64748b", fontFamily: "Inter-Medium", fontSize: 12 },
  verificationCode: { textAlign: "center", fontSize: 26, letterSpacing: 8, fontFamily: "Inter-SemiBold", minHeight: 60 },
  codeHint: { fontFamily: "Inter-Regular", fontSize: 12, lineHeight: 18, color: "#64748b", marginTop: -10 },
  sectionToggle: { minHeight: 44, flexDirection: "row", gap: 10, alignItems: "center" },
  businessTypes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  businessType: { minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderRadius: 10, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  businessTypeSelected: { backgroundColor: "#ecfdf5", borderColor: "#059669" },
  businessTypeText: { color: "#047857", fontFamily: "Inter-SemiBold" },
  logout: { minHeight: 44, justifyContent: "center", alignItems: "center", alignSelf: "center", paddingHorizontal: 14 },
});
