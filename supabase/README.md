# Supabase: schema, migration và kiểm tra

Supabase được giữ để tích hợp tiếp. Chat hiện đọc JSON và lưu lịch sử trong trình duyệt. Health RPC chỉ trả boolean; kết nối thành công không chuyển nguồn trả lời sang Supabase.

## Database mới

Chạy `schema.sql`, rồi `seed.sql` trong SQL Editor bằng tài khoản quản trị. Schema dành cho PostgreSQL 15+, không có lệnh reset bảng. Seed mặc định dùng INSERT trong transaction và dừng khi trùng khóa.

## Database đã triển khai

Backup và lưu cấu hình grants/policies hiện tại để có thể khôi phục quyền riêng đã tùy chỉnh. Review rồi chạy theo thứ tự:

1. [20261015_close_public_access.sql](migrations/20261015_close_public_access.sql): thu hồi quyền corpus/chat của public/anon/authenticated, đóng các policy demo, bật RLS, view dùng quyền caller, thêm health RPC.
2. [20261015_dataset_created_on_date.sql](migrations/20261015_dataset_created_on_date.sql): chuyển ngày tạo dataset từ timestamp về DATE theo timezone dataset.
3. [20261022_governance_activation_gate.sql](migrations/20261022_governance_activation_gate.sql): đánh dấu mọi mock runtime là inactive, mở enum cho artifact đã duyệt và chỉ để health báo ready khi artifact được activate.
4. [verify_access.sql](verify_access.sql): xác minh catalog không còn grants công khai, RLS/view/RPC đúng cấu hình.

Migration không xóa bảng hay dòng, có thể chạy lại. Quyền service role được giữ. Không cấp lại policy công khai để sửa lỗi kết nối: kiểm tra RPC, URL và anon key. Nếu cần rollback, khôi phục grants/policies từ bản lưu trước migration; kiểu timestamp cũ có thể tái tạo từ ngày và timezone nhưng không khôi phục được giờ đã bị loại bỏ. Dataset chỉ sử dụng ngày, không có nghiệp vụ lưu giờ tạo.

Seed trong repo là fixture mẫu nên có `activation_allowed=false`; vì vậy `knowledge_health()` trả `false` dù kết nối và quyền RPC đúng. Chỉ artifact `policy_runtime` đã qua governance gate mới được đặt active. Không sửa trực tiếp cờ activation để làm health xanh: loader vẫn từ chối nếu decision, owner/evidence, review state hoặc nguồn lịch sử chưa đạt.

Migration trong repo chưa được áp dụng lên Supabase thật trong đợt triển khai này. Kiểm tra PostgreSQL nhúng không chứng minh cấu hình project live đã đổi.

## Export SQLite

Từ root:

```powershell
.\.venv\Scripts\python.exe -B scripts/export_sqlite_to_supabase.py --mode fresh
.\.venv\Scripts\python.exe -B scripts/verify_provenance.py
```

Exporter đọc cả 9 bảng trong một snapshot SQLite, validate rồi ghi file atomically. Nó không tự chạy SQL trên server. `--mode upsert` cập nhật theo primary key và giữ các dòng chỉ tồn tại ở đích; đây không phải đồng bộ đầy đủ hoặc reset. Các xung đột UNIQUE khác vẫn làm transaction thất bại.

`generate_seed()` báo `readback_verified=false` vì chỉ xuất file. Sau import, `verify_readback()` so sánh toàn bộ metadata tái dựng từ PostgreSQL với snapshot đã xuất. Các cột DATE phải được đọc nguyên dạng `YYYY-MM-DD`, tránh đổi ngày khi qua JavaScript Date/timezone.

## Kiểm tra local

```powershell
cd frontend
npm.cmd run test:supabase
```

Test dùng PostgreSQL nhúng [PGlite](https://pglite.dev/docs/) trong bộ nhớ: tái tạo quyền demo cũ, áp migration hai lần, kiểm tra anon/authenticated không đọc/ghi corpus/chat, health RPC gọi được, service role giữ quyền, chat không bị xóa, và SQLite → SQL → PostgreSQL đọc lại khớp cả 9 bảng. Không đọc key hay kết nối database Supabase thật.
