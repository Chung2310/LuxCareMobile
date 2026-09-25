const defaultOrigin = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");

export const BRAND_NAME = "LuxCare";
export const BRAND_TAGLINE = "Hệ thống Quản lý Y tế";
export const SERVICE_WEBSITE_URL = defaultOrigin || "https://staging-luxcare.igentechnology.net";
export const SUPPORT_EMAIL = "support@luxcare.vn";
export const PRIVACY_POLICY_URL = `${SERVICE_WEBSITE_URL}/privacy-policy`;
export const TERMS_OF_SERVICE_URL = `${SERVICE_WEBSITE_URL}/terms-of-service`;
export const USER_DATA_DELETION_URL = `${SERVICE_WEBSITE_URL}/user-data-deletion`;

export const LAST_UPDATED = "August 29, 2026";

export interface LegalSection {
  title: string;
  titleVi?: string;
  content: string[];
}

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    title: "1. Scope",
    titleVi: "1. Phạm vi áp dụng",
    content: [
      `${BRAND_NAME} là nền tảng quản trị vận hành y tế & doanh nghiệp có thể kết nối với Google Drive, TikTok Shop, Facebook và các dịch vụ được phê duyệt để quản lý hoạt động nội bộ và nội dung công ty.`,
      "Chính sách bảo mật này giải thích thông tin chúng tôi thu thập, mục đích sử dụng, thời gian lưu trữ cũng như cách người dùng có thể thu hồi quyền truy cập hoặc yêu cầu xóa dữ liệu.",
    ],
  },
  {
    title: "2. Data We Receive",
    titleVi: "2. Dữ liệu chúng tôi tiếp nhận",
    content: [
      "Dữ liệu tài khoản và hồ sơ người dùng cung cấp trực tiếp: Họ tên, email, số điện thoại, thông tin công ty, chi nhánh và thông tin đăng nhập.",
      "Dữ liệu cấp quyền thiết bị di động: Quyền vị trí địa lý (chỉ sử dụng khi chấm công vào/ra ca), camera (chụp ảnh chấm công, hồ sơ hợp đồng), thư viện ảnh/video (tải lên tài liệu, đại diện) và microphone (ghi âm tin nhắn thoại trong chat).",
      "Đối với Google Drive: Chúng tôi nhận địa chỉ email tài khoản kết nối và quyền OAuth giới hạn (drive.file) để phục vụ lưu trữ tài liệu được người dùng ủy quyền.",
      "Dữ liệu vận hành kinh doanh: Lịch trực, ca làm, bảng chấm công, bảng lương, báo cáo công việc và tin nhắn trao đổi trong hệ thống.",
      "Dữ liệu kỹ thuật: Địa chỉ IP, loại thiết bị, phiên bản hệ điều hành, thời gian truy cập và nhật ký bảo mật nhằm đảm bảo an toàn tài khoản.",
    ],
  },
  {
    title: "3. How We Use Data",
    titleVi: "3. Mục đích sử dụng dữ liệu",
    content: [
      "Xác thực người dùng và duy trì phiên làm việc bảo mật trên các thiết bị.",
      "Xác nhận vị trí thực tế tại thời điểm chấm công để đảm bảo tính minh bạch trong quản lý nhân sự.",
      "Truyền tải tin nhắn, thông báo công việc, bảng lương và tài liệu trao đổi nội bộ.",
      "Khởi tạo và duy trì các kết nối tích hợp được người dùng cho phép.",
      "Tạo bản nháp nội dung hoặc gợi ý tự động dựa trên tài liệu người dùng tải lên.",
      "Giám sát độ tin cậy hệ thống, ngăn chặn lạm dụng và tuân thủ các nghĩa vụ pháp lý hiện hành.",
    ],
  },
  {
    title: "4. Device Permissions And Platform Integrations",
    titleVi: "4. Quyền truy cập thiết bị & Tích hợp nền tảng",
    content: [
      "Ứng dụng chỉ yêu cầu các quyền trên thiết bị (Camera, Vị trí, Ảnh, Microphone) khi người dùng chủ động kích hoạt tính năng tương ứng.",
      "Người dùng có thể bật hoặc tắt từng quyền truy cập bất kỳ lúc nào trong phần Cài đặt của thiết bị iOS/Android.",
      "Đối với dịch vụ bên thứ ba (Google Drive, TikTok Shop), chúng tôi chỉ yêu cầu phạm vi tối thiểu cần thiết và không bao giờ yêu cầu mật khẩu của dịch vụ bên thứ ba.",
    ],
  },
  {
    title: "5. AI Processing And User Materials",
    titleVi: "5. Xử lý AI & Tài liệu người dùng",
    content: [
      "Khi người dùng sử dụng tính năng hỗ trợ tạo nội dung bằng AI, hệ thống chỉ xử lý các tài liệu và văn bản do người dùng trực tiếp cung cấp.",
      "Người dùng giữ toàn quyền sở hữu và chịu trách nhiệm kiểm duyệt nội dung trước khi xuất bản hoặc sử dụng trong công việc.",
    ],
  },
  {
    title: "6. Sharing And Disclosure",
    titleVi: "6. Chia sẻ & Tiết lộ thông tin",
    content: [
      "Chúng tôi tuyệt đối không bán dữ liệu người dùng, thông tin cá nhân hoặc thông tin xác thực cho bất kỳ bên thứ ba nào.",
      "Chúng tôi không sử dụng dữ liệu người dùng cho mục đích quảng cáo thương mại ngoài phạm vi dịch vụ.",
      "Dữ liệu chỉ được chia sẻ với các nhà cung cấp hạ tầng đám mây (cloud hosting, push notifications) ở mức độ tối thiểu cần thiết để vận hành ứng dụng.",
    ],
  },
  {
    title: "7. Retention And Security",
    titleVi: "7. Lưu trữ & Bảo mật dữ liệu",
    content: [
      "Dữ liệu được lưu trữ với các biện pháp bảo mật tiêu chuẩn (mã hóa đường truyền HTTPS/TLS, mã hóa mật khẩu bcrypt, bảo mật token trong SecureStore).",
      "Dữ liệu được lưu giữ trong suốt thời gian người dùng duy trì tài khoản hoặc theo quy định pháp lý về lưu trữ hồ sơ lao động doanh nghiệp.",
    ],
  },
  {
    title: "8. Your Choices And Rights",
    titleVi: "8. Quyền của người dùng & Xóa dữ liệu",
    content: [
      "Người dùng có quyền xem, chỉnh sửa thông tin cá nhân hoặc đổi mật khẩu trong mục Cài đặt tài khoản.",
      "Người dùng có quyền tự yêu cầu XÓA TÀI KHOẢN trực tiếp ngay trong ứng dụng (tại màn hình Hồ sơ cá nhân) hoặc gửi yêu cầu qua trang web xóa dữ liệu.",
      "Khi tài khoản bị xóa, quyền truy cập và dữ liệu cá nhân liên kết sẽ bị xóa vĩnh viễn khỏi hệ thống đang hoạt động.",
    ],
  },
];

export const TERMS_OF_SERVICE_SECTIONS: LegalSection[] = [
  {
    title: "1. Agreement To Terms",
    titleVi: "1. Chấp thuận điều khoản",
    content: [
      `Chào mừng bạn đến với ${BRAND_NAME}. Bằng việc truy cập hoặc sử dụng ứng dụng di động hoặc trang web của chúng tôi, bạn đồng ý tuân thủ các Điều khoản dịch vụ này và mọi quy định pháp luật hiện hành.`,
      "Nếu bạn không đồng ý với bất kỳ điều khoản nào, vui lòng ngừng sử dụng dịch vụ.",
    ],
  },
  {
    title: "2. Account Responsibility",
    titleVi: "2. Trách nhiệm về tài khoản",
    content: [
      "Bạn chịu trách nhiệm bảo mật thông tin đăng nhập (email và mật khẩu) và cho mọi hoạt động diễn ra dưới tài khoản của mình.",
      "Bạn phải cung cấp thông tin đăng ký chính xác, trung thực và cập nhật khi có thay đổi.",
      "Thông báo ngay cho quản trị viên nếu bạn phát hiện bất kỳ hành vi xâm nhập hoặc sử dụng trái phép tài khoản.",
    ],
  },
  {
    title: "3. Acceptable Use & Conduct",
    titleVi: "3. Quy tắc sử dụng & Ứng xử",
    content: [
      "Không sử dụng ứng dụng cho các hành vi gian lận chấm công, can thiệp vị trí giả mạo (GPS spoofing) hoặc phá hoại hệ thống.",
      "Trong phần Trò chuyện (Chat) và Blog: Nghiêm cấm gửi nội dung thù địch, xúc phạm, quấy rối, nội dung khiêu dâm hoặc xâm phạm quyền sở hữu trí tuệ của người khác.",
      "Không phát tán mã độc, virus hoặc thực hiện hành vi tấn công từ chối dịch vụ.",
    ],
  },
  {
    title: "4. Customer Content And Lawful Use",
    titleVi: "4. Nội dung và quyền sở hữu",
    content: [
      "Bạn giữ quyền sở hữu đối với các tài liệu, hình ảnh và nội dung do bạn tải lên hệ thống.",
      "Bạn đảm bảo rằng bạn có đầy đủ quyền hạn để tải lên, lưu trữ và chia sẻ các tài liệu này trong nội bộ tổ chức.",
    ],
  },
  {
    title: "5. AI-Assisted Features",
    titleVi: "5. Tính năng hỗ trợ AI",
    content: [
      "Dịch vụ có thể cung cấp các công cụ hỗ trợ soạn thảo, tóm tắt và phân tích bằng trí tuệ nhân tạo.",
      "Kết quả từ AI mang tính tham khảo và người dùng cần xem xét, kiểm tra lại trước khi áp dụng vào công việc chính thức.",
    ],
  },
  {
    title: "6. Service Availability And Modifications",
    titleVi: "6. Tính khả dụng & Thay đổi dịch vụ",
    content: [
      "Chúng tôi nỗ lực duy trì ứng dụng hoạt động liên tục và ổn định, tuy nhiên dịch vụ có thể tạm gián đoạn để bảo trì định kỳ hoặc nâng cấp hạ tầng.",
      "Chúng tôi có quyền cập nhật các điều khoản này để phản ánh sự thay đổi của pháp luật hoặc tính năng sản phẩm.",
    ],
  },
  {
    title: "7. Termination",
    titleVi: "7. Chấm dứt sử dụng",
    content: [
      "Bạn có thể ngừng sử dụng dịch vụ hoặc tự xóa tài khoản của mình bất kỳ lúc nào.",
      "Chúng tôi có quyền tạm ngừng hoặc khóa vĩnh viễn tài khoản nếu phát hiện hành vi vi phạm nghiêm trọng các điều khoản sử dụng hoặc quy chế công ty.",
    ],
  },
  {
    title: "8. Disclaimer And Limitation",
    titleVi: "8. Giới hạn trách nhiệm",
    content: [
      "Ứng dụng được cung cấp trên cơ sở 'nguyên trạng' (as-is). Trong phạm vi tối đa được pháp luật cho phép, chúng tôi không chịu trách nhiệm cho các thiệt hại gián tiếp phát sinh từ việc sử dụng hoặc không thể sử dụng ứng dụng.",
    ],
  },
];
