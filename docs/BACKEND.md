# Tích hợp LuxCare API

Backend được triển khai từ repository LuxCare riêng. Đặt origin của backend trong `mobile/.env`; không có tài khoản hoặc secrets mẫu trong repository mobile.

Điều chỉnh lương dùng GET `/api/v1/payroll/periods/:periodKey/adjustments`, quyền `payroll-period:read`, scope công ty/chi nhánh xác thực và kỳ. API trả tên nhân viên cùng mảng điều chỉnh, chưa phân trang. Trạng thái approved và snapshotted được hiển thị riêng; mobile không tự cộng vào thực nhận. Luồng tra cứu không yêu cầu kỳ đã tồn tại bảng lương.

Lịch sử thanh toán gọi GET `/api/v1/payroll/runs/:id/payments` với quyền `payroll-payment:read`. API trả mảng sắp theo ngày tạo giảm dần trong phạm vi công ty/chi nhánh xác thực; mobile kiểm tra runId, lọc trạng thái tại máy và chỉ cộng amount của bản ghi confirmed. Dòng phân bổ dùng employeeId đối chiếu tên trong bảng lương, giữ mã nếu không tìm thấy tên. Chưa có API phân trang cho luồng này.

Tra cứu kỳ dùng GET `/api/v1/payroll/periods/:periodKey/run` với `payroll-period:read`. Mobile chỉ dùng `effectiveLines`; `effectiveError` được hiển thị thành lỗi thay vì dùng `lines` gốc. Backend hiện có thể tự sửa snapshot review khi checksum lệch trong quá trình GET; mobile không gửi yêu cầu tính/duyệt/chốt từ màn hình tra cứu. Chi tiết dòng vẫn yêu cầu quyền đọc/quản lý thanh toán hoặc quyền sở hữu phiếu đã phát hành ở backend.

Tải phiếu lương dùng GET `/api/v1/payroll/runs/:id/payslips/:employeeId/print` với Bearer token. Response hiện là `text/html`, có mẫu in và `window.print()` của backend; mobile lưu nguyên byte vào `.html` và mở bảng chia sẻ, không thực thi HTML trong app. API kiểm tra quyền, trạng thái phát hành và checksum; lỗi 403/404/409 được hiển thị, không dùng bản cũ để thay thế. Bản đã chia sẻ nằm trong cache thiết bị cho ứng dụng nhận đọc; chưa có xuất PDF/in native.

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

Phiếu lương cá nhân gọi `/api/v1/payroll/employee/me/payslips` và `/api/v1/payroll/runs/:id/lines/:employeeId`. Backend yêu cầu công ty/chi nhánh xác thực, chỉ trả phiếu đã phát hành của chính nhân viên với kỳ đã chốt/trả và checksum phát hành còn khớp. API chi tiết kiểm tra quyền đọc lương hoặc quyền sở hữu cùng bản phát hành; mobile không yêu cầu quyền quản lý cho luồng cá nhân. Danh sách hiện không có phân trang. Nguồn FE bổ sung ở đợt 39: `src/services/payrollService.ts` (tách transport) và `src/components/hr/payrollDetails.ts` (helper hiển thị), ngoài snapshot tách repository ban đầu.

Tài liệu chứng chỉ dùng `POST /api/v1/hr-credentials/upload?companyCode=...`, nhận data URL và trả `{ url, uploadToken }`. Khi tạo/sửa, mobile gửi `fileUrl`, `fileName`, `fileMimeType`, `fileSize`, `uploadToken`; không tự gán `resourceId`. API chấp nhận PDF/JPEG/PNG/WebP tối đa 10 MB. Token được hoàn tất vào nguồn `hr.credential` khi lưu hồ sơ. Bỏ chọn không xóa pending trên server; thay tài liệu không đảm bảo dọn tài nguyên cũ. Backend chưa có version/transaction cho cập nhật này; nếu kết quả lưu chưa xác định, cần tải lại trước khi gửi tiếp.

Upload hợp đồng mới/gia hạn hiện gửi các trường đơn (`contractFileUploadToken`, `signedImageUploadToken`, `extensionFileUploadToken`, `extensionSignedImageUploadToken`). Schema route hiện chưa nhận các mảng nhiều tệp dù controller/model có hỗ trợ mảng. Cần đồng bộ schema và hành vi cập nhật trước khi mở thay/gỡ tệp đã lưu trên mobile. Token pending hết hạn sau 24 giờ; bỏ chọn trên mobile không xóa tệp server.
