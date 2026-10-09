# LuxCare: đăng ký và xét duyệt doanh nghiệp

## Luồng đã triển khai

1. Người dùng đăng ký bằng email, tên và mật khẩu (8–72 ký tự, tối đa 72 byte UTF-8), đồng ý điều khoản. Backend lưu PendingRegistration, chưa tạo User hoàn chỉnh trước khi xác minh.
2. Hệ thống gửi mã 6 chữ số bằng SMTP nền tảng. Mã hết hạn sau 15 phút, tối đa 5 lần thử; gửi lại cách nhau 60 giây.
3. Xác minh thành công tạo User role **trial_user**, Company workspace riêng có lifecycleStatus=trial và chi nhánh MAIN. Người dùng có companyCode của workspace riêng và được vào các module thử nghiệm theo quyền/module policy (hr/resource/supply), không tự thành admin một doanh nghiệp đã duyệt.
4. Người dùng có thể gửi/bổ sung/hủy đơn doanh nghiệp hoặc xác nhận/từ chối lời mời gửi tới email đó. Không phải tạo tài khoản mới để gửi đơn.
5. Superadmin → **Xét duyệt doanh nghiệp**: duyệt nâng workspace riêng lên active, giữ mã và dữ liệu; chủ tài khoản thành admin. Với tài khoản cũ chưa có workspace, dịch vụ tạo Company/MAIN khi duyệt. Các ghi thay đổi chạy trong transaction; có thể chọn module được cấp.
6. Admin → **Mời nhân viên qua email** trên web hoặc hồ sơ mobile. Lời mời hết hạn sau 7 ngày; có gửi lại, thu hồi và mời lại. Người nhận xác nhận rồi được gán role user và companyCode đích.
7. Khi trial_user tham gia tổ chức khác, workspace riêng được archive, không tự chuyển dữ liệu vào tổ chức đích. Một tài khoản chỉ có một companyCode đang hoạt động.

## Tài khoản và dữ liệu hiện có

- Không backfill companyCode, không đổi role hoặc mật khẩu của các tài khoản cũ.
- Tài khoản tự đăng ký sau xác minh có onboardingRequired=false và role trial_user; thành viên công ty cũ không phải xác minh lại email. Luồng xác minh còn được giữ cho tài khoản cũ có yêu cầu onboarding.
- Tài khoản cũ chưa có công ty chỉ được dùng màn tiếp nhận; tài khoản blog độc lập tiếp tục luồng blog.
- Quyền và công ty trong request được đọc từ User hiện tại, thay vì tin quyền cũ trong JWT.
- Mọi endpoint nghiệp vụ dùng requireAuth chặn tài khoản chưa có công ty. Bộ lọc tenant từ chối user thiếu companyCode.
- Duyệt đơn và nhận lời mời cùng ghi vào User trong transaction. Hai thao tác chạy đồng thời không thể đưa một tài khoản vào hai công ty.
- Công ty mới có `modulePolicyManaged=true`; cơ chế bổ sung module supply cho công ty cũ không áp dụng cho công ty mới.
- Chi nhánh MAIN mới cần được admin cấu hình địa điểm, IP, giờ làm trước khi chấm công.

## Cấu hình triển khai

Các biến dưới đây thuộc **backend**, không dùng tiền tố VITE_ hay EXPO_PUBLIC_ cho SMTP/secrets:

```dotenv
PUBLIC_REGISTRATION_ENABLED=true
PLATFORM_SMTP_HOST=smtp.example.com
PLATFORM_SMTP_PORT=587
PLATFORM_SMTP_SECURE=false
PLATFORM_SMTP_USER=mailer@example.com
PLATFORM_SMTP_PASSWORD=<password>
PLATFORM_SMTP_FROM=LuxCare <mailer@example.com>
PLATFORM_PUBLIC_URL=https://your-luxcare-domain.example/onboarding
```

- Giữ `SUPERADMIN_ENCRYPTION_KEY` hiện có (64 ký tự hex), không đổi khóa khi triển khai.
- MongoDB phải là replica set hoặc sharded cluster. Không chạy onboarding với standalone và không có fallback ghi dữ liệu ngoài transaction.
- `PUBLIC_REGISTRATION_ENABLED=false` đóng đăng ký và các thao tác onboarding mới; đăng nhập tài khoản cũ vẫn hoạt động.
- Khi bật flag, startup kiểm tra SMTP, topology và tạo các collection/index cần thiết trước khi nhận request. Sai cấu hình sẽ làm startup thất bại có chủ đích.
- Mail được lưu trong outbox mã hóa, gửi sau khi transaction commit. Worker có lease để chạy nhiều instance; tối đa 6 lần thử, xóa nội dung sau khi gửi, giữ metadata tối đa 30 ngày.
- Cấu hình EXPO_PUBLIC_API_URL trỏ tới backend mới. Backend là nguồn quyết định trạng thái mở đăng ký; mobile không tự quyết định flag.
- Có lệnh `npm run provision:onboarding` để kiểm tra index/topology bằng URI riêng `ONBOARDING_PROVISION_MONGODB_URI`; thêm `-- --apply` để tạo index. Không chạy lệnh này trên DB thật trong quá trình sửa code.

### Thứ tự rollout

1. Backup MongoDB và triển khai backend với flag false; kiểm tra đăng nhập tài khoản cũ.
2. Cấu hình SMTP, replica set, public URL; kiểm tra khả năng gửi email bằng hộp thư thử nghiệm.
3. Bật flag trên staging, chạy danh sách nghiệm thu bên dưới.
4. Triển khai web cùng backend đã nghiệm thu.
5. Build mobile mới cho TestFlight; nghiệm thu trên thiết bị thật.
6. Bật trên production sau khi backup và xác nhận các biến môi trường thực sự được truyền vào container.

### Rollback

- Đóng tiếp nhận bằng flag false. Đăng nhập và dữ liệu công ty đã tạo vẫn tồn tại.
- Nếu phải quay về backend cũ, giữ flag đóng và không dùng app mới cho onboarding. Không gỡ index/collection hoặc hoàn tác companyCode bằng script tự động.
- Không reset User session/role/tenant toàn bộ để xử lý sự cố onboarding.

## Xóa tài khoản

- Tài khoản chưa thuộc công ty: Bảo mật tài khoản trong màn Tài khoản → xác nhận mật khẩu → xóa hồ sơ, đơn, mã email và các lời mời.
- Thành viên công ty: dùng chức năng xóa tài khoản hiện có trong hồ sơ.
- Admin duy nhất: tiếp nhận yêu cầu trong app, trả HTTP 202; màn Tài khoản hiển thị hạn xử lý 7 ngày và cho phép hủy.
- Superadmin thấy yêu cầu trong **Xét duyệt doanh nghiệp**, xử lý bằng mật khẩu và 2FA. Nếu có admin thay thế thì bàn giao; nếu không có, tạm ngừng công ty, không xóa dữ liệu đồng nghiệp.
- Bộ phận vận hành phải theo dõi hàng đợi và đáp ứng hạn 7 ngày. Đây là xử lý thủ công trong hệ thống, không yêu cầu người dùng gọi điện/gửi email.
- Hồ sơ nghiệp vụ doanh nghiệp và dấu vết kiểm toán được giữ theo chính sách lưu dữ liệu. Không gọi việc tiếp nhận yêu cầu là “đã xóa”.
- Không xóa vật lý ảnh/file của các nhân viên khác hay tài nguyên công ty trong quá trình xóa một tài khoản.

## Nghiệm thu staging bắt buộc

1. Admin/user/manager/branch_owner cũ đăng nhập web và mobile; dữ liệu/chi nhánh/module cũ đúng.
2. Đăng ký mới, nhận email, nhập sai mã 5 lần, hết hạn, gửi lại, SMTP lỗi rồi retry. Thử request role=superadmin/companyCode phải không cấp quyền.
3. Xác minh xong vào workspace riêng với đúng role trial_user và module policy. API/socket chỉ truy cập dữ liệu workspace đó, không xem được công ty khác hoặc tự cấp role admin. Tài khoản legacy không có companyCode vẫn bị chặn nghiệp vụ.
4. Gửi trùng đơn, bổ sung đơn với revision cũ, hủy trong lúc đang duyệt, từ chối rồi gửi lại.
5. Duyệt hai lần cùng idempotency-key, mất response sau commit, mã công ty trùng: workspace riêng giữ mã/dữ liệu khi nâng active; không có công ty mồ côi hay admin thứ hai.
6. Admin công ty A không xem/thu hồi lời mời công ty B. Sai email, chưa xác minh, hết hạn, thu hồi, chi nhánh inactive phải bị từ chối.
7. Hai lời mời và duyệt đơn chạy đồng thời: đúng một companyCode. Tham gia tổ chức khác archive workspace riêng và không tự chuyển dữ liệu. Cần chạy với MongoDB thật hỗ trợ transaction.
8. Sau xác nhận/duyệt: profile được làm mới, vào workspace đúng công ty; app không còn gọi API doanh nghiệp trước khi có quyền.
9. Xóa tài khoản mới; admin duy nhất gửi đơn và hủy; superadmin hoàn tất; tài khoản đã xóa không đăng nhập/refresh được.
10. Web build, backend build, mobile typecheck/unit tests/export iOS+Android. Kiểm tra giao diện và bàn phím trên iPhone thật.

## API

- Public: GET /api/v1/onboarding/capabilities; POST /api/v1/auth/register.
- Personal: GET /onboarding/state; POST /onboarding/email/resend, /email/verify.
- Applications: POST /onboarding/applications; PATCH /applications/:id; POST /applications/:id/cancel.
- Recipient: POST /onboarding/invitations/:id/answer với accept boolean.
- Company admin: GET/POST /company-invitations; POST /:id/resend, /:id/revoke.
- Privileged platform: GET /super-admin/company-applications; POST /:id/review.
- Deletion: GET /super-admin/account-deletion-requests; POST /:id/complete; POST /onboarding/deletion/cancel.
- Tất cả đường dẫn rút gọn ở trên đều nằm dưới /api/v1. Mutation privileged cần idempotency-key.

## AI miễn phí và Credit tạm ngừng

Xem tài liệu AI-ACCESS-ROLLOUT.md trong repository backend LuxCare để cấu hình hạn mức AI dùng chung trên web/mobile và ngân sách vận hành do LuxCare chịu. Credit/nạp tiền đang tạm ngừng; code và dữ liệu cũ được giữ. Trước App Review, kiểm tra tài khoản reviewer dùng được AI và hạn mức trên backend đã triển khai.
