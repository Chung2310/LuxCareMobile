# LuxCare: onboarding theo lời mời tổ chức

Cập nhật 19/10/2026. Public là phương thức phân phối App Store; tài khoản và quyền sử dụng dịch vụ là B2B theo tổ chức.

Đọc [kế hoạch và hướng dẫn release B2B](APP-REVIEW-B2B.md) trước khi triển khai. Luồng đăng ký cá nhân/workspace riêng trước đây đã được thay bằng kích hoạt email có lời mời còn hạn.

- POST `/api/v1/auth/register`: kiểm tra lời mời, tổ chức/chi nhánh/người mời, gửi OTP và lưu invitationId vào pending registration.
- POST `/api/v1/auth/register/verify`: xác minh OTP và nhận lời mời, tạo User trực tiếp trong tổ chức trong transaction. Không tạo workspace cá nhân.
- GET `/api/v1/onboarding/capabilities`: registrationEnabled=false, invitationRegistrationEnabled theo cờ, accessModel=organization_only.
- POST/PATCH `/api/v1/onboarding/applications`: HTTP 410; giữ dữ liệu cũ và khả năng xử lý đặc quyền cho vận hành.
- Admin quản lý lời mời ở `/api/v1/company-invitations`; người đã có tài khoản nhận lời mời ở `/api/v1/onboarding/invitations/:id/answer`.
- ORGANIZATION_INVITATIONS_ENABLED=true bật lời mời/OTP/mail; PUBLIC_REGISTRATION_ENABLED không còn mở đăng ký cá nhân. Xem tài liệu B2B về tương thích cờ cũ và rollout.
- trial_user cũ giữ dữ liệu và quyền quản lý tài khoản/lời mời/xóa; không có quyền API nghiệp vụ/AI/socket cá nhân.
- Superadmin cấp workspace/admin cho tổ chức đã xác minh theo thỏa thuận B2B. Không mở lại form tự tạo tổ chức trong app.

Chưa có deploy, build TestFlight hay cập nhật App Store Connect chỉ từ việc sửa các file này.
