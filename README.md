# Appota Knowledge Copilot

Demo trợ lý tra cứu chính sách nghỉ phép, có hội thoại nhiều lượt, trích dẫn điều khoản và sơ đồ tri thức. Giao diện chính là Next.js để deploy lên Vercel; backend Python/Streamlit và công cụ quản trị SQLite được giữ để chạy local và kiểm thử.

## Trạng thái hiện tại

| Thành phần | Cách hoạt động |
| --- | --- |
| Chat Next.js | API `/api/chat` chạy trong Next.js, đối chiếu chính sách từ `data/knowledge.json` bằng `frontend/src/lib/policy.server.ts`. |
| Gemini | Tùy chọn; model chọn cách trình bày bằng JSON có schema. Server kiểm tra fact IDs rồi render giá trị/đơn vị/nguồn từ dữ liệu đã xác thực. Lỗi model dùng kết quả rule engine. |
| Supabase | Kiểm tra kết nối bằng RPC `knowledge_health()`, chỉ trả boolean. Chưa dùng Supabase để trả lời chính sách hoặc lưu lịch sử chat. |
| Lịch sử hội thoại | `localStorage` phiên bản 2; kiểm tra ngày, citations, graph, trace và context trước khi khôi phục. |
| Backend Python | Rule engine trong `engine/`, giao diện Streamlit trong `app.py`, API Python trong `api/index.py`. Next.js chưa gọi API Python. |
| Dữ liệu | Bộ chính sách và nhân sự mẫu; lựa chọn persona là bối cảnh tra cứu mẫu, chưa có đăng nhập/SSO thật. |

## Chạy chatbot local

Cần Node.js **20.19+ hoặc 22.12+** cho bộ công cụ hiện tại; đã kiểm tra trên Node 24. Chạy từ thư mục gốc bằng PowerShell:

```powershell
cd frontend
npm.cmd ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm.cmd run dev
```

Mở `http://localhost:3000`. Lệnh tạo `.env.local` ở trên giữ nguyên file nếu bạn đã lưu API key. Chỉnh biến môi trường trong file này rồi khởi động lại server.

Trên Windows, có thể dùng `run_frontend.bat` để chạy Next.js. `run_app.bat` có menu chọn Next.js hoặc Streamlit.

Cấu hình Gemini, Supabase và xử lý lỗi được mô tả trong [frontend/README.md](frontend/README.md).

## Deploy lên Vercel

Import repository `nqminh-ai/hr_chatbot`, sau đó cấu hình:

| Thiết lập | Giá trị |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | `Next.js` |
| Install Command | Mặc định theo npm lockfile; có thể đặt `npm ci`. |
| Build Command | `npm run build` |
| Output Directory | Mặc định của Next.js (`.next`). |
| Include files outside the Root Directory in the Build Step | **Bật**, vì Next.js import `../data/knowledge.json`. |

Giữ cấu hình [frontend/vercel.json](frontend/vercel.json) và [frontend/next.config.ts](frontend/next.config.ts). `vercel.json` ở root được giữ cho cấu hình chạy từ root và danh sách fingerprint của `validate.py`; hướng dẫn này dùng Root Directory `frontend`. Xem [Vercel Build Settings](https://vercel.com/docs/builds/configure-a-build).

Thêm biến môi trường tại **Project Settings → Environment Variables** cho môi trường cần deploy:

- Gemini: `GEMINI_ENABLED`, `GEMINI_API_KEY`, `GEMINI_MODEL`.
- Supabase, nếu dùng kiểm tra kết nối: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

`.env.local` được Git bỏ qua và không được tải lên qua GitHub. Sau khi đổi biến trên Vercel, tạo deployment mới. Biến `NEXT_PUBLIC_*` được dùng ở bước build; xem [Vercel Environment Variables](https://vercel.com/docs/environment-variables).

Với cấu hình này, Vercel triển khai giao diện và API **Next.js**. Không cần cài Python, Streamlit hay SQLite cho deployment này.

## Backend Python local

Backend, schema, dữ liệu và test Python tiếp tục được duy trì. Môi trường đã kiểm chứng là CPython 3.14.5 trên Windows; `.python-version` ghi nhánh `3.14`. `requirements.lock` chứa version và SHA-256 wheel cho môi trường Windows đã kiểm chứng, không dùng lock này để cài dependency trên Vercel Linux.

Chạy từ thư mục gốc:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
.\.venv\Scripts\python.exe -B manage_database.py init
.\.venv\Scripts\python.exe -B -m streamlit run app.py --server.address 127.0.0.1 --server.port 8501
```

Mở `http://127.0.0.1:8501`. `init` tạo database từ JSON seed nếu chưa có, không reset database có sẵn. Khi `.venv` đã cài, chọn Streamlit trong `run_app.bat` để chạy.

Giao diện web Python riêng trong `public/` có thể chạy bằng:

```powershell
.\.venv\Scripts\python.exe -B web_preview.py
```

Mở `http://127.0.0.1:8000`; giao diện này dùng API `/api` và khác với chat Next.js.

## Dữ liệu và Supabase

| Đường dẫn | Vai trò |
| --- | --- |
| `data/knowledge.json` | Seed/fixture của backend và nguồn chính sách hiện tại của Next.js. |
| `data/appota.db` | Database SQLite local của Streamlit; không commit. |
| `data/csv/` | 9 bảng CSV cho kiểm tra, import và export dữ liệu SQLite. |
| `database/`, `schemas/` | Schema SQL, JSON Schema và truy vấn quản trị backend. |
| `data/documents.json`, `data/organization.json`, `data/personas.json` | Các nguồn mẫu được giữ để đối chiếu nguồn dữ liệu. |
| `supabase/schema.sql`, `supabase/seed.sql` | Schema PostgreSQL và seed mẫu để chuẩn bị tích hợp Supabase. |
| `scripts/export_sqlite_to_supabase.py` | Xuất SQLite local thành `supabase/seed.sql`; không tự tải dữ liệu lên Supabase. |

Dùng `manage_database.bat` hoặc `manage_database.py` để quản trị SQLite. Sửa CSV cần kiểm tra và import trước khi Streamlit nhận thay đổi. Import SQLite hoặc chỉnh Supabase **không tự cập nhật** JSON mà Next.js đang đọc. Chi tiết ở [docs/database.md](docs/database.md).

Để tạo lại seed Supabase từ database local:

```powershell
.\.venv\Scripts\python.exe -B scripts/export_sqlite_to_supabase.py --mode fresh
.\.venv\Scripts\python.exe -B scripts/verify_provenance.py
```

Exporter đọc một transaction SQLite, validate trước khi ghi file và không tự tải dữ liệu lên Supabase. `fresh` dùng INSERT và dừng khi trùng khóa; `upsert` cập nhật khóa có sẵn, giữ các dòng chỉ có ở đích. Xem [quy trình Supabase](supabase/README.md) và [frontend/README.md](frontend/README.md#supabase).

## Kiểm tra

Frontend, chạy trong `frontend/`:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

`npm test` chạy validation dữ liệu/body, contracts, kiểm tra output Gemini, API chat, React UI và migration/read-back PostgreSQL nhúng. Test SQL cần `.venv` ở root; có thể đặt `APPOTA_PYTHON` để chọn interpreter khác. Các test này không gọi dịch vụ thật. `npm run test:gemini:live` gửi đúng câu hỏi mẫu cùng fact mẫu tới Google và ghi kết quả trong `docs/evidence/gemini_live.json`.

Backend, chạy từ thư mục gốc:

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s tests -p "test_*.py"
.\.venv\Scripts\python.exe -B run_tests.py
.\.venv\Scripts\python.exe -B validate.py
```

`validate.py` kiểm tra toàn bộ public/private/detailed cùng contract Python–TypeScript và tạo báo cáo trong `docs/evidence/`. `benchmark.py` đo cả engine, tái dựng bảng và đọc SQLite có/không có cache. Các báo cáo sinh ra được Git bỏ qua. Scenario dùng ngày cố định; ngày mặc định trong ứng dụng theo `Asia/Ho_Chi_Minh`.

## Phạm vi demo

Chat hỗ trợ hỏi về số ngày phép, thời hạn báo trước, người duyệt, thời gian hạn chế nghỉ và người trực thay trong bộ dữ liệu mẫu. Đổi nhân sự/ngày áp dụng trong Next.js mở cuộc trò chuyện mới. Nguồn, graph và trace có thể xem theo câu trả lời.

Quy tắc fixture vẫn giữ khoảng trống chính sách A tại **28/02/2026**, đơn vị `unspecified_days` cho quy định báo trước của Team và các quyết định migration M01–M06 chưa được xác nhận. Persona mẫu không thay thế xác thực người dùng. Chưa có đồng bộ hội thoại theo tài khoản, vector database hay audit log bền vững.

Khi bật Gemini, câu hỏi, tối đa 6 câu hỏi trước đó và điều khoản đã lọc được gửi sang Google; không gửi toàn bộ kho hay nội dung assistant từ client. Chỉ dùng dữ liệu mẫu cho cấu hình demo hiện tại. Schema Supabase mới đóng quyền công khai trên corpus/chat; database đã triển khai cần chạy migration rồi kiểm tra quyền. Persona mẫu vẫn chưa phải xác thực nhân viên.

## Tài liệu

- [Frontend: cấu hình, API và xử lý lỗi](frontend/README.md)
- [Quản trị database](docs/database.md)
- [Sơ đồ dữ liệu](docs/data_erd.md)
- [Quy tắc và kiến trúc backend](docs/accuracy_rules_and_graph_architecture.md)
- [Scenario kiểm thử](docs/test_cases.md)
- [Bộ kiểm thử chi tiết](docs/detailed_test_cases.md)
- [Tiến độ triển khai và bằng chứng kiểm tra](docs/implementation_progress.md)
- [Báo cáo Mission 3: Before → After, kiểm thử và giới hạn](docs/MISSION_3_REPORT.md)
- [Kế hoạch hoàn thiện Mission 3 trong 3 ngày](docs/MISSION_3_COMPLETION_PLAN.md)
- [Implementation plan Mission 3: kiến trúc, file, test và quality gates](docs/MISSION_3_IMPLEMENTATION_PLAN.md)
- [Change Request intake Mission 3](docs/MISSION_3_CR_INTAKE.md)

Các kế hoạch, báo cáo và ảnh cũ đã dọn khỏi repository. Bản sao local của đợt dọn nằm trong `.cleanup-backups/` trên máy thực hiện, không được đưa lên GitHub.
