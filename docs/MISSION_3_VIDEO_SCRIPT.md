# Kịch bản video Mission 3 — B5 Kiểm chứng nguồn

**Thời lượng mục tiêu:** 4 phút 30 giây, không vượt quá 5 phút  
**Mission 2:** commit `f428463`  
**Mission 3:** commit `cb9e982` hoặc commit mới hơn chứa B5  
**Change Request:** B5 — người dùng muốn biết chính xác câu trả lời dựa trên tài liệu nào và phần nào trong tài liệu hỗ trợ kết luận

## 1. Chuẩn bị trước khi quay

- Mở deployment Mission 2 từ lịch sử Vercel ở một tab, đặt tên tab là `M2 Before`.
- Mở deployment mới nhất ở tab khác, đặt tên tab là `M3 After`.
- Vercel Mission 3 phải có `APPOTA_DEMO_MODE=true` để dùng persona mẫu.
- Ở cả hai bản dùng cùng input:
  - Persona: **Lan**.
  - Ngày tra cứu: **2026-10-14**.
  - Câu hỏi: **“Quy định nghỉ phép của tôi như thế nào?”**
- Mở terminal tại repository và tăng cỡ chữ đủ đọc.
- Chạy trước full gate để chắc chắn video không bị gián đoạn:

```powershell
.\run_mission3_video_tests.bat -Full
```

- Khi quay chỉ cần chạy bản nhanh:

```powershell
.\run_mission3_video_tests.bat
```

## 2. Kịch bản quay và lời nói

### 0:00–0:25 — Mở bài

**Màn hình:** trang Mission 3 hoặc tiêu đề báo cáo.

**Lời nói:**

> Đây là Appota Knowledge Copilot tiếp tục từ MVP Mission 2. Mission 2 đã trả lời chính sách theo người dùng, thời điểm và quyền truy cập. Change Request của Mission 3 là B5 — Kiểm chứng nguồn: người dùng phải biết chính xác kết luận dựa trên tài liệu nào và phần nào trong tài liệu.

### 0:25–1:05 — Before: Mission 2

**Màn hình:** tab `M2 Before` ở commit `f428463`.

**Thao tác:**

1. Chọn Lan và ngày `2026-10-14`.
2. Hỏi: “Quy định nghỉ phép của tôi như thế nào?”
3. Bấm một citation trong câu trả lời.
4. Dừng ở Inspector.

**Lời nói:**

> Ở Mission 2, hệ thống đã có citation và biết document/version. Nhưng tại điểm sử dụng, Inspector mới chủ yếu cho thấy phiên bản và ngày bắt đầu hiệu lực, kèm nhãn nguồn mẫu. Người dùng chưa thấy toàn bộ khoảng hiệu lực, ngày đang được đối chiếu và vị trí chính xác của phần nguồn.

### 1:05–1:30 — Quyết định thay đổi

**Màn hình:** bảng Before → After trong `docs/MISSION_3_REPORT.md`.

**Lời nói:**

> Tôi ưu tiên chuẩn hóa provenance từ engine đến UI: mỗi kết luận phải map đến đúng document version, clause, nguyên văn và source locator. Tôi chủ động không viết lại rule engine, không thêm vector database hoặc document viewer vì chúng không cần thiết để đáp ứng B5 trong ba ngày.

### 1:30–2:35 — After: Mission 3

**Màn hình:** tab `M3 After`.

**Thao tác:**

1. Dùng đúng Lan, ngày và câu hỏi của phần Before.
2. Bấm citation `POL-A-LV`.
3. Trỏ lần lượt vào:
   - tài liệu và version;
   - `Mục: entitlement`;
   - nguyên văn trong dấu ngoặc kép;
   - khoảng hiệu lực;
   - “Có hiệu lực ngày 2026-10-14”;
   - “Vị trí nguồn”;
   - “Định danh phần”.
4. Nếu đủ thời gian, bấm citation của một kết luận khác để chứng minh mỗi kết luận có nguồn riêng.

**Lời nói:**

> Ở Mission 3, cùng một câu hỏi nhưng người dùng kiểm chứng được đầy đủ. Đây là tài liệu và phiên bản, đây là mục hỗ trợ kết luận, đây là nguyên văn, khoảng hiệu lực và ngày truy vấn đã được đối chiếu. Vị trí nguồn cho biết file và dòng; định danh phần cho biết chính xác node trong dữ liệu nguồn. Claim, citation, trace và graph được kiểm tra cùng clause ID.

### 2:35–3:35 — Chạy test bắt buộc

**Màn hình:** terminal.

**Thao tác:**

```powershell
.\run_mission3_video_tests.bat
```

Khi output xuất hiện, chỉ vào:

- `test_cr_b5_01...` — test Change Request.
- `test_edg_m3_01...` — edge case.
- `test_reg_m3_01...` — regression Mission 2.
- Kết quả private scenarios.
- UI acceptance test B5.
- Dòng cuối `MISSION 3 TEST RESULT: PASS`.

**Lời nói:**

> Bộ test Mission 3 có test trực tiếp cho B5, một edge case thiếu căn cứ, một regression test cho quyền và phân cấp cũ, cùng test bổ sung cho biên phiên bản. Private suite và UI acceptance test cũng được chạy trong cùng script. Tất cả đều pass.

### 3:35–4:05 — Bằng chứng tổng thể

**Màn hình:** kết quả full gate đã chạy trước hoặc phần kết quả trong terminal.

**Lời nói:**

> Full gate hiện có 126 Python tests, 93 scenario và contract cases, 35 private scenarios, 91 phần trăm Python coverage, 13 TypeScript contracts, 56 chat checks và 30 UI tests. Provenance tamper checks, lint và production build đều pass. Điều này cho thấy B5 tốt hơn mà không làm hỏng hành vi Mission 2.

### 4:05–4:35 — Giới hạn còn lại

**Màn hình:** Inspector hoặc mục giới hạn trong báo cáo.

**Lời nói:**

> Giới hạn lớn nhất là locator hiện trỏ đến structured fixture, chưa mở trực tiếp tài liệu HR gốc hoặc highlight đúng đoạn PDF hay DOCX. Nếu đưa cho người dùng thật, ưu tiên tiếp theo là lưu artifact nguồn bất biến có checksum và approval, rồi mở document viewer tại đúng trang và đoạn được trích dẫn.

### 4:35–4:45 — Kết thúc

**Lời nói:**

> Tóm lại, Mission 3 không tăng số lượng tính năng; thay đổi chính là biến citation kỹ thuật thành bằng chứng người dùng có thể tự kiểm chứng, đồng thời giữ nguyên các regression quan trọng của Mission 2.

## 3. Ba câu trả lời bắt buộc — bản ngắn để đọc

### Câu 1

> Tôi ưu tiên B5 tại điểm sử dụng: chuẩn hóa mối liên kết từ kết luận đến document, version, clause và locator, rồi hiển thị nó trong Inspector. Tôi không viết lại rule engine, không thêm vector database hoặc document viewer vì các phần đó không cần để đáp ứng Change Request trong ba ngày và sẽ làm tăng rủi ro regression.

### Câu 2

> Khác biệt lớn nhất là provenance chuyển từ metadata kỹ thuật thành bằng chứng người dùng nhìn thấy và đối chiếu được. Bằng chứng là test B5 xác nhận claim, citation, trace và graph cùng clause ID; UI test xác nhận các trường nguồn hiển thị; contract test bảo đảm Python và Next.js không lệch; toàn bộ regression tiếp tục pass.

### Câu 3

> Rủi ro lớn nhất là source locator hiện mới trỏ vào fixture, chưa chứng minh trực tiếp artifact HR gốc đã được phê duyệt. Tôi sẽ ưu tiên lưu tài liệu nguồn bất biến với checksum và approval, rồi cho phép mở đúng trang và highlight đúng đoạn; nếu checksum hoặc quyền không khớp thì fail closed.

## 4. Checklist trước khi nộp

- [ ] Video không quá 5 phút.
- [ ] Before và After dùng cùng persona, ngày và câu hỏi.
- [ ] Có thao tác mở citation, không chỉ nói bằng slide.
- [ ] Có dòng test B5, edge, regression và private test pass.
- [ ] Không quay `.env.local`, API key hoặc dashboard chứa secret.
- [ ] Nêu rõ fixture/mock và giới hạn document viewer.
- [ ] Link GitHub, Vercel và video cùng trỏ đến phiên bản Mission 3 cuối.
