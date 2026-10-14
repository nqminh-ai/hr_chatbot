# Appota Knowledge — Chat Next.js

Giao diện chat chính của project, dùng Next.js, React và TypeScript. API `/api/chat` đối chiếu chính sách từ `../data/knowledge.json`, hỗ trợ Gemini tùy chọn và kiểm tra kết nối Supabase. Backend Python được giữ ở thư mục cha; Next.js hiện chưa gọi backend này.

## Chạy local

Cần Node.js từ **20.9.0** trở lên. Từ thư mục gốc:

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

Khi model, key hoặc dịch vụ có lỗi, API trả kết quả rule engine cùng thông báo fallback. Trích dẫn do server xác định từ dữ liệu. `provider=gemini` trong metadata chỉ cho biết adapter đã bật; provider trên từng câu trả lời mới cho biết lượt đó có dùng Gemini hay không.

Chọn model theo [danh sách model Gemini](https://ai.google.dev/gemini-api/docs/models). Khi bật Gemini, câu hỏi và ngữ cảnh được gửi sang Google; dùng dữ liệu mẫu cho demo hiện tại.

## Supabase

Supabase hiện phục vụ **kiểm tra kết nối**, chưa thay nguồn chính sách JSON hoặc `localStorage` lưu hội thoại.

1. Chuẩn bị project Supabase dành cho dữ liệu mẫu.
2. Nạp [schema.sql](../supabase/schema.sql), rồi [seed.sql](../supabase/seed.sql) qua SQL Editor.
3. Điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` vào `.env.local` hoặc biến môi trường Vercel.
4. Khởi động lại server hoặc tạo deployment mới; kiểm tra `GET /api/chat` và trạng thái ở sidebar.

**`schema.sql` có lệnh DROP TABLE/VIEW:** chạy lại sẽ xóa các bảng cùng tên và dữ liệu đang có. Dùng trên project demo mới hoặc sau khi đã backup. Policy hiện cho phép đọc công khai các bảng chính sách/persona và toàn quyền trên các bảng chat; cần thiết kế lại phân quyền trước khi dùng dữ liệu thật.

`checkSupabaseConnection()` truy vấn tối đa 10 `user_id` trong bảng `personas`. Nhãn **Supabase Live** xác nhận truy vấn này thành công; số personas hiển thị là số dòng trả về trong giới hạn đó, không phải tổng số nhân sự. Nhãn này không có nghĩa câu trả lời đã chuyển sang đọc Supabase.

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
| `GET /api/chat` | Trả ngày mặc định, trạng thái bật Gemini, cờ dữ liệu mẫu và kết quả kiểm tra kết nối Supabase. |
| `POST /api/chat` | Nhận câu hỏi/bối cảnh/lịch sử và trả câu trả lời, trạng thái, nguồn, graph, trace, provider và thông báo fallback nếu có. |

Ví dụ request POST:

```json
{
  "query": "Tôi được nghỉ phép bao nhiêu ngày?",
  "personaId": "lan",
  "date": "2026-10-14",
  "messages": []
}
```

Lịch sử lưu ở `localStorage` với key `appota-conversations-v1`, không đồng bộ giữa trình duyệt hay thiết bị. Đổi persona hoặc ngày áp dụng mở cuộc trò chuyện mới. Persona selector là bối cảnh mẫu, chưa phải đăng nhập.

## Kiểm tra và xử lý lỗi

Chạy trong `frontend/`:

```powershell
npm.cmd run test:chat
npm.cmd run lint
npm.cmd run build
```

Test chat mock lời gọi Gemini; kết quả pass không xác nhận key, model hoặc kết nối Supabase thật.

| Hiện tượng | Kiểm tra |
| --- | --- |
| Đã lưu key nhưng chưa có câu trả lời Gemini | `GEMINI_ENABLED=true`, key phía server, khởi động lại server; truy vấn phải có điều khoản và không bị từ chối/conflict. |
| Thông báo Gemini fallback | Model ID, quyền của API key, quota và khả năng gọi dịch vụ Google. |
| Sidebar báo lỗi Supabase | URL project, anon key, bảng `personas` đã nạp và policy SELECT. Chat JSON vẫn hoạt động nếu kiểm tra Supabase thất bại. |
| Vercel không tìm được `knowledge.json` | Root Directory là `frontend`, bật đọc file ngoài root và giữ thư mục `data/` trong repo. |
| Đổi biến Vercel nhưng ứng dụng chưa cập nhật | Tạo deployment mới cho đúng môi trường Production/Preview. |
| PowerShell chặn `npm.ps1` | Dùng `npm.cmd` như các lệnh trong README. |

Xem [README của project](../README.md) để chạy backend Python, quản trị dữ liệu và tìm tài liệu kiến trúc.
