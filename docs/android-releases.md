# Phát hành APK và cập nhật cho khách

## Thiết lập một lần

Repository LuxCareMobile → Settings → Secrets and variables → Actions → thêm:

| Secret | Nội dung |
| --- | --- |
| ANDROID_KEYSTORE_BASE64 | Toàn bộ nội dung file .android-signing/ANDROID_KEYSTORE_BASE64.txt trên máy đã tạo khóa |
| ANDROID_KEYSTORE_PASSWORD | Toàn bộ nội dung file .android-signing/ANDROID_KEYSTORE_PASSWORD.txt |
| GOOGLE_SERVICES_JSON | Cấu hình Firebase Android đã thêm trước đó |

Khóa được tạo tại thư mục .android-signing ở gốc repository trên máy của bạn; thư mục này không được commit. Sao lưu nguyên thư mục vào nơi riêng có bảo vệ. Dùng lại hai secret ký APK cho mọi lần phát hành. Không tạo lại khóa mỗi lần build. File Service Account Firebase của backend không phải khóa ký APK.

Chạy workflow Build IPA & APK, chọn nhánh có thay đổi. Job Android dừng nếu thiếu khóa; APK đầu ra được ký lại bằng khóa riêng và xác minh bằng apksigner. Kiểm tra dấu vân tay SHA-256 trong log Sign customer APK khớp certificate-sha256.txt trong bản sao lưu.

## Mỗi lần cập nhật

1. Sửa code; khi phát hành tính năng mới, đổi version trong mobile/app.json, ví dụ 1.0.0 → 1.0.1.
2. Push rồi chạy Build IPA & APK. Android versionCode = 1000 + github.run_number, tự tăng theo mỗi lần chạy mới của workflow. Re-run cùng một run giữ nguyên versionCode; hãy tạo run mới khi phát hành bản cập nhật.
3. Tải artifact LuxCare-android-apk-..., gửi LuxCare.apk cho khách bằng kênh phân phối của bạn.
4. Khách mở APK và chọn Cập nhật. Giữ package com.igen.luxcare và khóa ký cố định để cài đè, giữ dữ liệu app.

Không phát hành một run cũ sau run mới. Nếu chuyển repository hoặc thay workflow làm bộ đếm bắt đầu lại, phải điều chỉnh mã phiên bản cao hơn bản đã phát hành. Số phiên bản xuất hiện trong GitHub Step Summary.

## Bản thử nghiệm cũ

APK trước thay đổi này dùng khóa debug của Expo template. Bản ký bằng khóa riêng không cập nhật đè được lên bản debug đó. Trên máy thử cần kiểm tra dữ liệu đã đồng bộ, gỡ bản debug rồi cài bản ký riêng một lần; gỡ app có thể mất dữ liệu lưu cục bộ. Giao bản ký riêng cho khách ngay từ đầu.

## Kiểm tra trước khi giao khách

Cài bản ký riêng A trên máy thử, đăng nhập; build run mới B với cùng hai secret rồi cài cập nhật B. Kiểm tra dữ liệu, đăng nhập và thông báo Firebase. CI kiểm tra APK/chữ ký nhưng không thay thế thử nghiệm cài cập nhật trên máy thật.

Luồng này là cập nhật bằng APK; chưa có nút tải bản mới trong app hoặc tự động cài đặt.

Tham khảo: https://developer.android.com/tools/apksigner
