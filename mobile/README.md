# LuxCare Mobile

React Native + Expo SDK 57 + TypeScript. Dự án có package/lockfile riêng trong `mobile/`, dùng các nguồn TypeScript trong `src/` và `shared/` ở gốc repository LuxCareMobile. Clone toàn bộ repository này; không cần checkout repository web LuxCare.

Mã mobile và nguồn dùng chung đã được Git quản lý trong repository này. Các lệnh kiểm thử backend/web trong lịch sử triển khai bên dưới thuộc repository LuxCare gốc; xem README ở cấp gốc để chạy bộ kiểm thử mobile độc lập.

## Chạy ứng dụng

Yêu cầu Node >= 22.13, npm và Android/iOS có Expo Go tương thích SDK 57 hoặc development build. iOS build local cần macOS/Xcode; máy Windows có thể phát triển JS và kiểm thử trên điện thoại.

```powershell
cd mobile
npm ci
Copy-Item .env.example .env
# Sửa EXPO_PUBLIC_API_URL trong .env thành origin của backend
npm start
```

URL chỉ gồm scheme + host + port, không thêm `/api/v1`. Android emulator dùng `http://10.0.2.2:3000`; điện thoại thật dùng IP LAN của máy chạy LuxCare hoặc HTTPS staging. `localhost` trên điện thoại là điện thoại. Cần khởi động lại Metro sau khi sửa môi trường. Không chứa secrets trong EXPO_PUBLIC_*.

Backend cần có thay đổi `x-luxcare-client: native` trong auth controller để login trả refresh token cho native. Web vẫn nhận refresh token qua HttpOnly cookie như trước. Ứng dụng không tự chọn production và không có tài khoản/mật khẩu mẫu. Chưa kết nối kiểm thử tài khoản thật nếu chưa cấu hình URL và tài khoản staging.

## Đã triển khai đợt đầu

- Expo Router: đăng nhập, tab tổng quan/thông báo/phòng ban/tài khoản và route guard.
- API client: Bearer token, timeout, hủy request, refresh chung cho các request đồng thời, retry một lần sau 401, chặn API ngoài origin, xử lý SESSION_REPLACED và race với đăng xuất.
- SecureStore chỉ lưu refresh token, tách khóa theo origin; access token giữ trong bộ nhớ. Network/5xx không xóa phiên khi restore.
- Hồ sơ lấy từ `/auth/me` để nhận permissions thực tế; tải lại khi app trở về foreground.
- Tổng quan: ngày/tuần/năm, công việc/chấm công/tài nguyên; kiểm tra quyền dashboard:read.
- Thông báo: phân trang, lọc chưa đọc, đọc một/tất cả, xóa, kéo để tải lại.
- Phòng ban: danh sách, tìm kiếm, tạo/sửa/xóa (admin), mã/tên/mô tả/trạng thái. Backend vẫn quyết định quyền.
- Tái sử dụng trực tiếp `src/services/{dashboard,notification,department}Service.ts`, `src/types/{common,dashboard}.ts`, `src/utils/permissionUtils.ts`, `shared/permissions.ts` và parser lỗi FE.

## Đã bổ sung ở đợt hai

- Tab Đơn từ: 4 loại yêu cầu, phân trang, tìm/lọc trong trang giống web, nộp đơn cho chính mình, xem số dư phép năm và trạng thái xử lý.
- Duyệt theo `canDecide` do backend trả cho từng đơn, lựa chọn có phép/không phép, ghi chú và lý do từ chối; xóa đơn chờ duyệt theo quyền chủ đơn/admin.
- Biểu mẫu: xem/tải, tạo/xóa với quyền `timekeeping:manage`.
- Tệp đính kèm: chọn tệp native, giới hạn 10 tệp/đơn và 20 MB/tệp, giữ `uploadToken` để backend quản lý tài nguyên; tải/chia sẻ qua API có Bearer header, không đưa token vào URL.
- API thông thường timeout 20 giây, truyền tệp timeout 120 giây. Khi không xác nhận được kết quả tạo đơn, UI yêu cầu kiểm tra lại danh sách để hạn chế gửi trùng.
- Admin chọn chi nhánh hoạt động cùng doanh nghiệp trong Tài khoản; gửi `x-branch-id` cho backend, remount các tab và chặn response/retry từ phạm vi cũ. Lựa chọn chỉ giữ trong phiên app, chưa lưu qua lần khởi động lại. Những API chỉ có phạm vi doanh nghiệp vẫn tuân theo hành vi backend.
- `leaveService` được tách từ `LeaveRequestsTab.tsx`; web đã chuyển sang dùng service chung. `branchService` thêm factory cho native; loại yêu cầu/nhãn và types lấy từ FE. Module guard native dùng `src/config/modules.ts` của web.

## Đã bổ sung ở đợt ba

- Tab Chức năng tập hợp các màn hình theo module/quyền; tab Công việc riêng để truy cập nhanh.
- Nhân sự: danh sách theo doanh nghiệp/chi nhánh, tìm kiếm, xem hồ sơ và sửa tên, điện thoại, ngày sinh, chức danh, trình độ, bộ phận với quyền `user:manage`. Backend kiểm tra thêm cấp bậc của người sửa.
- Công việc: danh sách, tìm kiếm/lọc trạng thái/dự án/việc của tôi; tạo, cập nhật, xóa theo quyền; xem lịch sử, việc nhỏ và tải/chia sẻ tệp có sẵn. Quy tắc hoàn thành và tính giờ tận dụng mã FE.
- Dự án: danh sách, tìm kiếm và tiến độ lấy trực tiếp từ backend.
- Tách `rosterService` và `kanbanService` cho web/mobile dùng chung; `authService` và phần tải danh sách của Kanban web đã chuyển sang service này.
- Mobile gửi `expectedRevision` khi sửa công việc. Cần triển khai kèm thay đổi router Kanban và `server/service/kanban-task-revision.ts` để backend từ chối bản sửa cũ bằng HTTP 409. Client web cũ vẫn tương thích.
- Chưa có tạo/xóa nhân sự, sơ đồ tổ chức, CRUD dự án, sửa việc nhỏ, tải tệp mới cho công việc, bảng kéo thả hoặc KPI. Chưa cập nhật thời gian thực qua socket.

## Đã bổ sung ở đợt bốn

Kiểm tra: 49/49 test liên quan trong 8 file qua, TypeScript web/mobile qua, export Android/iOS qua. Lệnh test tại thư mục gốc: `node node_modules/vitest/vitest.mjs run mobile/src/features/work src/services/kanbanService.test.ts server/service/kanban-project.service.test.ts server/service/kanban-task-revision.test.ts src/components/hr/kanbanProjectProgressWiring.test.ts src/components/hr/kanbanSubtasks.test.ts mobile/src/api/client.test.ts --exclude '.worktrees/**'`. Chưa kiểm thử thiết bị hoặc staging.

- Dự án: tạo/sửa/xóa với quyền `work:manage`, lọc trạng thái, độ ưu tiên, thời gian bắt đầu/hạn cuối. Chỉ gửi các trường đã thay đổi khi sửa; backend quyết định trạng thái hoàn thành và tiến độ.
- Xóa dự án có xác nhận gỡ liên kết khỏi công việc, giữ các công việc theo hợp đồng API hiện tại.
- Việc nhỏ: thêm/sửa/bỏ khỏi danh sách, hạn, ghi chú và đánh dấu hoàn thành; giữ người được giao hiện có, tối đa 50 mục. Gửi `expectedRevision` khi lưu, chặn lưu tiếp khi chưa xác định kết quả do lỗi mạng/server. Chưa có chọn lại người được giao việc nhỏ.
- Các thao tác dự án dùng chung `kanbanService` và types FE. Chưa có upload tệp mới cho công việc/dự án, KPI hoặc socket; dự án chưa có kiểm tra phiên bản đồng thời ở backend.

## Đã bổ sung ở đợt năm

Kiểm tra: 55/55 test trong 10 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Lệnh test: `node node_modules/vitest/vitest.mjs run mobile/src/features/work mobile/src/features/leave/files.test.ts mobile/src/api/client.test.ts src/services/kanbanService.test.ts src/services/kanbanMediaService.test.ts src/components/hr/kanbanAttachmentWiring.test.ts src/components/hr/kanbanSubtasks.test.ts server/service/kanban-project.service.test.ts --exclude '.worktrees/**'`.

- Công việc và dự án có màn hình đính kèm riêng sau khi tạo bản ghi: chọn tệp tối đa 20 MB, thêm liên kết HTTP/HTTPS, gỡ khỏi danh sách, lưu và tải/chia sẻ. Mobile cho thêm tối đa 20 mục; giữ nguyên các mục sẵn có nếu bản ghi cũ có nhiều hơn.
- Giữ `uploadToken` để backend gắn tệp vào bản ghi. Gỡ đính kèm chỉ thay đổi danh sách của bản ghi, không yêu cầu xóa tệp lưu trữ. Hủy form không tự xóa upload đã gửi; việc xử lý upload chưa gắn bản ghi theo backend hiện có.
- Tách `kanbanMediaService` dùng chung với upload trên web; mobile dùng DocumentPicker/FileSystem, media upload timeout 120 giây. Chưa ghi âm hoặc quay video trực tiếp.
- Việc nhỏ có chọn/bỏ chọn người được giao từ API đồng nghiệp; giữ người hiện tại khi danh sách chưa tải được. Backend vẫn kiểm tra quyền sửa công việc.
- Lưu đính kèm công việc gửi phiên bản để kiểm tra xung đột. Dự án hiện theo hợp đồng backend chưa có khóa phiên bản; chỉnh đính kèm đồng thời cần UAT.
- Chưa thử thiết bị/staging. Không coi kiểm thử mock và bundle là nghiệm thu upload thật.

## Đã bổ sung ở đợt sáu

Kiểm tra: 26/26 test trong 6 file qua, TypeScript gốc/mobile qua, export Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run src/services/monthlyKpiService.test.ts src/components/hr/KanbanMonthlyKpiView.test.tsx mobile/src/features/navigation/modules.test.ts server/service/kanban-monthly-kpi.service.test.ts server/router/kanban-kpi-access.test.ts mobile/src/api/client.test.ts --exclude '.worktrees/**'`.

- KPI công việc theo tháng tại tab Chức năng: nhập tháng `YYYY-MM`, tìm nhân viên, số việc đúng hạn/tổng/chưa đạt, phần trăm hoặc “Chưa có công việc”, trạng thái tạm tính/đã chốt và thời điểm chốt.
- Route và mục điều hướng yêu cầu module HR và quyền `work:read`. Backend giới hạn nhân viên chỉ thấy hàng của mình; quản lý xem phạm vi doanh nghiệp/chi nhánh được phép.
- Dùng `monthlyKpiService` chung với `KanbanMonthlyKpiView` của web; không tính lại KPI trên app. Tháng theo giờ Việt Nam, chặn tháng tương lai, xóa báo cáo cũ khi đổi kỳ/phạm vi hoặc lỗi tải.
- Kỳ cũ tuân theo cơ chế chốt/snapshot có sẵn của API; mobile không bổ sung thao tác chốt kỳ riêng. Chưa kiểm thử API thật hoặc thiết bị.

## Đã bổ sung ở đợt bảy

Kiểm tra: 21/21 test trong 4 file qua; TypeScript web/mobile qua; bundle Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run mobile/src/features/navigation mobile/src/api/client.test.ts src/services/serviceTransport.test.ts --exclude '.worktrees/**'`. Chưa kiểm thử trên thiết bị thật hoặc staging.

- Thông báo có lọc công việc/đào tạo/hệ thống trên API, kết hợp lọc chưa đọc và phân trang. Không gửi loại `kho` vì validation backend hiện không nhận loại này.
- Action `NHÂN SỰ/Giao Việc`, `NHÂN SỰ/PHÒNG BAN` và `TỔNG QUAN` mở màn hình mobile tương ứng sau khi đánh dấu đã đọc. Kiểm tra doanh nghiệp, module và quyền; lỗi đánh dấu đã đọc được hiển thị để thử lại.
- Action chưa hỗ trợ được giải thích trên thẻ thông báo, không tự đoán đường dẫn hoặc mở URL tùy ý. Payload hiện không chứa mã bản ghi nên chỉ mở danh sách, chưa mở trực tiếp từng công việc. Chưa có push native.
- Dùng khóa thao tác đọc/xóa/mở để tránh gửi lặp khi bấm liên tiếp.

## Đã bổ sung ở đợt tám

Kiểm tra: 25/25 test trong 4 file qua; TypeScript web/mobile qua; export Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run mobile/src/features/dashboard src/services/dashboardService.test.ts mobile/src/api/client.test.ts src/services/serviceTransport.test.ts --exclude '.worktrees/**'`.

- Tổng quan: nhập ngày bắt đầu/kết thúc `YYYY-MM-DD`, kiểm tra ngày có thật và thứ tự trước khi gửi API. Truyền ngày nguyên dạng theo hợp đồng `dashboardService`, không đổi múi giờ trên client.
- Bổ sung số dự án hoạt động, tài liệu mới trong kỳ, phòng trò chuyện và thống kê đào tạo. Ghi rõ chỉ số công việc/đào tạo là trạng thái hiện tại, chấm công là hôm nay; bộ lọc ngày hiện áp dụng tài liệu mới theo backend.
- Việc cần xử lý hôm nay: task quá hạn và đơn chờ duyệt theo API; mở danh sách công việc/đơn từ theo module đang bật. Không duyệt trực tiếp trên tổng quan, màn hình đơn từ tiếp tục dùng `canDecide` của backend.
- API tổng quan và action-items tải/lỗi/thử lại độc lập; action-items không đổi theo bộ lọc ngày. Danh sách ưu tiên có giới hạn do backend, không coi đây là toàn bộ các việc/đơn còn tồn.
- Chưa kiểm thử thiết bị/staging hoặc đối chiếu múi giờ server thực tế; chưa có biểu đồ chi tiết.

## Đã bổ sung ở đợt chín

Kiểm tra: 20/20 test trong 4 file qua, TypeScript web/mobile qua, bundle Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run src/services/accountService.test.ts src/services/authService.register-user.test.ts mobile/src/features/account mobile/src/api/client.test.ts --exclude '.worktrees/**'`.

- Tài khoản: sửa tên hiển thị của chính mình, cập nhật ngay tên trong phiên; email và thông tin tổ chức vẫn theo API hồ sơ. Chưa có thay avatar native.
- Đổi mật khẩu: nhập mới/xác nhận, tối thiểu 6 ký tự như backend, không trim mật khẩu; che nội dung và xóa khỏi form sau thành công hoặc lỗi không xác định kết quả.
- Tách `accountService` dùng chung với `authService.updateProfile/changePassword` trên web. Mobile chỉ gửi tên khi sửa hồ sơ, không thay toàn bộ profile hoặc quyền từ response cập nhật.
- Giữ nguyên hợp đồng backend: đổi mật khẩu dùng phiên đã đăng nhập, API chưa có trường mật khẩu cũ và chưa thu hồi các phiên/token sau đổi. Không tự thêm luồng đăng xuất hoặc giả lập xác thực lại.
- Khóa thao tác trong khi lưu; đổi mật khẩu gặp lỗi mạng/5xx được báo chưa xác nhận kết quả và chặn gửi lại trên form đó. Chưa thử tài khoản thật hoặc thiết bị.

## Đã bổ sung ở đợt mười

Kiểm tra: 19/19 test trong 4 file qua; TypeScript web/mobile qua; bundle Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run server/service/department-legacy-pattern.test.ts src/services/departmentService.test.ts src/services/rosterService.test.ts mobile/src/api/client.test.ts --exclude '.worktrees/**'`.

- Phòng ban: lọc đang hoạt động, chỉnh thứ tự hiển thị, chọn/bỏ người phụ trách từ API đồng nghiệp; giữ dữ liệu người phụ trách cũ nếu không đổi.
- Admin/superadmin xem tên phòng ban cũ chưa gắn mã chuẩn, chọn nhiều tên và phòng ban đích, xác nhận chuẩn hóa và xem số hồ sơ đã cập nhật. Phạm vi toàn doanh nghiệp theo backend, bao gồm hồ sơ đã có mã nhưng tên khớp nguồn; không giới hạn theo chi nhánh đang chọn.
- Tái sử dụng `departmentService.getUnmapped/merge/update` và `rosterService.colleagues`. Không tạo phòng ban đích hoặc chuẩn hóa tự động khi mở màn hình.
- Cần triển khai kèm `server/service/department-legacy-pattern.ts` và thay đổi `department.service.ts`: escape ký tự regex trong tên nguồn để tránh tên `A.B`, `R&D (HQ)` khớp sai khi cập nhật hàng loạt.
- Chưa kiểm thử dữ liệu thật/staging. Danh mục phòng thuộc chi nhánh là chức năng riêng trên web, chưa chuyển sang mobile.

## Đã bổ sung ở đợt mười một

Kiểm tra: 28/28 test trong 5 file qua, TypeScript web/mobile và export Hermes Android/iOS qua. Lần đầu worker test UI timeout, chạy lại một worker thành công. Lệnh: `node node_modules/vitest/vitest.mjs run src/services/attendanceService.test.ts src/utils/attendanceDailyOverview.test.ts src/components/hr/calendar-holiday-overlay.test.tsx mobile/src/features/navigation/modules.test.ts mobile/src/api/client.test.ts --exclude '.worktrees/**' --maxWorkers 1`.

- Mục Lịch & chấm công: trạng thái hôm nay theo API, giữ ngày công thực tế khi có ca hôm trước chưa checkout; giờ hiển thị theo Việt Nam.
- Lịch sử cá nhân theo tháng gửi `employeeId`, `startDate`, `endDate` theo route hiện tại. Mobile chỉ hiển thị hàng có UID của tài khoản đăng nhập; không xem toàn bộ nhân viên trong đợt này. Giới hạn API 10.000 bản ghi, không có phân trang.
- Xem lịch nghỉ lễ/nghỉ bù/làm bù đã áp dụng từ `companyWorkCalendarService` được chuyển sang factory dùng chung web/mobile; loại log chấm công tách thành `src/types/attendance.ts`. Danh mục ca dùng kiểu `WorkShift` chung với WorkShiftsTab web, yêu cầu `timekeeping:manage`.
- Các nguồn tải độc lập, báo lỗi theo từng nguồn; chọn tháng không chọn tương lai. Danh mục ca là danh mục quản lý, không phải ca đã phân cho người dùng trong ngày.
- Chưa check-in/check-out native, GPS/camera/nhận diện khuôn mặt, CRUD/phân ca, lịch sự kiện, điều chỉnh công hoặc export. Chưa kiểm thử thiết bị/staging.

## Đã bổ sung ở đợt mười hai

Kiểm tra: 24/24 test trong 4 file qua; TypeScript web/mobile và bundle Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run mobile/src/features/shifts src/services/attendanceService.test.ts mobile/src/features/navigation/modules.test.ts mobile/src/api/client.test.ts --exclude '.worktrees/**' --maxWorkers 1`.

- Quản lý & phân ca yêu cầu HR và `timekeeping:manage`: tạo/sửa/xóa ca, giờ làm, ngày làm, ca mặc định/hoạt động, độ trễ, màu và nhiều khoảng nghỉ có/không lương. Kiểm tra giờ nghỉ nằm trong ca, không chồng nhau, hỗ trợ ca qua đêm. Chưa có cửa sổ giờ cho phép check-in/out hoặc chỉnh standardMinutes riêng.
- Phân ca nhiều nhân sự, tìm kiếm, ngày hiệu lực bắt đầu/kết thúc; ngày làm lấy từ ca được chọn. Xác nhận trước khi gửi. API áp dụng toàn doanh nghiệp và lưu thêm phân ca; bảng hiện lần phân ca mới nhất theo API, không khẳng định đây là ca đang có hiệu lực hôm nay.
- Xóa ca có xác nhận, hiển thị lỗi backend nếu ca đã được phân. Có thể ngừng hoạt động qua form sửa. Khi kết quả ghi không xác định do mạng/5xx, yêu cầu tải lại trước khi gửi tiếp.
- Dùng chung `attendanceService` và kiểu ca của FE. Chưa kiểm thử nhân sự thật/staging, chưa có hủy/sửa lịch sử phân ca vì API hiện chỉ có list/create.

## Đã bổ sung ở đợt mười ba

Kiểm tra: 13/13 test trong 5 file qua; TypeScript web/mobile và bundle Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run mobile/src/features/calendar src/services/companyWorkCalendarService.test.ts src/services/attendanceService.test.ts src/components/hr/calendar-holiday-overlay.test.tsx mobile/src/features/navigation/modules.test.ts --exclude '.worktrees/**' --maxWorkers 1`.

- Lịch nghỉ & làm bù theo năm: đồng bộ lịch hệ thống có xác nhận, thêm/sửa/xóa ngày tự tạo, bật/tắt áp dụng, bắt buộc lý do tắt, xem hành động/người thực hiện/thời điểm/lý do trong lịch sử.
- Đối chiếu controller: đọc lịch/audit cần Admin hoặc Superadmin có doanh nghiệp và HR; ghi còn cần `timekeeping:manage`. Sửa màn hình chấm công để người dùng thường không gọi API danh sách lịch quản trị; trạng thái ngày hôm nay vẫn từ `/today`.
- Ngày hệ thống không cho sửa ngày/tên/loại hoặc xóa trên UI. Backend xử lý xung đột, năm hỗ trợ và cập nhật công nghỉ lễ. Giữ nguyên API và dùng `companyWorkCalendarService` chung; thêm method audit, bảo toàn HTTP status lỗi.
- Lỗi ghi không xác định được báo cần tải lại; chưa kiểm thử đồng bộ hoặc thay đổi ngày nghỉ trên dữ liệu thật. Lịch sử hiển thị mã người thực hiện do API chưa cung cấp tên.

## Đã bổ sung ở đợt mười bốn

- Check-in/check-out từ màn hình Lịch & chấm công, lấy GPS hiện tại bằng `expo-location`, gửi multipart tới API LuxCare. Backend quyết định điều kiện chi nhánh, mạng và thời gian chấm công.
- Dùng cờ `ATTENDANCE_FACE_CHECK_ENABLED` chung với FE/backend, hiện là `false`: không yêu cầu ảnh. Khi bật cờ và build lại app, dùng camera trước với `expo-camera`, giới hạn ảnh 5 MB và dọn ảnh tạm trong cache sau thao tác. Không dùng ảnh từ thư viện.
- Có xử lý từ chối quyền, tắt định vị, giới hạn chờ GPS 20 giây, chặn gửi lặp và ngừng gửi nếu chuyển nền trong lúc lấy dữ liệu. Lỗi mạng/5xx yêu cầu đóng form để tải lại trạng thái trước khi gửi tiếp. Hiển thị thông báo cho mã lỗi địa điểm/khuôn mặt của backend.
- Đã thêm plugin quyền camera/vị trí; development build cũ cần build lại để có native module mới. Chưa kiểm thử quyền, camera, GPS hoặc check-in/out với thiết bị và tài khoản staging thực tế.
- Kiểm tra: 24/24 test trong 4 file qua, TypeScript web/mobile và export Hermes Android/iOS qua. Lệnh test: `node node_modules/vitest/vitest.mjs run mobile/src/features/attendance/checkin.test.ts mobile/src/api/client.test.ts src/components/dashboard/TimekeepingWidget.face-disabled.test.tsx server/middleware/attendance-face-gate.disabled.test.ts --exclude '.worktrees/**' --maxWorkers 1`.

## Đã bổ sung ở đợt mười lăm

- Form tạo/sửa ca có bốn mốc giờ vào/ra tùy chọn, hỗ trợ mốc qua nửa đêm và xóa từng mốc bằng cách để trống. Dùng lại API và kiểu `WorkShift` của service FE.
- Sửa ca giữ số phút công chuẩn đã lưu. Có thể nhập 1–1440 phút hoặc chọn tính lại từ thời lượng ca trừ các khoảng nghỉ không lương. Kiểm tra định dạng giờ và số phút trước khi gửi.
- Backend hiện lưu các mốc `checkInFrom`, `checkInUntil`, `checkOutFrom`, `checkOutUntil` nhưng chưa dùng chúng để kiểm soát check-in/out. UI ghi rõ giới hạn này.
- 16/16 test trong 4 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Lệnh test: `node node_modules/vitest/vitest.mjs run mobile/src/features/shifts src/services/attendanceService.test.ts server/service/work-shift.service.test.ts mobile/src/features/navigation/modules.test.ts --exclude '.worktrees/**' --maxWorkers 1`. Chưa nghiệm thu lưu cấu hình với staging hoặc thiết bị thật.

## Đã bổ sung ở đợt mười sáu

- Màn hình Quản lý công yêu cầu HR, doanh nghiệp và `timekeeping:manage`, gồm chọn/tìm nhân viên đang hoạt động, xem bản ghi theo tháng, chỉnh trạng thái/ghi chú với lý do bắt buộc và xác nhận trước khi gửi.
- Tái sử dụng `attendanceService` cho truy vấn lịch sử theo nhân viên; thêm PATCH chỉnh công và GET lịch sử qua API có audit. Giữ nguyên giờ vào/ra và thông tin GPS, không tạo lượt chấm công thay nhân viên.
- Hiển thị tối đa 50 lần chỉnh sửa gần nhất: người sửa, thời điểm, lý do, trạng thái/ghi chú/giờ vào-ra trước và sau. Có tải lại và xử lý lỗi quyền, lỗi mạng hoặc kết quả lưu chưa xác định.
- Backend hiện ghi bản công trước rồi tạo audit, chưa có giao dịch nguyên tử cho hai bước. Khi lỗi 5xx, cần tải lại cả bản ghi và lịch sử để đối soát. Danh sách nhân viên chọn lấy từ API phân ca; bản ghi công vẫn lọc theo phạm vi backend trả về.
- Chưa sửa giờ vào/ra, chưa chọn nhân viên đã ngừng hoạt động, chưa nghiệm thu tài khoản staging/thiết bị thật.
- Kiểm tra: 14/14 test trong 5 file qua, TypeScript web/mobile và export Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run mobile/src/features/attendance/adjustment.test.ts mobile/src/features/navigation/modules.test.ts src/services/attendanceService.test.ts server/service/timekeeping-adjustment.service.test.ts src/components/hr/CalendarTab.adjustment-history.test.ts --exclude '.worktrees/**' --maxWorkers 1`.

## Đã bổ sung ở đợt mười bảy

- Lịch nhân sự có danh sách theo tháng, lọc loại, tìm tiêu đề/nội dung/nhân viên, lọc liên quan đến tôi và mở rộng chi tiết. Hiển thị giờ Việt Nam, tính cả sự kiện giao với tháng được chọn, ẩn mục đang chờ duyệt như FE.
- Tách `CalendarItem` và `hrCalendarService` từ luồng tải lịch của `CalendarTab`; web/mobile cùng dùng service với transport riêng. Mobile chỉ mở lịch khi có doanh nghiệp và HR, lấy mã doanh nghiệp từ phiên đăng nhập.
- Các mục nghỉ phép/làm tại nhà có nút mở danh sách Đơn từ; chưa định vị trực tiếp một đơn. Người tạo/người được giao hiện hiển thị mã khi API không cung cấp tên.
- Luồng này chỉ xem lịch, chưa thêm/sửa/xóa sự kiện hoặc nhắc việc native. “Liên quan đến tôi” gồm người tạo, người được giao hoặc nhân viên của mục lịch. API trả toàn bộ danh sách trong phạm vi, lọc tháng trên client; chưa có phân trang phía server.
- Chưa nghiệm thu phạm vi dữ liệu hoặc giao diện trên staging/thiết bị thật.
- Kiểm tra: 10/10 test trong 5 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run mobile/src/features/calendar/events.test.ts src/services/hrCalendarService.test.ts src/components/hr/calendar-holiday-overlay.test.tsx src/components/hr/CalendarTab.adjustment-history.test.ts mobile/src/features/navigation/modules.test.ts --exclude '.worktrees/**' --maxWorkers 1`.

## Đã bổ sung ở đợt mười tám

- Tin tuyển dụng: tìm kiếm mã/tiêu đề/phòng ban qua API, lọc trạng thái, phân trang 20 tin, xem chi tiết nội dung/yêu cầu/quyền lợi/lương/hạn nộp và thùng rác.
- Người có quyền quản lý có thể chuyển trạng thái, xóa mềm và khôi phục với xác nhận. Gửi phiên bản bản ghi cho từng thao tác; khi lỗi yêu cầu tải lại trước khi ghi tiếp. Backend kiểm tra điều kiện mở tuyển.
- Tách `createRecruitmentService(transport)` từ service FE, giữ singleton `recruitmentApi` cho web. Native sử dụng cùng endpoint, kiểu dữ liệu, phân trang và lỗi HTTP.
- Cần HR, doanh nghiệp và `recruitment:read` để xem; thao tác ghi còn cần `recruitment:manage`. Admin phải chọn chi nhánh; vai trò khác phải có chi nhánh trong hồ sơ, theo quy tắc backend hiện có.
- Chưa tạo/sửa nội dung tin, tải JD/CV, quản lý ứng viên, pipeline hoặc phỏng vấn trên mobile. Chưa thử staging/thiết bị thật.
- Kiểm tra: 15/15 test trong 5 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Đã sửa mock backend cũ thiếu `skip/limit/countDocuments`, giữ và bổ sung assertion phạm vi. Lệnh: `node node_modules/vitest/vitest.mjs run src/services/recruitmentService.test.ts mobile/src/features/recruitment/access.test.ts server/service/recruitment-job.service.test.ts server/service/recruitment-pagination.test.ts mobile/src/features/navigation/modules.test.ts --exclude '.worktrees/**' --maxWorkers 1`.

## Đã bổ sung ở đợt mười chín

- Tạo tin tuyển dụng ở dạng nháp và sửa nội dung tin đang hoạt động: mã/tiêu đề/phòng ban/số lượng, mô tả/yêu cầu/quyền lợi, lương, công khai lương, loại hợp đồng, hình thức/địa điểm làm việc và hạn nộp.
- Hạn nộp nhập `YYYY-MM-DD HH:mm` theo giờ Việt Nam, kiểm tra ngày thực và chuyển ISO; giữ nguyên độ chính xác thời điểm cũ khi người dùng không sửa hạn nộp. Lương trống gửi null, kiểm tra số lượng và khoảng lương.
- Tin đang tuyển giữ trạng thái khi sửa và phải đủ thông tin mở tuyển. Payload chỉ gồm trường form, giữ nguyên JD hiện có. API update nhận phiên bản hiện tại; xung đột hoặc kết quả không xác định yêu cầu đóng/tải lại trước khi tiếp tục.
- Quyền đọc/quản lý và phạm vi chi nhánh dùng lại từ đợt mười tám. Chưa upload JD/CV, ứng viên/phỏng vấn hoặc UAT thiết bị/staging.
- Kiểm tra: 12/12 test trong 4 file qua; TypeScript mobile và export Hermes Android/iOS qua. Đã đổi tên module dữ liệu để tránh xung đột chữ hoa/thường trên Windows và chạy lại test form. Đợt này chỉ đổi mã mobile, không đổi backend/service web.

## Đã bổ sung ở đợt hai mươi

- Danh sách ứng viên phân trang 20 bản ghi, tìm tên/email/điện thoại, lọc giai đoạn/kết quả. Từ mỗi tin tuyển dụng mở ứng viên của tin đó; có bỏ lọc để xem toàn bộ phạm vi chi nhánh. Ký tự regex trong tìm kiếm được escape để tìm văn bản literal.
- Hồ sơ hiển thị liên hệ, học vấn, kinh nghiệm, kỹ năng, lương mong muốn, nguồn/ghi chú và lịch sử chuyển bước. Tên giai đoạn dùng pipeline từ API; mã tin/người phụ trách/người thao tác hiện hiển thị mã khi chưa có dữ liệu tên.
- Người có quyền quản lý có thể chọn giai đoạn đang hoạt động khác giai đoạn hiện tại, nhập ghi chú và xác nhận. Nhãn hiển thị kết quả tuyển dụng của giai đoạn cuối. Gửi phiên bản gốc, khóa gửi lặp và yêu cầu tải lại khi lỗi.
- Dùng `recruitmentService`/types FE và quyền/phạm vi đã có. Chưa tạo/sửa hồ sơ, CV, xóa/khôi phục ứng viên, quản trị pipeline hoặc lịch phỏng vấn. Chưa UAT thiết bị/staging.
- Kiểm tra: 14/14 test trong 5 file qua; TypeScript mobile và export Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run mobile/src/features/recruitment src/services/recruitmentService.test.ts server/service/recruitment-applicant.service.test.ts --exclude '.worktrees/**' --maxWorkers 1`. Không đổi mã runtime web/backend trong đợt này.

## Đã bổ sung ở đợt hai mươi mốt

- Tạo ứng viên từ danh sách đã lọc theo tin tuyển dụng; có nút sang danh sách tin để chọn. Backend yêu cầu tin đang mở và pipeline có giai đoạn hoạt động. Sửa hồ sơ dùng phiên bản hiện tại.
- Form gồm họ tên/email/điện thoại, ngày sinh/địa chỉ, kinh nghiệm/học vấn/kỹ năng, lương mong muốn, ngày đi làm, nguồn và ghi chú. Kiểm tra trường bắt buộc, email, ngày thực và lương không âm. Trường ngày không đổi giữ giá trị gốc; ngày/lương tùy chọn trống gửi null.
- Khi tạo bị cảnh báo trùng email/điện thoại, hiển thị hồ sơ liên quan và chờ quyết định sửa thông tin hoặc xác nhận tạo thêm. Không tự gửi `confirmDuplicate`; khóa form trong lúc xem cảnh báo để xác nhận đúng dữ liệu.
- Payload sửa không chứa tin tuyển dụng, CV, người phụ trách, giai đoạn hoặc kết quả. Lỗi phiên bản/kết quả ghi không xác định yêu cầu đóng/tải lại. Chưa upload CV, gán người phụ trách, xóa/khôi phục hồ sơ hoặc phỏng vấn; chưa UAT thiết bị/staging.
- Kiểm tra: 17/17 test trong 6 file qua; TypeScript mobile và export Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run mobile/src/features/recruitment src/services/recruitmentService.test.ts server/service/recruitment-applicant.service.test.ts --exclude '.worktrees/**' --maxWorkers 1`.

## Đã bổ sung ở đợt hai mươi hai

- Lịch phỏng vấn phân trang 20 mục, lọc trạng thái, ứng viên hoặc lịch tôi phỏng vấn. Mở từ từng ứng viên để xem và đặt lịch cho đúng hồ sơ/tin tuyển dụng.
- Tạo/sửa giờ bắt đầu–kết thúc theo giờ Việt Nam, hình thức trực tiếp/trực tuyến/điện thoại, địa điểm, liên kết, trạng thái, kết quả và ghi chú. Kiểm tra ngày thực, kết thúc sau bắt đầu và URL HTTP/HTTPS. Giữ độ chính xác thời điểm cũ khi không đổi.
- Dùng service tuyển dụng chung, quyền/phạm vi chi nhánh hiện có và phiên bản khi cập nhật. Lịch mới chưa gán người phỏng vấn; sửa lịch giữ danh sách đã có. Chưa chọn người phỏng vấn, thùng rác lịch, gửi lời mời hoặc nhắc lịch native. Chưa thử trên staging/thiết bị thật.
- Kiểm tra: 19/19 test trong 7 file qua; TypeScript mobile và export Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run mobile/src/features/recruitment src/services/recruitmentService.test.ts server/service/recruitment-interview.service.test.ts --exclude '.worktrees/**' --maxWorkers 1`.

## Đã bổ sung ở đợt hai mươi ba

- Form ứng viên chọn một người phụ trách; form phỏng vấn chọn nhiều người phỏng vấn hoặc bỏ phân công. Tìm theo tên/email, dùng `rosterService.list` chung với FE.
- Danh sách yêu cầu `user:read` hoặc `hr:read`, lọc chính xác doanh nghiệp/chi nhánh và `isActive === true`. Backend vẫn kiểm tra người được gán khi lưu. Khi thiếu quyền/lỗi tải, có thông báo và giữ nguyên phân công cũ nếu không sửa.
- Chỉ gửi trường phân công khi có thay đổi; bỏ người phụ trách gửi null, bỏ hết người phỏng vấn gửi mảng rỗng. Mã người không còn trong roster vẫn hiển thị để người dùng quyết định giữ/bỏ. Bộ chọn bị khóa khi lưu hoặc xác nhận hồ sơ trùng.
- Chưa kiểm thử quyền và dữ liệu nhân sự trên staging/thiết bị thật. Chưa JD/CV, thùng rác ứng viên/lịch hoặc quản trị pipeline.
- Kiểm tra: 26/26 test trong 9 file qua; TypeScript mobile và export Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run mobile/src/features/recruitment src/services/recruitmentService.test.ts server/service/recruitment-interview.service.test.ts server/service/recruitment-applicant.service.test.ts --exclude '.worktrees/**' --maxWorkers 1`.

## Đã bổ sung ở đợt hai mươi bốn

- Thùng rác ứng viên/lịch phỏng vấn có phân trang và bộ lọc hiện có; xóa mềm/khôi phục cần quyền quản lý, xác nhận và phiên bản bản ghi. Hồ sơ trong thùng rác không cho sửa/chuyển bước; lịch đã xóa không cho sửa.
- Bổ sung bốn method xóa/khôi phục trong service FE dùng chung. Backend lọc `deleted` theo Boolean nên danh sách hiện tại bỏ hẳn query này, chỉ gửi `deleted=true` khi xem thùng rác.
- Sửa lỗi nút thêm ứng viên nằm trong nhánh thiếu quyền/chi nhánh, chuyển về danh sách hợp lệ. Có kiểm thử hồi quy vị trí nút.
- Sửa backend `deleteState` của ứng viên để thực sự đổi `isDeleted` khi xóa/khôi phục, giữ điều kiện doanh nghiệp/chi nhánh/phiên bản và metadata xóa. Cần cập nhật backend cùng mobile; chưa chạy thao tác này trên dữ liệu thật.
- Chưa JD/CV hoặc quản trị pipeline; chưa UAT thiết bị/staging.
- Kiểm tra: 28 test hồi quy trong 10 file qua; sau sửa backend, chạy lại 5 test ứng viên (gồm test mới xóa/khôi phục) đều qua. TypeScript web/mobile và export Hermes Android/iOS qua. Lệnh hồi quy: `node node_modules/vitest/vitest.mjs run mobile/src/features/recruitment src/services/recruitmentService.test.ts server/service/recruitment-interview.service.test.ts server/service/recruitment-applicant.service.test.ts --exclude '.worktrees/**' --maxWorkers 1`.

## Đã bổ sung ở đợt hai mươi lăm

- Quy trình tuyển dụng có xem danh sách theo thứ tự; người có quyền quản lý được thêm/bỏ giai đoạn, sửa tên/màu, đưa lên/xuống, bật/tắt và chọn kết quả cuối. Giai đoạn mới dùng UUID, các giai đoạn cũ giữ ID.
- Kiểm tra tên, màu HEX, mã không trùng và ít nhất một giai đoạn hoạt động; chuẩn hóa thứ tự liên tục. Xác nhận trước khi lưu toàn bộ quy trình với phiên bản gốc. Backend chặn bỏ/tắt giai đoạn đang có ứng viên.
- Kết quả cuối tác động khi chuyển ứng viên vào giai đoạn; không tự cập nhật kết quả của mọi ứng viên cũ. Quyền/phạm vi chi nhánh và service FE dùng lại; lỗi phiên bản hoặc ghi không xác định yêu cầu đóng/tải lại.
- Chưa JD/CV hoặc UAT thiết bị/staging.
- Kiểm tra: 12/12 test trong 3 file qua; TypeScript mobile và export Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run mobile/src/features/recruitment/pipelineModel.test.ts server/service/recruitment-pipeline.service.test.ts src/services/recruitmentService.test.ts --exclude '.worktrees/**' --maxWorkers 1`.

## Đã bổ sung ở đợt hai mươi sáu

- Kho tệp JD/CV riêng trong chi tiết tin/hồ sơ ứng viên: xem metadata, chọn/upload/thay tệp, tải/chia sẻ và gỡ theo quyền. Hỗ trợ PDF/DOC/DOCX tối đa 10 MB, dùng dung lượng tệp thực trên thiết bị.
- Multipart native không đặt thủ công Content-Type, thay tệp gửi phiên bản attachment. Timeout API upload và tải signed URL là 120 giây. Không gửi token LuxCare sang máy chủ lưu trữ; yêu cầu HTTPS, lấy signed URL mới mỗi lần tải.
- Dọn bản sao picker trong cache sau upload; bản tải để chia sẻ được giữ trong cache cho ứng dụng nhận đọc. Thay/gỡ có xác nhận, lỗi ghi yêu cầu tải lại metadata trước khi tiếp tục.
- Kho attachment này độc lập với trường liên kết công khai `jdFileUrl`/`cvUrl` của FE; chưa chuyển luồng chỉnh/upload liên kết công khai đó. Chưa nghiệm thu cloud storage/staging hoặc picker/share trên thiết bị thật.
- Kiểm tra: 25/25 test trong 3 file qua; TypeScript mobile và export Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run mobile/src/features/recruitment/files.test.ts mobile/src/api/client.test.ts server/service/recruitment-attachment.service.test.ts --exclude '.worktrees/**' --maxWorkers 1`.

## Đã bổ sung ở đợt hai mươi bảy

- Chi tiết tin/ứng viên hiển thị liên kết JD/CV công khai cũ; mở qua ứng dụng hệ thống sau xác nhận tên miền. Form tạo/sửa cho nhập/thay/gỡ liên kết HTTP/HTTPS, chặn scheme thực thi/local và URL chứa tài khoản/mật khẩu.
- URL không đổi thì bỏ hoàn toàn các trường URL/publicId khỏi payload; thay/gỡ mới gửi URL và xóa publicId cũ theo hợp đồng FE. Backend có thể dọn tệp công khai cũ sau cập nhật, form ghi rõ hành vi này.
- Chưa upload tệp mới vào kho công khai trực tiếp từ mobile. Upload PDF/DOC/DOCX trong kho attachment riêng đã có ở đợt hai mươi sáu. Chưa UAT thiết bị/staging.
- Kiểm tra: 18/18 test trong 5 file qua; TypeScript mobile và export Hermes Android/iOS qua. Lệnh: `node node_modules/vitest/vitest.mjs run mobile/src/features/recruitment/publicLink.test.ts mobile/src/features/recruitment/jobForm.test.ts mobile/src/features/recruitment/applicantFormModel.test.ts server/service/recruitment-job.service.test.ts server/service/recruitment-applicant.service.test.ts --exclude '.worktrees/**' --maxWorkers 1`.

## Đợt 28: upload JD/CV công khai

- Form tạo/sửa tin và ứng viên có chọn PDF/DOC/DOCX tối đa 10 MB, upload bằng API LuxCare và lưu URL cùng publicId; có thể tiếp tục sửa/gỡ liên kết.
- Khóa thao tác trong lúc chọn/upload/lưu. Cảnh báo hồ sơ trùng giữ lại tệp cho lần xác nhận, không upload lại.
- Khi đóng form, dọn các tệp mới chưa gửi kèm yêu cầu lưu. Không xóa tệp đã gửi cho server khi chưa chắc kết quả lưu; chỉ cho phép dọn lại nếu server trả cảnh báo trùng (hồ sơ chưa tạo). Tệp cũ do backend xử lý sau khi cập nhật thành công.
- Dọn tệp tạm là best effort. Mất mạng, mất phản hồi upload/lưu, app bị tắt hoặc đổi phạm vi có thể để lại tệp công khai chưa gắn hồ sơ; chưa có tác vụ backend đối soát/dọn tệp mồ côi.
- Kiểm tra: 34/34 test trong 6 file qua, TypeScript mobile và export Hermes Android/iOS qua. Chưa UAT upload thật trên thiết bị/staging; export không phải APK/IPA.

## Đợt 29: tra cứu hợp đồng nhân sự

- Thêm mục Hợp đồng nhân sự cho tài khoản có doanh nghiệp, phân hệ HR và quyền `hr:read`. API tiếp tục giới hạn nhân viên chỉ xem hồ sơ của mình; gửi chi nhánh đang chọn hoặc chi nhánh tài khoản.
- Danh sách tìm kiếm theo API, phân trang 10 bản ghi, xem trạng thái/thời hạn/ghi chú; danh sách sắp hết hạn trong 20 ngày lấy riêng từ API, không lọc theo trang/từ khóa hiện tại.
- Xem lịch sử gia hạn theo từng hợp đồng, phân trang độc lập. Hiển thị tên/dung lượng tệp hợp đồng, ảnh đã ký và phụ lục; chưa xem/tải nội dung hoặc tạo/sửa/gia hạn trên mobile.
- Tách types và bốn hàm đọc metadata tệp từ `ContractsTab.tsx` để web/mobile dùng chung, hỗ trợ cả mảng nhiều tệp và trường một tệp cũ. Service mới nhận transport mobile, không kéo component web/auth browser vào bundle.
- 20/20 kiểm thử trong 7 file qua; TypeScript dự án gốc/mobile và export Hermes Android/iOS qua (không phải APK/IPA). Chưa UAT thiết bị/staging.

## Đợt 30: tải và chia sẻ tệp hợp đồng

- Tệp hợp đồng, ảnh đã ký, tệp gia hạn và ảnh phụ lục có nút tải/mở/chia sẻ qua bảng chia sẻ Android/iOS. Người dùng chọn ứng dụng đọc hoặc lưu tài liệu; chưa có trình xem PDF/Word tích hợp.
- Tách helper tải/chia sẻ đang dùng trong đơn từ thành `src/files/shareFile.ts`, giữ alias cũ để công việc/đơn từ tiếp tục dùng chung. Tải qua `/api/v1/media/download` có xác thực, không gắn token vào URL hoặc mở thẳng URL bên ngoài.
- Hợp đồng hủy tải khi rời màn hình/thu gọn chi tiết, chặn nhấn lặp trong mỗi nhóm tệp; timeout 120 giây bao gồm đọc body, kiểm tra dung lượng khai báo và byte thực tế tối đa 20 MB. Tệp chưa chia sẻ bị hủy được dọn; tệp đã chuyển cho ứng dụng nhận còn trong cache để đọc.
- Giữ giới hạn domain của media proxy backend. URL ngoài danh sách cho phép có thể bị từ chối; chưa bổ sung tải từ nguồn tùy ý hoặc chính sách dọn cache đã chia sẻ. Body vẫn đọc vào bộ nhớ trước khi kiểm tra kích thước thực tế nếu server không báo dung lượng.
- Kiểm tra: 20/20 test trong 4 file, TypeScript mobile và export Hermes Android/iOS qua (không phải APK/IPA); chưa UAT trên thiết bị/staging.

## Đợt 31: tạo và sửa hợp đồng cơ bản

- Thêm form tạo/sửa hợp đồng cho quyền `hr:read` + `hr:manage` trong phân hệ HR. Chọn nhân viên từ danh sách API trong phạm vi hiện tại, có tìm tên/email/phòng ban; giữ được nhân viên hiện tại dù không còn trong danh sách đang hoạt động.
- Loại hợp đồng, ngày bắt đầu/hết hạn, bốn trạng thái và ghi chú có kiểm tra trước khi gửi. Ngày theo dạng YYYY-MM-DD như FE; giữ chính xác timestamp cũ nếu không sửa ngày.
- Khi sửa chỉ PATCH các trường thay đổi, không gửi lại tệp, metadata upload hoặc dữ liệu lương. Khóa nút lưu/đóng khi gửi; lỗi mạng/5xx hoặc kết quả chưa xác nhận chặn gửi tiếp cho đến khi đóng và tải lại.
- API hợp đồng chưa có version/concurrency token; PATCH tối thiểu giảm ghi đè trường không sửa, chưa ngăn được hai người cùng sửa một trường. Tạo hợp đồng mới mặc định bản nháp. Chưa tạo gia hạn hoặc upload/gỡ tệp hợp đồng trên mobile.
- Kiểm tra: 17 test/5 file, TypeScript gốc/mobile và export Hermes Android/iOS qua (không phải APK/IPA); chưa UAT dữ liệu thật/thiết bị.

## Đợt 32: tạo gia hạn hợp đồng

- Thêm nút Tạo gia hạn trong chi tiết hợp đồng cho quyền đọc/quản lý HR. Nhập ngày hết hạn mới, ngày gia hạn và lý do tối đa 1000 ký tự.
- Kiểm tra ngày hợp lệ và hạn mới phải sau hạn hiện tại. Gửi đúng API `POST /hr-contracts/:id/extensions`, không gửi kèm thay đổi nhân viên, trạng thái hoặc tệp.
- API tạo lịch sử, cập nhật hạn hợp đồng và chuyển hợp đồng expired thành active; các trạng thái khác được giữ theo backend. Đóng form sau thành công sẽ tải lại danh sách và lịch sử khi mở chi tiết.
- Khóa thao tác lưu/đóng trong lúc gửi. Với lỗi mạng/5xx hoặc phản hồi thiếu bản ghi, chặn gửi lại cho đến khi đóng và kiểm tra kết quả. Backend chưa có transaction/version/idempotency cho toàn bộ luồng, vì vậy lỗi có thể để lại lịch sử trước khi hạn hợp đồng được cập nhật; cần đối soát trên staging.
- Kiểm tra độc lập: 123/123 test trong 29 file và TypeScript qua. Chưa UAT thiết bị/staging. Upload/gỡ tệp hợp đồng và gia hạn vẫn chưa chuyển.

## Đợt 33: upload hợp đồng và phụ lục khi tạo

- Hợp đồng mới và form gia hạn nhận một tài liệu PDF/DOC/DOCX/ảnh cùng một ảnh đã ký, tối đa 10 MB mỗi tệp. Có chọn lại/bỏ tệp chưa lưu, khóa lưu/đóng trong lúc upload.
- Dùng endpoint upload hiện có, đọc kích thước thật trước khi mã hóa base64; gửi metadata và uploadToken qua các trường đơn được schema backend chấp nhận. Không gửi mảng nhiều tệp vốn chưa được schema route hiện tại hỗ trợ.
- Các token chưa lưu phụ thuộc cơ chế pending upload của backend (hạn token 24 giờ); mobile chỉ dọn bản sao picker trong cache, không tự xóa tài nguyên server. Không giả định tệp đã bị xóa khi bỏ chọn hoặc đóng form.
- Chưa thay/gỡ tệp đã lưu khi sửa hợp đồng: backend có dữ liệu mảng nhiều tệp nên cần hoàn thiện contract API trước để tránh ghi đè mất tệp. Chưa upload thêm vào bản gia hạn đã tồn tại.
- 129 test/30 file, TypeScript và export Hermes Android/iOS qua (không phải APK/IPA); chưa UAT thiết bị/staging.

## Đợt 34: tra cứu văn bằng và chứng chỉ

- Thêm màn hình văn bằng/chứng chỉ cho quyền `credentials:read` hoặc `hr:read` trong phân hệ HR của doanh nghiệp. Backend quyết định phạm vi nhân viên và công ty/chi nhánh.
- Tìm nhân viên/tên chứng chỉ/số hiệu/nơi cấp, lọc bốn loại văn bằng và ba trạng thái; phân trang server 20 bản ghi. Thống kê tổng/còn hạn/sắp hết hạn/hết hạn lấy riêng từ API, không theo bộ lọc danh sách.
- Chi tiết có nơi/ngày cấp, thời hạn hoặc không thời hạn, số hiệu, phạm vi chuyên môn, số ngày nhắc và ghi chú. Tài liệu dùng luồng tải/chia sẻ sẵn có, tối đa 20 MB, phụ thuộc domain được media proxy cho phép.
- Dùng lại kiểu Credential từ FE và `shared/hr-credential.ts`; trạng thái hiển thị theo API. Chưa tạo/sửa/xóa/upload chứng chỉ, chưa push nhắc hạn hoặc UAT thiết bị/staging.
- Kiểm tra: 132/132 test trong 31 file, TypeScript và export Hermes Android/iOS qua (không phải APK/IPA).

## Đợt 35: tạo/sửa văn bằng và chứng chỉ

- Thêm form chọn nhân viên, tên/loại/số hiệu/nơi cấp, ngày cấp, hạn hoặc không thời hạn, phạm vi chuyên môn, ghi chú và số ngày nhắc 1–365. Kiểm tra ngày thực và độ dài theo schema backend.
- Cần quyền đọc cùng `credentials:manage` hoặc `hr:manage`. Danh sách chọn nhân viên lọc chi nhánh hiện tại; cho phép giữ nhân viên cũ không còn trong danh sách hoạt động.
- PATCH chỉ trường thay đổi, giữ timestamp ngày không sửa và tài liệu đã có; xóa hạn gửi null. Không gửi trạng thái, backend tự tính trạng thái theo hạn/số ngày nhắc.
- Khóa lưu/đóng khi gửi; lỗi mạng/5xx hoặc phản hồi không xác nhận yêu cầu đóng và tải lại trước khi gửi tiếp. Backend chưa có version/idempotency, chưa bảo vệ đầy đủ cập nhật đồng thời.
- Chưa xóa/upload chứng chỉ hoặc UAT thiết bị/staging.
- Kiểm tra: 136/136 test trong 32 file, TypeScript và export Hermes Android/iOS qua (không phải APK/IPA).

## Đợt ba mươi sáu: xóa chứng chỉ

- Xóa hồ sơ theo quyền quản lý, có màn hình xác nhận tên chứng chỉ và nhân viên; thông báo không thể khôi phục hồ sơ.
- Khóa gửi trùng và đóng khi đang gửi. Nếu lỗi, yêu cầu đóng và tải lại trước thao tác tiếp; không tự gửi lại DELETE ở service.
- Tải lại danh sách, thống kê và về trang đầu sau khi đóng màn hình xóa. Tệp liên kết cần kiểm tra lại trong LuxCare.
- Kiểm tra: 142/142 test trong 33 file, TypeScript và export Hermes Android/iOS qua (không phải APK/IPA).
- Chưa UAT trên thiết bị/staging thật.

## Đợt ba mươi bảy: tài liệu chứng chỉ

- Chọn và tải một tệp PDF/JPG/PNG/WebP tối đa 10 MB khi tạo hoặc sửa chứng chỉ; kiểm tra dung lượng thực trước khi đọc base64.
- Gửi metadata và token upload cùng hồ sơ khi lưu. Bỏ tệp vừa chọn giữ tài liệu đã lưu; thay tệp có thông báo tệp cũ có thể vẫn còn trong kho.
- Khóa lưu/đóng trong khi chọn và tải, hủy upload khi unmount, dọn bản sao cache; timeout upload 120 giây. Không tự xóa tệp pending trên server khi bỏ chọn.
- Chưa có gỡ tài liệu đã lưu hoặc push nhắc hạn; chưa UAT thiết bị/staging.
- Kiểm tra: 152/152 test trong 34 file, TypeScript và export Hermes Android/iOS qua (không phải APK/IPA).

## Đợt ba mươi tám: tra cứu hồ sơ theo nhân viên

- Bộ lọc nhân viên dùng chung cho hợp đồng và chứng chỉ, tìm theo tên/email trong danh sách nhân viên API trả về.
- Gửi `employeeId` cùng chi nhánh, từ khóa và phân trang; đổi nhân viên quay về trang đầu. Hợp đồng sắp hết hạn và thống kê chứng chỉ theo nhân viên đang chọn.
- Giữ nhãn lựa chọn trong khi tải lại; đặt lại bộ lọc xóa cả từ khóa tìm người và điều kiện hồ sơ, giữ phạm vi phiên. Quyền xem do API kiểm tra.
- Kiểm tra: 157/157 test trong 35 file, TypeScript và export Hermes Android/iOS qua (không phải APK/IPA).
- Chưa UAT thiết bị/staging thật.

## Đợt ba mươi chín: phiếu lương cá nhân

- Màn hình Phiếu lương của tôi trong Chức năng: danh sách đã phát hành, lọc kỳ, thực nhận/đã trả/còn lại và chi tiết công, thu nhập, khấu trừ, KPI.
- Tách transport của `payrollService` từ FE, dùng lại `payrollDetails` để hiển thị; không tính lại thực nhận trên mobile. Các helper web in/export chưa được nối vào UI mobile.
- API tự giới hạn nhân viên, công ty/chi nhánh và bản phát hành còn hiệu lực. Chi tiết lỗi có thông báo và tải lại; không hiển thị số 0 thay lỗi tải. Màn hình cần chi nhánh của phiên và phân hệ HR, không cần quyền quản lý lương để xem phiếu cá nhân.
- Lọc kỳ trong danh sách API đã trả, endpoint cá nhân chưa phân trang. Chưa tạo/duyệt/chốt kỳ, thanh toán, in/chia sẻ phiếu hoặc UAT thiết bị/staging.
- Kiểm tra: 163/163 test trong 36 file, TypeScript và export Hermes Android/iOS qua (không phải APK/IPA).

## Đợt bốn mươi: lưu/chia sẻ phiếu lương

- Tải bản HTML do API LuxCare phát hành và mở bảng chia sẻ Android/iOS để chọn ứng dụng nhận hoặc nơi lưu. Không phải PDF, chưa có in native.
- Dùng chung endpoint/service in của FE với Bearer token, kiểm tra quyền và trạng thái phát hành mỗi lần tải. Không gửi access token trong tệp hoặc URL mở ngoài.
- Kiểm tra MIME HTML, nội dung không rỗng, tối đa 2 MB; timeout 120 giây gồm đọc body, hủy khi rời màn hình và chặn bấm trùng trên cùng phiếu.
- Dọn cache khi hủy trước chia sẻ; giữ tệp đã chuyển cho bảng chia sẻ để ứng dụng nhận đọc được. Chưa có chính sách dọn cache riêng, chưa UAT thiết bị/staging.
- Kiểm tra: 175/175 test trong 37 file, TypeScript và export Hermes Android/iOS qua (không phải APK/IPA).

## Đợt bốn mươi mốt: tra cứu bảng lương theo kỳ

- Màn hình Tra cứu bảng lương: nhập kỳ YYYY-MM, trạng thái, tìm tên/mã nhân viên và tổng thực nhận của các dòng có hiệu lực.
- Dùng `payrollService.getRun` từ FE; chỉ hiển thị `effectiveLines`, không lấy `lines` cũ khi có `effectiveError` hoặc thiếu dữ liệu có hiệu lực. Phân biệt kỳ chưa tồn tại với lỗi API.
- Cần HR, công ty/chi nhánh và quyền `payroll-period:read`; chi tiết dòng cần `payroll-payment:read/manage`. Bộ tìm nhân viên áp dụng trên kỳ API đã trả, chưa phân trang server.
- Chưa tạo/tính/duyệt/chốt kỳ hoặc thanh toán; chưa UAT thiết bị/staging.
- Kiểm tra: 179/179 test trong 38 file, TypeScript và export Hermes Android/iOS qua (không phải APK/IPA).

## Đợt bốn mươi hai: lịch sử thanh toán lương

- Trong Tra cứu bảng lương có lịch sử thanh toán, lọc nháp/xác nhận/hủy/đảo, số tiền, ngày, ghi chú, mốc trạng thái và phân bổ nhân viên.
- Tổng đã xác nhận chỉ cộng `amount` của khoản confirmed, không cộng lại các dòng phân bổ; tổng không phụ thuộc bộ lọc trạng thái.
- Tận dụng `payrollService.getPayments`; cần quyền đọc kỳ và `payroll-payment:read`. Lỗi hoặc dữ liệu sai không hiển thị tổng bằng 0. Bỏ kết quả tải khi rời màn hình/đổi phạm vi.
- Liên kết chứng từ chỉ hiển thị để sao chép; chưa tải chứng từ, tạo/xác nhận/hủy/đảo thanh toán hoặc UAT thiết bị/staging.
- Kiểm tra: 183/183 test trong 39 file, TypeScript và export Hermes Android/iOS qua (không phải APK/IPA).

## Đợt bốn mươi ba: tra cứu điều chỉnh lương

- Danh sách điều chỉnh theo kỳ trong Tra cứu bảng lương, kể cả kỳ chưa có bảng lương; xem nhân viên, loại, số tiền, lý do, trạng thái và ngày liên quan.
- Tìm tên/mã nhân viên hoặc lý do, lọc loại và trạng thái, đặt lại bộ lọc; các bộ lọc áp dụng trên danh sách API trả về.
- Dùng `payrollService.getAdjustments`, quyền đọc kỳ, công ty/chi nhánh phiên đăng nhập; từ chối dữ liệu sai kỳ và hiển thị lỗi riêng. Phân biệt đã duyệt với đã đưa vào bản tính, không cộng trực tiếp điều chỉnh vào thực nhận.
- Chưa tạo/duyệt/từ chối điều chỉnh hoặc UAT thiết bị/staging.
- Kiểm tra: 186/186 test trong 40 file, TypeScript và export Hermes Android/iOS qua (không phải APK/IPA).

## Đợt bốn mươi bốn: duyệt/từ chối điều chỉnh

- Khoản pending có nút duyệt/từ chối khi có quyền đọc và quản lý kỳ lương. Xác nhận riêng hiển thị nhân viên, kỳ, loại, số tiền và lý do điều chỉnh.
- Chặn gửi trùng, khóa đóng trong lúc gửi; kiểm tra kết quả đúng bản ghi/kỳ/trạng thái. Mọi lỗi yêu cầu đóng và tải lại trước thao tác tiếp.
- Đóng màn hình xử lý tải lại cả bảng lương và điều chỉnh. Backend có thể tính lại kỳ nháp legacy sau duyệt/từ chối; không tự tính lương ở mobile.
- API chưa nhận lý do từ chối riêng, chưa có tạo điều chỉnh hoặc UAT thiết bị/staging.
- Kiểm tra: 191/191 test trong 41 file, TypeScript và export Hermes Android/iOS qua (không phải APK/IPA).

## Quy tắc dùng lại FE (áp dụng cho các đợt tiếp)

Service được xuất dưới dạng `createXService(transport)` cùng singleton mặc định cho web. Transport chỉ cung cấp `fetch` và `getAccessToken`; mobile inject API client, web giữ global fetch được interceptor hiện có bọc. Không polyfill localStorage/window, không sao chép service để tạo hai phiên bản endpoint. UI DOM/Tailwind phải chuyển thành component native. Trước khi chuyển service tiếp theo, rà soát các import gián tiếp tới Toast, auth, browser storage, window/document và file APIs.

## Kiểm tra

```powershell
# Trong mobile/
npm run typecheck
npm run export:native
# Tại thư mục gốc, dùng bộ test sẵn có của LuxCare
node node_modules/vitest/vitest.mjs run mobile/src/api/client.test.ts mobile/src/features/leave src/services/leaveService.test.ts src/services/branchService.test.ts src/components/hr/LeaveRequestsTab.test.tsx src/components/hr/leave-api-contract.test.ts src/services/serviceTransport.test.ts --exclude '.worktrees/**'
```

Export kiểm tra bundle JS cho Android/iOS, không phải APK/IPA. Chưa có app signing, store IDs, EAS project hoặc cấu hình phát hành. Icon hiện vẫn là asset khởi tạo Expo.

Kết quả kiểm tra đợt hai ngày 2026-09-08: TypeScript mobile và LuxCare gốc đều qua; 48 kiểm thử trong 8 file ở trên qua; Expo export Android/iOS thành công với Hermes bytecode trong `mobile/dist/`. Các API được mock trong kiểm thử; chưa xác nhận kết nối staging hoặc chạy trên thiết bị thật.

Kết quả đợt ba ngày 2026-09-08: 90/90 kiểm thử trong 19 file qua, TypeScript gốc/mobile qua, export Hermes Android/iOS qua. Bộ hồi quy mở rộng thêm `mobile/src/features/work`, `src/services/{kanbanService,rosterService,authService.register-user}.test.ts`, các test Kanban về project state/progress, task time/wiring, subtasks và `server/service/kanban-task-revision.test.ts`, `server/router/kanban-task-visibility.test.ts`. Test quyền đọc Kanban chuẩn hóa CRLF/LF khi đọc source trên Windows, giữ nguyên các assertion. Chưa kiểm thử thiết bị/staging.

## Giới hạn hiện tại

Đây là bốn mươi bốn đợt triển khai trong phạm vi ứng dụng đầy đủ, chưa phải bản đầy đủ chức năng. Xem `IMPLEMENTATION.md`.

- Giữ chính sách một phiên của backend; đăng nhập mobile có thể thay thế phiên web. Chưa thay đổi mô hình phiên theo thiết bị.
- Super Admin nhận challenge 202 được chặn an toàn, chưa có UI hoàn tất MFA. Không hạ yêu cầu xác thực.
- Chưa có push native, socket, chức năng offline ghi dữ liệu hoặc module nghiệp vụ ngoài danh sách trên. Upload/download hiện có trong đơn từ, công việc và dự án, tối đa 20 MB mỗi tệp trên mobile. Ảnh chấm công tối đa 5 MB.
- Tìm/lọc đơn từ hiện áp dụng trên trang đang tải (giống FE); backend hiện chỉ hỗ trợ phân trang. Ngày bắt đầu/kết thúc giữ quy ước giờ địa phương của form web; cần đối chiếu tính phép/múi giờ với backend trong UAT.
- Các tệp tải để chia sẻ nằm trong cache ứng dụng để ứng dụng nhận có thể đọc chúng; chưa có chính sách tự dọn riêng cho cache chia sẻ.
- Thông báo chỉ điều hướng các action được hỗ trợ ở đợt bảy; phòng ban đã có chuẩn hóa/gán người phụ trách, chưa danh mục phòng thuộc chi nhánh; tổng quan chưa có biểu đồ chi tiết.
- Chưa kiểm thử trên điện thoại hoặc staging thực tế. Cần kiểm thử network, lifecycle, bàn phím, vùng an toàn và quyền trên thiết bị thật trước nghiệm thu.

Tài liệu SDK dùng cho khởi tạo: https://docs.expo.dev/versions/v57.0.0/ và hướng dẫn dùng nguồn chung: https://docs.expo.dev/guides/monorepos/.
