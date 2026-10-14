# AUDIT: Appota Internal Knowledge V2 — 83/100

## 1. Bảng điểm
| Hạng mục | Tối đa | Trừ | Cuối | Lý do trừ điểm chính |
| :--- | :---: | :---: | :---: | :--- |
| 1. Tính đúng đắn logic & phương pháp | 25 | -2 | 23 | Biểu thức Regex bóc tách slot thời gian giả định năm cố định `20\d{2}` (`engine/semantic_matcher.py:33`), gán mặc định ngày đầu năm `01/01` khi chỉ có năm (`engine/semantic_matcher.py:38`), có thể gây lệch thời điểm hiệu lực nếu chính sách ban hành giữa năm. |
| 2. Xử lý dữ liệu & data leakage | 15 | -2 | 13 | Identity và session state hoàn toàn phụ thuộc vào client mockup (`app.py:43-44`), chưa có cơ chế server-side authentication/SSO binding; query raw không lưu persistent audit log (`engine/trace.py:6-11`). |
| 3. Chất lượng code & kiến trúc | 15 | -2 | 13 | Bộ từ khóa slotting và unsupported operations bị hard-code trực tiếp trong module logic thay vì nạp từ schema/metadata cấu hình (`engine/semantic_matcher.py:8-16`). |
| 4. Reproducibility | 12 | 0 | 12 | Có `requirements.lock` kèm full hash SHA-256 cho 43 gói dependency, `.python-version` ghim CPython 3.14, script `validate.py` ghi nhận đầy đủ SHA-256 checksum của source và snapshot. |
| 5. Vệ sinh notebook & mạch trình bày | 10 | 0 | 10 | Repo tuân thủ cấu trúc thuần module Python (`.py`), không tồn tại notebook `.ipynb` rác, không có dead cell hay out-of-order execution. |
| 6. Hiệu năng & tối ưu | 8 | -2 | 6 | `benchmark.py:17-31` sử dụng `copy.deepcopy` toàn bộ snapshot trong vòng lặp tạo 1.000 tài liệu scale, gây lãng phí bộ nhớ và CPU khi benchmark; phép kiểm tra quan hệ cạnh trong đồ thị (`engine/knowledge_graph.py:14`) duyệt mảng `O(E)`. |
| 7. Kiểm thử & xác thực kết quả | 8 | -4 | 4 | Toàn bộ 70 test case và 7 scenario oracle chỉ chạy trên dữ liệu mock tổng hợp (`data/knowledge.json`), thiếu hoàn toàn bài test trên dữ liệu văn bản thực tế (unstructured text/PDF ingest); benchmark tự sinh dữ liệu nhân bản 1 template cố định (`benchmark.py:18-30`). |
| 8. Tài liệu, naming, readability | 7 | -3 | 4 | Sử dụng biến 1 ký tự (`c`, `d`, `e`, `p`, `u`, `n`, `a`, `b`) rải rác trong comprehension và hàm cốt lõi (`engine/knowledge_graph.py:28-36`, `engine/timeline.py:8-9,20-25`, `engine/metadata.py:132-140`); tài liệu README thừa nhận chưa có content-owner xác nhận cho các quyết định M01-M06. |
| **TỔNG CỘNG** | **100** | **-17** | **83** | **Xếp loại: Tốt (75-89), còn lỗi vừa.** |

---

## 2. Findings theo mức độ
| ID | Mức | File:dòng | Mô tả lỗi | Điểm trừ | Cách sửa |
| :--- | :--- | :--- | :--- | :---: | :--- |
| F-01 | **HIGH** | `engine/semantic_matcher.py:33-38` | Phân tích ngày bằng regex giả định năm `20\d{2}` và ép mặc định `date(year, 1, 1)` khi người dùng hỏi năm chung chung (ví dụ: "năm sau 2027"). Nếu chính sách có hiệu lực từ giữa năm (ví dụ: `01/06/2027`), mốc `01/01/2027` sẽ nhận sai phiên bản chính sách. | -2 | Yêu cầu trả về trạng thái `needs_clarification` khi không có ngày cụ thể hoặc cho phép xác định khoảng thời gian (interval overlap) thay vì chọn điểm mốc `01/01`. |
| F-02 | **HIGH** | `tests/test_engine.py:34-386`<br>`run_tests.py:77-86` | Bộ kiểm thử (70 test case, 7 scenario) chỉ chạy trên mock dataset tĩnh nội bộ gồm 8 tài liệu nhân tạo. Không có bài test end-to-end ingest từ văn bản PDF thực tế (`Mission1_Tri_thuc_noi_bo_Appota_BA_report.pdf`). | -4 | Bổ sung integration test kiểm thử pipeline trích xuất văn bản thực tế từ báo cáo BA/PDF sang metadata schema. |
| F-03 | **MEDIUM** | `app.py:43-46` | Mock Persona Chooser hoàn toàn nằm ở client-side input (`st.sidebar.selectbox`). Mặc dù prompt injection trong text query không ghi đè được role, nhưng bất kỳ ai truy cập UI đều có thể chọn tài khoản cấp cao (Executive) để xem dữ liệu mật. | -2 | Tích hợp middleware xác thực session (SSO/JWT token thật), vô hiệu hóa selector trong môi trường production. |
| F-04 | **MEDIUM** | `engine/semantic_matcher.py:8-16` | Danh sách từ khóa phân loại slot (`SLOTS`) và danh sách nghiệp vụ không hỗ trợ (`UNSUPPORTED`) bị hard-code cố định trong file code. Khi có chính sách mới hoặc thuật ngữ mới, phải sửa code engine. | -2 | Chuyển cấu hình từ khóa slotting và taxonomy vào schema/file cấu hình (`data/knowledge.json` hoặc rules config riêng). |
| F-05 | **MEDIUM** | `engine/knowledge_graph.py:13-15` | Hàm kiểm tra trùng lặp cạnh `if edge not in edges: edges.append(edge)` duyệt danh sách tuyến tính `edges` dạng list. Khi quy mô đồ thị lớn (hàng nghìn nút/cạnh), thao tác này có độ phức tạp $O(E^2)$. | -1 | Lưu trữ tập hợp cạnh bằng `set` các tuple `(source, target, relation)` để đạt tra cứu $O(1)$. |
| F-06 | **MEDIUM** | `benchmark.py:17-31` | Hàm sinh dữ liệu scale `scaled_fixture` sử dụng `copy.deepcopy` toàn bộ cấu trúc dữ liệu JSON trong vòng lặp 1.000 lần, gây nghẽn RAM và đo lường không phản ánh đúng chi phí runtime thực tế của engine. | -1 | Xây dựng fixture generator dạng flat/shallow copy hoặc streaming dict template. |
| F-07 | **LOW** | `engine/trace.py:6-11` | Hàm `make_trace` tạo payload hash SHA-256 nhưng chỉ trả về ephemeral dict trong memory kèm response, hoàn toàn không có persistent storage (file log xoay vòng, database hay message queue). | -1 | Tích hợp module logging chuẩn của Python (`logging.handlers.RotatingFileHandler`) hoặc append audit log ra file JSON Lines an toàn. |
| F-08 | **LOW** | `engine/metadata.py:132-142` | Biến 1 ký tự (`c`, `e`) được dùng trong list/generator comprehension của các hàm nghiệp vụ trọng yếu, giảm tính tường minh khi review code. | -1 | Đổi tên biến sang danh từ có nghĩa: `clause_raw`, `event_raw`. |
| F-09 | **LOW** | `engine/timeline.py:8-9, 20-25` | Sử dụng biến 1 ký tự (`e`, `d`) trong biểu thức logic kiểm tra phê duyệt và nhóm tài liệu. | -1 | Đổi thành `event`, `doc`. |
| F-10 | **LOW** | `engine/knowledge_graph.py:26-36` | Sử dụng biến 1 ký tự (`n`, `p`, `g`, `o`, `d`) trong cả backend Python lẫn client JS generator, gây khó khăn cho việc bảo trì. | -1 | Chuẩn hóa đặt tên định danh đầy đủ trong script sinh SVG/HTML. |
| F-11 | **LOW** | `engine/core.py:60-68` | Logic lấy floor document khi có truy vấn policy cụ thể duyệt qua toàn bộ document trong snapshot bằng generator lồng nhau, khó đọc và khó refactor. | -0 | Tách logic trích xuất Floor Policies thành phương thức riêng `_resolve_applicable_floors()`. |
| F-12 | **LOW** | `engine/graph_view.py:44` | Việc escape chuỗi payload JSON vào mã HTML chỉ xử lý ký tự `<, >, &` thủ công, chưa tận dụng chuẩn MIME script block an toàn tuyệt đối. | -0 | Mã hóa base64 payload JSON hoặc sử dụng thư viện templating an toàn (Jinja2 với autoescape). |

---

## 3. ĐÃ TỐT
- **Bảo mật truy cập & Chống rò rỉ (ACL & Zero-Trust Scope)**: Cơ chế kiểm soát quyền đọc và phạm vi áp dụng tài liệu được kiểm soát chặt chẽ tại [`engine/filter.py:11-27`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/engine/filter.py#L11-L27). Tài liệu bí mật (`Confidential`) bắt buộc phải có danh sách `allowed_roles` cụ thể, từ chối trung tính không phân biệt tài liệu mật tồn tại hay không (`engine/filter.py:5-8`, [`tests/test_engine.py:300-304`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/tests/test_engine.py#L300-L304)).
- **Tính toán hiệu lực thời gian phi phụ thuộc thứ tự (As-of Timeline Selection)**: Cơ chế `select_versions` tại [`engine/timeline.py:18-34`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/engine/timeline.py#L18-L34) xác định phiên bản chính sách có hiệu lực dựa trên sự kiện vòng đời (`approved`, `revoked`, `valid_from`, `valid_to`), chủ động phát hiện chồng lấn (overlap) hoặc khoảng trống hiệu lực (gap) và phát sinh ngoại lệ `PolicyConflict` thay vì chọn sai chính sách.
- **Áp dụng sàn pháp lý tối thiểu có bảo toàn truy nguyên (Floor Enforcement & Provenance)**: Thuật toán `_enforce_floor` tại [`engine/hierarchy.py:7-18`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/engine/hierarchy.py#L7-L18) thay thế toàn bộ clause cấp dưới nếu giá trị thấp hơn sàn cấp trên, đồng thời ghi lại vết đè (`overridden`) và đánh dấu nguồn sàn gốc (`claim.source`), ngăn chặn triệt để vi phạm luật lao động hoặc quy định tập đoàn.
- **Dữ liệu Snapshot bất biến (Immutable In-memory Dataset)**: Sử dụng `MappingProxyType`, tuple và `@dataclass(frozen=True)` tại [`engine/snapshot.py:17-23, 60-68`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/engine/snapshot.py#L17-L23) đảm bảo không một thành phần runtime nào có thể sửa đổi dữ liệu chính sách trong quá trình xử lý request ([`tests/test_engine.py:271-278`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/tests/test_engine.py#L271-L278)).
- **Chiếu đồ thị tri thức an toàn ở backend (Authorized Graph Projection)**: Hàm `project_graph` tại [`engine/knowledge_graph.py:8-45`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/engine/knowledge_graph.py#L8-L45) chỉ dựng các node và edge thuộc phạm vi người dùng được phép xem, loại bỏ hoàn toàn metadata hoặc tài liệu ngoài phạm vi trước khi truyền tới UI ([`tests/test_engine.py:58-63`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/tests/test_engine.py#L58-L63)).
- **Xác thực Schema nghiêm ngặt Fail-Closed**: Triển khai `Draft202012Validator` kết hợp kiểm tra toàn vẹn ngữ nghĩa (chu trình tổ chức, thứ tự lifecycle, đơn vị số học, khớp hash SHA-256 nguồn) tại [`engine/metadata.py:28-128, 146-166`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/engine/metadata.py#L28-L128). Mọi vi phạm cấu trúc đều chặn khởi động hệ thống thay vì hoạt động sai lệch.
- **Quản lý phụ thuộc và môi trường nghiêm ngặt**: Cung cấp tệp `requirements.lock` với mã hash SHA-256 độc lập cho từng package bánh đà (wheel), kiểm chứng độc lập trên CPython 3.14 Windows 11 ([`validate.py:34-44`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/validate.py#L34-L44)).

---

## 4. CHƯA TỐT
- **Giả định thời gian cứng nhắc khi người dùng hỏi năm**: Tại [`engine/semantic_matcher.py:33-38`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/engine/semantic_matcher.py#L33-L38), khi câu hỏi chứa năm mà không có ngày tháng (ví dụ: "Năm sau 2027"), mã nguồn tự ép mốc `date(year, 1, 1)`. **Hậu quả**: Nếu một chính sách mới có hiệu lực từ ngày `01/04/2027` hoặc `01/07/2027`, hệ thống sẽ trả lời dựa trên chính sách cũ của ngày đầu năm, gây sai lệch thông tin nghiêm trọng cho nhân viên.
- **Thiếu xác thực thực thể người dùng thực (Identity Spoofing)**: Tại [`app.py:43-46`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/app.py#L43-L46), danh tính nhân viên hoàn toàn phụ thuộc vào việc lựa chọn từ dropdown Streamlit. **Hậu quả**: Bất kỳ người dùng nào trong mạng nội bộ cũng có thể mạo danh lãnh đạo hoặc nhân viên khác để tra cứu thông tin phân quyền.
- **Hard-coded Business Taxonomy**: Các bộ từ khóa regex nhận diện slot (`notice_period`, `approver`, `blackout_period`, `contingency`) và các danh mục chưa hỗ trợ (`bao luu`, `thai san`, `cong don`) được khai báo dạng hằng số Python trong [`engine/semantic_matcher.py:8-16`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/engine/semantic_matcher.py#L8-L16). **Hậu quả**: Khó mở rộng thêm loại chính sách mới (bảo hiểm, công tác phí) mà không làm biến động mã nguồn cốt lõi.
- **Trace Audit Log chỉ tồn tại trong bộ nhớ ngắn hạn**: Module [`engine/trace.py:6-11`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/engine/trace.py#L6-L11) chỉ tính mã băm trace SHA-256 và trả kèm kết quả query. **Hậu quả**: Khi có sự cố tranh chấp lao động hoặc nghi vấn rò rỉ thông tin, đội ngũ bảo mật và HR hoàn toàn không có file log lịch sử để tra soát (non-repudiation / audit trail).
- **Bộ dữ liệu kiểm thử hoàn toàn là Mock Data nhân tạo**: Dù có file `Mission1_Tri_thuc_noi_bo_Appota_BA_report.pdf` trong thư mục gốc, hệ thống hoàn toàn không có module parser văn bản PDF hay bài test đối soát trên văn bản thực tế. **Hậu quả**: Hệ thống chưa chứng minh được khả năng hoạt động khi tài liệu chính sách thực tế phát sinh các định dạng phi cấu trúc.

---

## 5. ĐÃ TỐI ƯU
- **Biên dịch trước biểu thức chính quy phạm vi (Regex Pre-compilation)**: Tại [`engine/semantic_matcher.py:41-50`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/engine/semantic_matcher.py#L41-L50), `compile_scope_patterns` biên dịch trước toàn bộ các alias của đơn vị tổ chức thành `re.Pattern` ngay khi nạp snapshot, tránh việc biên dịch lại regex trên từng truy vấn và tránh vượt giới hạn kích thước cache regex của Python ([`tests/test_engine.py:285-291`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/tests/test_engine.py#L285-L291)).
- **Kiểm soát phiên bản snapshot theo hàm băm nội dung (Content-addressed Caching)**: Tại [`engine/core.py:39-47`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/engine/core.py#L39-L47) và [`app.py:15-17`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/app.py#L15-L17), snapshot chỉ được khởi tạo lại khi mã SHA-256 của tệp dữ liệu hoặc schema thay đổi. Quá trình tra cứu đạt tốc độ xử lý warm-snapshot p50 dưới 0.35 ms ([`docs/evidence/benchmark.json:13`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/docs/evidence/benchmark.json#L13)).
- **Cấu trúc dữ liệu bất biến và tra cứu từ điển $O(1)$**: Toàn bộ danh mục tổ chức, nhân sự và tài liệu được băm thành từ điển tra cứu theo ID duy nhất tại [`engine/metadata.py:21-25, 155-156`](file:///c:/Users/minh4/OneDrive/Desktop/Appota/engine/metadata.py#L21-L25), loại bỏ hoàn toàn các vòng lặp quét tuyến tính $O(N)$ khi tìm quan hệ phân cấp.

---

## 6. CHƯA TỐI ƯU
| Vị trí | Hiện tại | Nên làm | Lợi ích ước tính |
| :--- | :--- | :--- | :--- |
| `engine/knowledge_graph.py:13-15` | `if edge not in edges: edges.append(edge)` duyệt danh sách cạnh $O(E)$. | Dùng `seen_edges = set()` lưu tuple `(source, target, relation)`. | Giảm thời gian dựng đồ thị từ $O(E^2)$ xuống $O(E)$ khi đồ thị mở rộng quy mô. |
| `benchmark.py:17-31` | Dùng `copy.deepcopy(raw)` 1.000 lần để tạo tài liệu mở rộng. | Tạo template chuẩn và nhân bản nông (shallow clone) các trường thay đổi (`doc_uid`, `unit_id`). | Giảm 85% thời gian chạy benchmark và tiết kiệm hàng trăm MB bộ nhớ heap. |
| `engine/core.py:62-67` | Lấy floor policies bằng comprehension lồng nhau qua toàn bộ documents. | Lập chỉ mục sẵn `floor_documents` theo `scope_id` trong `KnowledgeSnapshot`. | Giảm thời gian resolve floor từ $O(D)$ xuống $O(1)$ cho mỗi request. |
| `app.py:33-35` | Xuất file JSON tải xuống bằng cách chạy `json.dumps` trực tiếp mỗi lần render UI. | Cache chuỗi JSON đã xuất hoặc tải trực tiếp payload từ đồ thị backend. | Giảm tải serialize JSON lặp đi lặp lại trong vòng lặp Streamlit. |

---

## 7. Top 10 việc cần sửa (xếp theo điểm thu hồi được)
| # | Việc | Điểm lấy lại | Công sức (S/M/L) |
| :---: | :--- | :---: | :---: |
| 1 | Bổ sung integration test đối soát văn bản thực tế (trích xuất PDF/BA report sang cấu trúc metadata). | +4 | M |
| 2 | Sửa logic phân tích thời gian năm trong `engine/semantic_matcher.py` để không ép cứng mốc `01/01`. | +2 | S |
| 3 | Tách taxonomy nhận diện slotting và unsupported operations ra file cấu hình JSON/YAML độc lập. | +2 | S |
| 4 | Bổ sung module xác thực danh tính phía máy chủ (Session/Header auth token) thay vì selector tự do trên UI. | +2 | M |
| 5 | Tích hợp ghi persistent audit log xoay vòng cho `engine/trace.py` để phục vụ tra soát sau sự cố. | +1 | S |
| 6 | Thay thế việc kiểm tra trùng lặp cạnh bằng `set` trong `engine/knowledge_graph.py`. | +1 | S |
| 7 | Tối ưu hóa bộ sinh dữ liệu mở rộng trong `benchmark.py`, loại bỏ `copy.deepcopy` toàn phần. | +1 | S |
| 8 | Chuẩn hóa danh xưng biến trong `engine/metadata.py`, `timeline.py`, `knowledge_graph.py` (loại bỏ biến 1 ký tự). | +2 | S |
| 9 | Lập chỉ mục sẵn các floor documents trong snapshot để tối ưu hóa truy vấn floor policy. | +1 | S |
| 10 | Đóng gói base64 payload JSON nhúng trong `engine/graph_view.py` để gia tăng mức độ an toàn sandbox. | +1 | S |

---

## 8. Phán quyết
Dự án **Appota Internal Knowledge V2** là một giải pháp xây dựng hệ thống hỏi đáp chính sách nội bộ theo hướng tiếp cận **Deterministic Rule & Knowledge Graph Engine** cực kỳ bài bản, tư duy kiểm soát truy cập phân tầng (RBAC/ABAC) và sàn pháp lý (Floor Enforcement) rất chuẩn mực, vượt trội hoàn toàn so với các kiến trúc RAG/LLM thiếu kiểm soát thường gặp. Mã nguồn tuân thủ nghiêm ngặt tính bất biến của dữ liệu, có kiểm tra fail-closed schema và khóa phụ thuộc đầy đủ bằng mã băm SHA-256.

Tuy nhiên, **nếu đưa hệ thống này vào vận hành thực tế ở trạng thái hiện tại, rủi ro lớn nhất là:**
1. **Lỗ hổng mạo danh danh tính (Identity Spoofing)** do giao diện cho phép tự chọn persona mà không có lớp bảo vệ session/SSO thực tế.
2. **Sai lệch mốc thời gian áp dụng chính sách** khi người dùng hỏi chung chung về một năm tài chính do engine đang ép cứng về ngày `01/01`.
3. **Mất dấu vết kiểm toán (Audit Trail)** do hệ thống chưa lưu vết truy vấn và căn cứ pháp lý xuống bộ lưu trữ bền vững.
Hệ thống đạt **83/100 điểm**, ở mức Tốt nhưng cần xử lý các rủi ro tích hợp trước khi đưa vào môi trường doanh nghiệp.
