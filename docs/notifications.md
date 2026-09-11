# Thông báo realtime và push mobile

## Chat và Blog realtime

`CommunicationProvider` nghe các event có sẵn của backend: `internal_new_message`, `internal_room_updated/deleted`, `internal_message_edited/deleted/reaction`, `internal_messages_read`, `blog_post_created/deleted/pinned/liked`. Không cần thêm endpoint backend cho phần realtime này.

Chat hiển thị banner khi nhận tin của người khác ngoài phòng đang xem, mở đúng phòng khi chạm banner, và lấy số chưa đọc từ API cho tab/icon chức năng. Phòng đang mở cập nhật theo socket; polling 15 giây chỉ dự phòng khi mất socket. App không đánh dấu đã đọc khi tab không hiển thị hoặc app chạy nền.

Blog hiển thị banner bài mới và số bài chưa xem trên icon ở trang chủ, danh sách chức năng và mục ghim. Đánh dấu đã xem khi kênh được tải thành công trong màn hình đang mở. Chỉ tính 50 bài API đang trả về, không tính bài tự đăng. Lần đồng bộ đầu tiên trên thiết bị lấy các bài hiện tại làm mốc; các bài mới sau đó được đếm. Trạng thái xem lưu riêng theo API server/công ty/tài khoản trên thiết bị, chưa đồng bộ đã xem giữa nhiều thiết bị. Khi reconnect/foreground, tải lại API để cập nhật nội dung và badge.

Phần Chat/Blog này là realtime trong app, chạy được trên Expo Go; chưa bổ sung push nền cho hai loại nội dung này.

Expo Go: không nạp `expo-notifications` hoặc gọi API native push. Vẫn dùng socket, banner và badge trong ứng dụng; màn hình Thông báo giải thích giới hạn này. Luồng xin quyền và push native chạy trong development/release build của LuxCare.

Backend: `E:/Igen/LuxCare`. Mobile: `mobile/`.

## Luồng hoạt động

- Khi mở app, tạo Android channel `default` và xin quyền nếu người dùng chưa quyết định. Không chờ đăng nhập. Từ chối quyền không chặn ứng dụng; màn hình Thông báo có nút mở Cài đặt.
- Sau đăng nhập, lấy Expo push token và POST `/api/v1/push/devices` với `{ token, platform: "android" | "ios" }`. JWT quyết định người nhận, công ty và phiên. DELETE cùng endpoint với `{ token }` để hủy.
- Socket dùng API origin, path `/socket.io/`, namespace `/`, `auth.token`. Server tự join room cá nhân. Mobile nghe `new_notification` và `notifications:changed`, đồng bộ lại qua API sau reconnect/foreground.
- Foreground hiển thị banner chung cho socket và push, chống trùng theo notification ID trong phiên (giới hạn 200 ID). Tab thông báo hiển thị số chưa đọc. Push foreground không tạo thêm banner hệ điều hành.
- Background dùng push có title/body để hệ điều hành hiển thị. Không chạy socket bằng background task. Chạm thông báo chờ khôi phục phiên và navigation, kiểm tra người nhận/công ty rồi dùng `notificationTarget`; nội dung chưa hỗ trợ mở danh sách thông báo.
- Backend đánh dấu thông báo mới bằng `mobilePushQueued: false`. Worker mỗi 5 giây chuyển tối đa 20 thông báo sang các job MongoDB có khóa duy nhất notification/token/session, rồi xử lý tối đa 20 job. Thông báo cũ không có cờ này không được gửi lại.
- Worker kiểm tra thiết bị và phiên trước gửi; logout/đổi phiên thu hồi đăng ký. Job retry tối đa 8 lần với backoff; ticket được kiểm tra receipt sau 15 phút. `DeviceNotRegistered` loại đăng ký đúng chủ sở hữu. Job lưu 7 ngày qua TTL để chẩn đoán.
- Thông báo kho được ghi qua inventory outbox cũng có event realtime và đi qua worker push. Web Push hiện có vẫn độc lập.

## Cấu hình trước khi phát hành

Điền biến build trong `mobile/.env` hoặc EAS environment theo `mobile/.env.example`:

| Biến | Giá trị cần có |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Backend đã triển khai API thiết bị |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | UUID project EAS thực tế |
| `LUXCARE_ANDROID_PACKAGE` | Android application ID đã đăng ký |
| `LUXCARE_IOS_BUNDLE_IDENTIFIER` | iOS bundle identifier đã đăng ký |
| `GOOGLE_SERVICES_JSON` | Đường dẫn google-services.json đúng ứng dụng, có thể dùng EAS file variable |

Cấu hình FCM v1 service account và APNs credentials trong EAS cho project tương ứng. Không đưa khóa dịch vụ vào biến `EXPO_PUBLIC_*` hoặc git. Backend hỗ trợ biến `EXPO_ACCESS_TOKEN` nếu bật enhanced push security của Expo.

Triển khai backend trước, bảo đảm MongoDB tạo index unique của `MobilePushDevice` và `MobilePushJob` cùng TTL/index hàng đợi theo schema. Nếu môi trường tắt autoIndex, tạo các index theo schema trong quy trình migration trước khi bật worker. Cho phép backend kết nối HTTPS tới `exp.host`.

Build lại native sau khi thêm plugin; cập nhật JavaScript đơn thuần không bổ sung native module. Dùng development/release build để kiểm thử push, không dùng Expo Go Android.

## Xác minh

Kiểm thử tự động: `npm test -- mobile/src/features/notifications/payload.test.ts mobile/src/api/socketService.test.ts mobile/src/api/client.test.ts mobile/src/features/navigation/notificationTarget.test.ts`; backend chạy `npx vitest run server/service/mobile-push.service.test.ts`. Chạy typecheck ở hai dự án và export Android/iOS.

Trên thiết bị thật: cài mới → xin quyền trước login → đăng nhập → tạo công việc cho người dùng từ tài khoản khác → nhận đúng một banner foreground → background/khóa màn hình → nhận push → chạm mở đúng màn hình. Kiểm tra thêm từ chối quyền/mở Settings, mở từ trạng thái app chưa chạy, offline/reconnect, đọc/xóa/badge, logout/đổi phiên và token hết hiệu lực.

Theo dõi collection `mobilepushjobs`: `send`, `receipt`, `delivered`, `cancelled`, `failed`; xem `lastError`, `attempts`, `availableAt`. `delivered` chỉ xác nhận receipt thành công từ nhà cung cấp, không chứng minh người dùng đã xem.

## Giới hạn

Không thể thu hồi push đã được nhà cung cấp nhận trước thời điểm logout. Logout hoàn toàn offline chỉ xóa phiên ở máy; backend chưa biết đến thao tác đó cho tới khi phiên bị thu hồi/thay thế. Hệ điều hành có thể trì hoãn/chặn push (ví dụ force-stop Android). Push không bảo đảm exactly-once khi mạng đứt sau khi provider đã nhận; danh sách DB và dedupe foreground giữ dữ liệu nhất quán.

Chưa thể xác minh push end-to-end nếu thiếu project ID/credentials và bản native cài trên thiết bị. Không có khóa hoặc ID giả được thêm vào cấu hình.

Tài liệu: [Expo Notifications SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/), [gửi push và xử lý receipts](https://docs.expo.dev/push-notifications/sending-notifications/).
