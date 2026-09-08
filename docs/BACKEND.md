# Tích hợp LuxCare API

Backend được triển khai từ repository LuxCare riêng. Đặt origin của backend trong `mobile/.env`; không có tài khoản hoặc secrets mẫu trong repository mobile.

- Login native gửi header `x-luxcare-client: native`. Backend phải trả refresh token cho native; refresh nhận token trong body, web tiếp tục dùng cookie HttpOnly.
- Mobile dùng Bearer access token trong bộ nhớ và refresh token trong SecureStore. Giữ chính sách phiên của backend; đăng nhập có thể thay thế phiên web.
- Các route phải giữ module/permission guard và phạm vi công ty/chi nhánh. Mobile gửi `x-branch-id` khi chọn chi nhánh; một số API còn nhận branchId trong query.
- Tuyển dụng cần bản sửa xóa/khôi phục ứng viên trong `server/service/recruitment-applicant.service.ts` của LuxCare: xóa truy vấn bản ghi chưa xóa, khôi phục truy vấn bản ghi đã xóa và cập nhật metadata tương ứng.
- Phòng ban cần xử lý tên cũ bằng mẫu literal đã escape trong `server/service/department.service.ts` và `department-legacy-pattern.ts` của LuxCare.
- Tải tài liệu dùng media proxy có xác thực và danh sách domain cho phép. Upload tài liệu/đơn từ cần các route managed upload tương ứng; tệp công khai tuyển dụng dùng `/api/v1/recruitment/files/public`.
- Hợp đồng chưa có version token chống cập nhật đồng thời. Mobile chỉ PATCH trường thay đổi; cần đối soát nếu nhiều người cùng sửa.
- Gia hạn trả `{ contract, extension }`, cập nhật hạn và chuyển expired về active. Backend hiện tạo lịch sử trước rồi lưu hợp đồng, chưa có transaction/idempotency chung; sau lỗi không rõ kết quả cần kiểm tra cả hai bản ghi trước khi gửi lại.
- Khung giờ check-in/out của ca hiện được lưu cấu hình nhưng backend chưa thực thi đầy đủ. Cờ xác nhận khuôn mặt lấy từ nguồn cấu hình chung, không tự bật ở mobile.

Các sửa đổi backend không được tự triển khai khi push repository mobile. Đối chiếu [ma trận triển khai](../mobile/IMPLEMENTATION.md) và kiểm thử trên staging trước nghiệm thu.

Tài liệu chứng chỉ dùng `POST /api/v1/hr-credentials/upload?companyCode=...`, nhận data URL và trả `{ url, uploadToken }`. Khi tạo/sửa, mobile gửi `fileUrl`, `fileName`, `fileMimeType`, `fileSize`, `uploadToken`; không tự gán `resourceId`. API chấp nhận PDF/JPEG/PNG/WebP tối đa 10 MB. Token được hoàn tất vào nguồn `hr.credential` khi lưu hồ sơ. Bỏ chọn không xóa pending trên server; thay tài liệu không đảm bảo dọn tài nguyên cũ. Backend chưa có version/transaction cho cập nhật này; nếu kết quả lưu chưa xác định, cần tải lại trước khi gửi tiếp.

Upload hợp đồng mới/gia hạn hiện gửi các trường đơn (`contractFileUploadToken`, `signedImageUploadToken`, `extensionFileUploadToken`, `extensionSignedImageUploadToken`). Schema route hiện chưa nhận các mảng nhiều tệp dù controller/model có hỗ trợ mảng. Cần đồng bộ schema và hành vi cập nhật trước khi mở thay/gỡ tệp đã lưu trên mobile. Token pending hết hạn sau 24 giờ; bỏ chọn trên mobile không xóa tệp server.
