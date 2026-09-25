# Hướng dẫn chi tiết Build & Đẩy App lên Apple App Store (iOS)

Tài liệu này tổng hợp toàn bộ quy trình, danh sách kiểm tra (checklist) và các bước kỹ thuật cần thiết để đưa ứng dụng **LuxCare** lên Apple App Store thành công, tránh bị Apple từ chối (reject).

---

## 1. Danh sách kiểm tra (App Store Submission Checklist)

| Hạng mục | Trạng thái | Ghi chú |
| :--- | :--- | :--- |
| **Cấu hình Codebase** | | |
| Cấu hình `NSMicrophoneUsageDescription` | ✅ Đã bổ sung | Bắt buộc cho tính năng ghi âm tin nhắn thoại trong Chat |
| Cấu hình `ITSAppUsesNonExemptEncryption` | ✅ Đã bổ sung | Bỏ qua khảo sát mã hoá thủ công trên TestFlight |
| Cấu hình `splash` screen | ✅ Đã bổ sung | Liên kết với `assets/splash-icon.png` |
| `supportsTablet: false` | ✅ Đã cấu hình | Tối ưu điện thoại, không bị bắt buộc nộp bộ ảnh iPad 13" |
| Default `bundleIdentifier` | ✅ Đã bổ sung | `com.luxcare.mobile` trong `app.json` |
| `eas.json` submit profile | ✅ Đã bổ sung | Hỗ trợ lệnh `eas submit -p ios` |
| Tính năng tự Xóa tài khoản (Account Deletion) | ✅ Đã triển khai | Bổ sung nút xóa, hộp thoại xác nhận mật khẩu và gọi API backend |
| **Chính sách & Pháp lý (Apple Review Guidelines)** | | |
| Đường link Chính sách bảo mật (Privacy Policy URL) | ✅ Đã tích hợp | Có màn hình in-app trực tiếp `/privacy-policy` & link theo URL dự án |
| Điều khoản sử dụng (Terms of Service / EULA) | ✅ Đã tích hợp | Có màn hình in-app trực tiếp `/terms-of-service` & link theo URL dự án |
| Cơ chế Báo cáo / Chặn vi phạm trong Chat (UGC) | ✅ Đã triển khai | Có nút Báo cáo vi phạm & Chặn người dùng trực tiếp trong Chat (Guideline 1.2) |
| Tài khoản Demo cho Apple Reviewer | ⚠️ Cần chuẩn bị | Cung cấp tài khoản test có sẵn dữ liệu, không chặn SMS OTP |
| **Tài nguyên Đồ họa & Metadata** | | |
| App Icon 1024x1024 (No Alpha / Flat) | ⚠️ Cần chuẩn bị | File PNG 1024x1024 không có kênh trong suốt (transparency) |
| Screenshots iPhone 6.7" / 6.9" | ⚠️ Cần chụp | Kích thước 1290 x 2796 px (iPhone 15/16 Pro Max), 3 - 5 ảnh |
| Mô tả, từ khóa, thông tin liên hệ hỗ trợ (Support URL) | ⚠️ Cần điền | Điền trong App Store Connect |
| **Tài khoản & Ký số** | | |
| Tài khoản Apple Developer Program ($99/năm) | ⚠️ Yêu cầu | Tài khoản cá nhân hoặc doanh nghiệp còn hiệu lực |
| App Record trên App Store Connect | ⚠️ Yêu cầu | Tạo app mới với Bundle ID khớp với dự án |
| Khóa thông báo đẩy APNs Key (`.p8`) | ⚠️ Yêu cầu | Tạo trên Apple Developer Console và nạp vào EAS |
| iOS Distribution Certificate & Provisioning Profile | ⚙️ Tự động qua EAS | EAS CLI tự động tạo và lưu trữ trên đám mây |

---

## 2. Chi tiết các yêu cầu kỹ thuật & Chính sách của Apple

### 2.1. Quyền truy cập thiết bị (Permissions / Info.plist)
Apple kiểm tra rất nghiêm ngặt chuỗi mô tả lý do yêu cầu quyền (Usage Descriptions). Nội dung phải giải thích rõ ràng **tại sao** ứng dụng cần quyền đó:
- `NSCameraUsageDescription`: Chấm công khuôn mặt, chụp ảnh hồ sơ/hợp đồng.
- `NSPhotoLibraryUsageDescription`: Đính kèm tệp, tải lên ảnh đại diện.
- `NSPhotoLibraryAddUsageDescription`: Lưu ảnh, video vào thiết bị.
- `NSLocationWhenInUseUsageDescription`: Xác định tọa độ thực tế khi chấm công vào/ra ca.
- `NSMicrophoneUsageDescription`: Ghi âm tin nhắn thoại trong phần Chat.

### 2.2. Xóa tài khoản (Apple Guideline 5.1.1(v) - Data Collection and Storage)
> *"If your app doesn't include account creation, you must provide a way to initiate account deletion within the app."*

Nếu app cho phép đăng nhập hoặc tạo tài khoản, người dùng **phải có quyền tự xóa hoặc gửi yêu cầu xóa tài khoản của mình ngay trong app** (thường đặt ở màn hình Profile hoặc Cài đặt tài khoản).
- Cần có hộp thoại xác nhận cảnh báo dữ liệu sẽ bị xóa hoặc vô hiệu hóa.
- Gọi API backend xóa/vô hiệu hóa tài khoản và xóa token khỏi thiết bị (`SecureStore`).

### 2.3. Quy định về tính năng Chat / Mạng xã hội (UGC - Guideline 1.2)
Vì LuxCare có tính năng gửi tin nhắn văn bản, ảnh, âm thanh giữa người dùng:
- Apple yêu cầu phải có Điều khoản sử dụng cam kết không dung thứ cho nội dung độc hại.
- Nếu ứng dụng chỉ dùng trong nội bộ doanh nghiệp (Internal Employee App), trong phần **Review Notes** gửi Apple, bạn hãy ghi rõ:
  > *"LuxCare is an internal workforce and operational management application for authorized employees of LuxCare. All user accounts are provisioned and managed directly by company administration under enterprise employment agreements."*

---

## 3. Các bước thiết lập trên Apple Developer & App Store Connect

### Bước 1: Đăng ký App ID & Bật Capabilities
1. Đăng nhập [Apple Developer Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).
2. Tạo mới một **App Identifier** (Bundle ID):
   - Description: `LuxCare Mobile`
   - Bundle ID: Khớp với ID trong cấu hình (ví dụ `com.luxcare.mobile` hoặc ID tổ chức của bạn).
3. Trong mục **Capabilities**, tích chọn:
   - **Push Notifications** (để dùng thông báo nền).

### Bước 2: Tạo APNs Auth Key (`.p8`) cho Push Notifications
1. Vào mục **Keys** → Chọn **Create a Key**.
2. Đặt tên: `LuxCare Push Key`, tích chọn **Apple Push Notifications service (APNs)**.
3. Tải về file `.p8` (chỉ tải được 1 lần duy nhất) và lưu lại **Key ID** cùng **Team ID**.
4. Nạp vào EAS:
   ```bash
   cd mobile
   npx eas-cli credentials
   # Chọn iOS -> Production -> Push Notifications Key -> Upload file .p8 vừa tải
   ```

### Bước 3: Tạo App mới trên App Store Connect
1. Truy cập [App Store Connect](https://appstoreconnect.apple.com/apps).
2. Nhấn dấu `+` → **New App**:
   - Platforms: **iOS**
   - Name: **LuxCare** (hoặc tên thương mại bạn muốn hiển thị)
   - Primary Language: Tiếng Việt hoặc English
   - Bundle ID: Chọn Bundle ID đã tạo ở Bước 1.
   - SKU: Mã định danh duy nhất (ví dụ: `luxcare-mobile-ios`).
   - User Access: Full Access.

---

## 4. Chuẩn bị Tài nguyên Đồ họa & Metadata

1. **App Icon Store**:
   - 1024 x 1024 px, PNG 24-bit (không chứa kênh Alpha / Transparency).
2. **Ảnh chụp màn hình (Screenshots)**:
   - **iPhone 6.7" / 6.9"**: 1290 x 2796 px (chụp từ iPhone 15 Pro Max hoặc 16 Pro Max trong Simulator).
   - Tối thiểu 3 ảnh cho các màn hình chính: Trang chủ/Dashboard, Chấm công/Ca làm việc, Bảng lương/Công việc, Trò chuyện/Thông báo.
3. **Thông tin mô tả**:
   - **Description**: Giới thiệu ứng dụng quản trị nhân sự, chấm công và điều hành dịch vụ chăm sóc LuxCare.
   - **Keywords**: `luxcare, cham cong, bang luong, quan ly nhan su, dieu hanh`
   - **Support URL**: Trang liên hệ hỗ trợ hoặc email cskh.
   - **Privacy Policy URL**: Link HTTPS chính sách bảo mật bắt buộc.

---

## 5. Hướng dẫn Build và Submit lên App Store

### Cách 1: Build và Submit trực tiếp bằng EAS CLI
1. Đăng nhập tài khoản Expo:
   ```bash
   npx eas-cli login
   ```
2. Chạy lệnh build bản production:
   ```bash
   cd mobile
   npx eas-cli build --platform ios --profile production
   ```
   *Lần đầu chạy, EAS CLI sẽ yêu cầu đăng nhập tài khoản Apple Developer để tự động tạo Distribution Certificate và Provisioning Profile.*
3. Sau khi build xong thành công, đẩy bản build lên TestFlight:
   ```bash
   npx eas-cli submit --platform ios --profile production
   ```
   *(Hoặc gộp cả 2 bước: `npx eas-cli build --platform ios --profile production --auto-submit`)*

### Cách 2: Sử dụng GitHub Actions
Dự án đã có sẵn workflow `.github/workflows/build-ios.yml`:
1. Cấu hình các Secret & Variable trong GitHub Repository Settings:
   - Secret: `EXPO_TOKEN`
   - Variables: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_EAS_PROJECT_ID`, `LUXCARE_IOS_BUNDLE_IDENTIFIER`
2. Vào tab **Actions** → Chọn **Build iOS IPA** → Chọn **Run workflow**:
   - Profile: `production`
3. Sau khi chạy xong, tải file IPA đã ký từ Artifacts về để dùng Transporter đẩy lên App Store Connect, hoặc cấu hình submit tự động.
