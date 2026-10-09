# LuxCare: nghiệm thu và gửi lại App Review

Cập nhật 09/10/2026 cho phản hồi Apple về bản **1.0 (23)**. Thay đổi đang ở source local; chưa deploy backend/web, build EAS mới hoặc gửi phản hồi vào App Store Connect.

## Thứ tự triển khai

1. Deploy backend/web có Credit tạm ngừng và quota AI dùng chung trước. Mã nguồn Credit/model/dữ liệu được giữ; không xóa số dư hoặc lịch sử.
2. Backend mở PUBLIC_REGISTRATION_ENABLED với SMTP hoạt động. Bật AI_FREE_ENABLED=true, hoặc dùng AI_PERSONAL_FREE_ENABLED=true nếu chưa khai báo AI_FREE_ENABLED. Giữ cấu hình hạn mức giờ/ngày/tháng hiện tại và ngân sách vận hành do LuxCare chịu; không có phí/ngân sách người dùng. Secrets chỉ đặt ở backend.
3. Tại mobile chạy npm run review:preflight. Có thể dùng LUXCARE_REVIEW_API_URL để kiểm tra staging HTTPS. Script chỉ gửi GET không xác thực, không tạo tài khoản/email, không gọi provider AI hay mua/nạp.
4. Preflight kiểm tra 10 đường dẫn: health/capabilities/legal pages 200; AI consent, AI status và Blog blocks 401; wallet/balance và company-wallet/status 410 FEATURE_DISABLED. Capabilities phải có registrationEnabled=true, companyWalletEnabled=false, aiQuotaEnabled=true. Bản server cũ không có flag mới sẽ FAIL, kể cả health vẫn 200.
5. Profile EAS production dùng HTTPS https://luxcare.igentechnology.net và remote versioning/autoIncrement. Build iOS mới phải lớn hơn **23**; kiểm tra số thực tế trong App Store Connect, không đoán dựa vào source.
6. Nghiệm thu TestFlight trên iPhone thật; chọn đúng build mới để gửi review. Preflight không thay thế kiểm tra nội dung trang và luồng đã đăng nhập.

## Nghiệm thu TestFlight

- Đăng nhập → **Đăng ký tài khoản** → mã email → workspace riêng. Tài khoản mới role trial_user, không tự thành admin doanh nghiệp được duyệt; không yêu cầu trả phí.
- Hồ sơ → **Doanh nghiệp & lời mời** → **Đăng ký doanh nghiệp**: gửi/theo dõi/bổ sung/hủy đơn miễn phí. Duyệt giữ mã/dữ liệu workspace và cấp quyền admin. Nhận lời mời sang tổ chức khác archive workspace riêng, không tự chuyển dữ liệu.
- AI trong Chat: đọc dữ liệu chia sẻ/tên bên xử lý/chính sách, từ chối phải chặn gửi, đồng ý mới gửi; thu hồi chặn request tiếp theo. Đổi tài khoản không dùng nhầm consent.
- AI không cần số dư Credit. Cùng tài khoản web/mobile phải cộng chung hạn mức. Dùng hết hạn mức thì có thông báo và thời điểm dùng lại; không có nút nạp/mua thêm. Không mô tả màn trợ lý cá nhân hay bảng số lượt còn lại nếu mobile không có màn đó.
- Mobile không có màn Credit/nạp; điều khoản ghi LuxCare chịu toàn bộ chi phí AI. API server vẫn phải chặn client/link/callback cũ. Các màn bảng lương là ghi nhận nghiệp vụ lương, không phải mua quyền sử dụng app.
- AI doanh nghiệp/Kho tri thức: consent riêng theo workspace; kiểm tra typing và lỗi provider. Quota không thay thế kiểm tra quyền hoặc consent.
- Chat/Blog: báo cáo, chặn/bỏ chặn và bộ lọc hiện lý do. Bố trí người xử lý hàng đợi báo cáo trên web; lọc cục bộ không đọc pixels/âm thanh bên trong file.
- Hồ sơ/Bảo mật tài khoản → Xóa; admin duy nhất thấy yêu cầu, hạn xử lý 7 ngày và tùy chọn hủy. Người vận hành phải hoàn tất trong hạn, không coi tiếp nhận là đã xóa.
- Link chính sách/điều khoản/hỗ trợ hoạt động trước và sau đăng nhập; trang render đúng nội dung miễn phí.

## App Store Connect

- [Bản nháp trả lời Apple 09/10](APP-REVIEW-RESPONSE-2026-10-09.md) trả lời năm câu **2.1(b)** và hỏi phạm vi yêu cầu **3.1.1**. Chưa gửi; không khẳng định đã bỏ đăng ký. Không tự suy ra 3.2 đã được duyệt.
- Giữ phân phối public theo mục tiêu sản phẩm. Metadata mô tả nhiều tổ chức độc lập, tự đăng ký và workspace riêng; không mô tả chỉ dành cho nhân viên LuxCare hay gói trả phí.
- Review Notes: Login → “Đăng ký tài khoản” → verify email → private workspace; Profile → “Doanh nghiệp & lời mời”; AI in Chat free within usage limits.
- Chuẩn bị reviewer account đã xác minh email, còn quota, có dữ liệu phù hợp; thêm account tổ chức đã duyệt nếu cần. Chỉ điền credentials trong Sign-In Information, không commit mật khẩu.
- Privacy URL https://luxcare.igentechnology.net/privacy-policy; support mailbox support@luxdefa.vn cần được theo dõi. App Privacy phản ánh dữ liệu thực tế: account/contact, nội dung người dùng/AI/tệp, usage/security, vị trí chấm công nếu bật. Consent AI không thay thế khai báo này.

Các lệnh build/submit xem [APP_STORE_RELEASE_GUIDE.md](APP_STORE_RELEASE_GUIDE.md). Chỉ thực hiện sau nghiệm thu và quyết định phát hành; cập nhật docs không tự phát hành hoặc sửa metadata online.
