# Theo dõi phạm vi đầy đủ LuxCare Mobile

Mục tiêu cuối: đối chiếu mọi màn hình/thao tác/quyền/API của web với mobile. Không coi có service hoặc tên module là đã hoàn tất giao diện. Bảng này là kiểm kê nhóm ban đầu, cần bổ sung ma trận thao tác chi tiết khi chuyển từng module.

| Nhóm | FE có thể tận dụng / cần khảo sát | Trạng thái mobile |
|---|---|---|
| Nền tảng / tài khoản | types/common, authService, accountService, apiClientError | Có đăng nhập thường, refresh, hồ sơ, sửa tên, đổi mật khẩu, đăng xuất; thiếu MFA, avatar native, phiên theo thiết bị |
| Tổng quan | dashboardService, types/dashboard | Có số liệu cơ bản/đào tạo, ngày/7 ngày/năm/khoảng ngày tùy chọn và việc cần xử lý; mở danh sách công việc/đơn từ; chưa biểu đồ chi tiết |
| Thông báo | notificationService | Có danh sách/read/delete, lọc loại/chưa đọc; điều hướng công việc/phòng ban/tổng quan theo action và quyền; chưa push native hoặc mở bản ghi cụ thể |
| Phòng ban | departmentService, rosterService | Có CRUD, lọc hoạt động, gán người phụ trách, thứ tự hiển thị, xem tên cũ/chuẩn hóa; cần backend sửa khớp tên literal và UAT dữ liệu thật |
| Doanh nghiệp / chi nhánh | branchService, authService | Đã tái sử dụng branchService; admin chọn chi nhánh trong phiên, xóa state tab khi đổi phạm vi; chưa CRUD chi nhánh/quản trị doanh nghiệp |
| Phân quyền | rolePermissionService, shared/permissions, config/modules | Tái sử dụng catalog/nhãn/module guard; duyệt đơn theo canDecide backend; chưa UI quản trị quyền |
| Nhân sự / hồ sơ | rosterService, authService, types/common | Có danh sách theo chi nhánh, tìm kiếm, xem/sửa hồ sơ cơ bản theo quyền; chưa tạo/xóa, sơ đồ tổ chức |
| Chấm công / ca / lịch | companyWorkCalendarService, attendanceService, hrCalendarService, types/attendance, attendanceFaceCheck | Có trạng thái hôm nay, lịch sử cá nhân, check-in/out GPS và camera theo cờ chung; CRUD/phân ca, công chuẩn và cấu hình khung giờ vào/ra (backend chưa thực thi khung giờ); quản lý lịch nghỉ/làm bù, đồng bộ, bật/tắt và audit; chỉnh trạng thái/ghi chú công theo nhân viên/tháng, xem lịch sử theo quyền; xem/lọc/chi tiết lịch nhân sự; chưa sửa giờ vào/ra hoặc CRUD sự kiện; chờ UAT thiết bị |
| Nghỉ phép / đơn từ | leaveService, types/leave, LeaveRequestsTab | Đã có 4 loại yêu cầu, nộp/duyệt/từ chối/xóa, số dư phép, biểu mẫu và tệp đính kèm; chờ UAT thiết bị/staging |
| Hợp đồng / chứng chỉ | components/hr, shared/hr-credential, hrContractService, hrContractFiles, types/hrContract | Có tra cứu hợp đồng: tìm kiếm/phân trang, trạng thái/thời hạn/ghi chú, sắp hết hạn và lịch sử gia hạn; tạo/sửa thông tin cơ bản theo quyền, chọn nhân viên trong phạm vi; danh mục tệp mới/cũ dùng chung FE; tải/mở/chia sẻ tệp tối đa 20 MB qua ứng dụng thiết bị. Chưa tạo gia hạn, upload/gỡ tệp hoặc trình xem tích hợp; chứng chỉ chưa chuyển |
| Tuyển dụng | recruitmentService, rosterService, types/recruitment | Có tin tuyển dụng theo chi nhánh: tạo/sửa nội dung, tìm/lọc/phân trang, chi tiết, chuyển trạng thái, xóa mềm/khôi phục; ứng viên có tạo/sửa/cảnh báo trùng/tìm/lọc/phân trang/hồ sơ/lịch sử/chuyển bước/gán người phụ trách/xóa mềm/khôi phục; phỏng vấn có danh sách/lọc/phân trang/tạo/sửa/trạng thái/kết quả/gán người/xóa mềm/khôi phục; quản trị pipeline; upload/thay/tải/chia sẻ/gỡ attachment JD/CV riêng theo quyền; có xem/sửa/gỡ liên kết và upload JD/CV công khai; chờ UAT thiết bị/staging |
| Tiền lương | payrollService, types/hr, components/hr/payroll | Chưa chuyển |
| Công việc / Kanban / KPI | kanbanService, kanbanMediaService, monthlyKpiService, types/hr, kanbanTaskTime | Có CRUD công việc/dự án, lịch sử, tiến độ; CRUD/hoàn thành/gán người cho việc nhỏ; upload/link/gỡ/tải tệp; KPI tháng theo quyền; chưa bảng kéo thả, ghi âm/quay trực tiếp, socket |
| Chat | internalChatService, socketService | Chưa chuyển; cần lifecycle/reconnect native |
| AI / kho kiến thức | assistantService, assistantKnowledgeService, chatbotRequest | Chưa chuyển; cần streaming/upload native |
| Khách hàng | /customer-leads, các component FE tương ứng | Chưa chuyển |
| Kho / vật tư / danh mục / nhà cung cấp | supplyInventoryService, supplyService, warehouseService, categoryService, supplierService, shared/supply-* | Chưa chuyển |
| Thiết bị | equipmentComplianceService, /equipment | Chưa chuyển |
| Tài nguyên / Google Drive | resourceService, types/resource | Chưa chuyển; cần picker/download/OAuth |
| Blog / nội dung | blogService | Chưa chuyển |
| Pháp lý | legalDocumentService, knowledgeLegalReviewService | Chưa chuyển |
| Email / thanh toán / ví | companyEmailService, companyPaymentService, walletService | Chưa chuyển; phải xác nhận route đang mount |
| Super Admin | superAdmin*Service, superAdminRequest | Chưa chuyển; phụ thuộc hoàn tất MFA native |

## Đợt 28 — upload công khai

Đã thêm upload JD/CV công khai vào form tạo/sửa tin tuyển dụng và ứng viên (PDF/DOC/DOCX, tối đa 10 MB), lưu publicId đúng với URL đã upload. Giữ tệp khi xác nhận hồ sơ trùng; dọn tệp chưa gửi lưu khi đóng form, không dọn tệp có kết quả lưu chưa xác định. Chưa có backend dọn tệp mồ côi hoặc UAT thiết bị/staging. Bộ kiểm tra: 34 test/6 file và TypeScript mobile qua.

## Đợt 29 — tra cứu hợp đồng

Hoàn thành màn hình hợp đồng và lịch sử gia hạn có phân trang, tìm kiếm và danh sách sắp hết hạn từ API. Guard `hr:read` + HR + doanh nghiệp; phạm vi gửi theo phiên, backend giới hạn bản ghi theo vai trò. Tách types và metadata tệp của FE dùng chung; chưa chuyển thao tác ghi hoặc đọc nội dung tệp. 20 test/7 file, TypeScript gốc/mobile và export Hermes Android/iOS qua; chưa UAT thiết bị/staging.

## Đợt 30 — tệp hợp đồng

Đã có tải/mở/chia sẻ cho tệp hợp đồng và gia hạn qua media proxy đã xác thực. Helper chung với đơn từ/công việc, giới hạn 20 MB, timeout cả đọc body, hủy khi rời màn hình hợp đồng. Chưa có trình xem tích hợp; phụ thuộc domain được backend cho phép và ứng dụng đọc trên thiết bị. 20 test/4 file và TypeScript mobile qua; chưa UAT thiết bị/staging.

## Đợt 31 — tạo/sửa hợp đồng

Form native chọn nhân viên, loại hợp đồng, thời hạn, trạng thái và ghi chú. Tái sử dụng types/API; kiểm tra ngày, phạm vi danh sách nhân viên và quyền đọc/quản lý HR. PATCH chỉ trường thay đổi, giữ timestamp ngày không sửa và các tệp đã có. Backend chưa có cơ chế version chống ghi đè đồng thời; lỗi lưu chưa xác định yêu cầu đóng/tải lại. 17 test/5 file và TypeScript mobile qua; chưa UAT thiết bị/staging.

## Đợt tiếp theo

1. Kiểm chứng đăng nhập/thông báo/phòng ban với staging và thiết bị thật; chốt hành vi phiên web/mobile.
2. UAT chọn chi nhánh và đơn từ; đối soát hiển thị lịch/ngày tính phép, tệp tài liệu thật và hierarchy duyệt; triển khai UI quản trị quyền.
3. Chuyển nhân sự/chấm công/công việc theo từng luồng end-to-end, tận dụng types và service đã tách transport.
4. Tiếp tục các module còn lại trong bảng, ghi rõ màn hình và thao tác đã nghiệm thu.

## Tiêu chí nghiệm thu từng module

Đợt hai mươi bảy: 18/18 test trong 5 file qua; TypeScript mobile và export Hermes Android/iOS qua. Có xem/mở/sửa/gỡ liên kết JD/CV công khai, bảo toàn publicId khi URL không đổi. Chưa upload kho công khai hoặc UAT thiết bị/staging.

Đợt hai mươi sáu: 25/25 test trong 3 file qua; TypeScript mobile và export Hermes Android/iOS qua. Có kho attachment JD/CV, multipart và signed download/chia sẻ. Chưa luồng liên kết công khai hoặc UAT storage/thiết bị/staging.

Đợt hai mươi lăm: 12/12 test trong 3 file qua; TypeScript mobile và export Hermes Android/iOS qua. Có quản trị giai đoạn/thứ tự/màu/kết quả cuối của pipeline, xác nhận và phiên bản khi lưu. Chưa UAT thiết bị/staging.

Đợt hai mươi bốn: 28 test hồi quy qua, sau sửa backend thêm/chạy lại 5 test ứng viên qua; TypeScript web/mobile và export Hermes Android/iOS qua. Có thùng rác ứng viên/lịch; sửa nút thêm ứng viên và lỗi backend không đổi trạng thái xóa. Cần cập nhật backend cùng mobile; chưa UAT thiết bị/staging.

Đợt hai mươi ba: 26/26 test trong 9 file qua; TypeScript mobile và export Hermes Android/iOS qua. Có chọn/bỏ người phụ trách ứng viên và nhiều người phỏng vấn từ roster đúng chi nhánh, giữ phân công không đổi khi lỗi/thiếu quyền tải. Chưa UAT thiết bị/staging.

Đợt hai mươi hai: 19/19 test trong 7 file qua; TypeScript mobile và export Hermes Android/iOS qua. Có danh sách/lọc/phân trang/đặt lịch/sửa lịch/kết quả phỏng vấn. Chưa chọn người phỏng vấn hoặc UAT thiết bị/staging.

Đợt hai mươi mốt: 17/17 test trong 6 file qua; TypeScript mobile và export Hermes Android/iOS qua. Có tạo/sửa ứng viên, cảnh báo trùng và xác nhận riêng, kiểm tra dữ liệu và bảo toàn CV/giai đoạn/người phụ trách. Chưa UAT thiết bị/staging.

Đợt hai mươi: 14/14 test trong 5 file qua; TypeScript mobile và export Hermes Android/iOS qua. Có danh sách/hồ sơ ứng viên, bộ lọc/phân trang, lịch sử và chuyển giai đoạn có xác nhận/kết quả/phiên bản. Chưa UAT thiết bị/staging.

Đợt mười chín: 12/12 test trong 4 file qua; TypeScript mobile và export Hermes Android/iOS qua. Có tạo nháp/sửa nội dung tin tuyển dụng, kiểm tra số lượng/lương/ngày và giữ phiên bản/JD khi sửa. Sửa xung đột tên module trên Windows, chạy lại test form. Chưa UAT thiết bị/staging.

Đợt mười tám: 15/15 test trong 5 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Có danh sách/chi tiết/phân trang tin tuyển dụng, chuyển trạng thái, xóa mềm và khôi phục theo phiên bản/quyền/chi nhánh. Sửa mock test backend cũ để hỗ trợ phân trang. Chưa UAT staging/thiết bị.

Đợt mười bảy: 10/10 test trong 5 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Có lịch nhân sự theo tháng/loại/tìm kiếm/liên quan đến tôi và chi tiết, dùng service chung với web. Chưa CRUD sự kiện, nhắc việc native hoặc UAT staging/thiết bị.

Đợt mười sáu: 14/14 test trong 5 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Có chọn nhân viên/tháng, chỉnh trạng thái/ghi chú với lý do và xác nhận, xem lịch sử trước/sau theo quyền quản lý công. Chưa sửa giờ vào/ra hoặc nghiệm thu staging/thiết bị.

Đợt mười lăm: 16/16 test trong 4 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Bổ sung cấu hình khung giờ vào/ra, bảo toàn công chuẩn khi sửa ca và tính lại theo giờ nghỉ. Backend mới lưu khung giờ, chưa thực thi giới hạn đó. Chưa UAT staging/thiết bị.

Đợt mười bốn: 24/24 kiểm thử trong 4 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Đã có check-in/out GPS, camera trước theo cờ chung đang tắt, xử lý quyền và lỗi gửi không xác định. Chưa nghiệm thu camera/GPS, lifecycle hoặc ghi chấm công trên thiết bị/staging.

Đợt mười ba: 13/13 kiểm thử trong 5 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Có quản lý lịch nghỉ/làm bù, đồng bộ và audit, sửa quyền đọc lịch; chưa nghiệm thu dữ liệu thật/thiết bị.

Đợt mười hai: 24/24 kiểm thử trong 4 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Có CRUD ca và phân ca nhiều nhân sự, kiểm tra giờ nghỉ/ca qua đêm; chưa nghiệm thu thiết bị/staging.

Đợt mười một: 28/28 kiểm thử trong 5 file qua khi chạy một worker; TypeScript web/mobile và export Hermes Android/iOS qua. Lần chạy test đầu timeout khởi tạo worker, đã chạy lại thành công. Có màn hình xem lịch/chấm công; chưa check-in/out hoặc nghiệm thu thiết bị/staging.

Đợt mười: 19/19 kiểm thử trong 4 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Có quản lý người phụ trách, thứ tự và chuẩn hóa tên phòng ban; chưa nghiệm thu dữ liệu thật/thiết bị.

Đợt chín: 20/20 kiểm thử trong 4 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Có sửa tên, đổi mật khẩu qua service dùng chung; chưa nghiệm thu tài khoản thật/thiết bị.

Đợt tám: 25/25 kiểm thử trong 4 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Bổ sung khoảng ngày tổng quan, đào tạo và action-items; chưa nghiệm thu thiết bị/staging.

Đợt bảy: 21/21 kiểm thử trong 4 file qua; TypeScript web/mobile và export Hermes Android/iOS qua. Có điều hướng thông báo theo action hỗ trợ, lọc loại và khóa thao tác. Chưa thử thiết bị/staging.

Đợt sáu: 26/26 kiểm thử trong 6 file qua, TypeScript web/mobile qua, bundle Hermes Android/iOS qua. Bổ sung KPI tháng dùng chung service với web; chưa nghiệm thu thiết bị/staging.

Đợt năm: 55/55 kiểm thử trong 10 file qua, TypeScript gốc/mobile qua, xuất bundle Hermes Android/iOS thành công. Có upload/link/gỡ/tải đính kèm và chọn người cho việc nhỏ; chưa UAT staging/thiết bị.

Đợt bốn: 49/49 kiểm thử liên quan trong 8 file qua; TypeScript web/mobile qua; bundle Hermes Android/iOS xuất thành công. Phạm vi mới: CRUD dự án và quản lý việc nhỏ. Chưa kiểm thử staging/thiết bị; chưa gán lại người cho việc nhỏ hoặc upload mới cho công việc/dự án.

Đợt ba: 90/90 kiểm thử trong 19 file qua, TypeScript web/mobile qua, xuất bundle Hermes Android/iOS thành công. Có thêm nhân sự cơ bản, công việc và danh sách dự án. Kiểm tra phiên bản công việc cần backend cập nhật cùng app; chưa nghiệm thu API thật hoặc thiết bị.

Đợt hai: 48 kiểm thử qua, TypeScript web/mobile qua, bundle Hermes Android/iOS xuất thành công. Kết quả này chỉ xác nhận mã và hợp đồng API mock; chưa nghiệm thu trên thiết bị thật. Mã `mobile/` hiện bị repository gốc bỏ qua trong Git, cần lưu cùng các nguồn FE dùng chung khi chuyển môi trường phát triển.

- Đối chiếu màn hình, tìm kiếm/bộ lọc, CRUD/duyệt, import/export, phân trang, upload và quyền với FE thật.
- API thật và backend kiểm tra tenant/chi nhánh/quyền; app không tự mở quyền bằng fallback role.
- Loading/empty/error, timeout/offline, refresh và session replacement hoạt động đúng.
- Android/iOS thiết bị thật; không đánh dấu hoàn thành từ kết quả bundle JS.
