# Build iOS trực tiếp trên GitHub macOS

Workflow chính: `.github/workflows/build-ios.yml`, tên **Build iOS IPA (GitHub macOS)**.
Chạy thủ công trên `macos-26`, Xcode 26.4.1, Node 22. Expo CLI chỉ tạo native project bằng prebuild ngay trên runner; Xcode archive/export và Apple upload cũng chạy trên runner. Không gọi EAS Build/Submit, không cần EXPO_TOKEN hoặc quota EAS Build.
Expo project ID vẫn được giữ để đăng ký Expo Push Token. Dịch vụ gửi push hiện có là phần riêng với dịch vụ build.

## Thiết lập signing một lần

Trên GitHub repository **LuxCareMobile** → Settings → Secrets and variables → Actions.

| Secret | Nội dung |
| --- | --- |
| `IOS_DISTRIBUTION_P12_BASE64` | Base64 file Apple Distribution `.p12`, gồm certificate **và private key** |
| `IOS_DISTRIBUTION_P12_PASSWORD` | Mật khẩu xuất file `.p12`; có thể rỗng nếu file không đặt mật khẩu |
| `IOS_APP_STORE_PROFILE_BASE64` | Base64 provisioning profile **App Store Connect** cho Bundle ID hiện tại |
| `IOS_ADHOC_PROFILE_BASE64` | Chỉ cần cho preview: base64 profile **Ad Hoc** có UDID iPhone cần cài |
| `APP_STORE_CONNECT_API_KEY_BASE64` | Base64 file API key `.p8`; chỉ cần khi chọn upload TestFlight |
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID của App Store Connect API key |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID của App Store Connect API team key |

API key App Store Connect dùng quyền phù hợp để upload build (ví dụ App Manager). Đây là key khác với APNs push key. Workflow cũng nhận PEM nguyên văn trong secret API key nhưng base64 dễ sao chép hơn.

Nếu signing credentials hiện nằm trên EAS, dùng `eas credentials -p ios` tại `mobile/` trên máy quản trị để tải **credentials hiện có** về, lấy `.p12`, password và provisioning profile; thao tác này chỉ chuyển credentials, không build trên EAS. Không revoke certificate đang dùng. Nếu không còn credentials, tạo/export Apple Distribution certificate gồm private key bằng Keychain Access trên Mac và tạo profile tương ứng trên Apple Developer. API key `.p8` lấy từ App Store Connect → Users and Access → Integrations → App Store Connect API, thường chỉ tải được lúc tạo.

Profile phải khớp chính xác `com.luxcare.mobile`, team `VP77TD9A77`, còn hạn và chứa certificate trong `.p12`. Bật Push Notifications trên App ID và tạo lại profile nếu capability thiếu. Profile App Store/Ad Hoc phải có quyền push production khi ứng dụng sử dụng push nền. Luồng hiện hỗ trợ một app target; khi thêm extension phải bổ sung profile riêng trước khi build.

Base64 file trên Mac (kết quả chỉ dán vào GitHub Secret tương ứng):

```bash
base64 -i distribution.p12 | pbcopy
base64 -i LuxCare_AppStore.mobileprovision | pbcopy
base64 -i AuthKey_YOURKEYID.p8 | pbcopy
```

Trên PowerShell, đưa trực tiếp vào clipboard, không in nội dung lên log:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\signing\distribution.p12')) | Set-Clipboard
```

Giữ các file signing ngoài repository. Runner tạo keychain tạm, chỉ cấp signing app target, kiểm tra certificate/profile, sau đó xóa keychain/profile/API key kể cả khi build lỗi. Artifacts chỉ gồm IPA, dSYMs và log Xcode; không upload thư mục credentials.

## Variables và số build

| Variable | Mặc định |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | `https://luxcare.igentechnology.net` |
| `LUXCARE_IOS_BUNDLE_IDENTIFIER` | `com.luxcare.mobile` |
| `APPLE_TEAM_ID` | `VP77TD9A77` |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | `0ec1cf95-301c-44f9-8317-23b44d0f5234` (push registration) |
| `IOS_BUILD_NUMBER_BASE` | `1000` |

Số build mặc định = `IOS_BUILD_NUMBER_BASE + github.run_number`. Trước lần đầu, xem số build cao nhất trong App Store Connect và đặt base để kết quả lớn hơn số đó. Có thể nhập `build_number` thủ công. Bộ đếm version remote trong EAS không còn được dùng bởi workflow này. Nếu rerun một workflow đã upload thành công, số build không tự đổi: tạo Run workflow mới hoặc nhập số mới để tránh duplicate build. Khi dùng override lớn, tăng base cho các lần sau.

`app_version` có thể đặt `1.0.1`; để trống dùng `app.json`. Giữ marketing version phù hợp với phiên bản đang chuẩn bị gửi Apple.

## Chạy production / TestFlight

1. Deploy backend B2B trước. Workflow production chạy `review:preflight`; sẽ dừng trước signing nếu public API chưa đáp ứng cấu hình B2B, legal URLs hoặc Credit chưa tắt.
2. Đưa workflow và toàn bộ source mới lên nhánh cần build trong repository LuxCareMobile. Workflow phải có trên nhánh mặc định để nút Run workflow hiện ra.
3. Actions → **Build iOS IPA (GitHub macOS)** → Run workflow → chọn nhánh → profile `production`.
4. Chọn `upload_testflight=true` để upload sau khi IPA kiểm tra thành công; chọn false nếu chỉ cần tải IPA để dùng Transporter.
5. Tải artifact `LuxCare-ios-production-<run>-<attempt>`: `LuxCare.ipa`, debug symbols. Log native nằm trong artifact riêng, giữ 7 ngày.
6. Chờ Apple xử lý build trong App Store Connect → TestFlight. Upload thành công chưa đồng nghĩa build được xử lý xong hoặc được duyệt. Nghiệm thu lời mời, OTP, quyền tổ chức, AI/push và xóa tài khoản trên iPhone.
7. Chọn build mới khi resubmit. Giữ App Store Connect distribution **Public** theo [APP-REVIEW-B2B.md](../docs/APP-REVIEW-B2B.md).

Workflow chỉ upload binary, không tự gửi App Review hoặc phát hành App Store. Không cần Apple ID/password hay token Expo để chạy workflow này.

## Preview và thử cài qua USB

Chọn `profile=preview` để xuất IPA ký Ad Hoc; chỉ cài được trên các thiết bị có UDID trong profile. Preview không upload TestFlight kể cả checkbox đang bật. Thêm thiết bị phải cập nhật profile trong GitHub Secret trước khi build lại.

Workflow `.github/workflows/build-ios-sideloadly.yml` (**Build IPA & APK**) vẫn phục vụ thử nghiệm unsigned + Android, tự chạy khi push `develop`. IPA unsigned cần Sideloadly ký lại trên máy cài đặt; không dùng để gửi App Store. Production chọn workflow ký ở trên.

## Kiểm tra và giới hạn local

```bash
cd mobile
node --test scripts/prepare-ios-build.check.cjs scripts/configure-ios-signing.check.cjs
python3 scripts/ios-signing.check.py
bash -n scripts/build-signed-ios.sh
```

CI thường cũng chạy các kiểm tra helper này. Windows kiểm tra được cấu hình, profile validation và serialization Xcode project; archive/codesign/upload cần runner macOS cùng credentials thật. Build này dùng phút macOS GitHub; cần bảo đảm Actions được bật và billing/quota phù hợp. Nếu runner bỏ Xcode 26.4.1, cập nhật `DEVELOPER_DIR` sang bản đáp ứng Expo SDK 57 (Xcode 26.4 trở lên) sau khi kiểm tra.

Nguồn: [Expo native production builds](https://docs.expo.dev/guides/local-app-production/), [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [GitHub Apple signing](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications), [macOS runner image](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md), [Apple upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/).
