# Kế hoạch hoàn thiện Mission 3 trong 3 ngày

**Sản phẩm:** Appota Knowledge Copilot  
**Đề:** B — Tri thức nội bộ Appota  
**Ngày lập:** 22/10/2026  
**Nguyên tắc:** tiếp tục từ MVP Mission 2, chỉ thay đổi phần cần thiết để xử lý yêu cầu mới và chứng minh kết quả

## 1. Mục tiêu bàn giao

Trong ba ngày, hoàn thiện một phiên bản Mission 3 có thể chứng minh đầy đủ chuỗi:

`Mission 2 → yêu cầu mới → quyết định phạm vi → cải tiến → kiểm chứng → giới hạn còn lại`

Phiên bản bàn giao phải:

1. Xử lý đúng Change Request B1–B5 được reviewer hoặc hệ thống chỉ định.
2. Tiếp tục đáp ứng yêu cầu chung của Đề B: loại tri thức, phiên bản và hiệu lực, xung đột đa cấp, phân quyền, từ chối khi thiếu dữ liệu và kiểm chứng nguồn.
3. Chạy lại các test quan trọng của Mission 2.
4. Có ít nhất ba test Mission 3: một test trực tiếp cho CR, một edge case và một regression test.
5. Có bằng chứng before/after trên cùng dữ liệu, cùng câu hỏi và cùng tiêu chí đánh giá.
6. Có repository cập nhật, link chạy thử, video tối đa năm phút và báo cáo trả lời ba câu hỏi bắt buộc.

## 2. Trạng thái xuất phát đã kiểm tra

### Baseline Mission 2

- Commit đang làm mốc trước cải tiến: `f428463`.
- Engine đã có lựa chọn phiên bản theo ngày, phân quyền persona/scope, phân giải chính sách đa cấp, trạng thái fail-closed, citation, graph và trace.
- Next.js là bản demo chính; Python là rule engine và bộ kiểm thử đối chiếu.

### Phần Mission 3 đang làm dở

- Citation UI đã được bổ sung `valid_to`, ngày tra cứu và source locator.
- Đã có ba test Mission 3 mô phỏng readiness, edge case và regression.
- Kết quả kiểm tra gần nhất trên worktree hiện tại:
  - Backend: 119/119 test pass bằng test discovery.
  - Frontend UI: 21/21 test pass.
  - Shared scenario/contracts: 92/92 pass.
  - Chat checks: 40/40 pass với Gemini được mock.
  - Lint: pass.
  - Production build: pass.

Các kết quả trên hiện bao gồm bằng chứng cho B5. Test `CR-B5-01` bám đúng yêu cầu kiểm chứng nguồn; test amendment chỉ là coverage bổ sung cho temporal boundary.

## 3. Cổng đầu vào bắt buộc: chốt Change Request

B5 — Kiểm chứng nguồn đã được nhận ngày 22/10/2026 và ghi đầy đủ tại `docs/MISSION_3_CR_INTAKE.md`. Quy trình chuẩn dùng bảng sau:

| Trường | Nội dung cần chốt |
|---|---|
| `cr_id` | B1, B2, B3, B4 hoặc B5 |
| Nguồn | Reviewer hoặc hệ thống đã chọn |
| Yêu cầu nguyên văn | Không rút gọn làm mất điều kiện |
| Hành vi hiện tại | Kết quả Mission 2 trên case tái hiện |
| Hành vi mong muốn | Kết quả quan sát được sau cải tiến |
| Dữ liệu kiểm thử | Persona, tài liệu, version, scope và query date |
| Tiêu chí chấp nhận | Mỗi tiêu chí phải có assertion/test tương ứng |
| Ngoài phạm vi | Việc hữu ích nhưng không cần để đạt CR |

Gate này đã hoàn thành cho B5: có yêu cầu nguyên văn, ba acceptance criteria, case Mission 2 và impact matrix.

## 4. Quyết định phạm vi

### P0 — bắt buộc

- Một vertical slice cho CR thật, đi xuyên qua đúng các lớp bị ảnh hưởng: dữ liệu → rule/contract → API → UI → test.
- Khả năng kiểm chứng tại điểm sử dụng: tài liệu, phiên bản, khoảng hiệu lực, ngày đối chiếu, điều khoản và vị trí nguồn.
- Fail-closed khi thiếu dữ liệu, không có phiên bản hiệu lực, không đủ quyền hoặc có xung đột không thể phân giải.
- Zero-leakage trên answer, citation, graph, trace và error response.
- Bộ test CR/edge/regression và full regression Mission 2.
- Bằng chứng before/after tái lập được.

### P1 — chỉ làm nếu trực tiếp hỗ trợ CR

- Thông báo làm rõ có cấu trúc.
- Nhãn trạng thái tài liệu hiện hành/lịch sử/hết hiệu lực.
- Copy trace ID hoặc source locator.
- Thêm fixture nhỏ để tái hiện CR.

### Chủ động chưa làm trong Mission 3

- Không tích hợp SSO/HRIS thật.
- Không xây pipeline ingest và approval hoàn chỉnh.
- Không hợp nhất toàn bộ JSON, SQLite và Supabase thành một runtime mới.
- Không thêm vector database, autonomous agent hoặc mở rộng quyền quyết định của LLM.
- Không làm dashboard vận hành, load test production hoặc kế hoạch Mission 4.

Các hạng mục trên có giá trị cho production nhưng không nên lấy thời gian khỏi CR, kiểm thử và bằng chứng trong deadline ba ngày.

## 5. Kế hoạch thực hiện theo ba ngày

### Ngày 1 — Chốt yêu cầu và tạo baseline

**Buổi sáng**

1. Ghi nhận nguyên văn CR và hoàn thành bảng intake ở Mục 3.
2. Chuyển CR thành 2–5 acceptance criteria quan sát được.
3. Chạy case tái hiện trên commit Mission 2 và lưu output before.
4. Lập impact matrix cho data, Python engine, Next.js API, UI và tài liệu.

**Buổi chiều**

1. Viết test CR để nó thất bại đúng vì hành vi còn thiếu.
2. Chốt edge case gần nhất với failure mode của CR.
3. Chọn một invariant Mission 2 làm regression guard.
4. Chốt thiết kế tối thiểu và danh sách việc chủ động không làm.

**Đầu ra cuối Ngày 1**

- CR intake và acceptance matrix.
- Fixture tái hiện tối thiểu.
- Output/screenshot before.
- Ba test mục tiêu đã được định nghĩa; test CR đang fail vì lý do mong đợi.
- Phạm vi code được khóa, không còn hạng mục “nice to have” chen vào P0.

### Ngày 2 — Cải tiến và kiểm thử theo lát cắt

**Buổi sáng**

1. Cập nhật data/schema/contract nếu CR cần metadata mới.
2. Cập nhật rule engine hoặc policy resolver.
3. Bảo đảm quyết định về quyền, version và conflict vẫn nằm ở logic xác định; LLM không tự tạo fact.

**Buổi chiều**

1. Truyền kết quả qua API/type/validation đến UI.
2. Hoàn thiện trạng thái hiển thị và khả năng mở nguồn kiểm chứng.
3. Làm cho test CR và edge case pass.
4. Chạy test khu vực sau mỗi thay đổi, sau đó chạy regression backend và UI.

**Đầu ra cuối Ngày 2**

- CR hoạt động end-to-end trên demo local.
- Tối thiểu ba test bắt buộc pass.
- Không có citation hoặc trace lệch clause ID.
- Không có dữ liệu ngoài quyền xuất hiện trong mọi nhánh response.
- Có output/screenshot after trên đúng case của Ngày 1.

### Ngày 3 — Chứng minh, đóng gói và bàn giao

**Buổi sáng**

1. Chạy toàn bộ unit, scenario, contract, UI, lint và production build.
2. Chạy bộ before/after trên cùng case set và tổng hợp số liệu.
3. Sửa lỗi regression; không mở thêm feature mới sau quality gate.
4. Kiểm tra deploy mới bằng smoke test trên URL công khai.

**Buổi chiều**

1. Hoàn thiện báo cáo Mission 3 và ba câu trả lời bắt buộc.
2. Ghi rõ fixture/mock/live, giới hạn và rủi ro còn lại.
3. Quay video tối đa năm phút theo kịch bản ở Mục 9.
4. Kiểm tra repository sạch, không có secret; giữ commit history Mission 2.
5. Chốt link GitHub, commit Mission 3, link demo và link video.

**Đầu ra cuối Ngày 3**

- Code và test đã commit.
- Full regression pass hoặc có giải thích rõ cho bất kỳ sai khác nào.
- Evidence before/after có thể tái lập.
- Demo URL hoạt động.
- Video ≤ 5 phút.
- Báo cáo và ba câu trả lời bắt buộc hoàn chỉnh.

## 6. Ma trận kiểm thử tối thiểu

| Nhóm | Mục tiêu | Assertion bắt buộc |
|---|---|---|
| CR | Chứng minh hành vi mới được yêu cầu | Đúng status, fact/value, source, version, scope và ngày hiệu lực theo acceptance criteria |
| Edge | Tấn công điểm dễ bịa hoặc rò rỉ nhất của CR | Fail closed; không tự tạo fact; không lộ policy/clause ngoài quyền |
| Regression | Giữ invariant quan trọng của Mission 2 | Kết quả nghiệp vụ và provenance cũ không đổi ngoài phần được CR yêu cầu |

Ngoài ba test bắt buộc, cần giữ các lớp kiểm tra hiện có:

- Temporal gap/overlap và mốc `[valid_from, valid_to)`.
- Xung đột cùng cấp và kế thừa Group → Company → Department → Team.
- Persona không tồn tại, contractor và truy cập chéo công ty.
- Thiếu evidence và câu hỏi ngoài corpus.
- Đồng nhất citation ↔ graph ↔ trace.
- Validation dữ liệu lưu trong lịch sử hội thoại.

Lệnh test riêng Mission 3 phải dùng discovery vì `tests` hiện không phải Python package:

```powershell
python -m unittest discover -s tests -p "test_mission3.py" -v
```

Không ghi `python -m unittest tests.test_mission3 -v` vào evidence vì lệnh đó hiện không import được module.

## 7. Phương pháp chứng minh before/after

Không dùng “nhiều test hơn” làm bằng chứng duy nhất. Chạy cùng một case set trên:

- **Before:** commit Mission 2 `f428463`.
- **After:** commit Mission 3 cuối cùng.

Case set gồm case chính của CR, edge case và regression case. Với mỗi case ghi:

| Trường | Before | After |
|---|---|---|
| Input/persona/query date | Giống nhau | Giống nhau |
| Status | Kết quả M2 | Kết quả M3 |
| Fact/decision | Có đúng căn cứ hay không | Có đúng acceptance criteria hay không |
| Source/version | Có kiểm chứng được hay không | Tài liệu, version, hiệu lực và locator |
| Leakage/hallucination | Có/không | Có/không |
| Thời gian kiểm chứng | Số thao tác hoặc thời gian đo | Cùng phương pháp đo |

Chỉ kết luận “tốt hơn” trên tiêu chí có dữ liệu thực tế. Không dùng các từ “hoàn hảo”, “100% an toàn” hoặc suy rộng ngoài fixture đã kiểm tra.

## 8. Quality gates và Definition of Done

Mission 3 chỉ được coi là hoàn thành khi:

- CR thật và acceptance criteria xuất hiện trong báo cáo.
- Có test trực tiếp cho CR, một edge case và một regression test.
- Các test quan trọng Mission 2 pass.
- Frontend test, lint và production build pass.
- Before/after dùng cùng input và có kết quả lưu lại.
- Người dùng có thể mở và đối chiếu nguồn của câu trả lời.
- Nhánh thiếu dữ liệu/xung đột/không đủ quyền không bịa fact.
- Báo cáo phân biệt rõ mock, fixture và kiểm chứng live.
- Ba câu hỏi bắt buộc được trả lời bằng quyết định và bằng chứng cụ thể.
- Repository không chứa secret, file môi trường hoặc dữ liệu cá nhân thật.
- Link demo đã smoke-test sau deploy và video không quá năm phút.

## 9. Kịch bản video tối đa năm phút

1. **0:00–0:30 — Bối cảnh:** Mission 2 làm được gì và CR mới là gì.
2. **0:30–1:10 — Before:** tái hiện đúng case Mission 2 chưa xử lý đạt yêu cầu.
3. **1:10–1:40 — Quyết định:** nói rõ ưu tiên thay đổi và phần chủ động không làm.
4. **1:40–3:10 — After:** chạy case sau cải tiến, mở citation/Inspector và kiểm chứng nguồn.
5. **3:10–4:10 — Evidence:** chạy ba test Mission 3 và chỉ ra full regression.
6. **4:10–4:45 — Kết luận:** số liệu before/after và vì sao tốt hơn.
7. **4:45–5:00 — Giới hạn:** rủi ro lớn nhất còn lại và bước ưu tiên tiếp theo.

## 10. Hồ sơ nộp bài

- Repository GitHub tiếp tục từ Mission 2 và giữ commit history.
- Link bản chạy thử Mission 3.
- Video cải tiến tối đa năm phút.
- Bộ kiểm thử cập nhật và hướng dẫn chạy lại.
- Báo cáo Mission 3 gồm:
  - trạng thái Mission 2;
  - yêu cầu mới/CR;
  - quyết định làm và không làm;
  - sản phẩm Mission 3;
  - bằng chứng before/after;
  - giới hạn còn lại;
  - ba câu trả lời bắt buộc.

## 11. Rủi ro cần theo dõi hằng ngày

| Rủi ro | Ứng xử |
|---|---|
| Chưa có CR thật | Escalate ngay; vẫn làm common hardening nhưng không tuyên bố nghiệm thu CR |
| Python và Next.js cho kết quả khác nhau | Thêm contract case cho CR và chọn một expected behavior duy nhất |
| Fixture quá đẹp, không tái hiện lỗi thật | Tạo fixture nhỏ nhất chứa đúng conflict/gap/access condition của CR |
| Deploy khác local | Build production và smoke-test URL ở Ngày 3 |
| Mở rộng phạm vi | Chỉ nhận việc mới nếu cần cho acceptance criterion P0 |
| Evidence không tái lập | Ghi commit SHA, runtime version, dataset checksum và lệnh chạy |

## 12. Việc tiếp theo ngay lập tức

1. Review diff và tạo commit Mission 3 theo nhóm code/test và tài liệu.
2. Push lên GitHub, deploy bản mới và smoke-test URL.
3. Ghi commit SHA cùng URL vào báo cáo.
4. Quay video B5 tối đa năm phút theo kịch bản ở Mục 9.
5. Kiểm tra lần cuối toàn bộ hồ sơ nộp bài.
