# LuxCare: gửi lại App Review theo mô hình B2B

Đọc [APP-REVIEW-B2B.md](APP-REVIEW-B2B.md) để có cấu hình, rollout, ma trận nghiệm thu và bản nháp trả lời Apple mới nhất.

1. Xác minh tổ chức khách hàng và thỏa thuận B2B. Cấp workspace/admin qua Superadmin; chuẩn bị tổ chức demo cho reviewer.
2. Deploy backend/web với ORGANIZATION_INVITATIONS_ENABLED=true, PUBLIC_REGISTRATION_ENABLED=false, SMTP và MongoDB transaction hoạt động. Giữ nguyên khóa mã hóa. Capabilities phải báo organization_only và registrationEnabled=false.
3. Nghiệm thu admin tạo tài khoản nhân viên, đăng nhập bằng tài khoản được cấp, đóng đăng ký/OTP tạo tài khoản cũ, từ chối truy cập cá nhân, bảo toàn dữ liệu cũ, xóa tài khoản, AI consent/quota và UGC report/block.
4. Tại mobile chạy review:preflight với public API. Preflight chỉ GET; cần TestFlight thực tế để xác nhận hành vi có đăng nhập.
5. Chạy workflow **Build iOS IPA (GitHub macOS)** với profile production để Xcode archive/export IPA trực tiếp trên runner và upload TestFlight. Cấu hình signing Secrets, chọn số build lớn hơn build trước theo [IOS_BUILD.md](../mobile/IOS_BUILD.md); bộ đếm EAS remote không được dùng.
6. Giữ App Store Connect distribution **Public**. Cập nhật metadata, screenshots, App Privacy, Review Notes, Sign-In Information và thông tin liên hệ. Không dùng bản phản hồi 09/10 đã đánh dấu lịch sử.
7. Chỉ gửi khẳng định đã triển khai khi backend/web và TestFlight mới cùng phản ánh B2B. Credentials reviewer chỉ nhập vào App Store Connect, không lưu trong source.

Các lệnh build/submit hiện có ở [APP_STORE_RELEASE_GUIDE.md](APP_STORE_RELEASE_GUIDE.md). Chỉnh source/docs không tự deploy, phát hành, gửi Apple hoặc thay đổi cấu hình online.
