# Báo cáo Mission 3 — Cải tiến và kiểm chứng

**Sản phẩm:** Appota Knowledge Copilot  
**Ngày kiểm chứng:** 22/10/2026  
**Phạm vi:** tiếp tục trên sản phẩm Mission 2, không làm lại từ đầu

## 1. Kết luận ngắn

Mission 2 đã có rule engine cho phiên bản tài liệu, phân quyền theo ngữ cảnh, phân giải chính sách đa cấp, từ chối khi thiếu căn cứ, citation, graph và trace. Vì vậy Mission 3 không thay lại lõi đang hoạt động. Phần cải tiến tập trung vào hai khoảng trống có thể chứng minh được:

1. Người dùng trước đây thấy mã tài liệu, phiên bản và ngày bắt đầu hiệu lực, nhưng chưa thấy đầy đủ **khoảng hiệu lực**, **ngày tra cứu được đối chiếu**, và **vị trí nguồn** ngay trong giao diện kiểm chứng.
2. Change Request B5 yêu cầu người dùng biết chính xác câu trả lời dựa trên tài liệu nào và phần nào trong tài liệu hỗ trợ kết luận; Mission 2 có metadata nền nhưng chưa đưa đầy đủ bằng chứng này đến điểm sử dụng.

Kết quả sau cải tiến:

- Inspector hiển thị `doc_uid`, phiên bản, khoảng hiệu lực `[valid_from, valid_to)`, ngày tra cứu đã khớp và `path:line · json_pointer` của nguồn.
- Citation contract Python–TypeScript mang cùng identity, validity window, source text và source locator; response có citation ngoài ngày hiệu lực bị client từ chối.
- Có 4 test Mission 3 riêng, với assertion xác định thay vì chấp nhận nhiều trạng thái mơ hồ.
- Toàn bộ bộ kiểm thử backend và frontend tiếp tục pass; không phát hiện regression trong phạm vi fixture hiện có.

## 2. Change Request B5 — Kiểm chứng nguồn

Ảnh Change Request mới do ứng viên cung cấp ngày 22/10/2026 ghi:

> **B5 — Kiểm chứng nguồn:** Người dùng muốn biết chính xác câu trả lời dựa trên tài liệu nào và phần nào trong tài liệu hỗ trợ kết luận đó.

B5 được chuyển thành ba acceptance criteria:

1. Mỗi claim phải map đến đúng `doc_uid`, `clause_id`, nguyên văn nguồn và source locator.
2. Người dùng mở citation phải thấy tài liệu, version, mục/điều khoản, hiệu lực, ngày đối chiếu và vị trí nguồn.
3. Citation sai identity hoặc không có hiệu lực tại ngày trả lời phải bị từ chối trước khi hiển thị.

## 3. Before → After

| Bước | Trạng thái / quyết định |
|---|---|
| **M2 — Trước cải tiến** | Engine đã chọn phiên bản theo ngày, lọc quyền theo persona/scope, phân giải Group → Company → Department → Team, áp sàn, trả citation/graph/trace. Inspector mới hiển thị `doc_id`, `version`, `valid_from` và nhãn “Nguồn mẫu”. |
| **Vấn đề / yêu cầu mới** | B5 yêu cầu người dùng biết chính xác câu trả lời dựa trên tài liệu nào và phần nào hỗ trợ kết luận. Mission 2 chưa hiển thị full validity, ngày đối chiếu và locator trong Inspector. |
| **Quyết định thay đổi** | Chuẩn hóa citation Python–TypeScript với `doc_uid`, `valid_from`, `valid_to`, source text và source locator; hiển thị khoảng hiệu lực, ngày tra cứu và source locator trong Inspector; chặn response có citation ngoài ngày hiệu lực; thêm test Mission 3. |
| **Quyết định không thay đổi** | Không viết lại temporal/RBAC/hierarchy engine vì các invariant đã có test bao phủ. Không thêm vector DB, document viewer hay agent tự trị vì không cần để đáp ứng B5 trong ba ngày. |
| **M3 — Sau cải tiến** | Người dùng có thể đối chiếu phiên bản + khoảng hiệu lực + ngày tra cứu + vị trí nguồn trên cùng một thẻ citation. Bộ test riêng kiểm tra biên chuyển phiên bản, thiếu người trực thay, khoảng thời gian chưa có chính sách, zero-leakage và kế thừa đa cấp. |
| **Bằng chứng tốt hơn** | CR-B5-01 xác nhận mọi claim/citation/trace/graph cùng trỏ đúng clause; UI test xác nhận tài liệu, phần và locator hiển thị rõ; shared contract xác nhận metadata không lệch giữa hai runtime; negative test từ chối temporal citation sai. |
| **Giới hạn còn lại** | Locator hiện trỏ vào structured fixture, chưa mở trực tiếp file gốc/PDF và highlight đoạn nguồn; persona vẫn là dữ liệu mẫu; chưa kiểm chứng Supabase/Gemini live trong lần chạy này. |

## 4. Đối chiếu 5 yêu cầu cải tiến chung

| Yêu cầu | Cơ chế hiện có | Bằng chứng chính |
|---|---|---|
| Phân biệt phiên bản và thời điểm hiệu lực | `engine/timeline.py`, `frontend/src/lib/policy-resolution.server.ts`; khoảng hiệu lực hiển thị trong Inspector | TEMPORAL-M3-01 kiểm tra trước và đúng mốc chuyển phiên bản |
| Kiểm soát quyền theo bối cảnh | `engine/filter.py`, `readable()` ở frontend; lọc theo role, contract, company/scope | REG-M3-01 kiểm tra contractor không có citation, clause ID hay mã policy |
| Xử lý mâu thuẫn nhiều nguồn/cấp | `engine/hierarchy.py`, floor enforcement và same-level collision; temporal overlap/gap trả `conflict` | Bộ detailed/private/unit regression hiện có |
| Từ chối khi không đủ căn cứ | Các trạng thái `refused`, `insufficient_evidence`, `needs_clarification`, `conflict` | EDG-M3-01 kiểm tra thiếu người trực thay và temporal void |
| Cho người dùng kiểm chứng tài liệu | Citation, graph, trace; Mission 3 thêm canonical identity, validity window, query date và source locator | CR-B5-01 và UI test B5 |

## 5. Bộ kiểm thử Mission 3

File: `tests/test_mission3.py`

1. **CR-B5-01 — exact document, section and locator for every claim**
   - Câu hỏi tổng hợp của Lan tạo nhiều claim.
   - Tập `clause_id` trong claim, citation và trace phải giống nhau; graph phải chứa các clause tương ứng.
   - Citation `POL-A-LV@v1.0#entitlement` phải có identity, source text, validity window và `path:line · json_pointer` chính xác.

2. **EDG-M3-01 — missing evidence + temporal void**
   - Hùng xin nghỉ khi không có người trực thay phải trả chính xác `insufficient_evidence`, vẫn dẫn đúng điều khoản contingency và không xác nhận ngoại lệ.
   - Tra cứu ngày 01/01/2010 phải fail closed với `refused`, không citation và không node document/clause.

3. **REG-M3-01 — Mission 2 regression**
   - Contractor Nam bị từ chối và không lộ mã policy/citation/clause ID.
   - Hùng vẫn nhận 12 ngày phép và báo trước 10 `unspecified_days` theo đúng phân cấp.
   - Clause IDs trong trace phải khớp tập citation; graph không chứa policy Công ty A.

4. **TEMPORAL-M3-01 — approved amendment boundary**
   - Snapshot mô phỏng thêm `POL-A-LV v3.0`, được duyệt ngày 20/10/2026 và có hiệu lực từ 01/11/2026.
   - Ngày 31/10/2026 phải trả 14 ngày từ `v2.0`; ngày 01/11/2026 phải trả 16 ngày từ `v3.0`.

Ngoài ra, UI test B5 mở citation và kiểm tra tài liệu/version, mục, full validity, ngày đối chiếu, “Vị trí nguồn” và “Định danh phần”. Negative UI test từ chối citation chưa có hiệu lực tại `query_date`.

## 6. Kết quả kiểm chứng

Các lệnh được chạy tại workspace local ngày 22/10/2026:

| Lệnh | Kết quả |
|---|---|
| `.\.venv\Scripts\python.exe -B -m unittest discover -s tests -p "test_mission3.py" -v` | 4/4 pass |
| `.\.venv\Scripts\python.exe -B -m unittest discover -s tests -p "test_*.py"` | 119/119 pass |
| `python validate.py` | public 7/7, private 35/35, detailed 38/38, contracts 12/12; tổng 92/92 scenario/contract |
| `npm test` | data/body, contracts, Gemini mock, 40 chat checks, UI/history và PostgreSQL embedded pass |
| `npm run test:ui` | 21/21 pass sau khi thêm test Inspector và invalid temporal citation |
| `npm run lint` | pass |
| `npm run build` | production build pass |

Các con số trên chứng minh regression suite hiện tại pass; chúng không phải cam kết “không thể có lỗi” ngoài fixture và môi trường đã kiểm tra.

### Bằng chứng before/after trên baseline Mission 2

Đối chiếu trực tiếp với commit `f428463`:

| Điểm kiểm chứng | Mission 2 (`f428463`) | Mission 3 hiện tại | Bằng chứng tự động |
|---|---|---|---|
| Citation Python | Có document/clause identity và locator; thiếu source text, `valid_from`, `valid_to` | Có đủ identity, source text, validity window và locator | `CR-B5-01` |
| Citation Next.js | Thiếu `doc_uid`, `valid_to`; `text_source` là text render thay vì nguyên văn nguồn | Cùng canonical metadata với Python | 12/12 shared contracts và 40 chat checks |
| Inspector | Chỉ hiển thị “Hiệu lực từ” và nhãn “Nguồn mẫu” | Hiển thị full validity window, ngày đang đối chiếu và `path:line · json_pointer` | UI test mở citation |
| Temporal citation sai | Client chưa đối chiếu ngày trả lời với khoảng hiệu lực citation | Response bị từ chối trước khi hiển thị | UI negative test |
| Regression | Baseline chức năng Mission 2 | Không đổi kết quả nghiệp vụ ngoài metadata kiểm chứng | 119/119 backend, 92/92 scenario/contracts, 21/21 UI |

Đây đồng thời là before/after trực tiếp cho B5: metadata nguồn đã có một phần ở Mission 2 nhưng chưa kiểm chứng được end-to-end tại điểm sử dụng; Mission 3 đưa bằng chứng canonical đến UI và chặn metadata nguồn sai.

## 7. Trả lời 3 câu hỏi bắt buộc

### 1. Sau khi nhận yêu cầu mới, đã ưu tiên thay đổi gì và chủ động chưa làm gì? Vì sao?

Ưu tiên lớn nhất là B5 tại điểm sử dụng: bảo đảm mỗi kết luận map đến đúng tài liệu/version/điều khoản, rồi hiển thị nguyên văn nguồn, khoảng hiệu lực, ngày tra cứu và vị trí nguồn ngay trong Inspector. Đây là thay đổi tập trung trực tiếp vào câu hỏi: “Kết luận này dựa trên tài liệu nào và phần nào?”

Chủ động không viết lại rule engine, không thêm vector database/document viewer và không giao quyền tạo citation cho LLM. Temporal resolution, RBAC, hierarchy và fail-closed đã tồn tại và có regression coverage; B5 cần đưa provenance sẵn có đến người dùng và kiểm tra tính nhất quán, không cần thay kiến trúc truy hồi.

### 2. Thay đổi nào tạo khác biệt lớn nhất giữa Mission 2 và Mission 3? Bằng chứng nào cho thấy phiên bản mới tốt hơn?

Khác biệt lớn nhất là chuyển provenance từ “metadata kỹ thuật có sẵn” thành “bằng chứng người dùng nhìn thấy và đối chiếu được”. Trước cải tiến, Inspector chỉ cho biết phiên bản và ngày bắt đầu hiệu lực. Sau cải tiến, cùng thẻ citation cho biết identity tài liệu, cả khoảng hiệu lực, ngày truy vấn được xác nhận và vị trí nguồn chi tiết; client từ chối hiển thị nếu citation không có hiệu lực tại ngày trả lời.

Bằng chứng gồm CR-B5-01 kiểm tra claim/citation/trace/graph cùng `clause_id`, UI test tái hiện thao tác mở citation, negative test từ chối temporal citation sai và 12/12 shared contracts so metadata giữa Python–TypeScript. Bộ regression backend/frontend tiếp tục pass sau thay đổi.

### 3. Nếu đưa cho người dùng thật ngày mai, rủi ro hoặc giới hạn lớn nhất là gì? Ưu tiên xử lý thế nào?

Rủi ro lớn nhất của B5 là **tính xác thực của nguồn gốc**: locator hiện trỏ đến JSON fixture, chưa mở file HR gốc bất biến hoặc highlight đúng đoạn trong PDF/DOCX. Người dùng có thể thấy hệ thống trích từ đâu trong dataset nhưng chưa tự xác minh chữ ký/phê duyệt của tài liệu gốc.

Ưu tiên xử lý:

1. Lưu artifact nguồn bất biến với checksum và trạng thái phê duyệt của HR.
2. Cho source locator mở document viewer tại đúng trang/đoạn được highlight.
3. Kiểm tra link, checksum và quyền truy cập trước khi hiển thị citation; fail closed khi artifact không còn khớp.
4. Sau đó mới tích hợp SSO/publishing pipeline và chạy shadow mode với người dùng thật.
