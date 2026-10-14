# Triển khai chatbot Appota trên Vercel

Bản chat hiện dùng Next.js và dữ liệu chính sách mẫu đã commit. API đã thay phần câu trả lời viết sẵn theo persona bằng việc lấy điều khoản đúng phạm vi/ngày, xử lý câu hỏi nối tiếp và tích hợp Gemini tùy chọn.

1. Push source lên GitHub.
2. Trong Vercel, import repo `nqminh-ai/hr_chatbot` và đặt **Root Directory = frontend**, **Framework Preset = Next.js**.
3. Giữ build/install/output mặc định của Next.js. Cho phép build đọc file ngoài Root Directory để lấy `data/knowledge.json` ở thư mục cha.
4. Deploy. Để bật Gemini, thêm `GEMINI_ENABLED=true`, `GEMINI_API_KEY` và tùy chọn `GEMINI_MODEL`, rồi redeploy. API key chỉ ở server, không có tiền tố `NEXT_PUBLIC_`.

Gemini tắt mặc định; chưa có key thì trả lời bằng các điều khoản đã đối chiếu, không giả vờ gọi AI. Khi bật Gemini, câu hỏi, lịch sử câu hỏi gần nhất và điều khoản liên quan được gửi sang Google. Chỉ sử dụng dữ liệu mẫu ở giai đoạn này. Chính sách miễn phí/trả phí khác nhau: xem [Gemini terms](https://ai.google.dev/gemini-api/terms).

Supabase chưa được nối vào chat runtime. Các file SQL/export local là công cụ chuẩn bị riêng; chúng không tự biến dữ liệu mẫu thành dữ liệu thật và không tự lưu lịch sử hội thoại lên Supabase. Hiện lịch sử lưu trong trình duyệt. Xem [frontend/README.md](frontend/README.md) để chạy và kiểm tra local.
