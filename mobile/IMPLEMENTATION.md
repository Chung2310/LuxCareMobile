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
| Hợp đồng / chứng chỉ | components/hr, shared/hr-credential, hrContractService, hrContractFiles, hrCredentialService | Hợp đồng có tạo/sửa/gia hạn, upload khi tạo, tra cứu và tải/chia sẻ; chưa thay/gỡ tệp đã lưu hoặc nhiều tệp mỗi nhóm. Chứng chỉ có tạo/sửa/xóa, danh sách/tìm/lọc/phân trang, thống kê, chi tiết, upload/thay tài liệu và tải/chia sẻ; chưa gỡ tài liệu đã lưu hoặc push nhắc hạn |
| Tuyển dụng | recruitmentService, rosterService, types/recruitment | Có tin tuyển dụng theo chi nhánh: tạo/sửa nội dung, tìm/lọc/phân trang, chi tiết, chuyển trạng thái, xóa mềm/khôi phục; ứng viên có tạo/sửa/cảnh báo trùng/tìm/lọc/phân trang/hồ sơ/lịch sử/chuyển bước/gán người phụ trách/xóa mềm/khôi phục; phỏng vấn có danh sách/lọc/phân trang/tạo/sửa/trạng thái/kết quả/gán người/xóa mềm/khôi phục; quản trị pipeline; upload/thay/tải/chia sẻ/gỡ attachment JD/CV riêng theo quyền; có xem/sửa/gỡ liên kết và upload JD/CV công khai; chờ UAT thiết bị/staging |
| Tiền lương | payrollService, types/payslip, types/payrollRun, types/payrollPayment, types/payrollAdjustment, types/payrollAudit, types/payrollIssue, components/hr/payrollDetails | Có phiếu lương và chia sẻ HTML; tạo kỳ nháp thường theo tháng, đồng bộ công đã tổng hợp, khóa bản công, tính/tính lại lương, duyệt/chốt/mở lại kỳ; tra cứu kỳ, tổng tiền, nhân viên; lỗi/cảnh báo kỳ; tạo nháp/xác nhận/lịch sử thanh toán; tạo/tra cứu/duyệt/từ chối điều chỉnh; nhật ký kỳ; xuất 4 mẫu Excel; phát hành và thu hồi phiếu theo nhân viên. Chưa tạo kỳ bổ sung/tổng hợp công kỳ/công thức/hủy-đảo thanh toán/sửa hoặc xóa điều chỉnh, PDF hoặc in native |
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

## Đợt 32–33 — gia hạn và tài liệu

Đã có tạo gia hạn, kiểm tra ngày hết hạn mới, lý do và phản hồi gồm hợp đồng/lịch sử. Form hợp đồng mới/gia hạn nhận tài liệu và ảnh đã ký qua managed upload, lưu metadata/token theo schema tệp đơn. Hủy chọn không đồng nghĩa xóa tệp server; chưa hỗ trợ thay/gỡ tài liệu đã lưu hoặc sửa bản gia hạn. 129 test/30 file và TypeScript qua; chưa UAT thiết bị/staging.

## Đợt 34 — văn bằng/chứng chỉ

Đã có danh sách, tìm kiếm, bộ lọc loại/trạng thái, phân trang server, thống kê phạm vi, chi tiết và tải/chia sẻ tài liệu. Quyền đọc chứng chỉ hoặc HR; backend giới hạn nhân viên tự xem hồ sơ. Chưa tạo/sửa/xóa/upload chứng chỉ hoặc push nhắc hạn; chưa UAT thiết bị/staging.

## Đợt 35 — tạo/sửa chứng chỉ

Đã có form tạo/sửa nội dung chứng chỉ, chọn nhân viên, thời hạn hoặc không thời hạn, số ngày nhắc theo quyền. PATCH tối thiểu, giữ tệp hiện có và ngày không sửa. Chưa xóa/upload chứng chỉ hoặc UAT thiết bị/staging.

## Đợt ba mươi sáu

Xóa chứng chỉ qua service dùng chung, xác nhận riêng và khóa thao tác trong lúc gửi. Lỗi yêu cầu tải lại trước lần tiếp theo, kết quả thành công phải có `status: success`. Đóng màn hình xóa tải lại danh sách và thống kê từ trang đầu. Backend xóa vĩnh viễn hồ sơ, chuyển tài nguyên có liên kết vào thùng rác theo cơ chế best effort; không có API khôi phục chứng chỉ. Chưa UAT thiết bị/staging.

## Đợt ba mươi bảy

Upload/thay tài liệu chứng chỉ PDF/JPG/PNG/WebP tối đa 10 MB trong form tạo/sửa. Dùng lại kiểm tra tệp hợp đồng, bổ sung giới hạn MIME chứng chỉ; gửi token pending và metadata theo API. Bỏ tệp mới giữ tài liệu cũ, PATCH chỉ tệp khi không sửa nội dung vẫn được gửi. Khóa thao tác khi tải, hủy theo lifecycle, dọn cache và dành 120 giây cho upload. Không xóa tài nguyên cũ hoặc pending từ mobile. Chưa gỡ tệp đã lưu, push nhắc hạn hoặc UAT thiết bị/staging.

## Đợt ba mươi tám

Tra cứu hợp đồng/chứng chỉ theo nhân viên bằng bộ chọn dùng chung có tìm tên/email. Tận dụng `employeeId` của service/API, kết hợp chi nhánh và phân trang; đặt lại bộ lọc về trang đầu. Giữ nhãn nhân viên khi tải lại hoặc không còn trong roster trả về, vẫn cho phép bỏ lựa chọn. Hợp đồng sắp hết hạn và thống kê chứng chỉ theo phạm vi nhân viên; không mở rộng quyền của tài khoản. Chưa UAT thiết bị/staging thật.

## Đợt ba mươi chín

Phiếu lương cá nhân dùng service payroll tách transport từ FE và helper chi tiết FE. Danh sách GET `/employee/me/payslips`, chi tiết GET `/runs/:id/lines/:employeeId`; quyền và bản phát hành kiểm tra ở backend. Có lọc kỳ trên dữ liệu đã tải, trạng thái rỗng/lỗi/tải lại, bỏ kết quả request khi rời màn hình. Không tự tính lại thực nhận hay lưu phiếu vào storage. Chưa quản lý kỳ lương, in/chia sẻ hoặc UAT thiết bị/staging.

## Đợt bốn mươi

Lưu/chia sẻ phiếu lương HTML từ endpoint in có xác thực. Giữ nội dung server, kiểm tra MIME/dung lượng khai báo và thực tế tối đa 2 MB; hủy theo lifecycle, timeout 120 giây, giữ cache sau chuyển cho bảng chia sẻ. API kiểm tra lại quyền/bản phát hành/checksum mỗi lần tải. Không tạo PDF hoặc gọi máy in native. Chưa UAT thiết bị/staging.

## Đợt bốn mươi mốt

Tra cứu bảng lương theo YYYY-MM, trạng thái, tìm nhân viên, tổng thực nhận từ effectiveLines; không dùng source lines khi thiếu dữ liệu có hiệu lực hoặc có effectiveError. Quyền đọc kỳ và chi tiết thanh toán tách biệt. Chưa tạo/tính/duyệt/chốt kỳ hoặc thanh toán. Chưa UAT thiết bị/staging.

## Đợt bốn mươi hai

Lịch sử thanh toán của kỳ qua API có xác thực: trạng thái, phân bổ nhân viên, ghi chú, mốc ngày và liên kết chứng từ dạng văn bản. Tổng chỉ tính khoản confirmed, không cộng lại allocations. Cần quyền đọc kỳ và đọc thanh toán; không mở bằng quyền manage đơn lẻ. Lọc trạng thái trên danh sách API trả về, chưa phân trang server. Chưa thao tác ghi thanh toán hoặc UAT thiết bị/staging.

## Đợt bốn mươi ba

Tra cứu điều chỉnh phụ cấp/thưởng/khấu trừ/điều chỉnh khác theo kỳ, lọc loại/trạng thái/tìm nhân viên hoặc lý do, đặt lại và tải lại. Không phụ thuộc kỳ đã có run. Kiểm tra quyền đọc kỳ và dữ liệu trả đúng kỳ; không suy diễn khoản đã duyệt đã ảnh hưởng thực nhận. Chưa tạo/duyệt/từ chối điều chỉnh hoặc UAT thiết bị/staging.

## Đợt bốn mươi bốn

Duyệt/từ chối điều chỉnh pending với quyền đọc và quản lý kỳ, màn hình xác nhận và khóa gửi/đóng. Kiểm tra bản ghi/kỳ/trạng thái phản hồi, lỗi yêu cầu tải lại. Đóng tải lại cả bảng lương và điều chỉnh vì backend có thể tính lại kỳ nháp legacy. Chưa tạo điều chỉnh, lý do từ chối riêng hoặc UAT thiết bị/staging.

## Đợt bốn mươi lăm

Tạo điều chỉnh pending theo kỳ, chọn nhân viên từ roster chi nhánh với quyền API hiện có, kiểm tra loại/số tiền nguyên VND/lý do. Payload chỉ employeeId/kind/amount/reason. Khóa gửi trùng và đóng lúc lưu; lỗi yêu cầu tải lại trước tạo tiếp vì API chưa có idempotency. Đóng tải lại kỳ và điều chỉnh. Chưa sửa/xóa điều chỉnh hoặc UAT thiết bị/staging.

## Đợt bốn mươi sáu

Nhật ký kỳ lương theo API: loại thao tác, thời gian Việt Nam, actorId và metadata lý do/mã điều chỉnh nếu có. Lọc thao tác, tìm mã người/thao tác, đặt lại, tải lại và xem thêm từng 20 bản ghi tại máy. Quyền đọc kỳ và phạm vi phiên; không cần bảng lương tồn tại. Chưa xuất nhật ký hoặc UAT thiết bị/staging.

## Đợt bốn mươi bảy

Xuất Excel chi tiết lương, bảo hiểm, thuế TNCN và chuyển khoản từ kỳ closed/paid theo quyền đọc thanh toán, thêm manage cho mẫu chuyển khoản. Dùng workbook có hiệu lực từ backend; không tự dựng bảng hoặc ghi thanh toán. Chia sẻ native với kiểm tra MIME/20 MB, timeout và hủy tải theo vòng đời màn hình. Giữ exportWorkbook Blob của FE. Chưa UAT thiết bị/staging.

## Đợt bốn mươi tám

Phát hành/phát hành lại phiếu lương cho nhân viên được chọn trong kỳ closed/paid. Tìm người, chọn tất cả/bỏ chọn, xem lại danh sách, xác nhận theo quyền quản lý thanh toán. Không dùng danh sách rỗng để phát hành toàn kỳ; đối chiếu phản hồi đầy đủ, khóa gửi trùng, tải lại sau thành công hoặc lỗi. Backend có thể đã ghi một phần khi request lỗi; app không tự retry. Chưa thu hồi hoặc UAT thiết bị/staging.

## Đợt bốn mươi chín

Thu hồi từng phiếu hiện được phát hành trong kỳ closed/paid theo quyền quản lý thanh toán. Tái sử dụng panel phát hành, xác nhận nhân viên/kỳ/chi nhánh và khóa thao tác cùng lúc; kiểm tra phản hồi withdrawn đúng runId/employeeId, tải lại sau kết quả hoặc lỗi không xác định. Không xóa bản đã tải/chia sẻ. Chưa thu hồi hàng loạt, lý do thu hồi riêng hoặc UAT thiết bị/staging.

## Đợt năm mươi

Tra cứu lỗi/cảnh báo đã lưu của kỳ qua GET issues, lọc mức độ/tìm nhân viên hoặc nội dung, xem gợi ý khắc phục nếu có và xem thêm từng 20 mục tại máy. Tải độc lập sau khi xác định đúng runId, kể cả khi effectiveLines lỗi. Kiểm tra dữ liệu trả về, giữ lỗi API và mức độ mới. Chưa tự sửa/tính lại hoặc UAT thiết bị/staging. Backend hiện chưa cung cấp route sửa/xóa điều chỉnh lương.

## Đợt năm mươi mốt

Tạo kỳ regular draft theo tháng sau khi GET xác nhận không có kỳ, với quyền đọc/quản lý và chi nhánh xác thực. Xác nhận khoảng ngày, khóa gửi, kiểm tra phản hồi và tải lại để đối soát sau lỗi/thành công. Dùng endpoint operational tách khỏi createRun legacy có tính lương. Chưa kỳ bổ sung/khoảng ngày tùy chỉnh/đồng bộ công/tính lương native hoặc UAT thiết bị/staging.

## Đợt năm mươi hai

Đồng bộ công kỳ draft theo expectedVersion và Idempotency-Key, dùng kết quả công đã tổng hợp ở backend. Xác nhận phạm vi, chặn gửi trùng, đối chiếu job và hiển thị số nhân viên/lỗi chặn. Tải lại kỳ và issues sau kết quả hoặc lỗi; không tự retry. Chưa tổng hợp công từ chấm công thô/khóa công/tính lương native hoặc UAT thiết bị/staging.

## Đợt năm mươi ba

Khóa công ngay sau lần đồng bộ không có lỗi blocking; xác nhận số người, gửi version mới, khóa thao tác đồng thời trong panel và kiểm tra snapshot/run trả về. Hiển thị mã bản công/số nhân viên, giữ trạng thái draft và cho tải lại. Chưa tính lương/mở khóa snapshot hoặc UAT thiết bị/staging.

## Đợt năm mươi tư

Tính/tính lại draft có version hợp lệ qua calculateOperationalRun với expectedVersion/Idempotency-Key. Yêu cầu xác nhận, dùng bản công đã khóa ở backend, đối chiếu revision completed/runVersion/effectiveLines và tải lại số liệu sau kết quả hoặc lỗi. Không tự retry/duyệt/chốt; chưa UAT thiết bị/staging.

## Đợt năm mươi lăm

Duyệt kỳ draft sang review theo expectedVersion, quyền quản lý và phạm vi phiên. Xác nhận tổng thực nhận/số dòng, dùng effectiveLines của màn hình tra cứu; backend lưu effective snapshot. Khóa gửi và đối chiếu phản hồi đúng kỳ/trạng thái/version, tải lại sau kết quả hoặc lỗi; chưa chốt/mở lại kỳ hoặc UAT thiết bị/staging.

## Đợt năm mươi sáu

Chốt review sang closed theo quyền đọc/quản lý và expectedVersion. Tái sử dụng panel duyệt với xác nhận chốt riêng, tổng thực nhận từ effectiveLines, kiểm tra phản hồi đúng kỳ/version và tải lại sau kết quả/lỗi. Backend đối chiếu checksum/revision; không tự retry/thanh toán/phát hành. Chưa mở lại kỳ hoặc UAT thiết bị/staging.

## Đợt năm mươi bảy

Mở lại review/closed về draft với lý do bắt buộc, xác nhận và expectedVersion. Tái sử dụng reopen của FE; kiểm tra phản hồi, chặn gửi lại và tải lại để đối soát. Backend chặn paid/confirmed payments, bỏ effective snapshot khi mở; chưa thao tác ghi/đảo thanh toán hoặc UAT thiết bị/staging.

## Đợt năm mươi tám

Tạo thanh toán nháp với phân bổ nhiều nhân viên trong kỳ closed, tổng tiền/ghi chú và xác nhận trước lưu. Tái sử dụng createPayment, body có idempotencyKey, backend kiểm tra số dư. App kiểm tra tiền nguyên/tổng an toàn/danh sách/response draft, khóa gửi trùng và tải lại sau kết quả/lỗi. Chưa xác nhận/hủy/đảo, ngày/chứng từ hoặc UAT thiết bị/staging.

## Đợt năm mươi chín

Xác nhận khoản thanh toán nháp từ lịch sử, xem lại phân bổ/chi nhánh/tổng trước gửi. Quyền đọc kỳ/đọc và quản lý thanh toán, kỳ closed; kiểm tra phản hồi confirmed đúng khoản/kỳ/phân bổ, khóa gửi trùng và tải lại cả kỳ sau kết quả/lỗi. Backend đối soát số dư và cập nhật trạng thái kỳ; không chuyển tiền ngân hàng. Chưa hủy/đảo hoặc nhập ngày/chứng từ, chưa UAT thiết bị/staging.

## Đợt tiếp theo

1. Kiểm chứng đăng nhập/thông báo/phòng ban với staging và thiết bị thật; chốt hành vi phiên web/mobile.
2. UAT chọn chi nhánh và đơn từ; đối soát hiển thị lịch/ngày tính phép, tệp tài liệu thật và hierarchy duyệt; triển khai UI quản trị quyền.
3. Chuyển nhân sự/chấm công/công việc theo từng luồng end-to-end, tận dụng types và service đã tách transport.
4. Tiếp tục các module còn lại trong bảng, ghi rõ màn hình và thao tác đã nghiệm thu.

## Tiêu chí nghiệm thu từng module

Đợt năm mươi chín: 300/300 test trong 56 file qua; TypeScript và export Hermes Android/iOS qua. Kiểm tra quyền/phạm vi/trạng thái/phân bổ, phản hồi và lỗi API không retry. Chưa UAT thiết bị/staging.

Đợt năm mươi tám: 292/292 test trong 55 file qua; TypeScript và export Hermes Android/iOS qua. Kiểm tra quyền/trạng thái, số tiền và phân bổ, phản hồi nháp đúng từng nhân viên, endpoint và idempotency, lỗi API không retry. Chưa UAT thiết bị/staging.

Đợt năm mươi bảy: 284/284 test trong 54 file qua; TypeScript và export Hermes Android/iOS qua. Kiểm tra quyền/trạng thái/lý do, phản hồi draft/phiên bản và lỗi paid/confirmed payments/version không retry. Chưa UAT thiết bị/staging.

Đợt năm mươi sáu: 277/277 test trong 53 file qua; TypeScript và export Hermes Android/iOS qua. Kiểm tra quyền/review/version, phản hồi closed đúng kỳ và lỗi checksum/revision/version không retry. Chưa UAT thiết bị/staging.

Đợt năm mươi lăm: 271/271 test trong 52 file qua; TypeScript và export Hermes Android/iOS qua. Kiểm tra trạng thái/phiên bản/kỳ phản hồi, endpoint xác thực và lỗi không retry; quyền draft dùng guard đã có. Chưa UAT thiết bị/staging.

Đợt năm mươi tư: 266/266 test trong 51 file qua; TypeScript và export Hermes Android/iOS qua. Kiểm tra revision hoàn tất/đúng kỳ/version/effectiveLines, header chống trùng và lỗi không retry. Chưa UAT thiết bị/staging.

Đợt năm mươi ba: 260/260 test trong 50 file qua; TypeScript và export Hermes Android/iOS qua. Kiểm tra snapshot/kỳ/phiên bản, endpoint xác thực và lỗi blocking/chưa sync/xung đột không retry. Chưa UAT thiết bị/staging.

Đợt năm mươi hai: 253/253 test trong 49 file qua; TypeScript và export Hermes Android/iOS qua. Kiểm tra quyền/version draft, key/header/payload, phản hồi job sai phạm vi hoặc chưa xong, số lượng và lỗi không retry. Chưa UAT thiết bị/staging.

Đợt năm mươi mốt: 246/246 test trong 48 file qua; TypeScript và export Hermes Android/iOS qua. Kiểm tra quyền, khoảng tháng/năm nhuận, phản hồi draft đúng kỳ, payload operational và lỗi không retry. Chưa UAT thiết bị/staging.

Đợt năm mươi: 235/235 test trong 47 file qua; TypeScript và export Hermes Android/iOS qua. Kiểm tra lọc/tìm lỗi, mức độ mới, API xác thực, dữ liệu sai định dạng/sai runId và giữ lỗi HTTP. Chưa UAT thiết bị/staging.

Đợt bốn mươi chín: 225/225 test trong 46 file qua; TypeScript và export Hermes Android/iOS qua. Kiểm tra quyền/phiếu có hiệu lực, phản hồi thu hồi đúng người/kỳ/trạng thái, endpoint có xác thực và lỗi không retry. Chưa UAT thiết bị/staging.

Đợt bốn mươi tám: 219/219 test trong 46 file qua; TypeScript và export Hermes Android/iOS qua. Kiểm tra quyền/trạng thái kỳ, danh sách chọn hợp lệ, phản hồi thiếu/trùng/sai kỳ và lỗi API không retry. Chưa UAT thiết bị/staging.

Đợt bốn mươi bảy: 212/212 test trong 45 file qua; TypeScript và export Hermes Android/iOS qua. Kiểm thử quyền xuất, API có xác thực, dữ liệu byte, lỗi API/MIME/dung lượng và hủy/timeout tải tệp. Chưa UAT thiết bị/staging.

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
