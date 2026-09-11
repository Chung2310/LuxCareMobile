# Tài liệu Tổng hợp API Hệ thống LuxCare (`Chung2310/LuxCare`)

Tài liệu này tổng hợp toàn bộ các API Endpoints, phương thức HTTP, tham số và mô tả chức năng của hệ thống **LuxCare**, được khám phá và trích xuất trực tiếp từ mã nguồn repository.

---

## 📌 1. Cấu trúc & Quy tắc kết nối API

- **Base URL**: `https://<your-luxcare-domain>` (không bao gồm `/api/v1` ở origin URL).
- **Prefix chung**: Tất cả các API chính thức đều bắt đầu bằng `/api/v1/`.
- **Headers bắt buộc**:
  - `Authorization`: `Bearer <accessToken>`
  - `x-branch-id`: `<Mã ID Chi nhánh dạng ObjectId (24 ký tựHEX)>` (Tùy chọn theo phạm vi chi nhánh)
  - `x-luxcare-client`: `native` (Xác định thiết bị di động Mobile)
  - `Content-Type`: `application/json` (cho các yêu cầu JSON)

---

## 🛠️ 2. Danh mục API theo Phân hệ Chức năng

### 1. Xác thực & Quản lý Phiên làm việc (Auth & Sessions)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Đăng nhập tài khoản bằng Email & Mật khẩu | `{ email, password }` |
| `POST` | `/api/v1/auth/refresh-token` | Lấy lại Access Token mới khi hết hạn | `{ refreshToken }` |
| `POST` | `/api/v1/auth/logout` | Đăng xuất phiên làm việc hiện tại | Không có |
| `GET` | `/api/v1/auth/me` | Lấy thông tin chi tiết của người dùng đang đăng nhập | Không có |
| `GET` | `/api/v1/auth/users` | Lấy danh sách tài khoản người dùng/nhân sự | `?search=...&role=...` |
| `GET` | `/api/v1/auth/users/colleagues` | Lấy danh sách đồng nghiệp trong cùng doanh nghiệp | Không có |
| `PATCH` | `/api/v1/auth/users/:id` | Cập nhật thông tin/trạng thái tài khoản người dùng | `{ displayName, role, status, ... }` |

---

### 2. Tổng quan & Số liệu Báo cáo (Dashboard & Analytics)

| Phương thức | Endpoint API | Mô tả chức năng | Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/dashboard/summary` | Lấy số liệu thống kê tổng hợp toàn bộ phân hệ | Không có |
| `GET` | `/api/v1/dashboard/action-items` | Lấy danh sách các công việc/hồ sơ cần xử lý hôm nay | Không có |

---

### 3. Chấm công & Quản lý Ca làm việc (Timekeeping & Shift Management)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/timekeeping/today` | Kiểm tra trạng thái chấm công & lượt Vào/Ra hôm nay | Không có |
| `POST` | `/api/v1/timekeeping/check-in` | Thực hiện Chấm công Vào (Check-in) | `{ location, image, note }` |
| `POST` | `/api/v1/timekeeping/check-out` | Thực hiện Chấm công Ra (Check-out) | `{ location, image, note }` |
| `GET` | `/api/v1/crud/timekeeping-logs` | Truy vấn nhật ký chấm công nhân sự | `?startDate=...&endDate=...&employeeId=...` |
| `GET` | `/api/v1/crud/timekeeping-logs/:id` | Lấy chi tiết 1 bản ghi chấm công | Không có |
| `GET` | `/api/v1/crud/timekeeping-logs/:id/adjustments` | Lấy danh sách yêu cầu điều chỉnh công | Không có |
| `GET` | `/api/v1/timekeeping/shifts` | Lấy danh sách danh mục Ca làm việc | Không có |
| `POST` | `/api/v1/timekeeping/shifts` | Tạo mới Ca làm việc | `{ name, startTime, endTime, ... }` |
| `PATCH` | `/api/v1/timekeeping/shifts/:id` | Cập nhật thông tin Ca làm việc | `{ name, startTime, endTime, ... }` |
| `DELETE` | `/api/v1/timekeeping/shifts/:id` | Xóa Ca làm việc | Không có |
| `GET` | `/api/v1/timekeeping/shift-assignments` | Lấy danh sách phân ca cho nhân viên | `?month=...&year=...` |
| `POST` | `/api/v1/timekeeping/shift-assignments` | Phân ca làm việc cho nhân viên | `{ employeeId, shiftId, date }` |

---

### 4. Quản lý Thiết bị y tế & Cơ sở (Equipment Management)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/equipment` | Truy vấn danh sách thiết bị y tế / cơ sở | `?search=...&status=...&category=...` |
| `GET` | `/api/v1/equipment/summary` | Thống kê số lượng thiết bị theo trạng thái | Không có |
| `GET` | `/api/v1/equipment/compliance` | Báo cáo tỷ lệ kiểm định & bảo trì thiết bị | Không có |
| `GET` | `/api/v1/equipment/:id` | Lấy chi tiết thông tin 1 thiết bị | Không có |
| `POST` | `/api/v1/equipment` | Tạo mới bản ghi Thiết bị | `{ code, name, status, category, ... }` |
| `PATCH` | `/api/v1/equipment/:id` | Cập nhật thông tin/trạng thái Thiết bị | `{ name, status, notes, ... }` |
| `DELETE` | `/api/v1/equipment/:id` | Xóa bản ghi Thiết bị khỏi hệ thống | Không có |

---

### 5. Quản lý Văn bằng & Chứng chỉ (HR Credentials)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/hr-credentials` | Danh sách văn bằng & chứng chỉ hành nghề | `?companyCode=...&employeeId=...` |
| `POST` | `/api/v1/hr-credentials/upload` | Tải lên bản scan văn bằng / chứng chỉ mới | `FormData(file, credentialName, ...)` |
| `DELETE` | `/api/v1/hr-credentials/:id` | Xóa hồ sơ văn bằng chứng chỉ | `?companyCode=...` |

---

### 6. Hợp đồng Lao động (HR Contracts)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/hr-contracts` | Lấy danh sách hợp đồng lao động & phụ lục | `?search=...&type=...` |
| `POST` | `/api/v1/hr-contracts` | Tạo mới hợp đồng lao động | `{ contractNumber, employeeId, type, ... }` |
| `POST` | `/api/v1/hr-contracts/upload` | Tải lên tệp đính kèm Hợp đồng | `FormData(file)` |
| `PATCH` | `/api/v1/hr-contracts/:id` | Cập nhật/gia hạn Hợp đồng lao động | `{ endDate, status, salary, ... }` |
| `DELETE` | `/api/v1/hr-contracts/:id` | Xóa hồ sơ Hợp đồng lao động | Không có |

---

### 7. Phòng ban & Chi nhánh (Departments & Branches)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/departments` | Lấy danh sách các Phòng ban | `?search=...` |
| `GET` | `/api/v1/departments/:id` | Lấy thông tin chi tiết 1 Phòng ban | Không có |
| `POST` | `/api/v1/departments` | Tạo mới Phòng ban | `{ code, name, description, managerId }` |
| `PATCH` | `/api/v1/departments/:id` | Cập nhật thông tin Phòng ban | `{ name, managerId, status }` |
| `DELETE` | `/api/v1/departments/:id` | Xóa Phòng ban | Không có |
| `POST` | `/api/v1/departments/merge` | Gộp 2 phòng ban làm một | `{ sourceId, targetId }` |
| `GET` | `/api/v1/departments/unmapped` | Lấy danh sách phòng ban chưa phân loại | Không có |
| `GET` | `/api/v1/branches` | Lấy danh sách các Chi nhánh cơ sở | Không có |
| `POST` | `/api/v1/branches` | Tạo mới Chi nhánh | `{ code, name, address, phone }` |
| `PATCH` | `/api/v1/branches/:id` | Cập nhật thông tin Chi nhánh | `{ name, address, phone, ... }` |
| `DELETE` | `/api/v1/branches/:id` | Xóa Chi nhánh | Không có |

---

### 8. Quản lý Nghỉ phép & Đơn từ (Leave Applications)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/hr/leave-applications` | Truy vấn danh sách Đơn xin nghỉ phép | `?page=1&limit=20` |
| `POST` | `/api/v1/hr/leave-applications` | Gửi Đơn xin nghỉ phép mới | `{ leaveTypeId, startDate, endDate, reason }` |
| `POST` | `/api/v1/hr/leave-applications/:id/decision` | Duyệt / Từ chối Đơn xin nghỉ phép | `{ decision: "approved" \| "rejected", note }` |
| `DELETE` | `/api/v1/hr/leave-applications/:id` | Hủy / Xóa Đơn xin nghỉ phép | Không có |
| `GET` | `/api/v1/hr/leave-templates` | Lấy các mẫu đơn xin nghỉ phép | Không có |
| `POST` | `/api/v1/hr/leave-templates` | Tạo mới mẫu đơn nghỉ phép | `{ name, daysAllowed, paid }` |
| `DELETE` | `/api/v1/hr/leave-templates/:id` | Xóa mẫu đơn nghỉ phép | Không có |
| `GET` | `/api/v1/leave/balance` | Tra cứu quỹ ngày nghỉ còn lại của nhân viên | `?employeeId=...&year=2026` |
| `POST` | `/api/v1/hr/leave-files/upload` | Tải lên đơn / giấy xác nhận y tế đính kèm | `FormData(file)` |

---

### 9. Quản lý Công việc, Dự án & KPI (Kanban Tasks, Projects & Monthly KPI)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/kanban/tasks` | Danh sách công việc Kanban | `?branchId=...&status=...` |
| `POST` | `/api/v1/kanban/tasks` | Tạo mới Công việc | `{ title, description, assigneeId, dueDate, ... }` |
| `PATCH` | `/api/v1/kanban/tasks/:id` | Cập nhật tiến độ / trạng thái công việc | `{ status, progress, comment, ... }` |
| `DELETE` | `/api/v1/kanban/tasks/:id` | Xóa Công việc | Không có |
| `GET` | `/api/v1/kanban/projects` | Danh sách các Dự án | `?branchId=...` |
| `POST` | `/api/v1/kanban/projects` | Tạo mới Dự án | `{ name, code, startDate, endDate }` |
| `PATCH` | `/api/v1/kanban/projects/:id` | Cập nhật thông tin Dự án | `{ name, status, ... }` |
| `DELETE` | `/api/v1/kanban/projects/:id` | Xóa Dự án | Không có |
| `GET` | `/api/v1/kanban/kpi/monthly` | Lấy chỉ số KPI đánh giá hàng tháng | `?month=...&year=...` |

---

### 10. Bảng lương & Phiếu lương (Payroll & Payslips)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/payroll/runs` | Lấy danh sách kỳ tính lương | `?year=2026` |
| `GET` | `/api/v1/payroll/runs/:id` | Chi tiết bảng lương của kỳ tính lương | Không có |
| `POST` | `/api/v1/payroll/runs` | Khởi tạo kỳ tính lương mới | `{ month, year, branchId }` |
| `GET` | `/api/v1/payroll/runs/:runId/exports` | Xuất bảng lương dưới dạng tệp Excel | Không có |
| `GET` | `/api/v1/payroll/runs/:runId/payslips/:employeeId/print` | Xuất / In Phiếu lương nhân viên dạng PDF | Không có |
| `GET` | `/api/v1/payroll/payslips/me` | Lấy danh sách Phiếu lương cá nhân | Không có |

---

### 11. Tuyển dụng & Hồ sơ Ứng viên (Recruitment & Applicants)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/recruitment/jobs` | Danh sách vị trí tuyển dụng | `?status=open` |
| `POST` | `/api/v1/recruitment/jobs` | Đăng tuyển vị trí công việc mới | `{ title, departmentId, requirements, ... }` |
| `GET` | `/api/v1/recruitment/applicants` | Danh sách hồ sơ Ứng viên | `?jobId=...&stage=...` |
| `POST` | `/api/v1/recruitment/applicants` | Nộp hồ sơ ứng tuyển | `{ fullName, email, phone, jobId, cvUrl }` |
| `PATCH` | `/api/v1/recruitment/applicants/:id` | Cập nhật vòng phỏng vấn / kết quả ứng viên | `{ stage, rating, notes }` |
| `POST` | `/api/v1/recruitment/files/public` | Tải lên tệp CV public | `FormData(file)` |

---

### 12. Thông báo Hệ thống (Notifications)

| Phương thức | Endpoint API | Mô tả chức năng | Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | Lấy danh sách thông báo người dùng | `?page=1&limit=20&unreadOnly=true` |
| `POST` | `/api/v1/notifications/:id/read` | Đánh dấu 1 thông báo là Đã đọc | Không có |
| `POST` | `/api/v1/notifications/read-all` | Đánh dấu tất cả thông báo là Đã đọc | Không có |
| `DELETE` | `/api/v1/notifications/:id` | Xóa 1 thông báo | Không có |

---

### 13. Lịch làm việc & Sự kiện Doanh nghiệp (Corporate Work Calendar)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/crud/hr-calendar-events` | Lấy lịch sự kiện doanh nghiệp | `?companyCode=...&month=...` |
| `POST` | `/api/v1/crud/hr-calendar-events` | Tạo mới sự kiện / lịch họp | `{ title, startTime, endTime, location }` |
| `PATCH` | `/api/v1/crud/hr-calendar-events/:id` | Cập nhật sự kiện | `{ title, startTime, endTime, ... }` |
| `DELETE` | `/api/v1/crud/hr-calendar-events/:id` | Xóa sự kiện | Không có |

---

### 14. Quy trình làm việc & Tự động hóa (Workflows)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/crud/workflows` | Lấy danh sách các quy trình làm việc | `?search=...` |
| `POST` | `/api/v1/crud/workflows` | Thiết lập quy trình tự động hóa mới | `{ name, steps, triggers, ... }` |
| `PATCH` | `/api/v1/crud/workflows/:id` | Cập nhật các bước trong quy trình | `{ steps, status }` |
| `DELETE` | `/api/v1/crud/workflows/:id` | Xóa quy trình làm việc | Không có |

---

### 15. Quản lý Tệp, Media & Tài nguyên Cloud (Media & Resources)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/resources` | Truy vấn tệp tài nguyên, thư mục cloud | `?search=...&type=...` |
| `POST` | `/api/v1/media/upload` | Tải tệp media/tài liệu chung lên hệ thống | `FormData(file)` |
| `GET` | `/api/v1/media/download` | Tải xuống tệp lưu trữ trên cloud | `?fileId=...` |

---

### 16. Quản lý Email chúc mừng & Cấu hình SMTP (Celebration Emails & Company SMTP)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/company-email/celebration` | Lấy cấu hình tự động gửi email chúc mừng (sinh nhật, lễ Tết) | Không có |
| `PUT` | `/api/v1/company-email/celebration` | Cập nhật cấu hình & template email chúc mừng | `{ birthdayEnabled, holidayEnabled, sendTime, birthdayTemplate, holidayTemplate, holidayOverrides }` |
| `GET` | `/api/v1/company-email/celebration/stats` | Thống kê nhân sự (tổng nhân viên, số người thiếu ngày sinh) | Không có |
| `POST` | `/api/v1/company-email/celebration/preview` | Xem trước nội dung email sau khi thế biến động | `{ subject, html, holidayName }` |
| `GET` | `/api/v1/company-email/celebration/history` | Lấy lịch sử 200 lượt gửi email chúc mừng gần nhất | Không có |
| `GET` | `/api/v1/company-email/smtp` | Lấy cấu hình SMTP doanh nghiệp hiện tại | Không có |
| `PUT` | `/api/v1/company-email/smtp` | Lưu cấu hình SMTP gửi thư riêng của doanh nghiệp | `{ host, port, secure, user, password, fromEmail, fromName }` |
| `POST` | `/api/v1/company-email/smtp/verify` | Kiểm tra kết nối SMTP với máy chủ mail | Không có |
| `POST` | `/api/v1/company-email/smtp/test` | Gửi email thử nghiệm đến địa chỉ của người dùng | Không có |

---

### 17. Kho tri thức & SOP Y tế (Assistant Knowledge Base & Medical SOPs)

| Phương thức | Endpoint API | Mô tả chức năng | Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/assistant/knowledge/documents` | Lấy danh sách toàn bộ tài liệu, phác đồ, quy chuẩn trong kho tri thức | Không có |
| `GET` | `/api/v1/assistant/knowledge/documents/:id` | Lấy thông tin chi tiết một tài liệu tri thức | Không có |
| `POST` | `/api/v1/assistant/knowledge/documents` | Tạo mới tài liệu tri thức (văn bản) | `{ title, text, documentType, category, ... }` |
| `POST` | `/api/v1/assistant/knowledge/files` | Tải lên tệp tài liệu (PDF, Word, TXT...) để bóc tách & chunking AI | `FormData(files, documentType, category, ...)` |
| `POST` | `/api/v1/assistant/knowledge/test-search` | Tìm kiếm ngữ nghĩa & đối soát AI trong kho tri thức | `{ query, category, documentType }` |
| `PATCH` | `/api/v1/assistant/knowledge/documents/:id` | Cập nhật phân loại, phạm vi hoặc metadata tài liệu | `{ documentType, category, visibility, ... }` |
| `DELETE` | `/api/v1/assistant/knowledge/documents/:id` | Xóa tài liệu khỏi kho tri thức | Không có |
| `GET` | `/api/v1/assistant/knowledge/scopes` | Lấy danh sách phạm vi áp dụng (chi nhánh, phòng ban) | Không có |

---

## 📝 Tóm tắt Tổng số lượng API Endpoints:
- **Tổng cộng**: **82+ API Endpoints** được định nghĩa và sẵn sàng sử dụng trên toàn hệ thống **LuxCare**.
- Tất cả đều tương thích với cơ chế tự động làm mới phiên làm việc (Refresh Token) và truyền giá trị Chi nhánh (`x-branch-id`) trên ứng dụng di động.


