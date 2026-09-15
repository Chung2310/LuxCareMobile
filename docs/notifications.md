# Thông báo realtime và push mobile

## Chat và Blog realtime

`CommunicationProvider` nghe các event có sẵn của backend: `internal_new_message`, `internal_room_updated/deleted`, `internal_message_edited/deleted/reaction`, `internal_messages_read`, `blog_post_created/deleted/pinned/liked`. Không cần thêm endpoint backend cho phần realtime này.

Chat hiển thị banner khi nhận tin của người khác ngoài phòng đang xem, mở đúng phòng khi chạm banner, và lấy số chưa đọc từ API cho tab/icon chức năng. Phòng đang mở cập nhật theo socket; polling 15 giây chỉ dự phòng khi mất socket. App không đánh dấu đã đọc khi tab không hiển thị hoặc app chạy nền.

Blog hiển thị banner bài mới và số bài chưa xem trên icon ở trang chủ, danh sách chức năng và mục ghim. Đánh dấu đã xem khi kênh được tải thành công trong màn hình đang mở. Chỉ tính 50 bài API đang trả về, không tính bài tự đăng. Lần đồng bộ đầu tiên trên thiết bị lấy các bài hiện tại làm mốc; các bài mới sau đó được đếm. Trạng thái xem lưu riêng theo API server/công ty/tài khoản trên thiết bị, chưa đồng bộ đã xem giữa nhiều thiết bị. Khi reconnect/foreground, tải lại API để cập nhật nội dung và badge.

Blog dùng realtime trong app. Chat có push nền qua worker như mô tả bên dưới.

Expo Go: không nạp `expo-notifications` hoặc gọi API native push. Vẫn dùng socket, banner và badge trong ứng dụng; màn hình Thông báo giải thích giới hạn này. Luồng xin quyền và push native chạy trong development/release build của LuxCare.

Backend: `E:/Igen/LuxCare`. Mobile: `mobile/`.

## Luồng hoạt động

- Khi mở app, tạo Android channel `default` và xin quyền nếu người dùng chưa quyết định. Không chờ đăng nhập. Từ chối quyền không chặn ứng dụng; màn hình Thông báo có nút mở Cài đặt.
- Sau đăng nhập, Android lấy token FCM và POST `/api/v1/push/devices` với `{ token, platform: "android", provider: "fcm" }`. iOS tiếp tục đăng ký token Expo với `provider: "expo"`. JWT quyết định người nhận, công ty và phiên. DELETE cùng endpoint với `{ token }` để hủy.
- Socket dùng API origin, path `/socket.io/`, namespace `/`, `auth.token`. Server tự join room cá nhân. Mobile nghe `new_notification` và `notifications:changed`, đồng bộ lại qua API sau reconnect/foreground.
- Foreground hiển thị banner chung cho socket và push, chống trùng theo notification ID trong phiên (giới hạn 200 ID). Tab thông báo hiển thị số chưa đọc. Push foreground không tạo thêm banner hệ điều hành.
- Background dùng push có title/body để hệ điều hành hiển thị. Không chạy socket bằng background task. Chạm thông báo chờ khôi phục phiên và navigation, kiểm tra người nhận/công ty rồi dùng `notificationTarget`; nội dung chưa hỗ trợ mở danh sách thông báo.
- Backend đánh dấu thông báo mới bằng `mobilePushQueued: false`. Worker mỗi 5 giây chuyển tối đa 20 thông báo sang các job MongoDB có khóa duy nhất notification/token/session, rồi xử lý tối đa 20 job. Thông báo cũ không có cờ này không được gửi lại.
- Worker kiểm tra thiết bị và phiên trước gửi; logout/đổi phiên thu hồi đăng ký. Job retry tối đa 8 lần với backoff; FCM thành công chuyển sang `accepted`; chỉ Expo kiểm tra receipt sau 15 phút. `DeviceNotRegistered` loại đăng ký đúng chủ sở hữu. Job lưu 7 ngày qua TTL để chẩn đoán.
- Thông báo kho được ghi qua inventory outbox cũng có event realtime và đi qua worker push. Web Push hiện có vẫn độc lập.

## Cấu hình trước khi phát hành

### Android: Firebase trực tiếp, cài APK trên máy khách

Không cần Expo account, EAS Project ID hay upload keystore lên EAS để dùng luồng Android này. App vẫn dùng thư viện Expo trong mã nguồn; thông báo đi từ backend → Firebase FCM → Android.

1. Firebase Console → Project settings → Android app: package phải là `com.igen.luxcare` nếu GitHub đang dùng `LUXCARE_IOS_BUNDLE_IDENTIFIER=com.igen.luxcare`. Tải `google-services.json`.
2. GitHub → Settings → Secrets and variables → Actions: giữ `EXPO_PUBLIC_API_URL`, giữ biến package hiện có (workflow dùng `LUXCARE_ANDROID_PACKAGE` nếu có, nếu không dùng `LUXCARE_IOS_BUNDLE_IDENTIFIER`). Secret `GOOGLE_SERVICES_JSON` chứa toàn bộ cấu hình client vừa tải.
3. Trên **máy chủ backend LuxCare**: dùng tài khoản dịch vụ có quyền gửi FCM cho cùng Firebase project. Có thể dùng Application Default Credentials của môi trường Google; nếu dùng máy chủ riêng, Firebase Console → Project settings → Service accounts → Generate new private key, lưu JSON ngoài repository, rồi đặt:
   ```dotenv
   GOOGLE_APPLICATION_CREDENTIALS=/duong-dan-bi-mat/firebase-service-account.json
   FIREBASE_PROJECT_ID=project-id-trong-google-services-json
   ```
   Đây là biến môi trường **backend**, không phải GitHub mobile hay `EXPO_PUBLIC_*`. Không đưa khóa này vào APK. Bật Firebase Cloud Messaging API (HTTP v1); backend cần truy cập Google OAuth và `fcm.googleapis.com`.
4. Triển khai backend đã sửa và khởi động lại. Bảo đảm index unique/TTL của `MobilePushDevice` và `MobilePushJob` được tạo theo schema nếu tắt autoIndex.
5. Chạy workflow APK trên GitHub, tải artifact và cài APK lên máy khách. Mở app, đăng nhập, cho phép thông báo rồi thử nhận khi app ở nền và khi đóng bình thường.

`google-services.json` chỉ cấu hình app nhận thông báo; backend cần quyền gửi ở bước 3. Khách hàng không cần tài khoản Expo hoặc Firebase.

### iOS và bản Android cũ

iOS và thiết bị cũ chưa nâng cấp APK tiếp tục dùng luồng Expo có sẵn: cần EAS Project ID và credentials tương ứng. Bản Android mới gửi `provider: "fcm"` và không gọi Expo Push Service. Không đổi token APNs của iOS thành token FCM.

## Thông báo chat và tắt thông báo

- Mobile: mở cuộc trò chuyện → Thông tin cuộc trò chuyện → Tắt/Bật thông báo tin nhắn. Áp dụng riêng cho mỗi người trong chat cá nhân hoặc nhóm, lưu trên backend và đồng bộ qua socket. Không chặn gửi tin, không ẩn nội dung và không giảm badge chưa đọc.
- API mới: `PATCH /api/v1/chat/rooms/:roomId/notifications`, body `{"muted":true}`. Cần quyền chat và là thành viên đúng công ty; chỉ cập nhật cài đặt của người đang đăng nhập.
- Tin nhắn mới có hàng đợi push bền vững; kiểm tra lại thành viên, công ty, đã đọc, tắt thông báo và phiên thiết bị trước gửi. Không gửi lại tin cũ khi bật thông báo. Web Push hiện có cũng kiểm tra mute.
- Foreground dùng chung khóa messageId để tránh banner trùng socket/push. Chạm push mở phòng sau khi xác minh tài khoản và quyền truy cập, kể cả khi khởi động ứng dụng từ trạng thái đóng.
- Triển khai backend LuxCare cùng thay đổi mobile; tạo index `ChatMessage { mobilePushQueued: 1, createdAt: 1 }` nếu autoIndex bị tắt. Không backfill cờ cho tin nhắn lịch sử. Push chat hết hạn sau một giờ.
- Push đã chuyển sang nhà cung cấp trước thời điểm tắt có thể vẫn xuất hiện; không thể thu hồi bằng cài đặt này. Tắt thông báo cần kết nối mạng để lưu thành công.

Kiểm thử thiết bị: dùng hai tài khoản, thử chat cá nhân và nhóm ở foreground/background/khóa màn hình; tắt thông báo và kiểm tra không có banner/push nhưng badge vẫn tăng; bật lại và chỉ nhận tin mới; thử đã đọc trước lúc worker gửi, chạm push khi app đóng, đổi tài khoản và rời nhóm.

## Xác minh

Âm thanh: banner foreground (thông báo chung, chat và Blog) phát file người dùng cung cấp `mobile/assets/notification_sound/universfield-new-notification-051-494246.mp3` (khoảng 2,46 giây), đóng gói cùng ứng dụng. Không còn tạo tiếng chuông WAV bằng code. Âm thanh chạy sau kiểm tra người nhận, mute và chống trùng event; giới hạn một tiếng mỗi giây khi nhiều tin đến cùng lúc. Không phát cho chat đang mở hoặc đã tắt thông báo. Dừng/giải phóng player khi app chuyển nền hoặc đổi phiên. Không thay đổi audio mode toàn ứng dụng.

Push nền tiếp tục dùng `sound: "default"`, kênh Android `default` khai báo âm thanh mặc định. Âm thanh thực tế phụ thuộc âm lượng, chế độ im lặng/Không làm phiền và cài đặt thông báo của hệ điều hành. Nếu người dùng đã tắt tiếng kênh Android, cần bật lại trong Cài đặt; ứng dụng không ghi đè lựa chọn đó. Âm báo foreground hiện dành cho Android/iOS, chưa hỗ trợ web.

Kiểm thử tự động: `npm test -- mobile/src/features/notifications/payload.test.ts mobile/src/api/socketService.test.ts mobile/src/api/client.test.ts mobile/src/features/navigation/notificationTarget.test.ts`; backend chạy `npx vitest run server/service/mobile-push.service.test.ts`. Chạy typecheck ở hai dự án và export Android/iOS.

Trên thiết bị thật: cài mới → xin quyền trước login → đăng nhập → tạo công việc cho người dùng từ tài khoản khác → nhận đúng một banner foreground → background/khóa màn hình → nhận push → chạm mở đúng màn hình. Kiểm tra thêm từ chối quyền/mở Settings, mở từ trạng thái app chưa chạy, offline/reconnect, đọc/xóa/badge, logout/đổi phiên và token hết hiệu lực.

Theo dõi collection `mobilepushjobs`: `send`, `receipt`, `delivered`, `cancelled`, `failed`; xem `lastError`, `attempts`, `availableAt`. `delivered` chỉ xác nhận receipt thành công từ nhà cung cấp, không chứng minh người dùng đã xem.

## Giới hạn

Không thể thu hồi push đã được nhà cung cấp nhận trước thời điểm logout. Logout hoàn toàn offline chỉ xóa phiên ở máy; backend chưa biết đến thao tác đó cho tới khi phiên bị thu hồi/thay thế. Hệ điều hành có thể trì hoãn/chặn push (ví dụ force-stop Android). Push không bảo đảm exactly-once khi mạng đứt sau khi provider đã nhận; danh sách DB và dedupe foreground giữ dữ liệu nhất quán.

Chưa thể xác minh push end-to-end nếu thiếu project ID/credentials và bản native cài trên thiết bị. Không có khóa hoặc ID giả được thêm vào cấu hình.

Tài liệu: [Expo Notifications SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/), [gửi push và xử lý receipts](https://docs.expo.dev/push-notifications/sending-notifications/).

## APK GitHub Actions và push khi đóng app

Workflow kiểm tra cấu hình Firebase client khớp package, ghi vào thư mục tạm rồi truyền `GOOGLE_SERVICES_JSON` cho prebuild. Android không còn yêu cầu `EXPO_PUBLIC_EAS_PROJECT_ID`.

App đăng ký lại khi mở, reconnect hoặc token thay đổi; lỗi tạm thời thử lại sau 30 giây, tăng tối đa 5 phút trong foreground. Khi chuyển nền, đăng ký vẫn được giữ.

Kiểm tra bằng hai tài khoản trên máy thật: gửi thông báo/chat → kiểm tra khay thông báo khi app ở nền/đóng → chạm để mở đúng nội dung. Thử cả logout, đổi tài khoản, chat đã đọc và tắt thông báo chat. Android **Buộc dừng** chặn nhận push cho đến khi mở app lại.

Backend: `MobilePushJob.state = accepted` nghĩa là FCM đã nhận yêu cầu, chưa xác nhận thiết bị hiển thị. `FCM UNREGISTERED` xóa token đúng chủ sở hữu; `FCM SENDER_ID_MISMATCH` cần đối chiếu Firebase project của APK và backend. Lỗi xác thực/mạng được ghi mã lỗi không kèm khóa bí mật, thử lại tối đa 8 lần. Sau khi sửa credentials, gửi thông báo mới để kiểm tra.

Tài liệu: [Gửi FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api), [Dùng FCM trực tiếp với expo-notifications](https://docs.expo.dev/push-notifications/sending-notifications-custom/).
