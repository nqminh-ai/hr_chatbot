# Appota Knowledge — Chat

Ứng dụng Next.js có hội thoại nhiều lượt, lịch sử lưu tại trình duyệt, chuyển cuộc trò chuyện và nguồn chính sách theo từng câu trả lời. Dữ liệu hiện vẫn là mẫu từ `../data/knowledge.json`. Nhân sự/ngày áp dụng nằm trong phần Thiết lập tra cứu; đổi bối cảnh mở hội thoại mới.

Chạy local:

```powershell
npm ci
npm run dev
```

Kiểm tra:

```powershell
npm run test:chat
npm run lint
npm run build
```

## Gemini và dữ liệu

Gemini tắt mặc định. Không có key hoặc chưa bật thì ứng dụng trả kết quả đối chiếu điều khoản, hỗ trợ chào hỏi và câu hỏi nối tiếp; đây không phải LLM.

Muốn bật với dữ liệu mẫu, cấu hình server trong `.env.local` hoặc Environment Variables của Vercel:

```dotenv
GEMINI_ENABLED=true
GEMINI_API_KEY=<your-private-api-key>
GEMINI_MODEL=gemini-3.8-flash
```

Không đặt key trong biến `NEXT_PUBLIC_`, không commit `.env.local`. API chỉ gửi câu hỏi, tối đa 6 câu hỏi trước đó và các điều khoản đã được lọc theo bối cảnh, hiệu lực và sàn. Không gửi toàn bộ kho chính sách hay câu trả lời assistant do client cung cấp. API từ chối gọi Gemini nếu metadata dataset không còn là `mock_runtime`.

Giới hạn này không phát hiện được dữ liệu thật được gắn nhãn mẫu, hay thông tin nhạy cảm do người dùng tự nhập. Khi bật Gemini, câu hỏi và ngữ cảnh được gửi sang Google. Không dùng giao diện này với thông tin nội bộ thật trước khi chọn điều kiện xử lý dữ liệu phù hợp. Lịch sử nằm trên trình duyệt hiện tại, chưa có đồng bộ tài khoản hoặc Supabase. Persona chooser là bối cảnh mẫu, không phải cơ chế xác thực.

Khi Gemini lỗi, API trả kết quả đối chiếu cùng thông báo fallback. Trích dẫn được server xác định từ dữ liệu; câu trả lời LLM vẫn cần đánh giá độ chính xác, không có bảo đảm chống hallucination tuyệt đối.

## Vercel

Import repo, đặt Root Directory là `frontend`, Framework là Next.js. Build/install/output dùng mặc định (`npm run build`, `npm ci`, `.next`). Bật Include files outside the Root Directory in the Build Step để Next.js đọc JSON seed ở thư mục cha. Không cần Supabase để chạy bản này.

Key đã lưu ở `.env.local` chỉ dùng trên máy local. Thêm các biến Gemini vào Environment Variables của Vercel cho môi trường deploy và redeploy sau khi đổi biến. Xem [Vercel Environment Variables](https://vercel.com/docs/environment-variables).

Backend Python ở thư mục cha được giữ nguyên; chat Next.js hiện dùng `src/lib/policy.server.ts` và chưa gọi API Python. Schema/seed Supabase và client được giữ cho lần tích hợp tiếp theo. Chi tiết cấu trúc và chạy backend ở [README của project](../README.md).

Nguồn: [Gemini terms](https://ai.google.dev/gemini-api/terms), [Gemini generateContent](https://ai.google.dev/api/generate-content). Fine-tune không phải biện pháp bảo mật; nếu công ty yêu cầu không gửi dữ liệu cho nhà cung cấp ngoài, cần triển khai model trên hạ tầng được công ty kiểm soát.
