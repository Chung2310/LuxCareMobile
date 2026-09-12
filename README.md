# LuxCare Mobile

Ứng dụng React Native + Expo SDK 57 sử dụng API LuxCare. Repository độc lập chứa mã mobile và các nguồn TypeScript dùng chung được lấy từ frontend LuxCare.

## Cài đặt và chạy

Yêu cầu Node.js >= 22.13 và npm.

```sh
git clone https://github.com/Chung2310/LuxCareMobile.git
cd LuxCareMobile
npm ci
npm ci --prefix mobile
```

Sao chép `mobile/.env.example` thành `mobile/.env`, đặt `EXPO_PUBLIC_API_URL` bằng origin backend (không thêm `/api/v1`). Android emulator có thể dùng `http://10.0.2.2:3000`; điện thoại thật dùng IP LAN hoặc HTTPS staging. Không đưa mật khẩu hoặc khóa bí mật vào biến `EXPO_PUBLIC_*`.

```sh
npm start
npm test
npm run typecheck
npm run export:native
```

Export tạo bundle JavaScript/Hermes cho Android và iOS, không tạo APK/IPA. Chưa cấu hình signing hoặc phát hành lên store. Backend chạy riêng; repository này không chứa server LuxCare.

## Cấu trúc và tài liệu

- `mobile/`: ứng dụng Expo, assets, lockfile và kiểm thử native.
- `src/`, `shared/`: các service, kiểu dữ liệu và quy tắc frontend mà mobile đang nhập trực tiếp; giữ cấu trúc này khi chạy Metro.
- [Hướng dẫn và lịch sử triển khai](mobile/README.md).
- [Ma trận chức năng và công việc còn lại](mobile/IMPLEMENTATION.md).
- [Yêu cầu tích hợp backend](docs/BACKEND.md).

Đã có các luồng tài khoản, tổng quan, thông báo, nhân sự, đơn từ, chấm công/ca/lịch, công việc/dự án/KPI, tuyển dụng và hợp đồng cơ bản. Đây là bản đang phát triển; chưa đầy đủ mọi chức năng LuxCare và chưa UAT trên thiết bị/staging thực tế.

Các nguồn dùng chung là bản sao tại thời điểm tách repository, không tự đồng bộ từ LuxCare. Khi cập nhật API hoặc kiểu dữ liệu, cần cập nhật cả hai repository và chạy lại kiểm thử.

## Kiểm tra repository

Ngày 2026-09-08: 371/371 kiểm thử trong 65 file qua; TypeScript và export Hermes Android/iOS qua trong repository độc lập. Chưa kiểm thử thiết bị/staging thật.

## Build IPA và APK trên GitHub Actions

Workflow **Build IPA & APK** (`.github/workflows/build-ios-sideloadly.yml`) chạy khi push vào `develop` hoặc chọn **Run workflow**. Hai job chạy song song: IPA trên macOS và APK trên Ubuntu.

- Biến repository `EXPO_PUBLIC_API_URL`: địa chỉ HTTPS của backend.
- `LUXCARE_ANDROID_PACKAGE`: mã ứng dụng Android, ví dụ `com.yourcompany.luxcare`. Nếu không đặt, job dùng `LUXCARE_IOS_BUNDLE_IDENTIFIER`; mã này phải hợp lệ với Android (các phần ngăn bằng dấu chấm, không có dấu gạch ngang).
- `EXPO_PUBLIC_EAS_PROJECT_ID`: dùng chung cấu hình EAS hiện có nếu được đặt.

Khi job Android thành công, tải artifact `LuxCare-android-apk-<run_number>`, giải nén và cài `LuxCare.apk` trên điện thoại. APK là bản Release có sẵn JavaScript, không cần Metro. Artifact và log build được giữ 7 ngày; log Android nằm trong `LuxCare-android-build-log-<run_number>`.

APK dùng khóa debug có sẵn trong template Expo để cài thử nội bộ, chưa phải bản ký bằng khóa phát hành Google Play. Workflow IPA đã ký qua EAS (`build-ios.yml`) vẫn chạy thủ công riêng.
