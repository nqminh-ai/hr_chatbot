# Mission 3 — Change Request Intake

**Đề:** B — Tri thức nội bộ Appota  
**Trạng thái:** `B5_ACCEPTED_AND_IMPLEMENTED_LOCALLY`  
**Cập nhật:** 22/10/2026

Ảnh Change Request mới do ứng viên cung cấp đã được đối chiếu. CR chính thức là **B5 — Kiểm chứng nguồn**: “Người dùng muốn biết chính xác câu trả lời dựa trên tài liệu nào và phần nào trong tài liệu hỗ trợ kết luận đó.”

## 1. Thông tin cần nhận

| Trường | Giá trị |
|---|---|
| CR ID | B5 — Kiểm chứng nguồn |
| Yêu cầu nguyên văn | “Người dùng muốn biết chính xác câu trả lời dựa trên tài liệu nào và phần nào trong tài liệu hỗ trợ kết luận đó.” |
| Nguồn xác nhận | Ảnh “Change Request của bạn” do ứng viên cung cấp ngày 22/10/2026 |
| Ngày nhận CR | 22/10/2026 |
| Deadline | 3 ngày từ khi Mission 3 được mở; chưa có timestamp mở trong ba ảnh |

## 2. Acceptance criteria

| ID | Given | When | Then | Test |
|---|---|---|---|---|
| AC1 | Một câu trả lời có một hoặc nhiều kết luận | Hệ thống trả lời từ policy đã resolve | Mỗi claim map đúng một `doc_uid`, `clause_id`, source text và source locator | `test_cr_b5_01_every_claim_maps_to_exact_document_section_and_location` |
| AC2 | Người dùng mở citation từ câu trả lời | Inspector hiển thị căn cứ | Thấy tài liệu, version, mục/điều khoản, khoảng hiệu lực, ngày đối chiếu, file:dòng và JSON pointer | UI test `B5 lets users verify...` |
| AC3 | Citation không có hiệu lực tại ngày trả lời hoặc metadata không nhất quán | Client nhận response | Response bị từ chối trước khi hiển thị, không tạo xác nhận nguồn sai | UI test `rejects a citation...` và parity test |

## 3. Case tái hiện Mission 2

| Trường | Giá trị |
|---|---|
| Baseline commit | `f428463` |
| Persona/scope | Lan — Staff, Công ty A |
| Query | “Quy định nghỉ phép của tôi như thế nào?” |
| Query date | `2026-01-15` |
| Fixture/document versions | `POL-A-LV@v1.0` và policy cấp Group có hiệu lực |
| Actual Mission 2 | Engine có identity/locator nhưng Python thiếu validity/source text; Inspector không hiển thị full validity, query date hoặc locator |
| Expected Mission 3 | Mỗi kết luận truy được đến đúng document version, clause, source text và locator; UI cho người dùng kiểm chứng trong một lần mở citation |

## 4. Impact matrix

| Lớp | Có thay đổi? | File dự kiến | Lý do |
|---|---|---|---|
| Data/schema | Không | `data/knowledge.json`, schema | Metadata B5 đã có trong fixture |
| Python output | Có | `engine/generator.py` | Xuất source text và validity cùng identity/locator |
| Next.js output | Có | `frontend/src/lib/policy-resolution.server.ts` | Dùng cùng canonical citation contract |
| API contract | Có | types, validation, shared contract runners | Chặn identity/temporal metadata sai và kiểm tra parity |
| UI | Có | `InspectorDrawer.tsx`, `ChatClient.tsx` | Hiển thị tài liệu, phần nguồn và ngày đối chiếu rõ ràng |
| Tests/evidence | Có | Mission 3 tests/report | CR test, edge, regression, UI và before/after |

## 5. Quyết định phạm vi

### Sẽ làm

- Canonical citation xuyên suốt Python và Next.js.
- Liên kết claim ↔ citation ↔ trace ↔ graph bằng `clause_id`.
- Hiển thị tài liệu/version, điều khoản, nguyên văn nguồn, hiệu lực và locator trong Inspector.
- Từ chối citation ngoài ngày hiệu lực hoặc sai identity.

### Chủ động chưa làm

- Không xây document viewer/PDF highlighter trong deadline ba ngày.
- Không xây pipeline ingest/approval hoặc SSO.
- Không thêm vector database hay cho LLM tự tạo citation.

## 6. Quality gate để chuyển sang implementation CR

- [x] Có CR ID và yêu cầu nguyên văn.
- [x] Có nguồn chỉ định hợp lệ.
- [x] Acceptance criteria quan sát và kiểm thử được.
- [x] Có case tái hiện trên Mission 2.
- [x] Có quyết định rõ phần làm và không làm.

B5 đã qua quality gate local. Các bước bàn giao còn lại là commit/push, deploy smoke test và video.
