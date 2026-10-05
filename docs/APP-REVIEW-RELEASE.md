# LuxCare: nghiệm thu và gửi lại App Review

## Thứ tự triển khai

1. Deploy backend/web mới trước. Không đưa build mới vào review khi endpoint `/api/v1/onboarding/capabilities` công khai vẫn trả 404.
2. Cấu hình backend mở đăng ký, SMTP Gmail hoạt động, AI cá nhân và ngân sách được bật theo nhu cầu. Giữ model AI đang dùng; consent tự lấy danh sách bên xử lý từ metadata công khai của OpenRouter.
3. Tại `mobile`, chạy `npm run review:preflight`. Script chỉ GET các endpoint health/capabilities/chính sách, không tạo tài khoản, gửi email hay gọi AI. Kết quả 200 chưa thay thế kiểm tra nội dung trang được render.
4. Profile EAS production đã đặt `EXPO_PUBLIC_API_URL=https://luxcare.igentechnology.net`; số build tăng tự động bằng remote versioning. Kiểm tra build mới lớn hơn 21 trong App Store Connect.
5. Build/TestFlight trên thiết bị thật. Chọn đúng build mới để gửi Apple.

## Nghiệm thu TestFlight

- Đăng nhập → Đăng ký tài khoản; tạo tài khoản không thuộc công ty; nhận và xác minh mã email.
- AI cá nhân: đọc dữ liệu chia sẻ/tên bên xử lý/chính sách; Không đồng ý phải chặn gửi, Đồng ý mới gửi; thu hồi phải chặn các request tiếp theo. Đăng xuất/đổi tài khoản không dùng nhầm sự đồng ý của tài khoản trước.
- Kiểm tra quota/lượt còn lại và thời điểm thử lại; không có màn mua/nạp Credit cá nhân.
- AI doanh nghiệp/Kho tri thức: xác nhận riêng cho workspace trước khi gửi câu hỏi hoặc nạp tài liệu; thấy trạng thái đang trả lời và lỗi nếu provider thất bại.
- Chat: nội dung/tệp bị bộ lọc chặn phải hiện lý do; báo cáo/chặn/bỏ chặn hoạt động. Admin kiểm tra và xử lý hàng đợi báo cáo trên web.
- Tài khoản cơ bản: Tài khoản → Bảo mật tài khoản → Xóa; tài khoản doanh nghiệp: Hồ sơ → Xóa. Admin duy nhất thấy deadline 7 ngày và tùy chọn hủy.
- Link chính sách/điều khoản/hỗ trợ hoạt động trước và sau đăng nhập.

## App Store Connect

- Dùng Privacy URL `https://luxcare.igentechnology.net/privacy-policy` và Support URL hoạt động; email hỗ trợ thống nhất `support@luxdefa.vn`, cần xác nhận được theo dõi.
- Mô tả/ảnh chụp phản ánh AI cá nhân miễn phí và doanh nghiệp xét duyệt; không mô tả toàn app là dành riêng cho nhân viên một công ty.
- Khai báo App Privacy theo dữ liệu thực tế và các tính năng đang bật, gồm thông tin tài khoản, nội dung người dùng, usage/security và vị trí chấm công nếu dùng. Sự đồng ý AI không thay thế khai báo này.
- Chuẩn bị tài khoản reviewer cơ bản đã xác minh, còn quota; tài khoản công ty nếu cần kiểm tra nghiệp vụ. Điền credentials ở Sign-In Information, không commit mật khẩu.
- Trả lời đủ năm câu hỏi 3.2 theo bản nháp `D:/cty/LuxCare/docs/APP-REVIEW-ONBOARDING.md`; xác nhận mô hình khách hàng/thu phí đúng thực tế trước khi gửi.

## Giới hạn

Bộ lọc cục bộ kiểm tra văn bản, link và metadata tệp, không phân tích nội dung hình ảnh/âm thanh bên trong. Cần người phụ trách xử lý báo cáo và hành động kịp thời. Chưa deploy, build EAS, gửi email, gọi AI thật hoặc gửi trả lời Apple bằng tác vụ sửa code này.
