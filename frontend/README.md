# Appota Knowledge — Chat Next.js

Giao diện chat chính của project, dùng Next.js, React và TypeScript. API `/api/chat` đối chiếu chính sách từ `../data/knowledge.json`, hỗ trợ Gemini tùy chọn và kiểm tra kết nối Supabase. Backend Python được giữ ở thư mục cha; Next.js hiện chưa gọi backend này.

## Chạy local

Cần Node.js **20.19+ hoặc 22.12+**; môi trường đã kiểm tra là Node 24. Từ thư mục gốc:

```powershell
cd frontend
npm.cmd ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm.cmd run dev
```

Mở `http://localhost:3000`. Nếu đã lưu API key, giữ nguyên `.env.local`; không sao chép template đè lên file này. Khởi động lại server sau khi đổi biến môi trường.

Để kiểm tra bản production local:

```powershell
npm.cmd run build
npm.cmd run start
```

Vì repository chỉ chứa fixture inactive, production build local ở trên cần đặt `APPOTA_DEMO_MODE=true` trong phiên shell hoặc `.env.local`. Không dùng override này khi thay fixture bằng dữ liệu nhân sự thật; artifact thật phải qua governance gate.

## Biến môi trường

Đặt file `.env.local` ngay trong `frontend/`, cùng cấp với `package.json`. File này được Git bỏ qua. Template nằm tại [.env.example](.env.example).

| Biến | Mục đích |
| --- | --- |
| `GEMINI_ENABLED` | `true` để cho phép gọi Gemini; template mặc định là `false`. |
| `GEMINI_API_KEY` | API key phía server. Có key nhưng chưa bật `GEMINI_ENABLED` thì vẫn dùng rule engine. |
| `GEMINI_MODEL` | Model ID dùng cho Gemini. Mặc định hiện tại trong code/template là `gemini-3.8-flash`; hãy đặt ID mà project Google của bạn có quyền sử dụng. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase, dạng `https://<project-ref>.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key của project Supabase để kiểm tra kết nối. |
| `SUPABASE_SERVICE_ROLE_KEY` | Được dự trù trong template nhưng runtime hiện chưa dùng. Chỉ dùng phía server khi triển khai chức năng cần đến. |
| `APPOTA_DEMO_MODE` | `true` chỉ cho public sample demo. Khi production mà không bật biến này, API fail-closed và yêu cầu trusted identity. |
| `APPOTA_AUTH_MODE` | Production hiện hỗ trợ `trusted-header`. Giá trị khác hoặc để trống làm API trả `503 auth_not_configured`. |
| `APPOTA_AUTH_SECRET` | Secret tối thiểu 32 ký tự, chỉ gateway và server biết; dùng ký HMAC identity, không có tiền tố `NEXT_PUBLIC_`. |
| `APPOTA_RATE_LIMIT_MAX` | Số POST tối đa cho mỗi identity trong một cửa sổ; mặc định 20, giới hạn hợp lệ 1–1000. |
| `APPOTA_RATE_LIMIT_WINDOW_SECONDS` | Độ dài cửa sổ rate limit; mặc định 60 giây, giới hạn hợp lệ 1–3600. |

Không đặt Gemini API key hoặc service-role key trong biến có tiền tố `NEXT_PUBLIC_`. URL và anon key Supabase không phải thông tin xác thực người dùng; quyền truy cập dữ liệu phụ thuộc vào policy của database.

## Xác thực và quota

Local development mặc định chạy demo nếu `NODE_ENV` không phải production và `APPOTA_DEMO_MODE` không được đặt là `false`. Production mặc định fail-closed. Muốn giữ deployment công khai chỉ với dữ liệu mẫu, phải chủ động đặt `APPOTA_DEMO_MODE=true`; chế độ này cho phép chọn mọi persona mẫu và không được dùng với dữ liệu nhân sự thật.

Production dùng một gateway/SSO proxy tin cậy ở trước Next.js. Gateway phải xóa mọi header `x-appota-*` do client gửi, xác thực người dùng, ánh xạ subject sang `user_id` trong dataset rồi thêm:

| Header | Giá trị |
| --- | --- |
| `x-appota-user-id` | User ID chữ thường khớp persona, ví dụ `lan`. |
| `x-appota-auth-timestamp` | Unix time theo giây; server chấp nhận sai lệch tối đa 60 giây. |
| `x-appota-auth-signature` | HMAC-SHA256 dạng base64url với `APPOTA_AUTH_SECRET`. |

Chuỗi ký chính xác là `timestamp + "\\n" + userId + "\\n" + HTTP_METHOD + "\\n" + pathname`. Ví dụ pathname của cả GET và POST chat là `/api/chat`. Server kiểm tra chữ ký constant-time, chỉ trả persona đã xác thực và từ chối `personaId` khác identity. Không đưa `APPOTA_AUTH_SECRET` vào browser hoặc cấu hình `NEXT_PUBLIC_*`.

Rate limiter ứng dụng chạy trước khi đọc body hay gọi Gemini, trả `429`, `Retry-After` và các header `X-RateLimit-*`. Bucket production gắn với identity; demo dùng địa chỉ client. Bucket hiện nằm trong từng process để phòng vệ tại chỗ, vì vậy deployment nhiều instance vẫn phải áp distributed quota ở gateway/API edge.

## Governance activation gate

`data/knowledge.json` là mock fixture và luôn có `activation_allowed=false`. Development được phép nạp fixture inactive; production build/runtime chỉ được nạp nó khi chủ động đặt `APPOTA_DEMO_MODE=true`. Cờ này chỉ dành cho demo mẫu, không biến dữ liệu thành production-approved.

Một artifact thật chỉ được active khi đồng thời có `artifact_kind=policy_runtime`, `activation_allowed=true`, mọi migration decision là `confirmed` kèm owner/evidence, mọi document có `review_state=approved`, lifecycle dùng `authoritative_record` và provenance dùng `authoritative_json`. Loader TypeScript và Python đều fail-closed nếu thiếu bất kỳ điều kiện nào. Với Python, đặt `APPOTA_ENV=production` để tắt mặc định demo; `APPOTA_DEMO_MODE=true` là override có chủ ý cho fixture mẫu.

## Gemini

Gemini chỉ được gọi khi đã bật, có key, truy vấn có điều khoản để đối chiếu và không bị từ chối hoặc conflict. Không có cấu hình Gemini thì API vẫn trả lời bằng kết quả đối chiếu chính sách.

Server gửi câu hỏi hiện tại, tối đa 6 câu hỏi trước đó và các điều khoản đã lọc theo bối cảnh, hiệu lực và sàn chính sách. Nội dung assistant do client gửi và toàn bộ kho chính sách không được chuyển sang model. Adapter hiện chỉ cho phép dataset có `artifact_kind=mock_runtime`.

Model trả JSON theo schema với `status`, `fact_ids` và `style`. Server yêu cầu đúng trạng thái và đủ mọi fact ID đã lọc; output thừa, thiếu, trùng hoặc khác nguồn bị từ chối. Server render câu trả lời từ facts đã xác thực, bao gồm giá trị, đơn vị, ngày và trích dẫn. Model không trực tiếp viết nội dung trả lời.

Khi model, key hoặc dịch vụ có lỗi, API trả kết quả rule engine cùng thông báo fallback. Log server chỉ chứa mã lỗi và `requestId`, không ghi câu hỏi, nội dung HR hay key. `provider=gemini` trong metadata GET cho biết adapter đã bật; provider trên từng câu trả lời cho biết lượt đó có dùng Gemini hay không. `generation.render_mode=verified_facts` áp dụng cho câu trả lời chính sách.

Chọn model theo [danh sách model Gemini](https://ai.google.dev/gemini-api/docs/models). Khi bật Gemini, câu hỏi và ngữ cảnh được gửi sang Google; dùng dữ liệu mẫu cho demo hiện tại.

## Supabase

Supabase hiện phục vụ **kiểm tra kết nối**, chưa thay nguồn chính sách JSON hoặc `localStorage` lưu hội thoại.

1. Chuẩn bị project Supabase dành cho dữ liệu mẫu.
2. Project mới: nạp [schema.sql](../supabase/schema.sql), rồi [seed.sql](../supabase/seed.sql) qua SQL Editor. Database đã có dữ liệu: dùng migration trong [quy trình Supabase](../supabase/README.md).
3. Điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` vào `.env.local` hoặc biến môi trường Vercel.
4. Khởi động lại server hoặc tạo deployment mới; kiểm tra `GET /api/chat` và trạng thái ở sidebar.

Schema mới không tự reset bảng. Corpus, persona và chat đều bật RLS, thu hồi grants của `PUBLIC`, `anon`, `authenticated`; view dùng quyền người gọi. RPC `knowledge_health()` chỉ cho biết dataset có sẵn. Migration giữ dữ liệu và quyền service role; việc áp dụng lên Supabase thật là bước triển khai riêng.

`checkSupabaseConnection()` chỉ gọi RPC `knowledge_health()`, có một timeout tổng 2 giây và không fallback sang bảng corpus/persona đã được bảo vệ. Kết quả được cache 30 giây trong từng process. GET bootstrap chỉ đọc cache đồng bộ rồi dùng `after()` của Next.js để refresh sau khi response hoàn tất, nên tải chat không chờ Supabase; lần đầu có thể hiển thị **Đang kiểm tra**. Sidebar luôn ghi **Nguồn trả lời: JSON mẫu** tách biệt với trạng thái Supabase. Cache này không chia sẻ giữa các instance serverless.

Schema có sẵn `chat_conversations` và `chat_messages`, nhưng ứng dụng chưa ghi vào hai bảng này. `scripts/export_sqlite_to_supabase.py` ở root chỉ tạo lại file seed từ SQLite local, không tự chạy SQL trên Supabase.

## Telemetry vận hành

Các failure bất ngờ của chat, fallback Gemini và health probe Supabase được ghi dưới dạng một JSON object trên mỗi dòng. Schema chỉ gồm `event`, `requestId`, `stage`, `code`, `errorClass`, `elapsedMs`; stage/code là union cố định và tên lớp lỗi được sanitize. Logger không nhận hoặc ghi error message, request body, câu hỏi/lịch sử, URL, persona hay credential. Response chat/bootstrap/health trả `requestId` để đối chiếu log, nhưng repository chưa cấu hình dịch vụ thu thập log bên ngoài.

## Deploy Vercel

Import repo `nqminh-ai/hr_chatbot` và đặt:

| Thiết lập | Giá trị |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | `Next.js` |
| Install Command | Mặc định theo npm lockfile hoặc `npm ci`. |
| Build Command | `npm run build` |
| Output Directory | Mặc định Next.js (`.next`). |
| Include files outside the Root Directory in the Build Step | **Bật** để build đọc `../data/knowledge.json`. |

Cấu hình project nằm trong [vercel.json](vercel.json) và [next.config.ts](next.config.ts). Hướng dẫn này dùng `frontend` làm root, không cần cài Python/Streamlit cho build. Xem [Vercel Build Settings](https://vercel.com/docs/builds/configure-a-build).

Trong **Project Settings → Environment Variables**, thêm biến Gemini/Supabase cho Production và Preview theo nhu cầu. Key local không được đồng bộ qua GitHub. Đổi biến cần deployment mới; `NEXT_PUBLIC_*` phải có ở bước build. Xem [Vercel Environment Variables](https://vercel.com/docs/environment-variables).

## API và lưu trữ

| Endpoint | Vai trò |
| --- | --- |
| `GET /api/chat` | Demo trả các persona mẫu; production chỉ trả persona của identity đã ký, cùng ngày mặc định, provider, snapshot ID, nguồn JSON và trạng thái Supabase. |
| `GET /api/health` | Trả trạng thái cache/probe của RPC `knowledge_health()`; không đọc bảng corpus và không trả dữ liệu policy/persona. |
| `POST /api/chat` | Xác thực và rate-limit trước khi đọc body; production tự bind persona theo identity. Body tối đa 100.000 bytes; response có answer, citation, graph, trace, context và request ID. |

Ví dụ request POST:

```json
{
  "query": "Tôi được nghỉ phép bao nhiêu ngày?",
  "personaId": "lan",
  "date": "2026-10-14",
  "messages": []
}
```

Client gửi lại `context` của response trước để giữ ngày, policy/version và loại điều khoản khi hỏi tiếp. Đề cập “hiện tại” chuyển về ngày hiện tại; câu hỏi chỉ có năm yêu cầu ngày cụ thể.

Trong demo, `personaId` chọn bối cảnh mẫu. Trong production có thể bỏ trường này; nếu gửi thì nó phải trùng identity đã ký, nếu không API trả `403 persona_mismatch`.

Lịch sử lưu ở `localStorage` với key `appota-conversations-v2`, envelope `{version: 2, conversations: [...]}`. Có thể đọc v1 cũ sau khi kiểm tra metadata. Hội thoại hỏng bị loại bỏ; graph phải có endpoint hợp lệ, ngày phải tồn tại, và assistant message có citation phải có `queryDate` nằm trong khoảng hiệu lực nửa mở `[valid_from, valid_to)`. Citation hết hạn, chưa hiệu lực hoặc thiếu metadata hiệu lực làm conversation bị loại trước khi render. Dữ liệu có giới hạn kích thước và không đồng bộ giữa trình duyệt hay thiết bị. Đổi persona hoặc ngày áp dụng mở cuộc trò chuyện mới. Persona selector là bối cảnh mẫu, chưa phải đăng nhập.

## Kiểm tra và xử lý lỗi

Chạy toàn bộ gate trong `frontend/`:

```powershell
npm.cmd run verify
```

Lệnh này chạy Python validation với ngưỡng coverage dòng **80%** cho `engine/*.py`, toàn bộ `npm test` (bao gồm provenance), lint và production build. Nó dừng ở lớp đầu tiên thất bại, không gọi dịch vụ thật, và dùng `APPOTA_DEMO_MODE=true` riêng cho build của fixture demo inactive. GitHub Actions chạy đúng lệnh này cho mọi pull request và push lên `main`.

Để chẩn đoán riêng từng lớp:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

`npm test` và `npm run build` đều chạy `test:provenance`. Kiểm tra này hash byte thật của file nguồn rồi đối chiếu line range, JSON pointer, text, typed value/floor/unit và policy/version; bất kỳ sửa đổi không đồng bộ nào cũng chặn test/build.

`npm test` chạy test dữ liệu, contract, Gemini mock, API, React UI và PostgreSQL nhúng. JSON Schema là nguồn chuẩn khai báo `allowed_roles`, `applies_to`, `audience_roles` như các tập hợp; loader Python và TypeScript cùng canonicalize theo khai báo này. Contract C13 đảo thứ tự role giữa hai version và buộc hai engine trả cùng kết quả. Test telemetry xác nhận correlation/stage/error class/elapsed time và chặn prompt, credential, upstream diagnostics khỏi log. Test SQL cần Python `.venv` đã cài ở root (hoặc `APPOTA_PYTHON`). Không gọi Gemini/Supabase thật. Smoke test live riêng: `npm.cmd run test:gemini:live`; nó gửi một câu hỏi mẫu, không gửi lịch sử hay dữ liệu nhân sự thật. Kết quả triển khai hiện tại nằm trong [implementation_progress.md](../docs/implementation_progress.md).

| Hiện tượng | Kiểm tra |
| --- | --- |
| Đã lưu key nhưng chưa có câu trả lời Gemini | `GEMINI_ENABLED=true`, key phía server, khởi động lại server; truy vấn phải có điều khoản và không bị từ chối/conflict. |
| Thông báo Gemini fallback | Model ID, quyền của API key, quota và khả năng gọi dịch vụ Google. |
| Sidebar chưa kết nối Supabase | URL project, anon key, RPC `knowledge_health()` và migration đã áp dụng. Chat JSON vẫn hoạt động nếu kiểm tra Supabase thất bại. |
| Vercel không tìm được `knowledge.json` | Root Directory là `frontend`, bật đọc file ngoài root và giữ thư mục `data/` trong repo. |
| Đổi biến Vercel nhưng ứng dụng chưa cập nhật | Tạo deployment mới cho đúng môi trường Production/Preview. |
| PowerShell chặn `npm.ps1` | Dùng `npm.cmd` như các lệnh trong README. |

Xem [README của project](../README.md) để chạy backend Python, quản trị dữ liệu và tìm tài liệu kiến trúc.
