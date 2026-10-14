# Appota Internal Knowledge V2

Demo chatbot chính sách nghỉ phép. Bản chat Next.js dùng JSON seed và tích hợp Gemini tùy chọn; bản Streamlit local dùng rule engine Python/SQLite. Gemini tắt mặc định; chưa có vector DB hoặc SSO thật. Dữ liệu là mock; không đưa ứng dụng này vào sử dụng với dữ liệu nhân sự thật khi chưa tích hợp xác thực, governance và review bảo mật phù hợp.

## Chatbot và deploy lên Vercel

Bản chat hiện tại nằm trong `frontend/`: hội thoại nhiều lượt, câu hỏi nối tiếp, lịch sử lưu trên trình duyệt và nguồn theo từng câu trả lời. Thiết lập nhân sự/ngày áp dụng được thu gọn; đổi bối cảnh mở cuộc trò chuyện mới.

Import repo `nqminh-ai/hr_chatbot` trên Vercel và đặt **Root Directory = frontend**, **Framework Preset = Next.js**. Giữ build/install/output mặc định của Next.js và bật tùy chọn cho phép build đọc file ngoài Root Directory để lấy JSON seed tại `data/knowledge.json`.

Gemini tắt mặc định. Khi bật, API gửi các điều khoản đã lọc cùng câu hỏi/ngữ cảnh liên quan; dữ liệu vẫn được gửi ra Google. Bộ chính sách hiện là mẫu, không cần Supabase để chạy. Chưa có đăng nhập thật hay đồng bộ lịch sử qua database.

Xem [frontend/README.md](frontend/README.md) để cấu hình Gemini và kiểm tra. Python API `api/index.py` cùng giao diện `public/` vẫn được giữ nguyên và có thể chạy local qua `web_preview.py`.

Key local nằm trong `frontend/.env.local`, được Git bỏ qua. Để dùng Gemini, đặt `GEMINI_ENABLED=true`; chỉ lưu key chưa bật Gemini. Khi deploy, thêm `GEMINI_API_KEY`, `GEMINI_ENABLED` và model đã chọn vào Environment Variables của Vercel, rồi redeploy. Xem [hướng dẫn biến môi trường Vercel](https://vercel.com/docs/environment-variables).

Giữ `supabase/schema.sql`, `supabase/seed.sql`, `scripts/export_sqlite_to_supabase.py` và client `frontend/src/lib/supabase.ts` cho bước tích hợp tiếp theo. Chat hiện chưa đọc Supabase; Vercel chạy API Next.js trong `frontend/src/app/api/chat/`, chưa gọi backend Python.

Các asset Next.js mẫu, sidebar cũ không được import, kế hoạch/báo cáo cũ và cache dư đã được dọn. Bản sao các file đã dọn nằm trong `.cleanup-backups/` ở máy local, không commit. Backend Python, SQLite/CSV, schema, fixture, test và môi trường `.venv` được giữ nguyên. Báo cáo kiểm thử được tạo lại trong `docs/evidence/` và không commit. `vercel.json` ở root vẫn được giữ vì `validate.py` đưa file này vào danh sách kiểm chứng; cấu hình deploy hiện tại nằm trong `frontend/vercel.json`.

## Chạy trên Windows

Nhấp đúp `run_frontend.bat` để chạy chat tại `http://localhost:3000`. `run_app.bat` giữ menu chọn Next.js hoặc Streamlit tại `http://127.0.0.1:8501`. Backend Streamlit dùng Python trong `.venv`; nhấn `Ctrl+C` để dừng.

Môi trường local đã kiểm chứng: **CPython 3.14.5 / Windows 11**. `.python-version` ghi nhánh runtime 3.14; `requirements.lock` khóa đủ 43 dependency local trực tiếp và transitive bằng version và SHA-256 wheel. Lock artifact này dành cho Windows/ABI đã kiểm chứng, không dùng cho build Vercel Linux; nền tảng khác cần tạo lock thích hợp. Không dùng `pypdf` vì code không ingest PDF.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
.\.venv\Scripts\python.exe -B manage_database.py init
.\.venv\Scripts\python.exe -B validate.py
.\.venv\Scripts\python.exe -B -m streamlit run app.py
```

Kiểm tra riêng scenario hoặc smoke:

```powershell
.\.venv\Scripts\python.exe -B run_tests.py
.\.venv\Scripts\python.exe -B smoke_test.py
```

`run_tests.py` trả exit 1 khi có scenario fail, exit 2 khi cấu hình sai. `validate.py` chạy unit/regression/Streamlit AppTest và scenario, ghi test IDs, kết quả và SHA-256 source vào `docs/evidence/`. Ngày trong scenario được cố định cho fixture; ngày mặc định của ứng dụng lấy từ clock Asia/Ho_Chi_Minh.

Lock chứa version và SHA-256 wheel. Wheel binaries không được đưa vào repo; môi trường khác cần index hoặc wheelhouse chứa đúng các phiên bản trong lock. Báo cáo cài đặt cũ đã được lưu trong bản sao local `.cleanup-backups/`.

## Dùng ứng dụng và graph

Danh sách scenario và hướng dẫn kiểm thử ở [docs/test_cases.md](docs/test_cases.md). Bộ private riêng nằm tại `tests/private_test_cases.json`; nhấp đúp `run_private_tests.bat` để chạy và lưu kết quả ở `docs/evidence/private_test_results.json`.

1. Chọn persona và ngày nghiệp vụ. Persona chooser chỉ là mock identity.
2. Gửi câu hỏi nghỉ phép; xem `answered`, `refused`, `insufficient_evidence`, `conflict` hoặc trạng thái yêu cầu làm rõ.
3. Tab **Sơ đồ tri thức** có zoom, toàn cảnh, cuộn và chọn node để xem metadata/quan hệ. Graph chỉ được tạo từ policy được phép, cùng snapshot với câu trả lời.
4. **Xuất graph JSON** tải projection của request hiện tại. Không có endpoint/UI hiển thị tổng kho hoặc các document bị từ chối.
5. Tab **Trace & nguồn** cho biết clause được dùng, quyết định floor và snapshot; trace không ghi raw query. Trace hiện tại là dữ liệu trả về request, chưa có backend audit-log bền vững.

Đổi persona, ngày hoặc content snapshot xóa kết quả cũ trong session. Dataset/schema invalid khiến hệ thống fail closed; UI không hiển thị diagnostic nội bộ.

## Dữ liệu và migration

Nhấp đúp **`manage_database.bat`** để kiểm tra/import CSV, export hoặc backup. Bắt đầu thử với `data/csv/clauses.csv`: sửa typed value, kiểm tra CSV, import, rồi tải lại ứng dụng. Hướng dẫn đầy đủ và sơ đồ quan hệ bảng ở [docs/database.md](docs/database.md). Schema SQL ở `database/schema.sql`, truy vấn quản trị mẫu ở `database/queries.sql`.

- **Active mock runtime:** `data/appota.db` (SQLite). Dataset đọc từ DB được validate bởi `schemas/knowledge_runtime_v2.schema.json`; metadata vẫn là `artifact_kind=mock_runtime`.
- **CSV quản trị:** 9 file trong `data/csv/`. Sửa CSV chưa đổi runtime; import hợp lệ tạo backup, thay bộ dữ liệu trong transaction và ghi revision/hash vào `import_log`.
- **Seed và fixture test:** `data/knowledge.json`; lệnh `init` không reset database có sẵn. `run_tests.py --db data/appota.db` kiểm tra database đang chỉnh; không có `--db` thì dùng JSON fixture cố định.
- **Seed lịch sử giữ nguyên:** `data/documents.json`, `data/organization.json`, `data/personas.json`.
- **Mẫu thiết kế riêng:** `data/metadata_v2.sample.json` và `data/knowledge_graph.sample.json`. `design_fixture` không thể nạp bằng runtime schema.
- **Tracker maintainer:** `data/improvement_tracking.json` được giữ làm dữ liệu thiết kế; trang HTML/ảnh preview cũ nằm trong bản sao local `.cleanup-backups/`. Runtime graph phân quyền nằm trong ứng dụng.

Các quyết định M01–M06 chưa được content owner xác nhận. Runtime không thay ngày kết thúc v1 A: **28/02/2026 là gap**, trả conflict thay vì dùng nhầm policy Group. “10 ngày” của Team giữ `unspecified_days`, không được mặc định là ngày làm việc. Unlimited được biểu diễn riêng dựa trên text mock, không dùng sentinel 99 để tính số ngày. Approval events là `mock_fixture`; chưa có bằng chứng phê duyệt thật. Khi policy chung và Executive chồng clause ở cùng scope, query chung trả conflict; query nhắm rõ tài liệu vẫn kiểm tra ACL và floor.

## Kiến trúc

`CSV → validation/import transaction → SQLite → validated immutable snapshot → identity → ACL/contract/audience/scope → as-of version → clause resolution → typed floor → render/citations → authorized graph/trace`.

Tất cả consumers dùng snapshot bất biến. SQLite được đọc trong một read transaction; fingerprint tính từ nội dung dataset tái dựng và schema, nhận cả thay đổi SQL trực tiếp. Mỗi request giữ một snapshot riêng để tránh reload giữa chừng. Streamlit cache theo nội dung data/schema, tối đa hai snapshot; cần rerun/tải lại sau khi import. Numeric text được render từ giá trị effective; floor thay cả clause và source. Citations theo clause, không dedup làm mất approver/contingency.

Router là lexical cho phạm vi leave-policy hiện có; hỗ trợ clause slots, ngày/năm, policy/version và alias unit. Không phải mô hình hiểu mọi câu tiếng Việt. Phép nghỉ/operation ngoài các slot đã hỗ trợ cần hỏi lại hoặc bổ sung taxonomy; không suy diễn quyền xử lý ngoại lệ. Bảo lưu/chuyển ngày phép, nghỉ ốm/thai sản và các operation chưa có dữ liệu trả thiếu căn cứ.

## Kiểm chứng và giới hạn

- `docs/evidence/test_results.json`: số test, test IDs, environment, source hashes và kết quả scenario mới nhất.
- `validate.py` tạo lại báo cáo test; `benchmark.py` tạo lại báo cáo hiệu năng. Kết quả ở `docs/evidence/` là file local được Git bỏ qua.
- Báo cáo audit, kế hoạch và ảnh kiểm chứng cũ đã được đưa vào bản sao local `.cleanup-backups/`; chúng không phải kết quả kiểm chứng của lần deploy mới.

Lock được kiểm chứng trên Windows/Python nêu trên; nền tảng khác chưa được kiểm chứng. Metadata approval thật, content-owner decisions, SSO và audit storage bền vững là các điều kiện riêng trước khi dùng với dữ liệu thật. Không công bố bảo đảm miễn nhiễm hoặc chống leakage tuyệt đối.
