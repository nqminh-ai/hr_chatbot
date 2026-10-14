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

Không đặt Gemini API key hoặc service-role key trong biến có tiền tố `NEXT_PUBLIC_`. URL và anon key Supabase không phải thông tin xác thực người dùng; quyền truy cập dữ liệu phụ thuộc vào policy của database.

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

`checkSupabaseConnection()` gọi health RPC với timeout 5 giây và trả mã lỗi trung tính. Sidebar hiển thị **Nguồn trả lời: JSON mẫu** cùng trạng thái kết nối Supabase riêng; không dùng số dòng personas để suy ra nguồn trả lời.

Schema có sẵn `chat_conversations` và `chat_messages`, nhưng ứng dụng chưa ghi vào hai bảng này. `scripts/export_sqlite_to_supabase.py` ở root chỉ tạo lại file seed từ SQLite local, không tự chạy SQL trên Supabase.

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
| `GET /api/chat` | Trả ngày mặc định, trạng thái bật Gemini, personas từ snapshot đã validate, snapshot ID, nguồn JSON và kết nối Supabase. |
| `POST /api/chat` | Đọc body theo stream, giới hạn 100.000 bytes; trả câu trả lời, trạng thái, nguồn, graph, trace, context, request ID và thông báo fallback nếu có. |

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

Lịch sử lưu ở `localStorage` với key `appota-conversations-v2`, envelope `{version: 2, conversations: [...]}`. Có thể đọc v1 cũ sau khi kiểm tra metadata. Hội thoại hỏng bị loại bỏ; graph phải có endpoint hợp lệ, ngày phải tồn tại, dữ liệu có giới hạn kích thước. Không đồng bộ giữa trình duyệt hay thiết bị. Đổi persona hoặc ngày áp dụng mở cuộc trò chuyện mới. Persona selector là bối cảnh mẫu, chưa phải đăng nhập.

## Kiểm tra và xử lý lỗi

Chạy trong `frontend/`:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

`npm test` chạy test dữ liệu, contract, Gemini mock, API, React UI và PostgreSQL nhúng. Test SQL cần Python `.venv` đã cài ở root (hoặc `APPOTA_PYTHON`). Không gọi Gemini/Supabase thật. Smoke test live riêng: `npm.cmd run test:gemini:live`; nó gửi một câu hỏi mẫu, không gửi lịch sử hay dữ liệu nhân sự thật. Kết quả triển khai hiện tại nằm trong [implementation_progress.md](../docs/implementation_progress.md).

| Hiện tượng | Kiểm tra |
| --- | --- |
| Đã lưu key nhưng chưa có câu trả lời Gemini | `GEMINI_ENABLED=true`, key phía server, khởi động lại server; truy vấn phải có điều khoản và không bị từ chối/conflict. |
| Thông báo Gemini fallback | Model ID, quyền của API key, quota và khả năng gọi dịch vụ Google. |
| Sidebar chưa kết nối Supabase | URL project, anon key, RPC `knowledge_health()` và migration đã áp dụng. Chat JSON vẫn hoạt động nếu kiểm tra Supabase thất bại. |
| Vercel không tìm được `knowledge.json` | Root Directory là `frontend`, bật đọc file ngoài root và giữ thư mục `data/` trong repo. |
| Đổi biến Vercel nhưng ứng dụng chưa cập nhật | Tạo deployment mới cho đúng môi trường Production/Preview. |
| PowerShell chặn `npm.ps1` | Dùng `npm.cmd` như các lệnh trong README. |

Xem [README của project](../README.md) để chạy backend Python, quản trị dữ liệu và tìm tài liệu kiến trúc.
