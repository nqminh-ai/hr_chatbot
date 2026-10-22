# Mission 3 — Implementation Plan

**Sản phẩm:** Appota Knowledge Copilot  
**Đề:** B — Tri thức nội bộ Appota  
**Baseline Mission 2:** `f428463`  
**Thời gian:** 3 ngày kể từ khi Mission 3 mở  
**Trạng thái CR:** B5 — Kiểm chứng nguồn, nhận ngày 22/10/2026

## Trạng thái thực thi — 22/10/2026

| Work package | Trạng thái | Bằng chứng / phần còn lại |
|---|---|---|
| WP0 — Baseline và CR contract | **Complete** | B5 đã được chuyển thành ba acceptance criteria; baseline `f428463` |
| WP1 — Fixture và test-first | **Complete** | Có test B5 trực tiếp, edge, regression và temporal boundary |
| WP2 — Python domain/output | **Complete** | Mỗi claim map đúng document version, clause, source text và locator |
| WP3 — Next.js + parity | **Complete** | Citation Next.js cùng contract; 12/12 shared contracts so cả metadata |
| WP4 — UI verification | **Complete** | Inspector hiển thị tài liệu/phần nguồn/hiệu lực; client từ chối temporal citation sai |
| WP5 — Regression/evidence/deploy | **Local complete** | 119/119 backend, 92/92 scenario/contracts, 21/21 UI, 40 chat checks, lint/build pass; deploy/video còn lại |

B5 và yêu cầu cải tiến chung đã hoàn thành ở môi trường local. Mission 3 chưa bàn giao xong cho đến khi commit/push, deploy smoke test và video hoàn tất.

## 1. Mục tiêu kỹ thuật

Triển khai đúng một vertical slice cho Change Request được giao mà không viết lại MVP. Kết quả phải đồng nhất giữa:

```text
knowledge.json + schema
          │
          ├── Python engine ──► unit/scenario/oracle tests
          │
          └── Next.js resolver ──► /api/chat ──► Chat UI + Inspector
                         │
                         └── optional Gemini renderer
                             (không quyết định fact/quyền/version)
```

`tests/policy_contracts.json` là oracle hành vi dùng chung cho hai resolver. Next.js là runtime demo cần deploy; Python giữ vai trò đối chiếu và regression.

## 2. Nguyên tắc triển khai

1. **Test-first cho CR:** tạo case tái hiện trước khi sửa resolver.
2. **Một quyết định nghiệp vụ:** Python và TypeScript phải trả cùng status, claim, source và query date.
3. **Fail closed:** thiếu quyền, thiếu evidence, temporal gap/overlap hoặc conflict không phân giải được thì không sinh fact.
4. **Provenance end-to-end:** fact, citation, graph và trace phải cùng trỏ đến clause đã chọn.
5. **Không giao logic nghiệp vụ cho Gemini:** Gemini chỉ trình bày tập fact đã lọc và xác thực.
6. **Thay đổi tối thiểu:** chỉ sửa schema/data/engine/API/UI thật sự cần cho acceptance criteria.

## 3. Phạm vi file và trách nhiệm

| Lớp | File chính | Trách nhiệm khi triển khai |
|---|---|---|
| Runtime data | `data/knowledge.json` | Fixture nhỏ nhất tái hiện CR; không dùng dữ liệu cá nhân thật |
| Schema | `schemas/knowledge_runtime_v2.schema.json` | Chỉ thêm field nếu CR không thể biểu diễn bằng contract hiện tại |
| Python parsing | `engine/models.py`, `engine/metadata.py` | Parse/validate field mới thành model bất biến |
| Python decision | `engine/timeline.py`, `engine/filter.py`, `engine/hierarchy.py`, `engine/core.py` | Version, access, conflict, fail-closed |
| Python output | `engine/generator.py`, `engine/trace.py`, `engine/knowledge_graph.py` | Claim, citation, trace và graph cùng provenance |
| TS parsing | `frontend/src/lib/dataset.server.ts` | Validate cùng invariant dữ liệu với Python |
| TS decision | `frontend/src/lib/policy-resolution.server.ts`, `frontend/src/lib/policy.server.ts` | Hành vi tương đương Python cho runtime demo |
| Intent | `engine/semantic_matcher.py`, `frontend/src/lib/intent.server.ts` | Chỉ sửa nếu CR liên quan cách hiểu câu hỏi/làm rõ |
| API | `frontend/src/lib/chat-handler.server.ts`, `frontend/src/app/api/chat/route.ts` | Validate request, loại internal facts và trả contract công khai |
| Public types | `frontend/src/types/index.ts`, `frontend/src/lib/chat-validation.ts` | Chặn response/history metadata sai trước khi hiển thị |
| UI | `frontend/src/components/ChatClient.tsx`, `frontend/src/components/InspectorDrawer.tsx` | Trình bày trạng thái và cho kiểm chứng nguồn |
| Shared oracle | `tests/policy_contracts.json`, `contracts.py`, `frontend/scripts/check-contracts.cjs` | Khóa parity Python–TypeScript |
| Tests | `tests/test_mission3.py`, `tests/test_engine.py`, `frontend/tests/chat-ui.test.tsx` | CR, edge, regression và UI verification |
| Evidence | `docs/MISSION_3_REPORT.md`, `docs/evidence/` | Before/after, lệnh chạy, kết quả và giới hạn |

## 4. Contract mục tiêu

### 4.1 Citation công khai

Hai runtime dùng cùng một contract tối thiểu:

```text
doc_id
doc_uid
version
title
clause
clause_id
text_source
scope_level
valid_from
valid_to
source_ref.path
source_ref.line
source_ref.json_pointer
```

Invariant:

- `doc_uid = doc_id + "@" + version`.
- `clause_id = doc_uid + "#" + clause`.
- `valid_from <= query_date < valid_to`; `valid_to = null` nghĩa là không có mốc kết thúc.
- `source_ref` phải nằm trong source path/range đã được dataset validate.
- Citation chỉ được tạo sau access filtering và resolution.

Phần đang có trong worktree đã đưa `valid_to`, query date và source locator đến Inspector. Phần còn phải hoàn thiện là parity Python–TypeScript, validation contract và test cho khoảng hiệu lực hữu hạn.

### 4.2 Kết quả quyết định

Status công khai tiếp tục dùng:

- `ok`/`answered`: có fact đủ căn cứ.
- `needs_clarification`: câu hỏi thiếu hoặc mâu thuẫn bối cảnh.
- `insufficient_evidence`: hiểu yêu cầu nhưng corpus không đủ để kết luận.
- `conflict`: có nhiều policy/clause hợp lệ nhưng không thể chọn an toàn.
- `refused`: không có quyền hoặc không có policy được phép áp dụng.
- `out_of_scope`: ngoài phạm vi sản phẩm.

Không đổi nghĩa status chỉ để làm UI thuận tiện. Mapping `ok → answered` chỉ tồn tại ở contract runner.

### 4.3 Zero-leakage

Với response `refused`, không được xuất hiện nội dung hoặc định danh tài liệu bị cấm trong:

- `answer`;
- `citations`;
- `graph`;
- `trace`;
- error message;
- Gemini request.

## 5. Work packages

### WP0 — Khoá baseline và CR contract

**Thời lượng:** 2–3 giờ  
**Phụ thuộc:** nội dung nguyên văn CR

- Ghi `cr_id`, yêu cầu nguyên văn và nguồn chỉ định vào báo cáo.
- Tạo 2–5 acceptance criteria dạng Given/When/Then.
- Chạy cùng input trên commit `f428463`; lưu JSON/output/screenshot before.
- Lập impact matrix và quyết định file nào thật sự phải sửa.
- Chốt phần không làm.

**Gate:** chưa qua WP0 thì không sửa logic nghiệp vụ.

### WP1 — Thêm fixture và test thất bại đúng nguyên nhân

**Thời lượng:** 2–3 giờ

- Nếu dữ liệu hiện tại chưa tái hiện CR, thêm fixture tối thiểu vào `data/knowledge.json`.
- Cập nhật schema chỉ khi cần field mới.
- Thêm một case vào `tests/policy_contracts.json` để khóa parity nếu CR ảnh hưởng kết quả nghiệp vụ.
- Thêm ba test có tên rõ trong `tests/test_mission3.py`:
  - `test_cr_<id>_...`;
  - `test_edge_<id>_...`;
  - `test_reg_mission2_...`.
- Thêm UI/API test nếu acceptance criterion có hành vi nhìn thấy được.
- Chạy test và lưu failure chứng minh lỗi đến từ hành vi thiếu, không phải fixture/schema hỏng.

**Gate:** CR test đỏ; các regression test cũ vẫn xanh.

### WP2 — Triển khai logic domain trên Python

**Thời lượng:** 2–4 giờ

Chọn đúng seam theo CR:

- Version/effective time → `engine/timeline.py`.
- Role/company/team/classification → `engine/filter.py`.
- Override/floor/same-level conflict → `engine/hierarchy.py`.
- Missing evidence/status routing → `engine/core.py`, `engine/generator.py`.
- Input metadata mới → `engine/models.py`, `engine/metadata.py`.

Sau khi resolve:

- `engine/generator.py` phát citation canonical, bao gồm validity window và text source.
- `engine/trace.py` chỉ ghi identity của clause đã được phép.
- `engine/knowledge_graph.py` chỉ chiếu document/clause đã dùng.

**Gate:** test CR/edge/regression Python pass và không làm hỏng `tests/test_engine.py`.

### WP3 — Triển khai cùng contract trên Next.js runtime

**Thời lượng:** 2–4 giờ

- Mirror invariant dữ liệu trong `dataset.server.ts`.
- Mirror quyết định domain trong `policy-resolution.server.ts` và `policy.server.ts`.
- Không copy internal `facts` ra API công khai.
- Không gọi Gemini nếu status khác `ok` hoặc không có fact.
- Mở rộng type/validator trước khi UI nhận field mới.
- Chạy shared contract sau mỗi thay đổi để phát hiện drift sớm.

**Gate:** Python và TypeScript trả cùng expected result cho toàn bộ `policy_contracts.json`.

### WP4 — Hoàn thiện khả năng kiểm chứng trên UI

**Thời lượng:** 2–3 giờ

- Inspector hiển thị `doc_uid`, version và khoảng `[valid_from, valid_to)`.
- Hiển thị query date được đối chiếu, clause ID và source locator.
- Với `conflict`, `insufficient_evidence` hoặc `refused`, UI không dùng biểu tượng/ngôn ngữ tạo cảm giác đã xác nhận.
- Thêm UI test cho open citation và cho response không có citation.
- Validate dữ liệu khi restore `localStorage`; metadata không hợp lệ bị loại.

**Gate:** người review kiểm chứng được “nguồn nào, version nào, hiệu lực khi nào, điều khoản ở đâu” trong tối đa một thao tác mở Inspector.

### WP5 — Regression, evidence và deploy

**Thời lượng:** 4–5 giờ

- Chạy test Mission 3 riêng.
- Chạy toàn bộ backend, scenario/contracts, frontend, lint và build.
- Chạy after trên đúng input của WP0.
- Ghi bảng before/after bằng dữ liệu thật.
- Cập nhật ba câu trả lời bắt buộc và giới hạn còn lại.
- Deploy commit Mission 3 lên Vercel; smoke-test GET bootstrap và một POST CR case.
- Quay video theo kịch bản tối đa năm phút.

**Gate:** tất cả artifact nộp bài trỏ cùng commit SHA.

## 6. CR implementation matrix — B5

CR B5 được map đến các seam code như sau:

| Acceptance criterion | Fixture/data | Python seam | TS seam | API/UI | Test/evidence |
|---|---|---|---|---|---|
| AC1 — mỗi kết luận có nguồn chính xác | Dùng fixture hiện có | `generator.py`, graph/trace | `policy-resolution.server.ts`, contract runner | Citation payload | B5 backend test + 12 shared contracts |
| AC2 — người dùng xem tài liệu và phần hỗ trợ | Dùng source refs hiện có | Citation validity/source text | Public types | Inspector labels và locator | B5 UI test |
| AC3 — không xác nhận nguồn sai | Temporal fixture hiện có | Timeline invariant | Reply validation | Không hiển thị response sai | Invalid temporal citation UI test |

Quy tắc chọn seam:

- CR về loại tài liệu/metadata → schema + parsers trước, resolver sau.
- CR về version/thời gian → timeline/selectVersions.
- CR về xung đột cấp tổ chức → hierarchy/resolveFacts.
- CR về quyền → filter/readable và zero-leakage tests.
- CR về thiếu bằng chứng → routing/synthesizer và negative evidence tests.
- CR về kiểm chứng nguồn → citation contract, validation và Inspector.

## 7. Test plan chi tiết

### Test bắt buộc Mission 3

| Test | Fixture | Expected |
|---|---|---|
| CR acceptance | Đúng dữ liệu và persona của CR | Exact status, claim, source, version, scope và query date |
| Edge case | Boundary hoặc dữ liệu thiếu/xung đột gần CR nhất | Fail closed, không fact giả, không leakage |
| Regression | Một hành vi Mission 2 cùng vùng code | Expected M2 không đổi |

### Contract parity

Mỗi CR ảnh hưởng quyết định nghiệp vụ phải có một case trong `tests/policy_contracts.json`. `contracts.py` và `check-contracts.cjs` phải cùng pass; không cho phép chỉ một runtime đúng.

### Lệnh kiểm tra

Từ repository root:

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s tests -p "test_mission3.py" -v
.\.venv\Scripts\python.exe -B -m unittest discover -s tests -p "test_*.py"
.\.venv\Scripts\python.exe -B validate.py
```

Từ `frontend/`:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Không dùng `python -m unittest tests.test_mission3 -v` vì `tests` hiện không phải package importable.

## 8. Before/after harness

Mỗi lần đo tạo một record gồm:

```json
{
  "commit": "<sha>",
  "runtime": "python|nextjs",
  "case_id": "<cr-case>",
  "input": {"persona": "...", "query": "...", "date": "..."},
  "status": "...",
  "claims": [],
  "citations": [],
  "trace_id": "...",
  "passed_acceptance": false
}
```

So sánh trên cùng fixture và input. Chỉ đưa vào báo cáo các chỉ số đã đo:

- số acceptance criteria đạt;
- số case đúng status/fact/source;
- zero-leakage violations;
- số thao tác hoặc thời gian để mở và xác minh nguồn;
- tổng regression pass/fail.

## 9. Thứ tự commit đề xuất

1. `docs: record Mission 3 CR and acceptance criteria`
2. `test: add Mission 3 CR, edge and regression cases`
3. `feat: implement <CR-ID> in deterministic policy resolvers`
4. `feat: expose canonical citation evidence in Inspector`
5. `test: add cross-runtime contracts and capture evidence`
6. `docs: finalize Mission 3 report and submission links`

Mỗi commit chỉ chứa file liên quan. Không commit `.env.local`, secret, `.next`, database runtime hoặc evidence có dữ liệu nhạy cảm.

## 10. Definition of Done

- [ ] CR thật được ghi nguyên văn và map đến acceptance criteria.
- [ ] Test CR thất bại trên baseline M2 và pass trên M3.
- [ ] Có ít nhất một edge case và một regression test.
- [ ] Python–TypeScript contract parity pass.
- [ ] Citation/graph/trace cùng tham chiếu clause được phép.
- [ ] Zero-leakage pass cho nhánh không đủ quyền.
- [ ] Backend regression, `validate.py`, frontend tests, lint và build pass.
- [ ] Before/after dùng cùng case và có commit SHA.
- [ ] Demo URL đã smoke-test trên commit nộp bài.
- [ ] Video ≤ 5 phút và báo cáo trả lời đủ ba câu bắt buộc.
- [ ] Giới hạn còn lại được nêu rõ, không suy rộng ngoài fixture.

## 11. Đường găng

```text
CR nguyên văn
   ↓
Acceptance criteria + before baseline
   ↓
Failing CR test
   ↓
Python resolver ── shared contract ── Next.js resolver
   ↓
API/type/validation
   ↓
Inspector + UI test
   ↓
Full regression + before/after
   ↓
Deploy + video + report
```

B5 đã được triển khai end-to-end và kiểm thử local. Phần còn lại trên đường găng là tạo commit bàn giao, deploy bản mới, smoke-test URL và quay video.
