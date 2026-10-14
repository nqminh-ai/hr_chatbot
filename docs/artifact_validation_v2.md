# Xác minh artifact của implementation plan V2

> Lưu trữ kết quả lúc lập plan, trước triển khai engine V2. Kết quả thực thi hiện tại nằm ở `docs/evidence/` và `../AUDIT_REPORT.md`; nhận định “code gốc không đổi” bên dưới chỉ áp dụng cho thời điểm lập plan.

Ngày: 13/10/2026. Chỉ kiểm tra các artifact vừa tạo; **không import/chạy engine, app.py, run_tests.py hay smoke_test.py**. Không cài dependency, không sửa dữ liệu đang hoạt động hoặc audit baseline.

## Kết quả

| Nhóm | Kết quả | Phạm vi |
|---|---|---|
| JSON Schema | Pass | Mẫu V2 được validate bằng Draft202012Validator và FormatChecker; schema cũng được check trước validate. |
| Artifact invariants | **15/15 pass** | Danh sách bên dưới. |
| Dependency DAG | Pass | 19 task; không có cycle hoặc dependency tới task không tồn tại; tổng điểm thu hồi 57. |
| JavaScript syntax | Pass | Node.js `vm.Script` parse phần JavaScript của HTML. |
| Browser interactions | **17/17 pass ở mỗi viewport** | Microsoft Edge headless 155.0.4283.45, hai viewport CSS thực tế 1459px và 481px. |
| Visual inspection | Đã xem screenshot desktop | Graph, legend, panel và nút toàn cảnh hiển thị; preview tại `tracking_graph_preview.png`. Không chứng nhận mobile device thật hoặc toàn bộ trình đọc màn hình. |
| Production source/data | Không thay đổi | SHA-256 của 16 file baseline khớp `data/improvement_tracking.json → baseline.source_sha256`. |
| Điểm audit ứng dụng | **Vẫn 43/100** | Không có implementation fixes hay re-audit; các task nguồn vẫn `planned`. |

Browser QA dùng bản HTML tạm và profile trình duyệt riêng. Trạng thái verified trong các kiểm tra là dữ liệu QA tạm, được đưa về planned; không ghi vào JSON nguồn, không phải bằng chứng task sửa code đã hoàn thành. Browser native preview tool không khởi tạo được; kiểm tra render/tương tác hoàn tất bằng Edge headless offline. Chrome headless không dùng được GPU trong môi trường này nên không lấy lần chạy đó làm bằng chứng pass.

## 15 kiểm tra artifact

1. 16 file gốc giữ nguyên checksum.
2. 19 task nguồn đều planned, verified_at null.
3. Baseline 43 + tổng điểm thu hồi 57 = 100.
4. Findings đủ và duy nhất F01–F19.
5. Node IDs trong graph duy nhất.
6. Edge IDs trong graph duy nhất.
7. Tất cả source/target của edge tồn tại.
8. Sample không được activate (`activation_allowed=false`).
9. Không tạo cạnh CITES/DERIVED_FROM giả khi chưa có runtime trace.
10. Source line của từng clause khớp clause key trong seed gốc.
11. Bundle nhúng trong HTML khớp ba file JSON metadata/tracking/graph.
12. Schema từ chối thiếu classification ACL.
13. Schema từ chối Confidential có allowed_roles rỗng.
14. Schema từ chối ngày không tồn tại 2026-02-30.
15. Schema từ chối sentinel số 99 với kind unlimited.

## 17 kiểm tra tương tác, lặp ở hai viewport

1. Render đủ 19 task nodes lúc mở.
2. Estimate ban đầu là 43, không tự nâng điểm.
3. Chọn task mở đúng panel chi tiết.
4. Không cho verified khi dependency chưa verified.
5. Không cho verified khi thiếu owner/reviewer/evidence.
6. Verified của task không phụ thuộc làm thay đổi estimate đúng trọng số.
7. Đưa task trở về planned khôi phục estimate.
8. Chuyển sang knowledge graph render đủ 36 nodes.
9. Mô phỏng Lan có 11 nodes, không có EXEC hoặc policy B.
10. Mô phỏng lịch sử tháng 01/2026 chọn A v1 theo proposal, không dùng điều này để khẳng định engine hiện tại đã được sửa.
11. Mô phỏng Contractor không có document policy Official.
12. Nạp metadata JSON dựng lại đủ graph.
13. Nạp progress thiếu task bị từ chối.
14. Nạp tracking JSON gốc khôi phục đủ 19 task và estimate 43.
15. Export serialize đủ 19 task planned; thao tác download được chặn trong QA để không ghi vào Downloads của người dùng.
16. Nút toàn cảnh đặt chiều rộng graph trong viewport.
17. Trang không có overflow ngang ngoài vùng graph.

Các lần gọi file import được chờ tới khi có phản hồi trên UI trước assert; không dùng timer quá ngắn làm kết quả đọc file chưa xong bị coi là lỗi artifact. Window requested 390px được Edge giữ ở minimum width, nên viewport nhỏ **thực tế là 481px**, không tuyên bố đã kiểm tra 390px. Kiểm tra layout 320–390px, thiết bị cảm ứng và screen reader là phần cần bổ sung khi triển khai UI sản phẩm.

## Giới hạn của xác minh này

Schema chỉ xác minh shape/enum/type/date format; các semantic checks như version overlap, nguồn approval thật, unit tương thích và chain tổ chức thuộc implementation plan, chưa phải validator ứng dụng đang hoạt động. Graph filtering là mô phỏng trên toàn bộ fixture nhúng, không phải security boundary. Tracker không chạy test, không xác thực nội dung evidence và không thay thế CI/reviewer/re-audit. Không có kết quả nào ở đây được dùng để đóng F01–F19 hoặc nâng điểm audit của code hiện tại.
