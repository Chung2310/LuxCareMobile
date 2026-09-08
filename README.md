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

Ngày 2026-09-08: 212/212 kiểm thử trong 45 file qua; TypeScript và export Hermes Android/iOS qua trong repository độc lập. Chưa kiểm thử thiết bị/staging thật.
