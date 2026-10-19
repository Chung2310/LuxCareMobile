# LuxCare B2B: tài khoản do doanh nghiệp cấp

## Mô hình và phân phối

LuxCare bán dịch vụ trực tiếp cho các tổ chức theo thỏa thuận doanh nghiệp. Quản trị viên tổ chức tạo, phân quyền và quản lý tài khoản nhân viên. Nhân viên nhận tài khoản và đăng nhập, không tự tạo tài khoản qua lời mời hoặc đăng ký cá nhân.

App tiếp tục theo hướng phân phối **Public** trên App Store cho nhân viên của nhiều tổ chức độc lập. Chỉ khai báo mô hình thương mại và phạm vi khách hàng đúng thực tế; việc thay source không tự bảo đảm App Review chấp thuận.

## Luồng tài khoản

1. Vận hành xác minh tổ chức và cấp workspace/admin bằng chức năng Superadmin hiện có.
2. Admin tạo nhân viên tại Quản lý người dùng (`POST /api/v1/auth/register-user`), chọn chi nhánh/vai trò trong phạm vi được phép.
3. Nhân viên đăng nhập bằng tài khoản doanh nghiệp cung cấp và dùng các module được cấp quyền. Tài khoản admin tạo có tổ chức và không bị yêu cầu tự kích hoạt bằng lời mời.
4. Màn hình đăng nhập ghi “Tài khoản do quản trị viên doanh nghiệp cung cấp”. Không còn nút tạo tài khoản/kích hoạt lời mời.
5. Các link cũ `/dang-ky` (web), `/register` (mobile) đưa về đăng nhập.
6. `POST /auth/register` và `/auth/register/verify` trả 410 `SELF_REGISTRATION_DISABLED` cho request hợp lệ. OTP đã gửi trước đây cũng không tạo được tài khoản mới. Không tạo User/Company/Branch hoặc gửi OTP đăng ký.
7. Form tự nộp đơn doanh nghiệp tiếp tục đóng, API trả 410 `ORGANIZATION_APPLICATION_DISABLED`.

Luồng lời mời dành cho tài khoản cũ vẫn phục vụ chuyển đổi dữ liệu/tư cách thành viên qua xác thực. Lời mời không tạo tài khoản mới. API mời email chưa tồn tại trả `ACCOUNT_PROVISIONING_REQUIRED`; admin tạo nhân viên trực tiếp trong Quản lý người dùng. Một tài khoản vẫn chỉ thuộc một tổ chức đang hoạt động.

## Dữ liệu và quyền truy cập

- Không xóa hàng loạt hoặc chuyển dữ liệu cá nhân cũ sang doanh nghiệp.
- trial_user và tài khoản chưa có tổ chức vẫn được quản lý/xóa tài khoản, xác minh email cũ và xử lý lời mời phù hợp; nghiệp vụ/AI/socket tiếp tục bị chặn.
- Thành viên tổ chức active dùng module theo quyền. Tổ chức inactive tiếp tục bị chặn.
- Yêu cầu xóa tài khoản/admin duy nhất giữ cơ chế trạng thái, thời hạn xử lý và hủy yêu cầu hiện có.
- Credit/nạp tiền và mua thêm lượt trong ứng dụng tiếp tục tắt.
- Bán gói, hạn hợp đồng, số lượng nhân viên do vận hành quản lý; source không bổ sung thanh toán, gia hạn hoặc giới hạn seat tự động.

## Capabilities và cấu hình

`GET /api/v1/onboarding/capabilities` cần trả:

```json
{"registrationEnabled":false,"invitationRegistrationEnabled":false,"accessModel":"organization_only","personalAiEnabled":false,"companyWalletEnabled":false}
```

`PUBLIC_REGISTRATION_ENABLED` không mở được tự đăng ký hoặc kích hoạt tài khoản. `ORGANIZATION_INVITATIONS_ENABLED` chỉ điều khiển hạ tầng email/xác minh/lời mời dành cho tài khoản đã tồn tại; không đồng nghĩa cho phép tạo tài khoản từ lời mời. Có thể giữ true để chuyển đổi người dùng cũ, cùng SMTP/PLATFORM_PUBLIC_URL và MongoDB replica set/sharded cluster hỗ trợ transaction. Giữ nguyên khóa mã hóa.

Việc admin tạo nhân viên và nhân viên đăng nhập không phụ thuộc tính năng tự đăng ký công khai. Không commit credentials người dùng/reviewer.

## Rollout và nghiệm thu

1. Backup DB, kiểm kê tài khoản cũ, xác minh tổ chức và thỏa thuận B2B thực tế.
2. Deploy backend/web trước. Kiểm tra capabilities và hai API đăng ký đều bị đóng, kể cả client cũ/OTP cũ.
3. Tạo tài khoản nhân viên bằng admin tổ chức, đăng nhập trên web/mobile. Kiểm tra quyền vai trò/chi nhánh và ngăn admin cấp tài khoản ngoài phạm vi.
4. Xác nhận login không có link kích hoạt; link đăng ký cũ về login; tài khoản mới không cần OTP/lời mời để vào tổ chức.
5. Kiểm tra tài khoản trial cũ vẫn bị chặn nghiệp vụ/AI, giữ quản lý/xóa và dữ liệu lịch sử.
6. Chạy `review:preflight`: chỉ GET anonymous, yêu cầu cả registrationEnabled và invitationRegistrationEnabled false. Backend phiên bản cũ còn bật kích hoạt lời mời sẽ fail; deploy backend mới trước khi chạy build production.
7. Chạy workflow **Build iOS IPA (GitHub macOS)**. Thiết lập signing theo `mobile/IOS_BUILD.md` trong repo LuxCareMobile; build number phải cao hơn bản trước. Kiểm tra TestFlight thực tế.
8. Giữ App Store Connect **Public**, cập nhật mô tả/screenshots/Review Notes và cung cấp tài khoản demo thuộc tổ chức với dữ liệu mẫu. Kiểm tra module, AI consent/quota, quyền thiết bị, UGC report/block và xóa tài khoản.

Rollback giữ nguyên dữ liệu; không mở lại tự đăng ký. Không gán lại companyCode/role hàng loạt. Khi đổi client, server vẫn phải chặn các API tạo tài khoản công khai.

## Bản nháp trả lời Apple

Chỉ gửi sau khi backend/build mới thực sự triển khai và mô hình bán hàng đúng như mô tả. Điền version/build và tài khoản demo trực tiếp trong App Store Connect.

> LuxCare provides enterprise services sold directly to organizations for use by their employees and members. Organization administrators create and manage employee accounts. Employees sign in using the accounts provided by their organization; public self-registration and invitation-based account creation are disabled. We do not offer individual, consumer or family subscriptions. The app contains no purchase or upgrade flow directing users to external payment for these digital services.
>
> LuxCare supports multiple independent customer organizations. We request public App Store distribution so employees of those organizations can download the app and sign in. The review account provided in Sign-In Information belongs to a demo organization with representative business data. The submitted version/build is [actual version/build].

Không dùng lại tài liệu/response mô hình cá nhân miễn phí hoặc kích hoạt tài khoản qua lời mời đã được thay thế.
