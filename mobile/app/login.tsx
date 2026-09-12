import { useEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect } from "expo-router";
import { messageOf, useSession } from "../src/auth/SessionProvider";
import { colors } from "../src/ui";
import { useAppAlert } from "../src/components/AppAlert";

export default function Login() {
  const session = useSession();
  const { showAlert, alertView } = useAppAlert();
  const { width } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [keyboardSpace, setKeyboardSpace] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardSpace(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardSpace(0);
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollToInput = (offset: number) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: offset, animated: true });
    }, 120);
  };

  if (session.user) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    Keyboard.dismiss();
    try {
      await session.login(email, password);
      setPassword("");
    } catch (error) {
      showAlert("Đăng nhập thất bại", messageOf(error), undefined, "error");
    } finally {
      setBusy(false);
    }
  };

  // bg-login.png natural dimensions: 941 x 1672
  // Scale strictly by screen width so the image is 100% fitted horizontally.
  const bgWidth = width;
  const bgHeight = width * (1672 / 941);

  // Position form lower down towards the bottom of the screen
  const topSpacing = bgHeight * (860 / 1672);

  return (
    <View style={localStyles.container}>
      <StatusBar style="light" />

      {/* Full width background image anchored to the top */}
      <Image
        source={require("../public/bg-login.png")}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: bgWidth,
          height: bgHeight,
        }}
        resizeMode="contain"
      />

      <SafeAreaView style={localStyles.safeArea} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={localStyles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={[
              localStyles.scrollContent,
              { paddingTop: topSpacing, paddingBottom: 36 + keyboardSpace },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={localStyles.formContainer}>
              <Text style={localStyles.heading}>
                Đăng nhập{" "}
                <Text style={localStyles.brandLuxcare}>Luxcare</Text>
              </Text>

              {/* Email Field with rounded corners and light green background */}
              <View style={localStyles.inputGroup}>
                <Text style={localStyles.label}>Email</Text>
                <TextInput
                  accessibilityLabel="Email"
                  placeholder="Nhập email của bạn"
                  placeholderTextColor={colors.muted}
                  style={localStyles.input}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => scrollToInput(170)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!busy}
                />
              </View>

              {/* Password Field with rounded corners, light green background and Eye icon */}
              <View style={localStyles.inputGroup}>
                <Text style={localStyles.label}>Mật khẩu</Text>
                <View style={localStyles.passwordBox}>
                  <TextInput
                    accessibilityLabel="Mật khẩu"
                    placeholder="Nhập mật khẩu"
                    placeholderTextColor={colors.muted}
                    style={localStyles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => scrollToInput(250)}
                    secureTextEntry={!showPassword}
                    autoComplete="current-password"
                    editable={!busy}
                    onSubmitEditing={() => void submit()}
                  />
                  <Pressable
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={localStyles.eyeButton}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    <Image
                      source={
                        showPassword
                          ? require("../assets/lucide-eye.png")
                          : require("../assets/lucide-eye-off.png")
                      }
                      style={localStyles.lucideEye}
                      resizeMode="contain"
                    />
                  </Pressable>
                </View>
              </View>

              {/* Submit button with matching rounded corners */}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy || !email.trim() || !password }}
                disabled={busy || !email.trim() || !password}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  localStyles.submitButton,
                  pressed && { opacity: 0.85 },
                  busy && { opacity: 0.7 },
                ]}
              >
                <Text style={localStyles.submitButtonText}>
                  {busy ? "Đang đăng nhập…" : "Đăng nhập"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {alertView}
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e7fdf6", // Blends seamlessly with the bottom gradient of bg-login.png
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 36,
  },
  formContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.2)", // Gần như trong suốt, nhìn xuyên thấu thấy trọn background
    borderWidth: 1.5,
    borderColor: "rgba(167, 243, 208, 0.75)", // Viền xanh nhạt thanh mảnh định hình card
    borderRadius: 26, // Bo góc mượt mà
    padding: 20,
    gap: 14,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "left",
    marginBottom: 2,
  },
  brandLuxcare: {
    fontSize: 36,
    fontWeight: "bold",
    color: colors.primary,
    fontFamily: Platform.select({ ios: "Snell Roundhand", android: "cursive" }),
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    marginLeft: 4,
  },
  input: {
    backgroundColor: "#ecfdf5", // Xanh lá nhạt tươi mát
    borderWidth: 1.2,
    borderColor: "#a7f3d0", // Viền xanh ngọc nhạt
    borderRadius: 24, // Bo tròn mềm mại
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  passwordBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5", // Xanh lá nhạt tươi mát
    borderWidth: 1.2,
    borderColor: "#a7f3d0", // Viền xanh ngọc nhạt
    borderRadius: 24, // Bo tròn mềm mại
    paddingLeft: 18,
    paddingRight: 6,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  eyeButton: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  lucideEye: {
    width: 22,
    height: 22,
  },
  submitButton: {
    backgroundColor: "#065f46", // Màu xanh lá đậm sâu, nổi bật và tương phản rất rõ với nền
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    marginTop: 4,
    shadowColor: "#065f46",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonText: {
    color: "#ffffff", // Chữ trắng nổi bật trên nền xanh đậm
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
