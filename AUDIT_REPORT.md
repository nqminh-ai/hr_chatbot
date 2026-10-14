# AUDIT: Appota Knowledge Copilot — 57/100

Ngày đánh giá: 15/10/2026. Snapshot Git: `5f8416e659817c78bb09854229cec9b4a8561219`. Thư mục: `C:\Users\minh4\OneDrive\Desktop\Appota`.

Phạm vi: code ứng dụng, code kiểm thử, SQL, script và cấu hình dependency liên quan. Không chấm README, báo cáo cũ, slide hoặc deployment. Đây là demo rule engine chính sách nghỉ phép có adapter Gemini, không phải pipeline huấn luyện ML: `engine/core.py:28`, `frontend/src/lib/policy.server.ts:68`, `frontend/src/lib/gemini.server.ts:7`.

Phương pháp: đọc đầy đủ 59 file code, tổng 4.930 dòng kể cả dòng trống; đọc bổ sung schema, seed, source JSON, fixture và manifest dependency. Không chạy code, test, build, notebook, SQL hoặc cài dependency. Những test có trong source được đánh giá về thiết kế, **không được coi là đã pass trong lần audit này**: `tests/test_engine.py:34`, `tests/test_database.py:25`, `frontend/scripts/check-chat.cjs:32`. Chỉ tạo file báo cáo này; không commit/push.

## 1. Bảng điểm

| Hạng mục | Tối đa | Trừ | Cuối | Lý do trừ điểm chính |
| --- | ---: | ---: | ---: | --- |
| 1. Tính đúng đắn logic & phương pháp | 25 | 12 | **13** | F01 −4; F02 −3; F03 −2; F04 −2; F05 −1. Câu trả lời model không được đối chiếu lại, routing/ngữ cảnh/thời gian có phản ví dụ từ source. |
| 2. Xử lý dữ liệu & data leakage | 15 | 10 | **5** | F06 −3; F07 −4; F08 −2; F09 −1. Thiếu validation ở TypeScript, RLS không thực thi ACL, export thiếu snapshot nhất quán, provenance chỉ kiểm tra khai báo. |
| 3. Chất lượng code & kiến trúc | 15 | 6 | **9** | F10 −2; F11 −2; F12 −1; F13 −1. Hai engine độc lập, hàm lớn, lỗi bị che, dữ liệu lịch sử chưa validate đủ. |
| 4. Reproducibility | 12 | 4 | **8** | F14 −2; F15 −1; F16 −1. Launcher lỗi, đường cài đặt có thể thay lock, adapter/model thật thiếu bằng chứng kiểm chứng. |
| 5. Vệ sinh notebook & mạch trình bày | 10 | 0 | **10 — không áp dụng** | Inventory không có `.ipynb`; entrypoint là Python/Next.js (`app.py:39`, `frontend/src/app/page.tsx:3`). Giữ điểm xuất phát theo rubric trừ lỗi; không diễn giải là đã có notebook đạt chuẩn. |
| 6. Hiệu năng & tối ưu | 8 | 4 | **4** | F17 −2; F18 −1; F19 −1. Reconstruction quét lặp, validation lặp, giới hạn body được kiểm tra sau khi đọc hết. |
| 7. Kiểm thử & xác thực kết quả | 8 | 3 | **5** | F20 −2; F21 −1. Gate mặc định bỏ qua private/detailed cases, test Next.js thiếu UI và parity giữa hai engine. |
| 8. Tài liệu, naming, readability | 7 | 4 | **3** | F22 −2; F23 −1; F24 −1. Nhãn nguồn dữ liệu gây hiểu sai, code nén dài, docstring export khẳng định verification chưa triển khai. |
| **Tổng** | **100** | **43** | **57** | Mỗi khoản trừ được gắn một finding và một hạng mục; không cộng thêm phạt ngoài bảng. |

Không xác lập finding CRITICAL trong lần đọc này; trần 65 do CRITICAL không được kích hoạt. Những rủi ro chỉ có điều kiện, như quyền truy cập Supabase thực tế và output Gemini thật, được ghi rõ giới hạn bằng chứng ở F01, F07 và F16. Điểm notebook là quy ước giữ thang 100 của rubric, không phải bằng chứng về chất lượng ML/notebook.

### Inventory và entrypoint

Inventory đếm 105 file dự án không bị loại trừ. Loại khỏi inventory source: `.git/`, `.venv/`, `node_modules/`, `.next/`, `.cleanup-backups/`, tài liệu tham chiếu `paper/`, PDF và secret local. Không có notebook. Các nhóm code: 29 Python, 4 SQL, 9 TypeScript, 6 TSX, 5 BAT, 1 JS, 1 CJS, 1 MJS, 2 CSS, 1 HTML.

```text
Appota/
├── app.py, api/, web_preview.py       # Streamlit và HTTP Python
├── engine/                           # Snapshot, validation, routing, ACL, floor, graph
├── manage_database.py, database/     # Quản trị SQLite
├── data/, schemas/                   # Seed, CSV, nguồn và JSON Schema
├── frontend/
│   ├── src/app/                      # Entrypoint Next.js và route API
│   ├── src/lib/                      # Rule engine TS, Gemini, Supabase, lịch sử
│   ├── src/components/               # Chat, sidebar, inspector
│   └── scripts/check-chat.cjs         # Test adapter/rule engine TS
├── scripts/, supabase/               # Export và schema/seed PostgreSQL
├── public/                           # UI dùng HTTP Python
├── tests/                            # Unit/integration/UI Python và scenario fixtures
└── run_*.bat, run_tests.py, validate.py, smoke_test.py, benchmark.py
```

Mọi file code đã đọc, số dòng vật lý:

| File | Dòng | File | Dòng |
| --- | ---: | --- | ---: |
| `app.py:1` | 75 | `api/index.py:1` | 95 |
| `web_preview.py:1` | 49 | `manage_database.py:1` | 70 |
| `run_tests.py:1` | 112 | `validate.py:1` | 56 |
| `smoke_test.py:1` | 19 | `benchmark.py:1` | 73 |
| `scripts/export_sqlite_to_supabase.py:1` | 111 | `engine/core.py:1` | 118 |
| `engine/filter.py:1` | 27 | `engine/generator.py:1` | 56 |
| `engine/graph_view.py:1` | 45 | `engine/hierarchy.py:1` | 49 |
| `engine/identity.py:1` | 17 | `engine/knowledge_graph.py:1` | 55 |
| `engine/metadata.py:1` | 172 | `engine/models.py:1` | 91 |
| `engine/semantic_matcher.py:1` | 95 | `engine/snapshot.py:1` | 71 |
| `engine/storage.py:1` | 163 | `engine/tabular.py:1` | 189 |
| `engine/timeline.py:1` | 33 | `engine/trace.py:1` | 11 |
| `tests/test_database.py:1` | 231 | `tests/test_engine.py:1` | 385 |
| `tests/test_runner.py:1` | 139 | `tests/test_ui.py:1` | 90 |
| `tests/test_web.py:1` | 129 | `database/schema.sql:1` | 110 |
| `database/queries.sql:1` | 33 | `supabase/schema.sql:1` | 221 |
| `supabase/seed.sql:1` | 82 | `manage_database.bat:1` | 54 |
| `run_app.bat:1` | 66 | `run_frontend.bat:1` | 45 |
| `run_private_tests.bat:1` | 21 | `run_detailed_tests.bat:1` | 21 |
| `public/app.js:1` | 166 | `public/index.html:1` | 51 |
| `public/styles.css:1` | 1 | `frontend/next.config.ts:1` | 20 |
| `frontend/eslint.config.mjs:1` | 25 | `frontend/scripts/check-chat.cjs:1` | 96 |
| `frontend/src/app/page.tsx:1` | 5 | `frontend/src/app/layout.tsx:1` | 19 |
| `frontend/src/app/globals.css:1` | 35 | `frontend/src/app/api/chat/route.ts:1` | 2 |
| `frontend/src/components/ChatArea.tsx:1` | 242 | `frontend/src/components/ChatClient.tsx:1` | 110 |
| `frontend/src/components/ConversationSidebar.tsx:1` | 45 | `frontend/src/components/InspectorDrawer.tsx:1` | 206 |
| `frontend/src/lib/chat-handler.server.ts:1` | 53 | `frontend/src/lib/conversations.ts:1` | 19 |
| `frontend/src/lib/gemini.server.ts:1` | 36 | `frontend/src/lib/mockData.ts:1` | 52 |
| `frontend/src/lib/policy.server.ts:1` | 163 | `frontend/src/lib/supabase.ts:1` | 44 |
| `frontend/src/types/index.ts:1` | 61 | — | — |

Thứ tự chạy được truy vết từ source, không phải kết quả thực thi trong audit:

1. **Next.js:** `Home()` → `ChatClient` → POST `/api/chat` → `policyAnswer()` → lọc quyền/thời gian/floor/slot → Gemini nếu bật → response → state/localStorage. Bằng chứng: `frontend/src/app/page.tsx:3`, `frontend/src/components/ChatClient.tsx:75`, `frontend/src/app/api/chat/route.ts:1`, `frontend/src/lib/chat-handler.server.ts:33`, `frontend/src/lib/policy.server.ts:99`, `frontend/src/lib/chat-handler.server.ts:36`, `frontend/src/components/ChatClient.tsx:47`.
2. **Streamlit:** đọc SQLite → tái dựng dataset → validation → immutable snapshot → chọn persona/ngày → `answer_query()` → routing → ACL/version/floor → synthesis → graph/trace. Bằng chứng: `app.py:21`, `engine/storage.py:73`, `engine/metadata.py:146`, `app.py:44`, `app.py:60`, `engine/core.py:98`, `engine/core.py:104`.
3. **HTTP Python:** `web_preview.py` phục vụ asset và chuyển `/api` sang handler → JSON seed được cache → `KnowledgeAssistant` → answer/graph. Bằng chứng: `web_preview.py:15`, `api/index.py:16`, `api/index.py:31`, `api/index.py:87`.
4. **Quản trị:** CSV → parse kiểu → validate SQL trong memory → validate semantic → transaction thay dataset và backup; export Supabase là nhánh riêng, đọc SQLite và viết seed SQL. Bằng chứng: `manage_database.py:45`, `engine/tabular.py:148`, `engine/storage.py:57`, `engine/storage.py:106`, `scripts/export_sqlite_to_supabase.py:60`.
5. **Kiểm thử:** unittest discovery và 7 scenario mặc định; 35 private case và 38 detailed case chỉ được chọn ở các launcher riêng. Bằng chứng: `validate.py:28`, `validate.py:33`, `run_tests.py:77`, `run_private_tests.bat:15`, `run_detailed_tests.bat:15`.

## 2. Findings theo mức độ

Các phản ví dụ bên dưới là **truy vết tĩnh** qua nhánh code, không phải log chạy. HIGH không có nghĩa đã quan sát được sự cố trên hệ thống live.

| ID | Mức | File:dòng | Mô tả lỗi | Điểm trừ | Cách sửa |
| --- | --- | --- | --- | ---: | --- |
| F07 | HIGH | `supabase/schema.sql:215`, `supabase/schema.sql:220`, `supabase/seed.sql:48` | Policy SELECT `USING (true)` cho phép mọi row, kể cả tài liệu mẫu Confidential; policy ALL trên chat không ràng buộc người sở hữu. Đây là đường database khác với ACL của rule engine. Quyền GRANT, API expose và dữ liệu live **[không xác minh được]**; không khẳng định đã có rò rỉ dữ liệu thật. | 4 — dữ liệu | Ràng buộc RLS theo principal đã xác thực, scope/role và owner hội thoại; kiểm tra cả view và bảng quan hệ. |
| F01 | HIGH | `frontend/src/lib/gemini.server.ts:33`, `frontend/src/lib/gemini.server.ts:34`, `frontend/src/lib/chat-handler.server.ts:39` | Model output chỉ được kiểm tra có text, `STOP`, độ dài; sau đó thay answer rule engine nhưng giữ citation/trace cũ. Output sai số ngày hoặc tự cấp ngoại lệ vẫn qua điều kiện này. | 4 — logic | Dùng output có cấu trúc, validate claim/status/source với facts; render quyền lợi bằng server và fallback khi không khớp. |
| F06 | HIGH | `frontend/src/lib/policy.server.ts:2`, `frontend/src/lib/policy.server.ts:16`, `frontend/src/lib/policy.server.ts:69`, `engine/metadata.py:146` | TypeScript import JSON trực tiếp, không kiểm tra runtime schema/semantic hoặc `activation_allowed`. Cờ `isSampleDataset` chỉ chặn Gemini ở adapter; rule answer vẫn chạy. Type inference và SHA dataset không thay thế validation. | 3 — dữ liệu | Validate seed trước khi phục vụ, gồm activation, kiểu/đơn vị, lifecycle, uniqueness và tổ chức; dùng cùng hợp đồng với Python. |
| F02 | HIGH | `frontend/src/lib/policy.server.ts:89`, `frontend/src/lib/policy.server.ts:136`, `frontend/src/lib/policy.server.ts:144`, `tests/test_engine.py:318` | Router TS chỉ blacklist vài chủ đề; câu không thuộc nghỉ phép vẫn nhận toàn bộ facts khi không có slot. Alias scope dùng substring nên câu chỉ nhắc liên hệ phòng HR cũng bị coi là yêu cầu đọc scope HR. | 3 — logic | Thêm topic/intent gate và phân biệt scope đích với scope được nhắc; dùng regression cases cho cả hai engine. |
| F03 | HIGH | `frontend/src/lib/policy.server.ts:80`, `frontend/src/lib/policy.server.ts:94`, `frontend/src/lib/policy.server.ts:140`, `frontend/src/components/ChatClient.tsx:76` | Follow-up chỉ kế thừa ngày ISO từ history và một số slot; không kế thừa policy/version đích. Việc chuyển từ ngày lịch sử sang “hiện tại” cũng không được giữ thành context cho lượt sau. | 2 — logic | Lưu context đã resolve gồm ngày, policy/version, slot; cập nhật sau mỗi lượt thay vì tìm lại bằng regex trong text. |
| F04 | HIGH | `engine/semantic_matcher.py:33`, `engine/semantic_matcher.py:38`, `supabase/seed.sql:42`, `supabase/seed.sql:43`, `frontend/src/lib/policy.server.ts:86` | Python tự biến câu hỏi chỉ có năm thành 01/01. Năm 2026 có cả quyền lợi 12 và 14 ngày theo fixture, nên lấy một ngày đầu năm không đại diện cho cả năm. TS lại yêu cầu làm rõ. | 2 — logic | Hỏi ngày cụ thể hoặc trả các khoảng hiệu lực trong năm; thống nhất hai engine. |
| F08 | HIGH | `scripts/export_sqlite_to_supabase.py:64`, `scripts/export_sqlite_to_supabase.py:76`, `scripts/export_sqlite_to_supabase.py:100` | Export đọc từng bảng bằng SELECT độc lập, không mở read transaction giữ snapshot. Khi nguồn đổi giữa các SELECT, seed có thể trộn revision. `ON CONFLICT DO NOTHING` cũng giữ row cũ khi nạp lại thay vì đồng bộ cập nhật. | 2 — dữ liệu | Đọc nguồn trong một snapshot read-only nhất quán; validate dataset và định nghĩa rõ import mới hay upsert có kiểm chứng. |
| F05 | MEDIUM | `engine/semantic_matcher.py:65`, `engine/semantic_matcher.py:67`, `tests/private_test_cases.json:607`, `tests/private_test_cases.json:609` | PT32 kỳ vọng answered cho “Chế độ phép nghỉ thường niên của tôi?”, nhưng topic gate Python không có cụm “phép nghỉ thường niên”; nhánh source trả out_of_scope. | 1 — logic | Bổ sung taxonomy/alias tương ứng và đưa PT32 vào gate bắt buộc. |
| F09 | MEDIUM | `engine/metadata.py:112`, `engine/metadata.py:92`, `engine/snapshot.py:33` | Provenance hash chỉ được so giữa hai khai báo trong metadata; không đọc source để kiểm tra hash, JSON pointer và giá trị trích dẫn. Fingerprint snapshot kiểm tra nội dung dataset, không chứng minh citation khớp nguồn. | 1 — dữ liệu | Có bước verification nguồn riêng; đánh dấu citation đã kiểm chứng hay chỉ khai báo. |
| F10 | MEDIUM | `engine/core.py:53`, `engine/hierarchy.py:28`, `frontend/src/lib/policy.server.ts:68`, `frontend/src/lib/mockData.ts:3` | Business rules và persona được triển khai độc lập ở Python, TS và mockData. Khác biệt year routing và PT32 đã có bằng chứng, không chỉ là rủi ro lý thuyết của copy-paste. | 2 — kiến trúc | Một core/hợp đồng chung hoặc bộ contract tests chung; sinh persona từ cùng nguồn. |
| F11 | MEDIUM | `frontend/src/lib/policy.server.ts:68`, `frontend/src/lib/policy.server.ts:163`, `frontend/src/components/ChatArea.tsx:21`, `frontend/src/components/InspectorDrawer.tsx:16` | `policyAnswer` dài 96 dòng, kết hợp routing, lịch sử, ACL, temporal selection, floor, render, graph và trace. Hai component cũng chứa phần render rất lớn. Khó test từng trách nhiệm riêng. | 2 — kiến trúc | Tách context/intent, policy selection, clause resolution và projection; chia component theo trách nhiệm. |
| F12 | MEDIUM | `frontend/src/components/ChatClient.tsx:41`, `frontend/src/lib/chat-handler.server.ts:41`, `frontend/src/lib/chat-handler.server.ts:50` | Bootstrap nuốt lỗi bằng catch rỗng. Catch server trả thông báo chung nhưng không giữ loại lỗi hay sự kiện vận hành đã sanitize; khó phân biệt lỗi metadata, model, network và bug. | 1 — kiến trúc | Thông báo lỗi bootstrap; ghi error code/request ID đã sanitize, không log query/key. |
| F13 | MEDIUM | `frontend/src/lib/conversations.ts:14`, `frontend/src/lib/conversations.ts:17`, `frontend/src/components/ChatArea.tsx:154`, `frontend/src/components/InspectorDrawer.tsx:139` | Restore chỉ validate id/sender/content của message, không validate citations/graph/trace hoặc ngày thật. Ví dụ `citations` là chuỗi vẫn qua restore, nhưng `.map()` khi render sẽ lỗi. | 1 — kiến trúc | Version và validate toàn bộ schema lịch sử; bỏ phần metadata hỏng và migrate format cũ. |
| F14 | MEDIUM | `run_app.bat:19`, `run_app.bat:39`, `run_app.bat:56`, `run_app.bat:66` | Chọn chạy cả hai nhảy thẳng tới `run_both`, trong khi `APPOTA_PYTHON` chỉ được set trong `run_streamlit`; biến chưa được định nghĩa nếu môi trường ngoài không cung cấp. Script còn luôn exit 0 ở cuối dù nhánh chạy ứng dụng lỗi. | 2 — reproducibility | Khởi tạo/check interpreter trước menu; kiểm tra init/start và trả exit code thực. |
| F17 | MEDIUM | `engine/tabular.py:101`, `engine/tabular.py:111`, `engine/tabular.py:112`, `engine/tabular.py:126` | Với mỗi document lại quét toàn bộ lifecycle_events, supersedes và clauses. Reconstruction có chi phí khoảng O(D×(E+S+C)) trước sorting. | 2 — hiệu năng | Group/index các row theo doc_uid một lần trước khi dựng documents. |
| F19 | MEDIUM | `frontend/src/lib/chat-handler.server.ts:22`, `frontend/src/lib/chat-handler.server.ts:23` | Đọc hết body bằng `req.text()` rồi mới kiểm tra 100.000 byte; giới hạn này không ngăn allocation của body quá lớn trước đó. | 1 — hiệu năng | Giới hạn stream khi đọc, kiểm tra Content-Length hỗ trợ và hủy khi vượt cap. |
| F20 | MEDIUM | `validate.py:28`, `validate.py:33`, `run_tests.py:77`, `tests/test_runner.py:106`, `run_private_tests.bat:15` | Gate mặc định chỉ chạy bộ scenario mặc định; không chạy 35 private và 38 detailed case. PT32 có expectation không khớp source nhưng không bị gate mặc định bắt. | 2 — kiểm thử | Chạy tất cả case suites với tên suite riêng, fixture và report rõ ràng; gate phải fail khi case bắt buộc sai. |
| F21 | MEDIUM | `frontend/scripts/check-chat.cjs:33`, `frontend/scripts/check-chat.cjs:37`, `tests/test_database.py:49`, `tests/test_database.py:53` | Test TS load các hàm server nhưng không kiểm thử ChatClient/restore/abort; test parity hiện tại là Python JSON với Python SQLite, không phải Python với TS. Các mâu thuẫn context/routing không có gate chung. | 1 — kiểm thử | Thêm contract tests dùng chung và test UI Next.js cho lịch sử lỗi, đổi context, request bị hủy. |
| F22 | MEDIUM | `frontend/src/components/ConversationSidebar.tsx:30`, `frontend/src/components/ConversationSidebar.tsx:34`, `frontend/src/lib/supabase.ts:35`, `frontend/src/lib/policy.server.ts:2` | UI gọi trạng thái là “Nguồn dữ liệu: Supabase Live”, trong khi answer đọc JSON. `tableCount` chỉ là số dòng query giới hạn 10, không phải tổng personas. | 2 — naming | Đổi nhãn thành kiểm tra kết nối; hiển thị riêng nguồn chính sách đang dùng; bỏ hoặc tính count đúng nghĩa. |
| F15 | LOW | `run_frontend.bat:22`, `run_app.bat:28`, `frontend/package.json:13`, `frontend/package-lock.json:4` | Launcher dùng `npm install` với semver ranges dù có lockfile. Khi manifest/lock lệch, cài đặt có thể cập nhật lock thay vì fail như `npm ci`. Không khẳng định mọi lần install đều đổi version. | 1 — reproducibility | Dùng `npm ci` và báo lỗi khi lock không khớp. |
| F16 | LOW | `frontend/src/lib/gemini.server.ts:9`, `frontend/src/lib/gemini.server.ts:28`, `frontend/scripts/check-chat.cjs:65`, `frontend/scripts/check-chat.cjs:77` | Model mặc định và adapter live **[không xác minh được]** từ source: test dùng fake key và response model tự tạo. Request/response không có hợp đồng replay theo model version trong bộ kiểm thử. Trừ vì thiếu bằng chứng, không kết luận model mặc định không tồn tại. | 1 — reproducibility | Có smoke/evaluation riêng dùng model hợp lệ, record cấu hình/provider metadata đã sanitize; giữ mock tests cho unit test. |
| F18 | LOW | `engine/storage.py:82`, `engine/storage.py:88`, `app.py:23`, `engine/core.py:46` | `read_dataset` đã compile/validate snapshot nhưng trả raw; caller lại validate/compile. Cache ở Streamlit không bỏ bước validate nằm trong `runtime_data_bytes()` mỗi rerun. | 1 — hiệu năng | Trả hoặc reuse snapshot đã validate; chỉ recompile khi fingerprint thay đổi, vẫn phát hiện direct SQL edit. |
| F23 | LOW | `engine/graph_view.py:28`, `engine/graph_view.py:35`, `frontend/src/components/ConversationSidebar.tsx:27`, `public/styles.css:1` | JS/JSX/CSS có dòng nén rất dài; template graph dùng nhiều tên một ký tự như a/b/g/p. Review lỗi nhánh và diff khó hơn, không phải bằng chứng thuật toán sai. | 1 — readability | Format source, đặt tên theo vai trò và tách template/render helpers. |
| F24 | LOW | `scripts/export_sqlite_to_supabase.py:1`, `scripts/export_sqlite_to_supabase.py:103`, `scripts/export_sqlite_to_supabase.py:107`, `scripts/export_sqlite_to_supabase.py:108` | Docstring nói “verify migration”, nhưng chương trình chỉ tạo SQL rồi in OK; không thực thi/import/read-back PostgreSQL hay so sánh nội dung đích. | 1 — naming | Đổi mô tả đúng phạm vi export hoặc thêm bước verification riêng có bằng chứng. |

### Phản ví dụ quan trọng từ truy vết source

- **F01:** nếu upstream trả text “Bạn có 99 ngày phép năm.”, finishReason STOP và dưới 12.000 ký tự, adapter nhận text này. POST gán text vào answer; citation vẫn đến từ facts 14 ngày. Đây là phản ví dụ với một response giả định, **không phải** khẳng định Gemini live đã trả 99 ngày: `frontend/src/lib/gemini.server.ts:33`, `frontend/src/lib/chat-handler.server.ts:39`, `frontend/src/lib/policy.server.ts:146`, `supabase/seed.sql:55`.
- **F02:** với Lan, ngày `2026-10-14`, query `2+2 bằng bao nhiêu?` không trúng blacklist out-of-scope, không có slot, nên nhánh chọn tất cả facts. Query “Quy định nghỉ phép, sếp nào duyệt trước khi liên hệ phòng Nhân sự?” lại bị alias HR đưa sang refusal, dù Python có regression yêu cầu answered cho đúng câu này: `frontend/src/lib/policy.server.ts:89`, `frontend/src/lib/policy.server.ts:136`, `frontend/src/lib/policy.server.ts:144`, `tests/test_engine.py:318`.
- **F03:** Hùng hỏi đích `POL-B-LV` thì notice là 5 business_days; follow-up “Báo trước bao lâu?” không giữ target từ history và chọn policy Team 10 unspecified_days. Với history có `2026-01-15`, sau lượt “hiện tại” thì lượt tiếp không có ngày ISO vẫn có thể lấy lại mốc cũ: `frontend/src/lib/policy.server.ts:80`, `frontend/src/lib/policy.server.ts:85`, `frontend/src/lib/policy.server.ts:94`, `supabase/seed.sql:59`, `supabase/seed.sql:63`.
- **F04:** “Nghỉ phép năm 2026 bao nhiêu ngày?” ở Python được resolve thành `2026-01-01`; fixture cùng năm đổi từ v1 12 ngày sang v2 14 ngày từ 01/03, nên không thể coi answer đầu năm là answer cho toàn năm: `engine/semantic_matcher.py:38`, `supabase/seed.sql:42`, `supabase/seed.sql:43`, `supabase/seed.sql:53`, `supabase/seed.sql:55`.
- **F05:** normalize PT32 cho text “che do phep nghi thuong nien cua toi?”; không trúng các topic ở dòng 65–66, nên trả out_of_scope trước khi xét entitlement. Expectation fixture là answered/14 ngày: `engine/semantic_matcher.py:18`, `engine/semantic_matcher.py:65`, `engine/semantic_matcher.py:67`, `tests/private_test_cases.json:607`, `tests/private_test_cases.json:617`.

### Checklist bắt buộc

| Mục | Kết quả | Bằng chứng và giới hạn |
| --- | --- | --- |
| Fit scaler/encoder/imputer trước split | Không áp dụng | Các engine là routing/lọc clause, không có bước fit estimator: `engine/core.py:98`, `frontend/src/lib/policy.server.ts:99`. |
| Target encoding không CV | Không áp dụng | Không có target encoding hoặc training target trong luồng; dữ liệu được resolve thành typed claims: `engine/hierarchy.py:28`, `engine/generator.py:28`. |
| Feature chứa thông tin tương lai | Không áp dụng cho ML; có lỗi temporal ở ứng dụng | Không có feature pipeline; chính sách có as-of filtering, nhưng hỏi chỉ có năm bị tự chọn đầu năm ở F04: `engine/timeline.py:13`, `engine/semantic_matcher.py:38`. |
| Stratify train/val/test | Không áp dụng | Test ở đây là scenario oracle, không phải split dataset huấn luyện: `run_tests.py:77`. |
| Shuffle time-series sai cách | Không áp dụng | Không có train time-series; version selection dùng khoảng hiệu lực: `engine/timeline.py:18`. |
| Dùng test set để tune | Không áp dụng cho ML; chưa chứng minh độc lập acceptance | Đây là fixture thủ công; không có pipeline tối ưu hyperparameter. “Private” không chứng minh blind holdout: `tests/test_runner.py:54`, `tests/private_test_cases.json:604`. |
| Metric phù hợp imbalance | Không áp dụng cho classification ML | Oracle kiểm tra từng expectation, không tính metric classification: `run_tests.py:19`, `run_tests.py:54`. Không dùng pass rate fixture để suy ra accuracy với mọi câu tiếng Việt. |
| Baseline/dummy/naive | Không áp dụng cho model huấn luyện; thiếu evaluation Gemini live | Có nhánh rule engine fallback, nhưng mock test không so accuracy/grounding giữa model và baseline trên corpus độc lập: `frontend/src/lib/chat-handler.server.ts:33`, `frontend/scripts/check-chat.cjs:77`. |
| Seed random/numpy/torch/sklearn | Không áp dụng cho core deterministic; Gemini chưa xác minh reproducibility | Clock Python inject được, nhưng request Gemini temperature 0.2 và model được chọn từ env, không phải bằng chứng replay cùng output: `engine/core.py:33`, `tests/test_engine.py:136`, `frontend/src/lib/gemini.server.ts:9`, `frontend/src/lib/gemini.server.ts:28`. UUID là ID, không phải randomness huấn luyện: `frontend/src/lib/conversations.ts:8`. |
| Hard-coded path | Có lỗi phạm vi launcher ở F14; không phải mọi đường dẫn cố định đều lỗi | Path dataset phần lớn neo theo source root; nhánh chạy cả hai dùng biến chưa set: `engine/snapshot.py:12`, `scripts/export_sqlite_to_supabase.py:6`, `run_app.bat:56`. |
| Magic number | Có tham số cố định, chưa có bằng chứng mọi hằng số đều sai | Body 100.000 byte, history 20/6, timeout 25.000ms; lỗi cụ thể là body cap đặt sau đọc ở F19. Không trừ chỉ vì có số: `frontend/src/lib/chat-handler.server.ts:23`, `frontend/src/lib/chat-handler.server.ts:29`, `frontend/src/lib/gemini.server.ts:21`, `frontend/src/lib/gemini.server.ts:22`. |
| Credential/API key lộ trong code | Không tìm thấy trong source đã đọc | Gemini đọc env; template key rỗng; key trong test là fake. Scan các mẫu secret phổ biến không có match, nhưng không phải chứng minh mọi dạng secret đều được phát hiện: `frontend/src/lib/gemini.server.ts:24`, `frontend/.env.example:3`, `frontend/scripts/check-chat.cjs:65`, `.gitignore:6`. Secret local không được đưa vào báo cáo. |
| Notebook execution_count không tăng, cell chết, output sót, import rải rác | Không áp dụng | Inventory không có `.ipynb`; các entrypoint đọc được là script/module: `app.py:39`, `frontend/src/app/page.tsx:3`, `run_tests.py:109`. |
| Copy-paste | Có lỗi kiến trúc F10 | Hai implementation cùng xử lý quyền/version/floor và persona riêng: `engine/core.py:53`, `engine/hierarchy.py:28`, `frontend/src/lib/policy.server.ts:99`, `frontend/src/lib/mockData.ts:3`. |
| Hàm >50 dòng | Có — F11 | policyAnswer 68–163; ChatArea 21–242; InspectorDrawer 16–206. Bằng chứng entrypoint/end của hàm: `frontend/src/lib/policy.server.ts:68`, `frontend/src/lib/policy.server.ts:163`, `frontend/src/components/ChatArea.tsx:21`, `frontend/src/components/InspectorDrawer.tsx:16`. |
| Nesting >3 tầng | Có | Vòng for bảng → with file → for row → try, rồi comprehension parse row: `engine/tabular.py:150`, `engine/tabular.py:152`, `engine/tabular.py:157`, `engine/tabular.py:158`. Không thêm điểm trừ ngoài F11/F23. |
| Biến một ký tự | Có — F23 | Graph renderer dùng a/b/g/p và helper `$`: `engine/graph_view.py:23`, `engine/graph_view.py:35`, `engine/graph_view.py:36`. |
| Silent failure/except trống | Có — F12 | Bootstrap `.catch(() => {})`; generic server catch không lưu diagnostic code: `frontend/src/components/ChatClient.tsx:41`, `frontend/src/lib/chat-handler.server.ts:50`. Rollback rồi re-raise là xử lý đúng, không phải nuốt lỗi: `engine/storage.py:128`. |
| fillna/drop hàng loạt không giải thích | Không áp dụng cho DataFrame | Không có preprocessing DataFrame; restore history có filter loại bản ghi mà chưa có diagnostic theo record: `frontend/src/lib/conversations.ts:14`. Hợp đồng import thay trọn dataset được khai báo và bao transaction: `engine/storage.py:107`, `engine/storage.py:120`. |
| Python loop trên DataFrame/apply thay vectorize | Không áp dụng | Core dùng record/SQL/JSON, không có DataFrame pipeline. Bottleneck thật là quét record lặp ở F17: `engine/tabular.py:101`, `engine/tabular.py:112`. |
| Đọc/validate data nhiều lần | Có — F18 | read_dataset compile rồi caller compile lại; Streamlit vẫn gọi reader trước cache: `engine/storage.py:82`, `app.py:23`, `engine/core.py:46`. |
| Over-claim từ số liệu/nhãn | Có — F22/F24 | Supabase Live không phải nguồn answer; exporter “verify migration” chưa có read-back: `frontend/src/components/ConversationSidebar.tsx:34`, `frontend/src/lib/policy.server.ts:2`, `scripts/export_sqlite_to_supabase.py:1`, `scripts/export_sqlite_to_supabase.py:107`. Benchmark tự ghi rõ warm snapshot, nên không chấm nó như claim latency end-to-end: `benchmark.py:64`. |
| Requirements/env, pin version | Có cấu hình; tồn tại lỗi đường cài F15 | Python direct deps và closure pin/hash; npm có lockfile. Semver range không tự là lỗi khi dùng lock đúng: `requirements.txt:1`, `requirements-dev.txt:2`, `requirements.lock:2`, `frontend/package-lock.json:4`, `frontend/package-lock.json:32`. Launcher dùng install thay ci: `run_frontend.bat:22`. |

## 3. ĐÃ TỐT

- Python validate cả JSON Schema và semantic constraints trước compile; kiểm tra organization chain, lifecycle transition, typed unit và identity clause. Có negative tests sửa ACL, ngày, tổ chức và kiểu dữ liệu: `engine/metadata.py:149`, `engine/metadata.py:159`, `engine/metadata.py:160`, `tests/test_engine.py:175`, `tests/test_engine.py:195`, `tests/test_engine.py:210`.
- Snapshot freeze sâu và giữ một snapshot riêng cho managed request, tránh ghép identity/answer/graph từ hai revision. Có test bất biến và test reload giữa request: `engine/snapshot.py:17`, `engine/core.py:91`, `tests/test_engine.py:271`, `tests/test_engine.py:368`.
- Floor thay toàn bộ effective clause cùng source, không chỉ sửa số trong answer; provenance/graph theo nguồn floor có test kiểm tra: `engine/hierarchy.py:15`, `engine/hierarchy.py:18`, `tests/test_engine.py:81`, `tests/test_engine.py:91`.
- Import SQLite validate trước, kiểm tra round-trip, BEGIN IMMEDIATE, backup và rollback khi lỗi. Test failure injection kiểm tra cả dữ liệu và import_log: `engine/storage.py:108`, `engine/storage.py:111`, `engine/storage.py:116`, `engine/storage.py:128`, `tests/test_database.py:122`.
- Oracle có negative controls: đổi expectation, bỏ citation/claim, thêm dangling edge hoặc node trùng phải bị phát hiện. Đây là kiểm tra độ nhạy của oracle, không chỉ assertion happy path: `tests/test_runner.py:22`, `tests/test_runner.py:36`, `tests/test_runner.py:44`, `tests/test_runner.py:54`.
- Graph Python được dựng từ projection đã lọc, lọc references phiên bản ẩn, và escape payload ngăn đóng thẻ script; có regression test tương ứng: `engine/knowledge_graph.py:24`, `engine/knowledge_graph.py:27`, `engine/graph_view.py:44`, `tests/test_engine.py:71`, `tests/test_engine.py:361`.

## 4. CHƯA TỐT

- Căn cứ trích dẫn có thể đúng nhưng answer model không khớp căn cứ; giao diện vẫn đặt citation ngay dưới text model, khiến người dùng dễ tin nhầm rằng text đã được kiểm chứng: `frontend/src/lib/chat-handler.server.ts:39`, `frontend/src/components/ChatArea.tsx:143`, `frontend/src/components/ChatArea.tsx:151` — F01.
- Cùng câu hỏi đi hai engine có thể được answered, refused hoặc needs_clarification khác nhau; khác biệt scope nhắc HR và câu chỉ có năm có nhánh chứng minh được: `tests/test_engine.py:318`, `frontend/src/lib/policy.server.ts:89`, `engine/semantic_matcher.py:38`, `frontend/src/lib/policy.server.ts:86` — F02/F04/F10.
- History có thể đổi policy/ngày của follow-up mà người dùng chưa yêu cầu đổi: `frontend/src/lib/policy.server.ts:80`, `frontend/src/lib/policy.server.ts:94` — F03.
- App TS có thể trả kết quả với metadata chưa được phép activate, trong khi Python dùng schema fail-closed: `frontend/src/lib/policy.server.ts:16`, `frontend/src/lib/policy.server.ts:68`, `schemas/knowledge_runtime_v2.schema.json:11`, `engine/metadata.py:149` — F06.
- Policy database không sử dụng role/scope/owner để lọc row; việc rule engine từ chối không bảo vệ đường đọc SQL/PostgREST có quyền. Không suy ra đã truy cập được live chỉ từ SQL này: `supabase/schema.sql:215`, `supabase/schema.sql:220`, `engine/filter.py:11` — F07.
- Gate mặc định không kiểm tra requirement đang thất bại tĩnh ở PT32; việc có source test không đồng nghĩa acceptance suite hoàn chỉnh: `validate.py:33`, `tests/private_test_cases.json:607`, `engine/semantic_matcher.py:67` — F05/F20.
- Restore lịch sử giữ metadata không validate, nên record có content hợp lệ nhưng citations sai kiểu có thể làm render lỗi: `frontend/src/lib/conversations.ts:17`, `frontend/src/components/ChatArea.tsx:154` — F13.
- Chưa có bằng chứng live cho default model, model accuracy, Supabase grants/RLS thực tế hoặc latency end-to-end. Các kết quả đó **[không xác minh được]**; source hiện chỉ có mock adapter, SQL khai báo và warm benchmark: `frontend/scripts/check-chat.cjs:77`, `supabase/schema.sql:204`, `benchmark.py:64` — F16 và giới hạn F07.

## 5. ĐÃ TỐI ƯU

- Compile scope regex một lần mỗi snapshot, tái sử dụng qua request; test kiểm tra không gọi compile lại: `engine/semantic_matcher.py:41`, `engine/metadata.py:163`, `tests/test_engine.py:285`.
- Parse ngày metadata thành date khi compile và sort version selection để không phụ thuộc thứ tự document đầu vào; có permutation test: `engine/metadata.py:138`, `engine/timeline.py:33`, `tests/test_engine.py:168`.
- API Python cache một assistant của JSON seed cố định, tránh reload/compile mỗi HTTP request ở adapter này: `api/index.py:16`, `api/index.py:19`. Cache này không giải quyết các lần đọc SQLite của Streamlit ở F18.
- Ghi SQL bằng executemany và bound parameters; có test dữ liệu trông như SQL injection vẫn là dữ liệu: `engine/storage.py:50`, `engine/storage.py:53`, `tests/test_database.py:172`.
- TS chọn facts trước khi gọi model, cắt history user còn 6 câu và đặt deadline 25 giây cho Gemini. Giảm payload outbound và thời gian chờ model, nhưng không thay output validation ở F01: `frontend/src/lib/policy.server.ts:144`, `frontend/src/lib/gemini.server.ts:21`, `frontend/src/lib/gemini.server.ts:22`.

## 6. CHƯA TỐI ƯU

Các ước tính là độ phức tạp từ vòng lặp/luồng dữ liệu, không phải số đo chạy. Không ghi hệ số tăng tốc hoặc latency chưa đo.

| Vị trí | Hiện tại | Nên làm | Lợi ích ước tính |
| --- | --- | --- | --- |
| `engine/tabular.py:101`, `engine/tabular.py:112` | Mỗi document quét mọi event/clause/supersedes. | Index/group theo doc_uid một lần. | Phần grouping từ O(D×(E+C+S)) xuống khoảng O(D+E+C+S); sorting giữ chi phí riêng. |
| `engine/storage.py:82`, `app.py:23` | Validation/compile ở repository rồi lại ở loader. | Reuse validated snapshot theo fingerprint; giữ phát hiện direct SQL edits. | Giảm lần compile/validation trùng; ảnh hưởng latency cụ thể **[không xác minh được]**. |
| `frontend/src/lib/chat-handler.server.ts:22` | Buffer hết request body rồi mới reject. | Reader có cap và abort khi vượt ngưỡng. | Giới hạn memory do app giữ cho request body; overhead framework cần đo riêng. |
| `frontend/src/lib/policy.server.ts:31`, `frontend/src/lib/policy.server.ts:89` | find unit và normalize alias lại theo request. | Compile index unit/persona và alias khi load seed đã validate. | Lookup gần O(1) theo ID; tránh normalize lại các alias cố định. Chưa có điểm trừ riêng ngoài các finding đã ghi. |
| `frontend/src/components/ChatClient.tsx:47`, `frontend/src/components/ChatClient.tsx:61` | Serialize toàn bộ history mỗi lần conversations đổi, không có giới hạn số hội thoại. | Có retention/delete/export và lưu incremental hoặc debounce phù hợp. | Giảm ghi synchronous lớn và rủi ro quota; mức cải thiện cần đo, không cộng thêm điểm trừ. |
| `engine/knowledge_graph.py:14` | Deduplicate edge bằng membership trong list. | Dùng set khóa `(source,target,relation)` cùng list output. | Tránh kiểm tra tuyến tính theo số edge đã có; graph fixture nhỏ nên chưa trừ điểm riêng. |

## 7. Top 10 việc cần sửa (xếp theo điểm thu hồi được)

Điểm lấy lại là điểm trực tiếp của finding được liệt kê, không phải cam kết tổng điểm sau khi triển khai. Các việc cùng điểm ưu tiên theo rủi ro correctness/dữ liệu.

| # | Việc | Điểm lấy lại | Công sức (S/M/L) |
| --- | --- | ---: | --- |
| 1 | Thực thi role/scope/owner trong RLS; audit view và bảng phụ — F07, `supabase/schema.sql:215`. | 4 | L |
| 2 | Validate claim/status/source của output Gemini hoặc render quyền lợi bằng facts — F01, `frontend/src/lib/gemini.server.ts:34`. | 4 | L |
| 3 | Validate seed TypeScript theo runtime/semantic contract trước khi phục vụ — F06, `frontend/src/lib/policy.server.ts:2`. | 3 | M |
| 4 | Topic gate và scope intent đúng, thêm case HR-contact/out-of-scope — F02, `frontend/src/lib/policy.server.ts:89`. | 3 | M |
| 5 | Giữ resolved context policy/version/date cho follow-up — F03, `frontend/src/lib/policy.server.ts:80`. | 2 | M |
| 6 | Export SQLite trong consistent read snapshot; định nghĩa import/upsert — F08, `scripts/export_sqlite_to_supabase.py:76`. | 2 | M |
| 7 | Sửa cách xử lý câu hỏi chỉ có năm và thống nhất hai engine — F04, `engine/semantic_matcher.py:38`. | 2 | M |
| 8 | Chạy private/detailed fixtures trong gate chuẩn — F20, `validate.py:33`. Sửa PT32 riêng mới thu hồi thêm điểm F05. | 2 | S |
| 9 | Khởi tạo interpreter trước menu, kiểm tra init/start và exit code — F14, `run_app.bat:56`. | 2 | S |
| 10 | Group table rows theo doc_uid trước reconstruction — F17, `engine/tabular.py:101`. | 2 | M |

## 8. Phán quyết

**57/100: có lỗi nghiêm trọng về độ tin cậy của kết quả**, rõ nhất là model answer không được đối chiếu lại với citation và câu hỏi thiếu intent có thể nhận facts không liên quan: `frontend/src/lib/chat-handler.server.ts:39`, `frontend/src/lib/policy.server.ts:144`. Backend Python có nền validation, snapshot và transaction tốt hơn, nhưng temporal routing và private acceptance còn mâu thuẫn xác định được từ code/fixture: `engine/metadata.py:146`, `engine/storage.py:106`, `engine/semantic_matcher.py:38`, `tests/private_test_cases.json:607`. Nếu nộp ở trạng thái này, rủi ro lớn nhất là lấy việc gate mặc định chạy các case giới hạn làm bằng chứng cho toàn bộ khả năng ngôn ngữ và hai engine, trong khi default gate không chạy private suite: `validate.py:33`, `frontend/scripts/check-chat.cjs:41`. Nếu dùng với dữ liệu nội bộ thật, phải giải quyết đường RLS không ràng buộc role/owner trước; audit này không xác nhận quyền live hoặc bất kỳ cam kết production nào: `supabase/schema.sql:215`, `supabase/schema.sql:220`.
