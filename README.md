# Appota Internal Knowledge V2

Demo tra cứu chính sách nghỉ phép bằng rule engine Python, metadata có validation và knowledge graph theo persona/ngày. Bản web Vercel dùng JSON seed; bản Streamlit local dùng SQLite. Không dùng LLM, vector DB hoặc SSO thật. Dữ liệu là mock; không đưa ứng dụng này vào sử dụng với dữ liệu nhân sự thật khi chưa tích hợp xác thực, governance và review bảo mật phù hợp.

## Deploy lên Vercel

Import repo `nqminh-ai/hr_chatbot` trong Vercel, chọn nhánh `main` và giữ **Root Directory** ở thư mục gốc. Framework Preset là **Other**; không cần Build Command hoặc biến môi trường. `vercel.json` đã đặt Output Directory là `public` và cấu hình Python Function `api/index.py` tại `/api`.

- `public/`: giao diện web gồm trả lời, sơ đồ tri thức, trace và xuất graph JSON.
- `api/index.py`: API HTTP dùng lại engine, kiểm tra request và trả graph đã được lọc theo persona/ngày.
- `requirements.txt`: dependency Python cho Vercel; không cài Streamlit trên serverless.
- `.python-version`: chọn Python 3.14; Vercel quản lý bản patch của runtime.

Bản Vercel đọc snapshot chỉ đọc từ `data/knowledge.json` và runtime schema đã commit. Không cần Supabase hoặc SQLite để chạy demo. Chỉnh JSON rồi push để cập nhật dữ liệu qua lần deploy tiếp theo. Chỉnh SQLite/CSV local không tự đổi dữ liệu bản Vercel. Nếu cần quản trị chính sách online, tài khoản thật hoặc lưu lịch sử lâu dài, cần tích hợp database ngoài; repo hiện chưa có tính năng này. Không lưu thay đổi vào filesystem của Vercel Function.

Chạy giao diện web local để kiểm tra:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -B web_preview.py
```

Mở `http://127.0.0.1:8000`. Để chạy thêm Streamlit và toàn bộ test local, cài `requirements.lock` theo hướng dẫn bên dưới hoặc `requirements-dev.txt`.

Tài liệu nền tảng: [Python Functions](https://vercel.com/docs/functions/runtimes/python/api-directory), [cấu hình Vercel](https://vercel.com/docs/project-configuration/vercel-json), [giới hạn SQLite](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).

## Chạy trên Windows

Khi đã cài môi trường `.venv`, nhấp đúp `run_app.bat` để mở ứng dụng tại `http://127.0.0.1:8501`. Giữ cửa sổ chạy mở; nhấn `Ctrl+C` để dừng ứng dụng. File chạy dùng Python trong `.venv` của dự án và hiển thị lỗi nếu môi trường chưa sẵn sàng.

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

Lần cài trực tiếp từ package index trong môi trường audit không thành công. Đã kiểm chứng cài offline vào `.venv` sạch từ 43 wheel đúng phiên bản/ABI có sẵn trong pip cache; không sửa hoặc tự build lại wheel. SHA-256 wheel nằm ở `docs/evidence/wheel_manifest.json`; log cài đặt được giữ local và không commit. Wheel binaries không được đưa vào repo; môi trường khác cần index hoặc wheelhouse chứa đúng các phiên bản trong lock.

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
- **Tracker maintainer:** mở `docs/tracking_graph.html` trong trình duyệt; xem `data/improvement_tracking.json` để đối chiếu task, test và evidence. Đây là file thiết kế có nhúng toàn bộ mock data, không được phục vụ cho nhân viên với dữ liệu thật. Runtime graph phân quyền nằm trong ứng dụng.

Các quyết định M01–M06 chưa được content owner xác nhận. Runtime không thay ngày kết thúc v1 A: **28/02/2026 là gap**, trả conflict thay vì dùng nhầm policy Group. “10 ngày” của Team giữ `unspecified_days`, không được mặc định là ngày làm việc. Unlimited được biểu diễn riêng dựa trên text mock, không dùng sentinel 99 để tính số ngày. Approval events là `mock_fixture`; chưa có bằng chứng phê duyệt thật. Khi policy chung và Executive chồng clause ở cùng scope, query chung trả conflict; query nhắm rõ tài liệu vẫn kiểm tra ACL và floor.

## Kiến trúc

`CSV → validation/import transaction → SQLite → validated immutable snapshot → identity → ACL/contract/audience/scope → as-of version → clause resolution → typed floor → render/citations → authorized graph/trace`.

Tất cả consumers dùng snapshot bất biến. SQLite được đọc trong một read transaction; fingerprint tính từ nội dung dataset tái dựng và schema, nhận cả thay đổi SQL trực tiếp. Mỗi request giữ một snapshot riêng để tránh reload giữa chừng. Streamlit cache theo nội dung data/schema, tối đa hai snapshot; cần rerun/tải lại sau khi import. Numeric text được render từ giá trị effective; floor thay cả clause và source. Citations theo clause, không dedup làm mất approver/contingency.

Router là lexical cho phạm vi leave-policy hiện có; hỗ trợ clause slots, ngày/năm, policy/version và alias unit. Không phải mô hình hiểu mọi câu tiếng Việt. Phép nghỉ/operation ngoài các slot đã hỗ trợ cần hỏi lại hoặc bổ sung taxonomy; không suy diễn quyền xử lý ngoại lệ. Bảo lưu/chuyển ngày phép, nghỉ ốm/thai sản và các operation chưa có dữ liệu trả thiếu căn cứ.

## Kiểm chứng và giới hạn

- `docs/evidence/test_results.json`: số test, test IDs, environment, source hashes và kết quả scenario mới nhất.
- `docs/evidence/browser_ui.json` và ảnh: kiểm tra render graph trên browser thật ở desktop/mobile.
- `docs/evidence/benchmark.json`: p50/p95 warm snapshot cho 8 và 1.008 document; không gồm reload I/O, không phải SLO production.
- `AUDIT_REPORT.md`: báo cáo audit hiện tại ghi 83/100; các tài liệu kế hoạch lưu trữ vẫn nhắc baseline lịch sử 43/100. Chưa có review độc lập.

Lock được kiểm chứng trên Windows/Python nêu trên; nền tảng khác chưa được kiểm chứng. Metadata approval thật, content-owner decisions, SSO và audit storage bền vững là các điều kiện riêng trước khi dùng với dữ liệu thật. Không công bố bảo đảm miễn nhiễm hoặc chống leakage tuyệt đối.
