# Triển khai cải thiện Appota — 15/10/2026

Baseline audit tại commit `5f8416e`: 104 unit tests qua, public 7/7, private 34/35 (PT32), detailed 38/38, contract mới 6/12. Báo cáo audit là ảnh chụp trạng thái trước triển khai; không dùng điểm cũ để mô tả code hiện tại.

## Các phase

| Phase | Thay đổi đã triển khai | Kiểm tra |
| --- | --- | --- |
| 1. Regression gates | `validate.py` chạy public/private/detailed và contract Python–TypeScript; fixture expected độc lập và test mutation cho oracle. | 92/92 scenario/contract. |
| 2. Validate dữ liệu/body | TypeScript dùng cùng JSON Schema, thêm validation semantic, snapshot bất biến; đọc request stream giới hạn bytes và UTF-8. | 15 mutation dữ liệu bị từ chối; body quá giới hạn/hỏng UTF-8 được xử lý. |
| 3. Routing/context | Taxonomy dùng chung, sửa PT32, nhận intent trước lọc scope, hỏi lại khi chỉ có năm; context ngày/policy/version/slot và tách engine TypeScript thành module. | 12/12 contract; private 35/35; không suy diễn 01/01 cho năm. |
| 4. Gemini | JSON schema, kiểm tra status và đủ fact IDs, server render facts thay cho raw model answer; fallback khi output/model lỗi. | 7 output không an toàn bị từ chối; mock qua. Live chưa qua: timeout, sau đó HTTP 503. |
| 5. Supabase | Migration giữ dữ liệu, đóng public corpus/chat, health RPC tối thiểu, view theo quyền caller; schema mới không tự reset. | PostgreSQL nhúng: 30 thao tác public bị chặn, health hoạt động, service role và chat rows giữ nguyên, migration idempotent. Chưa áp dụng live. |
| 6. Frontend | Lịch sử v2 kiểm tra metadata/graph/context, personas từ snapshot server, diagnostics trung tính, nhãn nguồn JSON; hủy và bỏ phản hồi cũ khi đổi hội thoại/dừng/unmount. | 19 test UI/history; 38 kiểm tra API/chat. |
| 7. Export/provenance | Export từ một transaction SQLite đã validate, fresh/upsert rõ ràng, ghi atomically; kiểm tra bytes nguồn/pointer/text/value/unit/line; sửa kiểu `created_on` PostgreSQL về DATE. | SQLite → SQL → PostgreSQL đọc lại khớp cả 9 bảng; 3 source/16 clause xác minh; 7 test export/provenance. |
| 8. Hiệu năng/launcher/docs | Group child rows một lần; cache snapshot bất biến theo data+schema bytes; vẫn đọc DB để nhận SQL trực tiếp; launcher sửa interpreter/exit codes và dùng `npm ci`; README cập nhật. | Cache/schema/direct-SQL regression qua; lint/build qua; benchmark local dưới đây. |

## Kết quả cuối ở local

- Python: **114 unit tests**, không failure/error; public **7/7**, private **35/35**, detailed **38/38**, contracts **12/12**.
- `npm test`: dữ liệu/body, contracts, Gemini mock, chat/API, UI/history và PostgreSQL nhúng đều qua; test mặc định không gọi dịch vụ thật.
- `npm run lint`, `npm run build`: qua trên Node 24.16.0, CPython 3.14.5, Windows.
- `scripts/verify_provenance.py`: source bytes và clauses khớp; `.gitattributes` giữ JSON nguồn ở LF để hash không đổi giữa checkout Windows/Linux. Chuyển sentinel 99 → unlimited vẫn được ghi rõ là biến đổi mẫu M03, chưa có xác nhận owner.
- Launcher: lựa chọn sai trả exit code 2; không còn nhánh khởi động cả hai dùng interpreter chưa khai báo. Không tự mở các server trong kiểm tra này.

Benchmark trên máy này, không phải cam kết latency production:

| Phép đo | Trước/đối chứng | Sau |
| --- | --- | --- |
| Tái dựng 1.008 documents, median 7 lần | 443,1 ms từ `tabular.py` tại baseline | 48,3 ms |
| Đọc SQLite 8 documents + validate, median 20 lần | 96,9 ms với validator không cache | 4,9 ms với snapshot cache |
| Trả lời warm, p95/100 mẫu | Không suy ra speedup từ dao động đo | 1,5 ms fixture; 3,9 ms ở 1.008 documents |

Đối chứng đọc SQLite chưa tính lần validation trùng ở caller cũ. Cache giữ tối đa 2 snapshot, khóa bằng cả bytes data và schema; test SQL sửa 14 → 15 mà không tăng revision vẫn tạo snapshot mới. SQLite/user database không bị sửa bởi benchmark hoặc các test.

## Bước triển khai còn lại

1. **Gemini live:** smoke mẫu đã được người dùng cho phép. Google trả HTTP 503 ở lần thử cuối; chưa xác nhận key/model hoạt động. Runtime fallback về facts đã xác thực. Có thể chạy lại `npm.cmd run test:gemini:live` khi dịch vụ sẵn sàng; payload cố định là câu hỏi nghỉ phép với fact mẫu 14 ngày, không gửi lịch sử.
2. **Supabase live:** review và áp hai migration theo [supabase/README.md](../supabase/README.md), rồi chạy `verify_access.sql`. Test PostgreSQL nhúng không chứng minh project live đã đóng quyền.
3. **Vercel:** deploy phiên bản code mới với Root Directory `frontend`, cho phép đọc `data/` và `schemas/` ngoài root, cấu hình env phía server; chưa tạo deployment thủ công trong đợt này.

Các quyết định M01–M06, khoảng trống 28/02/2026 và `unspecified_days` của Team vẫn được giữ. Chưa bổ sung SSO hoặc dữ liệu HR thật. Phần giao diện Python trong `public/` vẫn được duy trì; việc format toàn bộ code giao diện cũ chưa thực hiện.

Evidence sinh ra nằm ở `docs/evidence/` (Git bỏ qua): `test_results.json`, các báo cáo từng suite, `gemini_live.json`, `benchmark.json`, `benchmark_storage_comparison.json`. Chạy lại các lệnh kiểm tra để tái tạo; không commit API key hay lịch sử hội thoại.
