# AUDIT: Appota Knowledge Copilot — 65/100

## 1. Bảng điểm

| Hạng mục | Tối đa | Trừ | Cuối | Lý do trừ điểm chính |
|---|---:|---:|---:|---|
| Tính đúng đắn logic & phương pháp | 25 | 9 | 16 | R01 −3; R02 −2; R03 −2; R06 −2 |
| Xử lý dữ liệu & data leakage | 15 | 7 | 8 | R04 −3; R07 −2; R09 −1; R15 −1 |
| Chất lượng code & kiến trúc | 15 | 5 | 10 | R05 −2; R08 −1; R14 −1; R17 −1 |
| Reproducibility | 12 | 1 | 11 | R11 −1 |
| Vệ sinh notebook & mạch trình bày | 10 | 0 | 10 | Không áp dụng: inventory không có `.ipynb`; không quy đổi điểm sang hạng mục khác |
| Hiệu năng & tối ưu | 8 | 2 | 6 | R12 −1; R13 −1 |
| Kiểm thử & xác thực kết quả | 8 | 3 | 5 | R10 −2; R16 −1 |
| Tài liệu, naming, readability | 7 | 1 | 6 | R14 −1; chỉ xét nội dung trong code |
| Tổng theo rubric | 100 | 28 | 72 | Bằng chứng và cách sửa tương ứng ở mục 2 |

**Điểm cuối: min(72, 65) = 65/100.** Áp trần vì R01 và R04 được xếp CRITICAL theo tiêu chí “kết quả sai/không tin được” của yêu cầu. Khoản giảm do trần là 7 điểm, không gán lại vào hạng mục để tránh đếm lỗi hai lần. Đây là điểm audit tĩnh, không chứng nhận ứng dụng đang chạy thành công.

### Phạm vi và mức xác minh

- Ngày audit: 15/10/2026; revision `764469b`; thư mục `C:/Users/minh4/OneDrive/Desktop/Appota`. Tên dự án lấy từ `frontend/src/app/layout.tsx:5`; các placeholder trong yêu cầu được đối chiếu với repo hiện tại.
- Bài toán hiện có là tra cứu chính sách nghỉ phép trên dữ liệu mẫu, với hai rule engine Python/TypeScript; Gemini tùy chọn chọn kiểu trình bày. Không có pipeline huấn luyện ML trong source đã đọc: `engine/core.py:98`, `frontend/src/lib/policy.server.ts:22`, `frontend/src/lib/gemini.server.ts:9`. Dataset tự khai báo `mock_runtime`, không phải chính sách thật: `data/knowledge.json:3`.
- Inventory: 136 file được Git quản lý; đọc sâu 84 file code, tổng 6.220 dòng, gồm 35 `.py`, 7 `.sql` và 42 file frontend/script khác; không có notebook. Danh sách source và số dòng dưới đây là kết quả đọc tại revision này; dependency đã cài, build output và virtualenv không phải code do dự án quản lý.
- Đọc thêm schema, fixture JSON/CSV, dependency manifest/lock và cấu hình để đối chiếu code. Không chấm báo cáo cũ, slide, cấu hình deploy hoặc số liệu mà các tài liệu đó tự công bố.
- Chỉ đọc nội dung, parse cấu trúc và so khớp hash bằng công cụ chuẩn; không import/chạy module dự án, chạy test/build/benchmark/install/smoke test hoặc gọi API. Kết quả chạy hiện tại, latency thực tế, clean install và trạng thái Supabase thật: **[không xác minh được]**. Không tái sử dụng số test pass trong lượt làm việc trước làm bằng chứng audit.
- Không có source trong phạm vi bị thiếu/không đọc được. Giới hạn bằng chứng chạy được phản ánh qua R10, R11, R16; không suy diễn rằng test đang fail. Không đọc secret `.env.local`; kiểm tra credential chỉ giới hạn ở source và file ví dụ (`frontend/.env.example:3`, `frontend/.env.example:7`).
- Phản ví dụ trong báo cáo là suy luận tĩnh theo nhánh code, chưa chạy; không phải log lỗi thực tế. Không thay data để dựng lỗi.

### Cây thư mục code

```text
Appota/
├── api/                      # API Python
├── engine/                   # snapshot, validation, intent, policy, storage, provenance
├── database/                 # SQLite schema/query
├── scripts/                  # export và xác minh nguồn
├── supabase/
│   └── migrations/           # PostgreSQL schema/seed/migration/verification
├── frontend/
│   ├── scripts/              # check và loader
│   ├── src/
│   │   ├── app/api/chat/     # Next.js entrypoint API
│   │   ├── components/      # chat/inspector
│   │   ├── lib/             # policy engine/validation TypeScript
│   │   └── types/
│   └── tests/
├── public/                   # giao diện Python API
├── tests/                    # unit tests/fixtures
├── data/                     # corpus/intent rules/CSV
├── schemas/                  # runtime/design schema
└── *.py, *.bat               # entrypoint/script ở gốc; liệt kê đầy đủ dưới đây
```

### Inventory từng file code

| File | Số dòng |
|---|---:|
| `api/index.py` | 95 |
| `app.py` | 75 |
| `benchmark.py` | 101 |
| `contracts.py` | 50 |
| `database/queries.sql` | 33 |
| `database/schema.sql` | 110 |
| `engine/core.py` | 118 |
| `engine/filter.py` | 27 |
| `engine/generator.py` | 56 |
| `engine/graph_view.py` | 45 |
| `engine/hierarchy.py` | 49 |
| `engine/identity.py` | 17 |
| `engine/knowledge_graph.py` | 55 |
| `engine/metadata.py` | 176 |
| `engine/models.py` | 91 |
| `engine/provenance.py` | 89 |
| `engine/semantic_matcher.py` | 137 |
| `engine/snapshot.py` | 71 |
| `engine/storage.py` | 163 |
| `engine/tabular.py` | 195 |
| `engine/timeline.py` | 33 |
| `engine/trace.py` | 11 |
| `frontend/eslint.config.mjs` | 25 |
| `frontend/next.config.ts` | 20 |
| `frontend/scripts/check-all.cjs` | 10 |
| `frontend/scripts/check-chat.cjs` | 78 |
| `frontend/scripts/check-contracts.cjs` | 25 |
| `frontend/scripts/check-data.cjs` | 51 |
| `frontend/scripts/check-gemini.cjs` | 23 |
| `frontend/scripts/check-gemini-live.cjs` | 32 |
| `frontend/scripts/check-supabase.cjs` | 89 |
| `frontend/scripts/test-loader.cjs` | 34 |
| `frontend/src/app/api/chat/route.ts` | 2 |
| `frontend/src/app/globals.css` | 35 |
| `frontend/src/app/layout.tsx` | 19 |
| `frontend/src/app/page.tsx` | 5 |
| `frontend/src/components/ChatArea.tsx` | 242 |
| `frontend/src/components/ChatClient.tsx` | 136 |
| `frontend/src/components/ConversationSidebar.tsx` | 42 |
| `frontend/src/components/InspectorDrawer.tsx` | 206 |
| `frontend/src/lib/calendar.ts` | 9 |
| `frontend/src/lib/chat-handler.server.ts` | 73 |
| `frontend/src/lib/chat-validation.ts` | 71 |
| `frontend/src/lib/conversations.ts` | 24 |
| `frontend/src/lib/dataset.server.ts` | 124 |
| `frontend/src/lib/gemini.server.ts` | 51 |
| `frontend/src/lib/intent.server.ts` | 67 |
| `frontend/src/lib/mockData.ts` | 6 |
| `frontend/src/lib/policy.server.ts` | 58 |
| `frontend/src/lib/policy-resolution.server.ts` | 115 |
| `frontend/src/lib/request-body.server.ts` | 26 |
| `frontend/src/lib/supabase.ts` | 25 |
| `frontend/src/types/index.ts` | 64 |
| `frontend/tests/chat-ui.test.tsx` | 97 |
| `frontend/tests/history.test.ts` | 37 |
| `frontend/vitest.config.mts` | 7 |
| `manage_database.bat` | 54 |
| `manage_database.py` | 70 |
| `public/app.js` | 166 |
| `public/index.html` | 51 |
| `public/styles.css` | 1 |
| `run_app.bat` | 63 |
| `run_detailed_tests.bat` | 21 |
| `run_frontend.bat` | 42 |
| `run_private_tests.bat` | 21 |
| `run_tests.py` | 119 |
| `scripts/export_sqlite_to_supabase.py` | 178 |
| `scripts/verify_provenance.py` | 19 |
| `smoke_test.py` | 19 |
| `supabase/migrations/20261015_close_public_access.sql` | 43 |
| `supabase/migrations/20261015_dataset_created_on_date.sql` | 13 |
| `supabase/schema.sql` | 230 |
| `supabase/seed.sql` | 81 |
| `supabase/verify_access.sql` | 35 |
| `tests/test_contract_oracle.py` | 39 |
| `tests/test_database.py` | 231 |
| `tests/test_engine.py` | 386 |
| `tests/test_export_provenance.py` | 77 |
| `tests/test_runner.py` | 139 |
| `tests/test_snapshot_cache.py` | 56 |
| `tests/test_ui.py` | 90 |
| `tests/test_web.py` | 130 |
| `validate.py` | 72 |
| `web_preview.py` | 49 |

Không có `.ipynb` nên không tồn tại cell/execution_count để chấm. Điểm notebook 10/10 áp dụng quy tắc bắt đầu ở tối đa và chỉ trừ lỗi có bằng chứng, không xác nhận chất lượng notebook.

### Entrypoint và thứ tự pipeline

| Luồng | Thứ tự thực tế theo code |
|---|---|
| Web Next.js | `frontend/src/app/page.tsx:3` → bootstrap GET (`frontend/src/components/ChatClient.tsx:29`) → POST (`frontend/src/components/ChatClient.tsx:99`) → route re-export (`frontend/src/app/api/chat/route.ts:1`) → body validation (`frontend/src/lib/chat-handler.server.ts:33`) → intent/persona/scope (`frontend/src/lib/policy.server.ts:22`) → versions/ACL (`frontend/src/lib/policy-resolution.server.ts:47`) → hierarchy/floor (`frontend/src/lib/policy-resolution.server.ts:69`) → tùy chọn Gemini (`frontend/src/lib/chat-handler.server.ts:53`) → response/UI. |
| Dataset Next.js | Seed/schema (`frontend/src/lib/dataset.server.ts:4`) → compile (`frontend/src/lib/dataset.server.ts:15`) → snapshot (`frontend/src/lib/dataset.server.ts:99`). Supabase chỉ được probe qua RPC; GET trả `dataSource: 'knowledge.json'` (`frontend/src/lib/chat-handler.server.ts:25`, `frontend/src/lib/supabase.ts:19`). |
| Streamlit | Đọc SQLite/snapshot/assistant (`app.py:23`) → câu hỏi (`app.py:60`) → refresh/clock/identity/intent (`engine/core.py:83`) → ACL (`engine/core.py:55`) → version (`engine/core.py:65`) → hierarchy/synthesis/graph (`engine/core.py:107`). |
| API Python/giao diện cũ | Assistant JSON (`api/index.py:16`) → handler (`api/index.py:32`); browser gọi API (`public/app.js:105`); preview server (`web_preview.py:42`). Đây là luồng riêng với Next.js. |
| Quản trị dữ liệu | CLI (`manage_database.py:37`) → transaction read (`engine/storage.py:73`) hoặc backup/replace/rollback (`engine/storage.py:106`). Export (`scripts/export_sqlite_to_supabase.py:152`) → seed SQL → atomic write (`scripts/export_sqlite_to_supabase.py:61`). |
| Xác thực | `validate.py:29` định nghĩa chạy unittest/scenario/contract; frontend aggregator chọn sáu nhóm check tại `frontend/scripts/check-all.cjs:3`. Đây là thứ tự từ source, không phải lệnh đã chạy trong audit. |

## 2. Findings theo mức độ

| ID | Mức | File:dòng | Mô tả lỗi | Điểm trừ | Cách sửa |
|---|---|---|---|---:|---|
| R01 | CRITICAL | `frontend/src/lib/intent.server.ts:41`, `frontend/src/lib/intent.server.ts:43`; `frontend/src/components/ChatClient.tsx:100` | Khi snapshot đổi, context reset nhưng lịch sử không replay vì `previous` vẫn tồn tại. Ngày user chọn trong hội thoại bị thay bằng ngày khởi tạo chat; có thể trả phiên bản chính sách khác mà không hỏi lại. | 3 logic | Replay history khi context không tương thích snapshot; giữ ngày đã xác định hoặc hỏi lại. Regression snapshot đổi + follow-up. |
| R04 | CRITICAL | `engine/provenance.py:58`, `engine/provenance.py:63`, `engine/provenance.py:68`, `engine/provenance.py:75` | Pointer có thể trỏ clause khác cùng policy/version, còn `source.line` trỏ key cũ. Các kiểm tra tách rời không bind pointer/key/line thành một clause; có thể chứng nhận nguồn sai slot. | 3 dữ liệu | Bind pointer terminal với key và vị trí dòng của đối tượng được trỏ; negative control cùng document khác key. |
| R02 | HIGH | `engine/semantic_matcher.py:31`; `frontend/src/lib/intent.server.ts:58` | Year-only guard chỉ nhận `20xx`; năm 1999/2100 bị bỏ qua, câu hỏi được xử lý theo ngày mặc định. | 2 logic | Nhận năm bốn chữ số trong ngữ cảnh thời gian; áp dụng clarification khi chưa đủ ngày. |
| R03 | HIGH | `engine/metadata.py:79`, `engine/tabular.py:88`, `engine/generator.py:19`; `frontend/src/lib/policy-resolution.server.ts:63` | Enum đã sửa có thể hợp lệ nhưng answer vẫn dùng `text_source` cũ; structured claim và câu trả lời mâu thuẫn. | 2 logic | Mapping enum → mô tả hoặc validate cặp enum/text; test thay approver qua SQL/CSV. |
| R05 | MEDIUM | `engine/semantic_matcher.py:91`, `engine/semantic_matcher.py:129`; `frontend/src/lib/intent.server.ts:25`, `frontend/src/lib/intent.server.ts:59` | Hai engine chia sẻ taxonomy nhưng khác quy tắc history/version và ưu tiên ngày; cùng hội thoại có thể khác status/ngày/fact. | 2 kiến trúc | Contract chuyển trạng thái/temporal; golden cases history + version, current-date + exact-date ở cả hai engine. |
| R06 | MEDIUM | `engine/semantic_matcher.py:85`; `frontend/src/lib/intent.server.ts:23`, `frontend/src/lib/intent.server.ts:60` | Có notice_period thì luôn bỏ entitlement, kể cả user hỏi rõ cả hai; trả lời thiếu một phần câu hỏi. | 2 logic | Chỉ loại match entitlement giả do cụm báo trước, giữ yêu cầu entitlement độc lập; test exact claim set nhiều slot. |
| R07 | MEDIUM | `frontend/src/components/ChatClient.tsx:106`; `frontend/src/components/ChatArea.tsx:237`; `frontend/src/lib/chat-handler.server.ts:51` | Provider của một reply ghi đè trạng thái cấu hình; footer có thể nói “chưa bật Gemini” nhưng câu tiếp theo vẫn gửi Google. | 2 dữ liệu | Tách configured/enabled khỏi provider của từng message; thông báo gửi dữ liệu theo cấu hình hiện hành. |
| R08 | MEDIUM | `frontend/src/components/ChatClient.tsx:90`, `frontend/src/components/ChatClient.tsx:101`; `frontend/src/lib/request-body.server.ts:1` | Client nhận 4.000 ký tự và 20 lượt history nhưng server chỉ nhận 100.000 byte; history hợp lệ từng field có thể khiến câu tiếp theo bị 413. | 1 kiến trúc | Budget UTF-8 toàn payload; giới hạn history theo byte, ưu tiên context; đồng bộ client/server. |
| R09 | MEDIUM | `schemas/knowledge_runtime_v2.schema.json:363`; `engine/tabular.py:70`; `frontend/src/lib/intent.server.ts:13` | Schema/matcher cho phép thiếu query_aliases, nhưng chuyển JSON thành bảng `pop` không default và phát sinh KeyError. | 1 dữ liệu | Canonicalize thiếu thành [] hoặc bắt buộc field trong schema; test round-trip optional field. |
| R10 | MEDIUM | `supabase/verify_access.sql:25`, `supabase/verify_access.sql:29`; `frontend/scripts/check-supabase.cjs:48` | `IF NOT (...)` không reject giá trị NULL; view thiếu reloptions hoặc function thiếu proconfig có thể lọt kiểm tra an toàn. | 2 kiểm thử | `IS DISTINCT FROM TRUE`/COALESCE false; negative tests bỏ security_invoker/fixed search_path. |
| R15 | MEDIUM | `frontend/src/lib/policy-resolution.server.ts:90`; `frontend/src/components/InspectorDrawer.tsx:115` | Citation gán text đã render vào text_source rồi UI đặt trong dấu ngoặc kép như nguyên văn nguồn. | 1 dữ liệu | Tách raw source text và effective/rendered text; inspector đặt tên/hiển thị đúng loại. |
| R16 | MEDIUM | `frontend/src/lib/policy-resolution.server.ts:81`; `frontend/scripts/check-chat.cjs:19`; `tests/test_engine.py:81` | TypeScript default gates không có entitlement dưới floor; regression 10 → 12 hiện chỉ bảo vệ Python. | 1 kiểm thử | Inject snapshot A=10 vào TS, đòi Group=12 và source đúng; test incompatible units và scope order. |
| R17 | MEDIUM | `frontend/src/lib/chat-validation.ts:41`, `frontend/src/lib/chat-validation.ts:44`; `frontend/src/lib/intent.server.ts:36` | Type guard dùng String/property coercion: mảng ["assistant"] hoặc key ["entitlement"] có thể pass nhưng không đúng type string. | 1 kiến trúc | Kiểm tra typeof string trước enum/key membership; negative tests array/object. |
| R11 | LOW | `tests/test_runner.py:121`, `tests/test_runner.py:122`, `tests/test_runner.py:128` | Test “clean environment install” dùng virtualenv đã có và pip check; không tạo môi trường sạch hay thử cài lock từ đầu. | 1 reproducibility | Đổi tên đúng phạm vi; thêm fresh-environment provisioning gate trong tác vụ được phép chạy. |
| R12 | LOW | `engine/storage.py:82`, `engine/storage.py:89` | Lấy runtime bytes SQLite serialize canonical JSON hai lần; cache validation không loại serialization thứ hai. | 1 hiệu năng | Reuse canonical bytes đã validate từ một lần đọc; giữ direct-SQL invalidation. |
| R13 | LOW | `frontend/src/lib/gemini.server.ts:19`, `frontend/src/lib/gemini.server.ts:32`, `frontend/src/lib/gemini.server.ts:37` | External model chỉ chọn hai style server render sẵn; thêm network/token cost cho phần xử lý rất nhỏ. | 1 hiệu năng | Style local hoặc chứng minh lợi ích đo được trước khi giữ model call. |
| R14 | LOW | `frontend/src/components/ChatArea.tsx:21`; `frontend/src/components/InspectorDrawer.tsx:16`; `engine/provenance.py:29`; `public/styles.css:1` | Component lớn; verifier gom nhiều tầng kiểm tra trong 61 dòng; legacy CSS minify một dòng khó review. | 2: 1 kiến trúc + 1 readability | Tách message/input/citation panel và các bước verifier; format CSS/inline script do repo sở hữu. |

Tổng 17 finding: 2 CRITICAL, 2 HIGH, 9 MEDIUM, 4 LOW. R14 là finding duy nhất chia khoản trừ giữa hai hạng mục; tổng vẫn là 2 điểm.

## 3. ĐÃ TỐT

- Snapshot immutable, cache theo cả bytes dữ liệu/schema; SQLite vẫn đọc mới để nhận direct edits. Tránh dùng chung trạng thái mutable và cache chỉ dựa mtime: `engine/metadata.py:147`, `engine/metadata.py:166`, `engine/snapshot.py:17`, `tests/test_snapshot_cache.py:37`.
- Floor Python thay cả claim/source, không chỉ sửa số; test đòi source Group, DERIVED_FROM và incompatible-unit conflict: `engine/hierarchy.py:15`, `tests/test_engine.py:91`, `tests/test_engine.py:101`. R16 là khoảng trống xác thực bản TS.
- Gemini không có quyền viết answer tùy ý: server buộc status/tập fact ID đúng rồi tự render từ facts. Giới hạn quyền model bằng code, vượt mức chỉ dựa prompt: `frontend/src/lib/gemini.server.ts:12`, `frontend/src/lib/gemini.server.ts:15`, `frontend/src/lib/gemini.server.ts:19`.
- SQLite đọc trong transaction và kiểm tra foreign key; thay dataset có backup/rollback; source test có case input lỗi không hỏng bản cũ: `engine/storage.py:75`, `engine/storage.py:116`, `tests/test_database.py:122`. Không coi test đã pass trong audit này.
- Oracle dùng expected status/date/value/unit/source, không lấy “hai engine đồng ý” làm chuẩn; negative controls từng trường tránh hợp thức hóa lỗi chung: `contracts.py:44`, `tests/test_contract_oracle.py:11`, `tests/test_contract_oracle.py:23`.
- Supabase test đổi role trên PostgreSQL engine thử nghiệm, đòi SELECT/ghi trái phép bị từ chối và giữ chat rows; migration revoke cả column grants: `frontend/scripts/check-supabase.cjs:50`, `frontend/scripts/check-supabase.cjs:54`, `frontend/scripts/check-supabase.cjs:64`, `supabase/migrations/20261015_close_public_access.sql:27`. Đây là thiết kế test, không chứng minh quyền instance thật.
- Graph HTML escape chuỗi để chặn thoát script; có negative test tương ứng: `engine/graph_view.py:43`, `tests/test_engine.py:362`. Không suy ra mọi UI đều đã security-tested từ case này.

## 4. CHƯA TỐT

### Phản ví dụ và hậu quả cụ thể

Các tình huống sau là suy luận tĩnh, **chưa chạy**; không giả định dataset hiện tại đã bị sửa hoặc hệ thống đã bị xâm nhập.

- **R01:** Chat khởi tạo ngày 2026-10-14, user đã hỏi ngày 2026-01-15, context giữ ngày tháng 1/snapshot cũ. Sau khi corpus đổi, câu “Vậy nghỉ phép bao nhiêu ngày?” gửi date khởi tạo và old context. Server reset sang tháng 10 nhưng không replay history vì chỉ replay khi không có previous; chọn phiên bản mới thay vì phiên bản tháng 1. Dữ liệu hai phiên bản: `data/knowledge.json:270`, `data/knowledge.json:363`; nhánh lỗi: `frontend/src/lib/intent.server.ts:41`, `frontend/src/lib/intent.server.ts:43`; payload: `frontend/src/components/ChatClient.tsx:100`.
- **R04:** Với notice_period A v2, giữ key và line 72, đổi pointer sang `/2/clauses/entitlement`, đồng bộ text_source/value thành text/value 14 của entitlement, đặt unit unspecified_days. Source bytes/hash không đổi; line 72 vẫn mở key notice; policy/version vẫn đúng; verifier suy unit từ text entitlement và trả verified. “14 ngày” được chứng nhận cho báo trước bằng pointer của quyền nghỉ phép. Nguồn thực: `data/documents.json:68`, `data/documents.json:72`; các kiểm tra tách rời: `engine/provenance.py:58`, `engine/provenance.py:63`, `engine/provenance.py:68`, `engine/provenance.py:84`. Test pointer hiện có đổi document, chưa chặn đổi key cùng document: `tests/test_export_provenance.py:39`.
- **R02:** “Nghỉ phép năm 1999 bao nhiêu ngày?” khớp topic/entitlement nhưng không khớp year-only regex. Engine dùng ngày mặc định thay vì hỏi ngày cụ thể; answer không trả lời thời điểm đã hỏi: `data/intent_rules.json:2`, `data/intent_rules.json:8`, `engine/semantic_matcher.py:31`, `frontend/src/lib/intent.server.ts:58`.
- **R03:** Sửa value_text approver A v2 thành DepartmentHead nhưng giữ text “Quản lý trực tiếp”. Schema cho enum là string không rỗng, metadata chỉ kiểm tra kind/unit, nên runtime chấp nhận; structured value khác lời trả lời. Đây là lỗ hổng khi update dataset, không khẳng định fixture đang mâu thuẫn: `schemas/knowledge_runtime_v2.schema.json:206`, `engine/metadata.py:79`, `engine/tabular.py:88`, `engine/generator.py:19`, `data/documents.json:77`.
- **R05:** Sau lượt nhắc POL-A-LV, “v2.0 nghỉ phép bao nhiêu ngày?” bị Python clarification trước khi inherit policy, TS dùng policy đã kế thừa. Với “Hiện tại tôi muốn xem nghỉ phép tại 2026-01-15”, Python ưu tiên today, TS ưu tiên ISO date. Có thể đổi status/phiên bản/fact: `engine/semantic_matcher.py:91`, `engine/semantic_matcher.py:125`, `engine/semantic_matcher.py:129`, `frontend/src/lib/intent.server.ts:25`, `frontend/src/lib/intent.server.ts:59`.
- **R06:** “Tôi có bao nhiêu ngày phép và phải báo trước bao lâu?” khớp hai slot rồi entitlement bị xóa. User có thời hạn báo trước nhưng thiếu số ngày phép: `data/intent_rules.json:4`, `data/intent_rules.json:8`, `engine/semantic_matcher.py:85`, `frontend/src/lib/intent.server.ts:60`.
- **R07:** Gemini bật; một lượt không facts hoặc fallback trả provider=rules; client ghi đè state và footer báo “chưa bật Gemini”. Lượt chính sách tiếp vẫn đi Google vì env không đổi. Không có bằng chứng gửi dữ liệu nhân sự thật; finding là thông báo sai trạng thái truyền dữ liệu: `frontend/src/lib/chat-handler.server.ts:51`, `frontend/src/lib/chat-handler.server.ts:53`, `frontend/src/lib/gemini.server.ts:6`, `frontend/src/components/ChatClient.tsx:106`, `frontend/src/components/ChatArea.tsx:237`.
- **R08:** `"nghỉ phép ".repeat(400)` dài 4.000 ký tự, 5.200 byte UTF-8. Hai mươi lượt đã có 104.000 byte history, chưa tính JSON/câu mới; mỗi field hợp lệ nhưng request tiếp bị 413: `frontend/src/components/ChatClient.tsx:90`, `frontend/src/components/ChatClient.tsx:101`, `frontend/src/lib/chat-handler.server.ts:46`, `frontend/src/lib/request-body.server.ts:17`.
- **R09:** Bỏ query_aliases khỏi unit vẫn đáp ứng required list, nhưng pop không default gây lỗi; import/export không bao phủ miền input schema: `schemas/knowledge_runtime_v2.schema.json:363`, `engine/tabular.py:70`.
- **R10:** reloptions/proconfig NULL → ANY(NULL) là NULL → NOT NULL vẫn NULL → PL/pgSQL không vào IF. Assertion có thể bỏ qua cấu hình thiếu. Migration hiện có bảo vệ; lỗi nằm ở verifier/test, không chứng minh instance thật unsafe: `supabase/verify_access.sql:25`, `supabase/verify_access.sql:29`, `supabase/migrations/20261015_close_public_access.sql:33`, `frontend/scripts/check-supabase.cjs:48`.
- **R15:** Nguồn A v2 viết “Nhân viên chính thức Công ty A được hưởng 14 ngày phép/năm.”; citation UI trích “14 ngày phép năm có hưởng lương.”. Số 14 đúng, nhưng render không phải nguyên văn: `data/documents.json:69`, `frontend/src/lib/policy-resolution.server.ts:64`, `frontend/src/lib/policy-resolution.server.ts:90`, `frontend/src/components/InspectorDrawer.tsx:115`.
- **R16:** Seed A=14, không dưới floor 12; golden cases dùng seed không chứng minh floor TS sửa 10 thành 12. Bỏ vòng floor có thể vẫn thỏa expectation hiện có. Đây là suy luận coverage, không phải mutation test đã chạy: `frontend/src/lib/policy-resolution.server.ts:81`, `frontend/scripts/check-chat.cjs:19`, `tests/policy_contracts.json:1`; Python có phản ví dụ tại `tests/test_engine.py:81`.
- **R17:** sender=["assistant"] pass String guard nhưng consumer so sánh strict với string. Context key ["entitlement"] lọt coercion nhưng không match keys.includes(clause.key), có thể lọc mất fact. LocalStorage không bảo đảm đúng type dù validator trả type predicate: `frontend/src/lib/chat-validation.ts:44`, `frontend/src/components/ChatClient.tsx:27`, `frontend/src/lib/chat-validation.ts:41`, `frontend/src/lib/intent.server.ts:36`, `frontend/src/lib/policy-resolution.server.ts:87`.
- **R11–R14:** Giới hạn còn lại là thiếu bằng chứng clean install, hai lần serialization, external style selection và source khó review; không suy diễn crash/latency chưa đo: `tests/test_runner.py:121`, `engine/storage.py:82`, `engine/storage.py:89`, `frontend/src/lib/gemini.server.ts:32`, `frontend/src/components/ChatArea.tsx:21`, `public/styles.css:1`.

### Checklist bắt buộc

| Mục | Kết luận | Bằng chứng và giới hạn |
|---|---|---|
| Data leakage: fit scaler/encoder/imputer trước split; target encoding không CV; future feature | Không áp dụng cho ML | Pipeline resolve policy, không fit estimator/transformer: `engine/core.py:98`, `engine/core.py:107`, `frontend/src/lib/policy.server.ts:22`. R01/R02 là temporal business logic, không gọi training leakage. R07 chấm riêng thông báo gửi dữ liệu. |
| Train/val/test: stratify, shuffle time-series, tune bằng test | Không áp dụng | Golden cases kiểm tra rule engine, không chia tập huấn luyện: `contracts.py:30`, `tests/test_contract_oracle.py:11`. Không phạt thiếu training split trong bài toán này. |
| Metric/imbalance và dummy/naive baseline | Không áp dụng cho classification; có baseline hiệu năng | Benchmark đo p50/p95, kiểm tra correctness và có baseline uncached/storage: `benchmark.py:37`, `benchmark.py:48`, `benchmark.py:71`. Số đo thực tế/speedup: [không xác minh được], không chấm theo báo cáo benchmark cũ. |
| Random seed: random/numpy/torch/sklearn | Không áp dụng cho training | Contract inject clock: `contracts.py:14`; Gemini temperature 0 là cấu hình, không chứng minh dịch vụ deterministic: `frontend/src/lib/gemini.server.ts:42`. Trace UUID không phải training randomness: `frontend/src/lib/chat-handler.server.ts:31`. |
| Hard-coded path, magic number, credential/API key | Có lỗi ở giới hạn magic number; không thấy key thật trong source đã đọc | R08: 4.000 ký tự/20 turn/100.000 byte không tương thích (`frontend/src/components/ChatClient.tsx:90`, `frontend/src/lib/request-body.server.ts:1`). Dataset ROOT-relative (`engine/snapshot.py:12`); key lấy từ env (`frontend/src/lib/gemini.server.ts:38`), ví dụ để trống (`frontend/.env.example:3`). Không đọc secret local/không đảm bảo phạm vi ngoài source. |
| Notebook: thứ tự cell, cell chết, output, import | Không áp dụng | Inventory không có ipynb; entrypoint Python/Next.js: `app.py:39`, `frontend/src/app/page.tsx:3`. Không có execution_count để kiểm tra. |
| Copy-paste, hàm >50 dòng, nesting >3, biến 1 ký tự | Có lỗi | R05 duplicate state logic (`engine/semantic_matcher.py:107`, `frontend/src/lib/intent.server.ts:40`); R14 UI functions lớn (`frontend/src/components/ChatArea.tsx:21`, `frontend/src/components/InspectorDrawer.tsx:16`), verifier 61 dòng/vòng và nhánh lồng (`engine/provenance.py:29`, `engine/provenance.py:71`). Không trừ riêng biến comprehension ngắn có ngữ cảnh rõ. |
| Silent failure: except trống/pass, fillna/drop vô tội vạ | Có lỗi ở assertion fail-open | R10 im lặng khi NULL (`supabase/verify_access.sql:25`). SQLite rollback rồi raise (`engine/storage.py:128`); Gemini fallback có warning/notice (`frontend/src/lib/chat-handler.server.ts:60`). Logging pass có chú thích tránh log dữ liệu (`api/index.py:93`); KeyboardInterrupt pass là shutdown (`web_preview.py:47`). Không có DataFrame fillna/drop trong pipeline. |
| Hiệu năng: loop DataFrame, đọc lại data, apply thay map/merge | Có lỗi; DataFrame không áp dụng | R12 serialize lại (`engine/storage.py:82`, `engine/storage.py:89`); R13 external style selection (`frontend/src/lib/gemini.server.ts:32`). SQLite refresh để nhận direct edits không tự động là lỗi (`engine/metadata.py:150`). |
| Over-claim từ số liệu so với code | Có lỗi về tên test/citation; chưa xác minh số liệu runtime | “clean_environment_install” không fresh-install (R11, `tests/test_runner.py:121`); quote UI không raw quote (R15, `frontend/src/components/InspectorDrawer.tsx:115`). Tên case SSO không chứng minh SSO thật: `tests/test_cases.json:93`, identity là mock (`engine/identity.py:16`). Không chấm claim trong report/slide ngoài scope. |
| Dependency: requirements/env, pin version | Không thấy lỗi pinning trong phạm vi đọc | Python manifest/lock (`requirements.txt:1`, `requirements-dev.txt:1`, `requirements.lock:1`); NPM lock v3 chốt version (`frontend/package-lock.json:4`, `frontend/package-lock.json:47`). Caret không chứng minh unpinned khi có lock; launcher dùng npm ci (`run_frontend.bat:21`). Clean install/tương thích môi trường khác: [không xác minh được], R11. |

## 5. ĐÃ TỐI ƯU

- Gom child rows theo document một lần trước khi dựng object, tránh quét toàn bộ child tables cho mỗi document: `engine/tabular.py:126`, `engine/tabular.py:132`. Chưa đo latency, nhưng cấu trúc vòng lặp giảm số lần full scan.
- LRU giới hạn hai snapshot theo content bytes, reuse validation/compile khi corpus/schema không đổi; giữ refresh SQLite để không che direct edits: `engine/metadata.py:147`, `engine/metadata.py:150`, `tests/test_snapshot_cache.py:37`.
- Python compile scope regex khi tạo snapshot, không compile lại mỗi câu hỏi; TS scope patterns dựng ở module level: `engine/semantic_matcher.py:41`, `engine/semantic_matcher.py:53`, `frontend/src/lib/intent.server.ts:11`.
- Dataset TS tạo index object không prototype cho lookup persona/unit; tránh full scan mỗi lookup và inherited property collisions: `frontend/src/lib/dataset.server.ts:21`, `frontend/src/lib/dataset.server.ts:24`.
- Body reader đếm byte theo chunk/cancel khi quá hạn mức, không đợi đọc toàn body mới reject; có UTF-8 decoder fatal: `frontend/src/lib/request-body.server.ts:9`, `frontend/src/lib/request-body.server.ts:16`, `frontend/src/lib/request-body.server.ts:18`. R08 là tương thích contract client, không phải thiếu giới hạn bộ nhớ server.

## 6. CHƯA TỐI ƯU

| Vị trí | Hiện tại | Nên làm | Lợi ích ước tính |
|---|---|---|---|
| `engine/storage.py:82`, `engine/storage.py:89` — R12 | Serialize canonical JSON để validate rồi serialize lại trả bytes | Reuse canonicalize trong một lần đọc | Bỏ một lượt serialize toàn dataset/request; ms/RAM: [không xác minh được] |
| `frontend/src/lib/gemini.server.ts:32`, `frontend/src/lib/gemini.server.ts:37` — R13 | External call, timeout 25 giây, chỉ chọn concise/bullets | Style local; đo lợi ích trước khi giữ model | Bỏ một external request cho mỗi câu eligible; latency/token cost: [không xác minh được] |
| `frontend/src/lib/chat-handler.server.ts:14`, `frontend/src/lib/supabase.ts:19`, `frontend/src/components/ChatClient.tsx:39` | Bootstrap chờ optional health RPC tới timeout 5 giây | Tách probe khỏi dữ liệu cần mở chat/cache probe TTL | Bỏ health probe khỏi critical path; 5 giây là timeout, không phải latency đo được. Đề xuất thêm, không cộng finding/điểm trừ |
| `frontend/src/components/ChatArea.tsx:107`, `frontend/src/lib/conversations.ts:20` | Render toàn bộ messages hiện có; giới hạn serialization không tự giới hạn state đang render | Paginate/virtualize chat dài, đo trước/sau | Giới hạn số message DOM đang mount; throughput: [không xác minh được]. Đề xuất thêm, không cộng finding/điểm trừ |

## 7. Top 10 việc cần sửa (xếp theo điểm thu hồi được)

| # | Việc | Điểm lấy lại | Công sức (S/M/L) |
|---|---|---:|---|
| 1 | R01: đổi snapshot phải giữ/replay ngữ cảnh ngày; regression — `frontend/src/lib/intent.server.ts:41` | 3 | M |
| 2 | R04: bind pointer/key/line cùng clause; negative control — `engine/provenance.py:58` | 3 | M |
| 3 | R02: year-only guard ngoài 20xx ở cả engine — `engine/semantic_matcher.py:31`, `frontend/src/lib/intent.server.ts:58` | 2 | S |
| 4 | R03: canonical render enum/kiểm tra text-value — `engine/generator.py:19`, `engine/metadata.py:79` | 2 | M |
| 5 | R05: contract ưu tiên ngày/history/version — `engine/semantic_matcher.py:129`, `frontend/src/lib/intent.server.ts:25` | 2 | M |
| 6 | R06: giữ entitlement khi hỏi nhiều slot — `frontend/src/lib/intent.server.ts:60` | 2 | S |
| 7 | R07: configured provider riêng với used provider — `frontend/src/components/ChatClient.tsx:106`, `frontend/src/components/ChatArea.tsx:237` | 2 | S |
| 8 | R10: catalog assertion NULL-safe/negative tests — `supabase/verify_access.sql:25` | 2 | S |
| 9 | R14: tách component/verifier, format legacy source — `frontend/src/components/ChatArea.tsx:21`, `engine/provenance.py:29` | 2 | M |
| 10 | R08: budget UTF-8 toàn payload/history — `frontend/src/components/ChatClient.tsx:101`, `frontend/src/lib/request-body.server.ts:1` | 1 | M |

Điểm lấy lại là khoản trừ trực tiếp ở mục 1, không tính hai lần việc bỏ trần. Phải sửa cả hai CRITICAL mới bỏ trần 65; còn một CRITICAL thì trần vẫn áp dụng. Trong nhóm đồng điểm, ưu tiên ảnh hưởng đến answer/nguồn trước; không dựa benchmark chưa đo.

## 8. Phán quyết

Điểm audit tĩnh là **65/100**, nằm trong dải “có sai sót phương pháp hoặc nợ kỹ thuật rõ rệt”; chưa chứng minh runtime hoạt động ở revision này vì không chạy test theo yêu cầu chỉ đọc. Nếu nộp hoặc ship hiện trạng, rủi ro lớn nhất là trả con số của sai thời điểm khi snapshot đổi và gắn nhãn verified cho sai điều khoản nguồn (`frontend/src/lib/intent.server.ts:41`, `engine/provenance.py:58`). Immutable snapshot, floor và oracle đã có cơ sở trong source, nhưng không bù hai lỗ hổng temporal context/provenance (`engine/metadata.py:147`, `tests/test_engine.py:91`, `tests/test_contract_oracle.py:11`). Cần sửa R01/R04 và bổ sung negative controls trước khi tin citation hoặc coi contract giữa hai engine ổn định (`tests/test_export_provenance.py:39`, `engine/semantic_matcher.py:91`, `frontend/src/lib/intent.server.ts:59`).
