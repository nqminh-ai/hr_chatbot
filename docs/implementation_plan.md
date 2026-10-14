# IMPLEMENTATION PLAN — MISSION 2: HIỆN THỰC HÓA (APPOTA INTERNAL KNOWLEDGE MVP)

> Lưu trữ kế hoạch Mission 2 ban đầu, không phải mô tả runtime hiện tại. Xem `implementation_plan_v2.md`, `accuracy_rules_and_graph_architecture.md` và README cho thiết kế/kết quả V2; những nhánh LLM và bảo đảm tuyệt đối bên dưới không phải chức năng đang hoạt động.

> **Mục tiêu**: Xây dựng Prototype/MVP chứng minh phần quan trọng nhất của giải pháp đã thiết kế ở Mission 1:
> **"Câu hỏi + Bối cảnh người dùng → Tìm đúng tri thức → Sử dụng đúng phạm vi → Trả lời có nguồn kiểm chứng."**

---

## 1. Mục tiêu cốt lõi & Giả thuyết cần chứng minh (Core Hypothesis)

* **Giả thuyết cốt lõi**: Kiểm soát quyền truy cập và kế thừa phân cấp tri thức bắt buộc phải do **Rule Engine & Pre-retrieval Filter** quyết định ở tầng dữ liệu, **không phụ thuộc vào LLM Prompt**.
* **Trường hợp bắt buộc**: Cùng câu hỏi *"Quy định nghỉ phép của tôi như thế nào?"*:
  * Nhân sự **Lan** (Cty A/Marketing): Nhận 14 ngày phép (theo `POL-A-LV v2.0`), sàn Tập đoàn.
  * Nhân sự **Hùng** (Cty B/Kỹ thuật/Payments): Nhận 12 ngày phép + báo trước 10 ngày + cấm nghỉ tuần on-call release (kế thừa tổng hợp từ Cty B, PB Kỹ thuật và Nhóm Payments).
  * Nhà thầu **Nam** (Contractor): Từ chối trung tính ("Không tìm thấy thông tin trong phạm vi của bạn").
  * **Lan** hỏi tài liệu Confidential của Lãnh đạo (`POL-A-LV-EXEC`): Từ chối trung tính, không tiết lộ tên tài liệu hay sự tồn tại của tài liệu.

---

## 2. Kiến trúc giải pháp & Tech Stack

### 2.1 Lựa chọn công nghệ
* **Ngôn ngữ**: Python 3.10+
* **Giao diện tương tác kép**:
  * **Interactive Web UI**: `Streamlit` (giao diện chọn nhanh Persona Lan/Hùng/Mai/Nam, gõ câu hỏi, xem luồng filter debug và câu trả lời kèm citation).
  * **Automated CLI Runner**: Script `python run_tests.py` chạy tự động và xuất báo cáo kiểm thử.
* **LLM Engine**:
  * Hỗ trợ Google Gemini API (`gemini-2.5-flash` / `gemini-1.5-flash`) hoặc OpenAI.
  * **Fallback Deterministic Mode (Offline Mock LLM)**: Đảm bảo người chấm bài clone repo về có thể chạy ngay và pass 100% test case mà không bắt buộc phải có API Key.

---

## 3. Cấu trúc thư mục Repository (Chuẩn bị nộp bài)

```
Appota/
├── docs/                       # Tài liệu thiết kế & quy tắc nghiệp vụ
│   ├── implementation_plan.md
│   └── accuracy_rules_and_graph_architecture.md
├── data/                       # Dữ liệu giả lập từ Mission 1
│   ├── organization.json       # Cơ cấu Tập đoàn Alpha -> Cty A, B -> PB -> Team
│   ├── personas.json           # Lan, Hùng, Mai, Nam
│   └── documents.json          # 8 tài liệu giả lập kèm metadata chi tiết
├── engine/                     # Bộ lõi logic nghiệp vụ (Deterministic)
│   ├── identity.py             # Mock SSO/HRM Service
│   ├── filter.py               # Pre-retrieval ACL & Validity Filter
│   ├── hierarchy.py            # Giải quyết ưu tiên điều khoản & Sàn bắt buộc
│   └── generator.py            # LLM Prompt & Fallback Synthesizer
├── tests/                      # Kịch bản kiểm thử
│   ├── test_cases.json         # Danh sách 5+ test cases tiêu chuẩn
│   └── test_runner.py          # Logic đánh giá Kỳ vọng vs Thực tế
├── app.py                      # Streamlit Web App trực quan
├── run_tests.py                # Script chạy tự động bộ kiểm thử
├── requirements.txt            # Danh sách thư viện cần thiết
└── README.md                   # Báo cáo tổng kết Mission 2 + Trả lời 3 câu hỏi bắt buộc
```
