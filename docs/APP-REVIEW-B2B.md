# LuxCare: chuyển sang B2B và gửi lại App Review

Cập nhật 19/10/2026. Tài liệu mô tả source B2B hiện tại và công việc vận hành trước khi gửi Apple. Sửa source/docs không deploy server, tạo khách hàng thật, tải build lên TestFlight hoặc thay đổi App Store Connect.

## Mô hình và phạm vi

- App được phân phối Public, miễn phí tải xuống; phục vụ nhiều tổ chức độc lập và thành viên được cấp quyền. Không mô tả app chỉ dành riêng cho nhân viên LuxCare.
- Khách hàng mua quyền sử dụng là tổ chức/nhóm theo thỏa thuận trực tiếp với LuxCare. Không bán gói cá nhân, người tiêu dùng hoặc gia đình.
- Gói theo module/quy mô tổ chức có thể được giới thiệu, báo giá và ký mua ngoài app. iOS không có bảng giá, checkout, QR, nút nâng cấp hay đường dẫn mời mua ngoài IAP. Các chức năng ghi nhận lương/thanh toán nghiệp vụ không phải mua quyền sử dụng app.
- Tổ chức được bộ phận vận hành xác minh và cấp workspace qua Superadmin theo hợp đồng/thỏa thuận. Source dùng cấu hình module và trạng thái active hiện có; không tự kiểm chứng hợp đồng, thu tiền, gia hạn hay giới hạn số ghế thương mại. Đối soát khách hàng/hợp đồng/số ghế vẫn do vận hành quản lý.
- Tài khoản nền tảng Superadmin và biên tập Blog là vai trò vận hành, không phải gói cá nhân cho khách hàng.

Cơ sở: [Apple 3.1.3(c) và phần mở đầu 3.1.3](https://developer.apple.com/app-store/review/guidelines/), [Public distribution](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/set-distribution-methods/). Apple xét mô hình thực tế và build gửi review; các tài liệu này không phải bảo đảm duyệt.

## Luồng cấp quyền

1. Vận hành xác nhận tổ chức, người đại diện và thỏa thuận B2B; Superadmin cấp Company/chi nhánh/admin và module theo thỏa thuận. Chỉ kích hoạt tổ chức đã được xác nhận.
2. Admin của Company active gửi lời mời tới đúng email, chọn chi nhánh active. Lời mời hết hạn sau 7 ngày; có gửi lại và thu hồi.
3. Người mới dùng mục **Kích hoạt lời mời** trên web/mobile. POST `/api/v1/auth/register` chỉ gửi OTP nếu email có lời mời pending, chưa hết hạn và tổ chức/chi nhánh/người mời còn hợp lệ.
4. PendingRegistration lưu invitationId. Nếu email có nhiều lời mời, chọn lời mời mới nhất; giao diện và email xác minh nêu tên tổ chức để người dùng xác nhận. Thu hồi lời mời không muốn dùng trước khi kích hoạt.
5. OTP có hiệu lực 15 phút, tối đa 5 lần thử, gửi lại cách nhau 60 giây. POST `/auth/register/verify` kiểm tra lại lời mời và mục tiêu, nhận lời mời và tạo User role user với companyCode/branchId của lời mời trong cùng transaction.
6. Không tạo Company, chi nhánh MAIN, khóa học mẫu hay role trial_user cho tài khoản mới. Quyền/tenant không lấy từ dữ liệu client.
7. Người đã có tài khoản đăng nhập, xác minh email nếu cần, rồi nhận lời mời trong **Tài khoản & lời mời**. Giữ nguyên ràng buộc một công ty đang hoạt động trên mỗi tài khoản.
8. Tự nộp/bổ sung đơn doanh nghiệp qua `/onboarding/applications` trả HTTP 410 `ORGANIZATION_APPLICATION_DISABLED`; form này đã gỡ khỏi web/mobile. Hồ sơ lịch sử được giữ; chỉ vận hành đặc quyền xử lý sau khi xác minh tổ chức.

## Tài khoản và dữ liệu cũ

- Không xóa, đổi mật khẩu, gán tổ chức hoặc chuyển dữ liệu hàng loạt.
- trial_user vẫn đăng nhập được để xem lời mời, quản lý tài khoản hoặc gửi yêu cầu xóa. API nghiệp vụ/AI và socket từ chối quyền workspace cá nhân; web/mobile đưa người dùng tới màn tài khoản.
- Tài khoản không thuộc tổ chức cũng chỉ được quản lý tài khoản và lời mời. AI cá nhân không còn là lối truy cập dịch vụ ngoài tổ chức.
- trial_user nhận lời mời hợp lệ sẽ tham gia tổ chức đích; workspace cá nhân cũ archive theo cơ chế hiện có, không nhập dữ liệu vào công ty đích.
- Cần thông báo chuyển đổi cho người dùng cũ và xử lý yêu cầu dữ liệu/xóa qua vận hành. Không tuyên bố có nút xuất dữ liệu nếu sản phẩm chưa cung cấp.
- Xóa tài khoản vẫn hoạt động; yêu cầu của chủ workspace/admin duy nhất được xử lý trong 7 ngày, có trạng thái và hủy yêu cầu. Vận hành phải theo dõi hàng đợi.

## Cấu hình backend và rollout

```dotenv
ORGANIZATION_INVITATIONS_ENABLED=true
PUBLIC_REGISTRATION_ENABLED=false
```

Cờ mới điều khiển hạ tầng lời mời/OTP và mail worker. `registrationEnabled` luôn false; `invitationRegistrationEnabled` báo khả năng kích hoạt lời mời. Nếu chưa khai báo cờ mới, giá trị cũ PUBLIC_REGISTRATION_ENABLED=true chỉ bật hạ tầng lời mời, không mở đăng ký cá nhân. Cờ mới được ưu tiên, kể cả false.

Giữ SMTP/PLATFORM_PUBLIC_URL hiện có và SUPERADMIN_ENCRYPTION_KEY; không đổi khóa. MongoDB phải hỗ trợ transaction (replica set/sharded cluster). Không commit hoặc ghi credentials reviewer vào repository.

GET `/api/v1/onboarding/capabilities` phải trả:

```json
{"registrationEnabled":false,"invitationRegistrationEnabled":true,"accessModel":"organization_only","personalAiEnabled":false,"companyWalletEnabled":false}
```

AI trong tổ chức tiếp tục theo module/consent/quota hiện có. Bật cấu hình quota phù hợp nếu dùng AI; không mua thêm lượt hay nạp Credit.

Thứ tự triển khai:

1. Backup DB; kiểm kê tổ chức đang phục vụ, tài khoản trial_user, các đơn/lời mời tồn đọng. Xác minh khách hàng B2B đang active bằng dữ liệu thực tế.
2. Triển khai staging backend/web và SMTP với cờ mới. Collections/indexes onboarding được tạo khi prepareOnboarding thành công.
3. Nghiệm thu ma trận dưới đây với DB có transaction và email thử nghiệm. Unit test mock không chứng minh gửi mail, rollback/concurrency MongoDB hoặc native UI.
4. Deploy backend/web B2B trước build mobile để client cũ cũng không thể tự tạo workspace cá nhân. Kiểm tra cả response capability, trang điều khoản render và API thật.
5. Build production bằng workflow **Build iOS IPA (GitHub macOS)** trong repository LuxCareMobile: Xcode archive/export ký trực tiếp trên runner, tùy chọn upload TestFlight bằng API key Apple. Thiết lập signing Secrets và số build theo `LuxCareMobile/mobile/IOS_BUILD.md` (trong repo mobile: `mobile/IOS_BUILD.md`). Số build dùng base + GitHub run number hoặc nhập thủ công, phải lớn hơn bản trước trong App Store Connect; không dùng bộ đếm EAS remote.
6. Trên iPhone TestFlight, kiểm tra luồng lời mời, tổ chức, các quyền thiết bị, AI consent, báo cáo/chặn và xóa tài khoản. Quota phải đủ cho reviewer.
7. Trong App Store Connect giữ **Public**, cập nhật mô tả/screenshots/Review Notes/App Privacy, điền tài khoản demo và chọn đúng build mới. Chỉ gửi các khẳng định đúng với backend/build thực sự triển khai.

Rollback: có thể đóng nhận lời mời bằng ORGANIZATION_INVITATIONS_ENABLED=false (mail worker onboarding cũng tạm dừng); không mở lại đăng ký cá nhân. Đăng nhập khách hàng tổ chức và luồng quản lý/xóa tài khoản không phụ thuộc bật đăng ký. Giữ collections/indexes/dữ liệu; không đảo companyCode/role hàng loạt. Khi dùng binary cũ, điểm đăng ký có thể còn hiện nhưng server vẫn phải từ chối email không có lời mời.

## Ma trận nghiệm thu trước submit

- Email không được mời không nhận OTP, không tạo User/Company/Branch. Client cũ không tạo được workspace cá nhân.
- Email được mời kích hoạt thành User của đúng tổ chức/chi nhánh; không tự cấp role admin, module hoặc tenant từ request.
- OTP sai, hết hạn, quá lần thử, gửi lại, dùng lại sau thành công đều có kết quả đúng.
- Thu hồi/hết hạn lời mời hoặc ngừng tổ chức/chi nhánh/người mời sau khi gửi OTP phải chặn tạo tài khoản. Hai lần nhận cùng lời mời không tạo hai User.
- PendingRegistration cũ không có invitationId không dùng được để tạo tài khoản dù OTP đúng.
- Admin chỉ mời/xem/thu hồi trong tổ chức mình; xác nhận lời mời không chuyển người đã thuộc tổ chức khác.
- trial_user cũ không dùng Dashboard/Kanban/vật tư/AI/socket nhưng vẫn xem lời mời, yêu cầu/hủy xóa. Tham gia tổ chức không chuyển dữ liệu cá nhân cũ.
- Người dùng tổ chức active đăng nhập và dùng module đúng quyền. Tổ chức inactive bị chặn. Không thấy form tự mở doanh nghiệp hay mua/nâng cấp trong iOS.
- Reviewer account truy cập đầy đủ workspace tổ chức và dữ liệu mẫu; backend và SMTP thực sự hoạt động trong thời gian review.
- Link pháp lý/hỗ trợ, chức năng xóa tài khoản, AI consent và Chat/Blog report/block vẫn hoạt động trên thiết bị thật.

Local checks: typecheck ERP/backend + mobile, test onboarding/auth/deletion + native policy/preflight, build ERP và native export. `npm run review:preflight` tại LuxCareMobile/mobile chỉ GET anonymous, kiểm tra capabilities B2B và Credit disabled; không chứng minh luồng đăng nhập/lời mời trên TestFlight.

## Kết quả kiểm tra local ngày 19/10/2026

- Typecheck ERP/backend và mobile: PASS.
- Test backend/onboarding/auth/deletion: 6 files, 49 tests PASS.
- Test native auth/onboarding/preflight/AI access wiring: 5 files, 36 tests PASS.
- Vite + esbuild production build ERP/backend: PASS.
- Expo export iOS và Android: PASS. Đây là bundle JS/assets local, không phải binary đã ký hay TestFlight.
- Browser smoke trên Microsoft Edge với API mock: PASS (Login → Kích hoạt lời mời, email chưa được mời bị từ chối, email được mời thấy tên tổ chức và bước OTP). Không gửi email hoặc tạo user thật.
- git diff --check ở cả hai repository: PASS.

Chưa nghiệm thu SMTP/MongoDB transaction trên staging, thiết bị iPhone/TestFlight hay App Store Connect. Thử GET capability API production từ môi trường này không kết nối được; không dùng điều đó để kết luận server production ngừng hoạt động. Chưa deploy và chưa gửi phản hồi hoặc build lên Apple.

## Bản nháp phản hồi Apple sau khi triển khai

Chỉ gửi nội dung dưới đây khi hợp đồng/mô hình bán hàng, backend và binary mới đúng như mô tả. Điền build thật và credentials riêng trong Sign-In Information. Mọi việc thay đổi online cần bước phát hành riêng.

Hello App Review Team,

We have revised LuxCare to serve organizations and groups exclusively, following the first resolution option in your feedback under Guidelines 3.1.1 and 3.1.3(c).

LuxCare is a publicly distributed, free-to-download business application serving multiple independent organizations. Access to its business services is sold directly by LuxCare to organizations for their employees and staff. We do not offer consumer, individual-user, or family plans.

We have removed standalone personal registration, personal trial workspaces, and the organization application form from the app. New member accounts can only be activated using an existing, valid invitation issued by an administrator of an active organization. Existing members sign in using accounts provisioned by their organization. The app contains no pricing, checkout, upgrade flow, or external purchase calls to action.

The submitted build is [actual version/build]. The review credentials in Sign-In Information belong to a demo organization workspace with representative business data. Please sign in and use [actual enabled modules and navigation steps]. The backend is available throughout review.

We request public App Store distribution so employees and members of our organizational customers can discover and download LuxCare. Access to organization services remains controlled by organization membership.

Thank you.

Không gửi bản nháp 09/10 nói toàn bộ dịch vụ miễn phí và giữ đăng ký cá nhân; nội dung đó thuộc mô hình trước.
