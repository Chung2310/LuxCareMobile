import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { account, kanbanMedia } from "../../api/services";
import { messageOf, useSession } from "../../auth/SessionProvider";
import { confirmedPassword, profileName } from "./validation";
import { Ionicons } from "@expo/vector-icons";

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1594824813629-873b22b62908?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&auto=format&fit=crop&q=80",
];

export function AccountForm({
  mode,
  onClose,
  setLocked,
}: {
  mode: "profile" | "password";
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const { user, updateDisplayName, updateUserProfile } = useSession();
  const [name, setName] = useState(user?.displayName || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const isProfile = mode === "profile";

  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status === "granted") return true;

      Alert.alert(
        "Cần cấp quyền máy ảnh",
        "LuxCare cần quyền truy cập máy ảnh để chụp ảnh đại diện. Vui lòng cho phép trong Cài đặt thiết bị.",
        [
          { text: "Để sau", style: "cancel" },
          { text: "Mở Cài đặt", onPress: () => void Linking.openSettings() },
        ]
      );
      return false;
    } catch (err) {
      setError(messageOf(err));
      return false;
    }
  };

  const requestLibraryPermission = async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status === "granted") return true;

      Alert.alert(
        "Cần cấp quyền thư viện ảnh",
        "LuxCare cần quyền truy cập ảnh để chọn ảnh đại diện. Vui lòng cho phép trong Cài đặt thiết bị.",
        [
          { text: "Để sau", style: "cancel" },
          { text: "Mở Cài đặt", onPress: () => void Linking.openSettings() },
        ]
      );
      return false;
    } catch (err) {
      setError(messageOf(err));
      return false;
    }
  };

  const handleAssetUpload = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploadingPhoto(true);
    setError(null);
    try {
      const mimeType = asset.mimeType || "image/jpeg";
      const fileName = asset.fileName || `avatar_${Date.now()}.jpg`;
      let base64Data = asset.base64;

      if (!base64Data && asset.uri) {
        try {
          const file = new File(asset.uri);
          base64Data = await file.base64();
        } catch {}
      }

      const fileSize = asset.fileSize || 0;
      const dataUri = base64Data ? `data:${mimeType};base64,${base64Data}` : asset.uri;

      try {
        const result = await kanbanMedia.upload({
          file: dataUri,
          fileName,
          mimeType,
          size: fileSize,
        });
        if (result?.url) {
          setPhotoURL(result.url);
        } else {
          setPhotoURL(dataUri);
        }
      } catch {
        setPhotoURL(dataUri);
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickImageFromCamera = async () => {
    if (uploadingPhoto || busy) return;
    const hasPerm = await requestCameraPermission();
    if (!hasPerm) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      await handleAssetUpload(result.assets[0]);
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const pickImageFromLibrary = async () => {
    if (uploadingPhoto || busy) return;
    const hasPerm = await requestLibraryPermission();
    if (!hasPerm) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      await handleAssetUpload(result.assets[0]);
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const promptAvatarChoice = () => {
    if (uploadingPhoto || busy) return;
    Alert.alert(
      "Chọn ảnh đại diện",
      "Bạn muốn chụp ảnh mới hay chọn từ thư viện ảnh thiết bị?",
      [
        {
          text: "Chụp ảnh mới",
          onPress: () => void pickImageFromCamera(),
        },
        {
          text: "Chọn từ thư viện",
          onPress: () => void pickImageFromLibrary(),
        },
        {
          text: "Hủy",
          style: "cancel",
        },
      ]
    );
  };

  const submit = async () => {
    if (lock.current || !user || disabled) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      if (isProfile) {
        const displayName = profileName(name);
        const payload: Record<string, unknown> = { displayName };
        if (photoURL !== (user.photoURL || "")) {
          payload.photoURL = photoURL;
        }

        const result = await account.updateProfile(payload);
        if (result.uid !== user.uid) throw new Error("Hồ sơ trả về không khớp tài khoản hiện tại.");

        updateDisplayName(user.uid, result.displayName);
        updateUserProfile(user.uid, {
          displayName: result.displayName,
          photoURL: result.photoURL ?? photoURL,
        });
      } else {
        const next = confirmedPassword(password, confirmation);
        try {
          await account.changePassword(next);
        } catch (err) {
          if (!(err && typeof err === "object" && "status" in err) || Number(err.status) >= 500) {
            setUncertain(true);
            setPassword("");
            setConfirmation("");
            throw new Error(
              "Chưa xác nhận được kết quả đổi mật khẩu. Đóng màn hình và kiểm tra đăng nhập trước khi đổi lại.",
            );
          }
          throw err;
        }
        setPassword("");
        setConfirmation("");
      }
      setSuccess(true);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };

  const disabled = busy || uploadingPhoto || success || uncertain;
  const isPasswordValid = password.length >= 6 && password === confirmation;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            onPress={onClose}
            disabled={busy || uploadingPhoto}
          >
            <Ionicons name="close" size={20} color="#475569" />
          </Pressable>

          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerTitle}>
              {isProfile ? "Hồ sơ cá nhân" : "Đổi mật khẩu"}
            </Text>
            <Text style={styles.headerSub}>{user?.email}</Text>
          </View>

          {!success ? (
            <Pressable
              style={({ pressed }) => [
                styles.saveHeaderBtn,
                disabled && styles.saveHeaderBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
              disabled={disabled}
              onPress={() => void submit()}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveHeaderBtnText}>Lưu</Text>
              )}
            </Pressable>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Success Banner */}
          {success && (
            <View style={styles.successCard}>
              <Ionicons name="checkmark-circle" size={54} color="#059669" style={{ marginBottom: 6 }} />
              <Text style={styles.successTitle}>
                {isProfile ? "Cập nhật hồ sơ thành công!" : "Đổi mật khẩu thành công!"}
              </Text>
              <Text style={styles.successDesc}>
                {isProfile
                  ? "Tên hiển thị và ảnh đại diện mới đã được cập nhật trên toàn hệ thống."
                  : "Mật khẩu của bạn đã được cập nhật an toàn."}
              </Text>
              <Pressable style={styles.doneBtn} onPress={onClose}>
                <Text style={styles.doneBtnText}>Hoàn tất</Text>
              </Pressable>
            </View>
          )}

          {/* Error Banner */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color="#e11d48" />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {!success && isProfile && (
            <>
              {/* Section Avatar Picker */}
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionIconBox}>
                    <Ionicons name="image-outline" size={16} color="#059669" />
                  </View>
                  <Text style={styles.sectionTitle}>Ảnh đại diện (Avatar)</Text>
                </View>

                <View style={styles.avatarMainRow}>
                  {/* Large Avatar Preview with Camera overlay */}
                  <Pressable
                    style={styles.avatarPickerWrap}
                    onPress={promptAvatarChoice}
                    disabled={disabled}
                  >
                    {photoURL ? (
                      <Image source={{ uri: photoURL }} style={styles.largeAvatar} />
                    ) : (
                      <View style={styles.largeAvatar}>
                        <Text style={styles.largeAvatarText}>
                          {(name || user?.displayName || "U").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.cameraIconBadge}>
                      {uploadingPhoto ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Ionicons name="camera" size={13} color="#ffffff" />
                      )}
                    </View>
                  </Pressable>

                  {/* Actions right side */}
                  <View style={styles.avatarActionsCol}>
                    <View style={styles.avatarBtnRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.actionSmallBtn,
                          disabled && { opacity: 0.5 },
                          pressed && { opacity: 0.8 },
                        ]}
                        disabled={disabled}
                        onPress={pickImageFromCamera}
                      >
                        <Ionicons name="camera-outline" size={15} color="#ffffff" />
                        <Text style={styles.actionSmallBtnText}>Chụp ảnh</Text>
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [
                          styles.actionSmallBtn,
                          styles.actionSmallBtnSecondary,
                          disabled && { opacity: 0.5 },
                          pressed && { opacity: 0.8 },
                        ]}
                        disabled={disabled}
                        onPress={pickImageFromLibrary}
                      >
                        <Ionicons name="images-outline" size={15} color="#334155" />
                        <Text style={styles.actionSmallBtnTextSecondary}>Thư viện</Text>
                      </Pressable>
                    </View>

                    {uploadingPhoto && (
                      <Text style={styles.uploadingText}>Đang xử lý & tải ảnh...</Text>
                    )}

                    {photoURL ? (
                      <Pressable
                        style={styles.removePhotoBtn}
                        disabled={disabled}
                        onPress={() => setPhotoURL("")}
                      >
                        <Ionicons name="trash-outline" size={13} color="#e11d48" />
                        <Text style={styles.removePhotoBtnText}>Xóa ảnh đại diện</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.avatarHint}>Chạm vào ảnh hoặc chọn cách tải</Text>
                    )}
                  </View>
                </View>

                {/* Preset Avatars Row */}
                <View style={styles.presetSection}>
                  <Text style={styles.presetTitle}>Hoặc chọn avatar gợi ý:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.presetRow}
                  >
                    {PRESET_AVATARS.map((url, idx) => {
                      const isSelected = photoURL === url;
                      return (
                        <Pressable
                          key={idx}
                          style={[
                            styles.presetThumbWrap,
                            isSelected && styles.presetThumbWrapSelected,
                          ]}
                          onPress={() => setPhotoURL(url)}
                          disabled={disabled}
                        >
                          <Image source={{ uri: url }} style={styles.presetThumb} />
                          {isSelected && (
                            <View style={styles.presetCheck}>
                              <Ionicons name="checkmark" size={11} color="#ffffff" />
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              {/* Section Basic Info */}
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionIconBox}>
                    <Ionicons name="person-outline" size={16} color="#059669" />
                  </View>
                  <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Tài khoản Email</Text>
                  <View style={styles.emailBox}>
                    <Ionicons name="mail-outline" size={16} color="#64748b" />
                    <Text style={styles.emailBoxText}>{user?.email}</Text>
                    <View style={styles.lockedBadge}>
                      <Text style={styles.lockedBadgeText}>Cố định</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Họ và tên hiển thị *</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    editable={!disabled}
                    placeholder="Nhập họ và tên đầy đủ..."
                    placeholderTextColor="#94a3b8"
                    onChangeText={setName}
                  />
                  <Text style={styles.fieldHint}>
                    Tên này hiển thị trên toàn bộ phân hệ chấm công, hợp đồng và bảng tin.
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.submitBtn,
                    (!name.trim() || disabled) && styles.submitBtnDisabled,
                    pressed && { opacity: 0.88 },
                  ]}
                  disabled={!name.trim() || disabled}
                  onPress={() => void submit()}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Lưu thông tin</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}

          {!success && !isProfile && (
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#059669" />
                </View>
                <Text style={styles.sectionTitle}>Bảo mật tài khoản</Text>
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mật khẩu mới *</Text>
                <View style={styles.passwordInputWrap}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    editable={!disabled}
                    placeholder="Tối thiểu 6 ký tự..."
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    onChangeText={setPassword}
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword((v) => !v)}
                  >
                    <Ionicons
                      name={showPassword ? "eye-outline" : "eye-off-outline"}
                      size={18}
                      color="#64748b"
                    />
                  </Pressable>
                </View>
                {password.length > 0 && password.length < 6 && (
                  <Text style={styles.warningHint}>Mật khẩu cần tối thiểu 6 ký tự.</Text>
                )}
              </View>

              {/* Confirmation Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Xác nhận mật khẩu mới *</Text>
                <View style={styles.passwordInputWrap}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmation}
                    editable={!disabled}
                    placeholder="Nhập lại mật khẩu mới..."
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showConfirmation}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    onChangeText={setConfirmation}
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowConfirmation((v) => !v)}
                  >
                    <Ionicons
                      name={showConfirmation ? "eye-outline" : "eye-off-outline"}
                      size={18}
                      color="#64748b"
                    />
                  </Pressable>
                </View>
                {confirmation.length > 0 && password !== confirmation && (
                  <Text style={styles.errorHint}>Mật khẩu xác nhận chưa khớp.</Text>
                )}
                {confirmation.length > 0 && isPasswordValid && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.successHint}>Mật khẩu khớp và hợp lệ.</Text>
                  </View>
                )}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  (!isPasswordValid || disabled) && styles.submitBtnDisabled,
                  pressed && { opacity: 0.88 },
                ]}
                disabled={!isPasswordValid || disabled}
                onPress={() => void submit()}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Xác nhận đổi mật khẩu</Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  saveHeaderBtn: {
    backgroundColor: "#059669",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  saveHeaderBtnDisabled: {
    opacity: 0.5,
  },
  saveHeaderBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 10,
  },
  sectionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  avatarMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  avatarPickerWrap: {
    position: "relative",
  },
  largeAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  largeAvatarText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
  },
  cameraIconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#0f172a",
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIcon: {
    fontSize: 12,
  },
  avatarActionsCol: {
    flex: 1,
    gap: 6,
  },
  avatarBtnRow: {
    flexDirection: "row",
    gap: 6,
  },
  actionSmallBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#059669",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  actionSmallBtnSecondary: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  actionSmallBtnIcon: {
    fontSize: 12,
  },
  actionSmallBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  actionSmallBtnTextSecondary: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  uploadingText: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
  },
  removePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
  },
  removePhotoBtnText: {
    color: "#e11d48",
    fontSize: 12,
    fontWeight: "600",
  },
  avatarHint: {
    fontSize: 11,
    color: "#94a3b8",
  },
  presetSection: {
    gap: 8,
    marginTop: 4,
  },
  presetTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  presetRow: {
    gap: 10,
    paddingVertical: 2,
  },
  presetThumbWrap: {
    position: "relative",
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "transparent",
  },
  presetThumbWrapSelected: {
    borderColor: "#059669",
  },
  presetThumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  presetCheck: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  presetCheckText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },
  emailBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  emailBoxIcon: {
    fontSize: 14,
  },
  emailBoxText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  lockedBadge: {
    backgroundColor: "#e2e8f0",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  lockedBadgeText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "700",
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  passwordInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
  },
  eyeIcon: {
    fontSize: 16,
  },
  fieldHint: {
    fontSize: 11,
    color: "#64748b",
  },
  warningHint: {
    fontSize: 11,
    color: "#d97706",
    fontWeight: "500",
  },
  errorHint: {
    fontSize: 11,
    color: "#e11d48",
    fontWeight: "600",
  },
  successHint: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: "#fff1f2",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorBannerText: {
    color: "#e11d48",
    fontSize: 13,
    fontWeight: "600",
  },
  submitBtn: {
    backgroundColor: "#059669",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  successCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    gap: 8,
  },
  successIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  successDesc: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  doneBtn: {
    marginTop: 12,
    backgroundColor: "#059669",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  doneBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
