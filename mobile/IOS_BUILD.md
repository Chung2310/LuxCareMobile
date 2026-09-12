# Build IPA bằng GitHub Actions

## Cài qua USB bằng Sideloadly (không cần ký trên EAS)

Dùng workflow **Build iOS IPA for Sideloadly** trong `.github/workflows/build-ios-sideloadly.yml`.
Workflow tự chạy khi `develop` nhận commit mới (merge PR hoặc push trực tiếp); không chạy khi PR chỉ được mở/cập nhật. Vẫn hỗ trợ chạy thủ công qua Run workflow.
Workflow này chạy Xcode trên GitHub macOS 26, build Release cho iPhone thật, tắt code signing rồi đóng gói `Payload/*.app` thành `LuxCare-unsigned.ipa`.
Không cần EXPO_TOKEN, chứng chỉ .p12, provisioning profile, Apple Developer trả phí hoặc đăng ký UDID cho bước build này.
Không gửi Apple ID/mật khẩu lên GitHub. Sideloadly ký và cài bằng tài khoản của bạn trên máy tính.

### Cấu hình và chạy

1. GitHub → Settings → Secrets and variables → Actions → Variables:
   - `EXPO_PUBLIC_API_URL`: backend HTTPS mà iPhone truy cập được, không dùng localhost.
   - `LUXCARE_IOS_BUNDLE_IDENTIFIER`: ví dụ `com.yourcompany.luxcare`, giữ ổn định qua các lần cài.
   - `EXPO_PUBLIC_EAS_PROJECT_ID`: không bắt buộc cho build unsigned; chỉ dùng nếu đã có dự án Expo phù hợp.
2. Đưa workflow lên nhánh mặc định để hiện nút Run workflow.
3. Merge PR vào `develop` để tự build, hoặc Actions → **Build iOS IPA for Sideloadly** → Run workflow → chọn nhánh.
4. Tải artifact `LuxCare-ios-sideloadly-<run number>`, giải nén ZIP ngoài để lấy IPA. Không giải nén file IPA.
5. Cài Sideloadly từ trang chính thức. Trên Windows, làm theo yêu cầu iTunes/iCloud bản web của Sideloadly.
6. Kết nối iPhone qua USB, mở khóa và chọn Trust/Tin cậy máy tính.
7. Trong Sideloadly chọn iPhone, kéo IPA vào, nhập Apple ID và chạy cài đặt.
8. Nếu iOS yêu cầu, tin cậy tài khoản nhà phát triển trong Settings → General → VPN & Device Management và bật Developer Mode trong Privacy & Security.

### Giới hạn cần biết

- Tài khoản Apple miễn phí: app thường có hiệu lực 7 ngày; cần ký lại hoặc dùng auto-refresh của Sideloadly.
- App hiện dùng Expo SDK 57, yêu cầu iOS 16.4 trở lên. Không hạ minimum iOS bằng công cụ sideload để vượt yêu cầu native SDK.
- IPA unsigned không thể tự cài bằng cách mở file trên iPhone; phải được Sideloadly ký trước.
- Không phải bản TestFlight/App Store. Workflow EAS có ký vẫn được giữ riêng phía dưới.
- Bản này phù hợp thử độ mượt, login, Blog, chat. Socket realtime khi app đang hoạt động khác với push nền.
- Push nền/APNs cần quyền ký và credentials phù hợp; không dùng bản ký bằng Apple ID miễn phí để kết luận push hoạt động. App có thể báo thông báo nền chưa cấu hình/đăng ký thất bại.
- Đổi Bundle ID/nhóm ký có thể ảnh hưởng phiên đăng nhập, Keychain và push token; hãy kiểm tra lại login sau khi cài.
- Workflow kiểm tra arm64, nền tảng iphoneos và bundle JS trước khi xuất IPA. Chưa xác minh cài/chạy trên iPhone cho tới khi có build thực tế.
- Build dùng phút chạy macOS của GitHub Actions; không dùng quota EAS. Lỗi native build được lưu trong artifact log.
- Xcode được chọn là 26.4.1 (đáp ứng SDK 57); cần cập nhật đường dẫn nếu GitHub runner bỏ phiên bản này trong tương lai.

Nguồn: [Sideloadly chính thức](https://sideloadly.io/), [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).

## Luồng EAS có ký (tùy chọn thay thế)

Workflow: `.github/workflows/build-ios.yml`. Chỉ chạy thủ công, không chạy trên push/PR và không tự submit lên App Store.
GitHub dùng EAS Build cloud để ký/biên dịch iOS, sau đó tải IPA về Artifacts (giữ 7 ngày).
Có thể phát sinh phí/quota EAS và phút chạy GitHub. Bản build là Release, không cần Metro/Expo Go.

## Thiết lập một lần

Cần tài khoản Expo, dự án EAS và Apple Developer Program còn hiệu lực.
Trong GitHub → Settings → Secrets and variables → Actions, khai báo:

| Loại | Tên | Giá trị |
| --- | --- | --- |
| Secret | `EXPO_TOKEN` | Expo access token có quyền build dự án |
| Variable | `EXPO_PUBLIC_API_URL` | URL HTTPS backend mà iPhone truy cập được |
| Variable | `EXPO_PUBLIC_EAS_PROJECT_ID` | UUID dự án EAS |
| Variable | `LUXCARE_IOS_BUNDLE_IDENTIFIER` | Bundle ID đã đăng ký, ví dụ `com.yourcompany.luxcare` |

Không đặt mật khẩu, token API hoặc khóa bí mật trong các biến EXPO_PUBLIC.
Script CI chuyển ba giá trị cấu hình công khai vào profile EAS trước khi upload mã nguồn; không ghi EXPO_TOKEN vào file.
Tránh đặt giá trị khác cho cùng các biến trong EAS Environment.
Workflow upload cả repository để giữ các import nguồn chung `src/` và `shared/` ngoài mobile.

Trên máy phát triển, từ `mobile/`, đăng nhập Expo và liên kết đúng dự án bằng `npx eas-cli@latest init`.
Cấu hình các biến môi trường phía trên với cùng giá trị trong terminal.
Nếu init thay đổi app config, kiểm tra và lưu project ID đúng; app.config.js hiện cũng hỗ trợ project ID qua biến môi trường.

Đối với preview:
1. Chạy `npx eas-cli@latest device:create`, mở link trên từng iPhone và đăng ký thiết bị.
2. Chạy `npx eas-cli@latest build --platform ios --profile preview` tương tác một lần.
3. Đăng nhập Apple theo hướng dẫn để EAS tạo/lưu distribution certificate và provisioning profile, chọn đúng thiết bị.
4. Chờ build đầu tiên thành công rồi mới dùng CI.

Đối với production: thiết lập credentials bằng một lần build tương tác với `--profile production`.
CI dùng credentials đã lưu trên EAS, không cần đặt Apple ID/password hay file .p12 vào GitHub.
Thông báo đẩy còn cần APNs credentials tương ứng; chỉ build IPA thành công chưa đảm bảo push hoạt động.

## Chạy và tải IPA

1. Đưa workflow lên nhánh mặc định để nút Run workflow xuất hiện trong GitHub Actions.
2. Actions → **Build iOS IPA** → **Run workflow** → chọn nhánh và profile.
3. Sau khi thành công, tải artifact `LuxCare-ios-<profile>-<run number>`; giải nén để lấy `LuxCare.ipa`.

- `preview`: chỉ cài trên iPhone có UDID trong provisioning profile. Link cài trực tiếp nằm trên trang build EAS.
- `production`: IPA dành cho TestFlight/App Store; không cài trực tiếp như APK. Workflow không tự submit.
- Thêm iPhone mới: đăng ký rồi build tương tác lại/re-sign để cập nhật provisioning profile. CI non-interactive không tự thêm thiết bị mới.
- Khi hủy/timeout GitHub job, kiểm tra EAS: build cloud có thể vẫn chạy; hủy trên EAS nếu không cần.
- Nếu build báo thiếu signing credentials, quay lại bước thiết lập tương tác, không commit certificate hoặc khóa vào repo.

Kiểm tra script cấu hình: `node --test mobile/scripts/prepare-ios-build.check.cjs` từ thư mục gốc.
Chưa chạy build ký thật nếu chưa có tài khoản/credentials.

Tham khảo: [Expo CI](https://docs.expo.dev/build/building-on-ci/), [internal distribution](https://docs.expo.dev/build/internal-distribution/).
