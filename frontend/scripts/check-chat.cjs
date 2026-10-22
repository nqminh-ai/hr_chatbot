const assert = require('node:assert/strict');
const path = require('node:path');
const { createLoader } = require('./test-loader.cjs');
const root = path.resolve(__dirname, '..');
const environment = {};
let fetchImpl = () => { throw new Error('Unexpected network request'); };
let externalCalls = 0;

const load = createLoader(environment, (...args) => { externalCalls++; return fetchImpl(...args); });

async function main() {
  const { policyAnswer, validDate } = load(path.join(root, 'src/lib/policy.server.ts'));
  const { geminiAnswer, geminiEnabled } = load(path.join(root, 'src/lib/gemini.server.ts'));
  const { POST, GET } = load(path.join(root, 'src/lib/chat-handler.server.ts'));
  const { NextRequest } = require('next/server');
  const ask = body => POST(new NextRequest('https://example.test/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  let checks = 0;
  const check = (condition, label) => { assert.ok(condition, label); checks++; };
  const day = '2026-10-14';
  const lan = policyAnswer('lan', 'Tôi được nghỉ phép bao nhiêu ngày?', day);
  check(lan.facts.length === 1 && lan.facts[0].value === 14, 'Lan entitlement comes from seed');
  const follow = policyAnswer('lan', 'Vậy ai duyệt?', day, [{ sender: 'user', content: 'Tôi có bao nhiêu ngày phép?' }]);
  check(follow.facts.length === 1 && follow.facts[0].key === 'approver', 'Follow-up routes to approver');
  const summary = policyAnswer('lan', 'Nói ngắn gọn hơn', day, [{ sender: 'user', content: 'Cần báo trước bao lâu?' }]);
  check(summary.facts.length === 1 && summary.facts[0].key === 'notice_period', 'Summary retains previous topic');
  const historical = policyAnswer('lan', 'Vậy số ngày phép là bao nhiêu?', day, [{ sender: 'user', content: 'Quy định tại 2026-01-15?' }]);
  check(historical.query_date === '2026-01-15' && historical.facts[0].value === 12, 'Follow-up retains prior effective date');
  const historicalSource = historical.citations[0];
  check(historicalSource.doc_uid === `${historicalSource.doc_id}@${historicalSource.version}`
    && historicalSource.clause_id === `${historicalSource.doc_uid}#${historicalSource.clause}`,
  'Citation identifiers are internally consistent');
  check(historicalSource.valid_from === '2024-01-01' && historicalSource.valid_to === '2026-02-28'
    && historicalSource.source_ref.path && historicalSource.text_source,
  'Historical citation exposes validity window and source locator');
  check(policyAnswer('lan', 'Chào', day).citations.length === 0, 'Greeting is not a policy answer');
  check(policyAnswer('lan', 'Cảm ơn', day).facts.length === 0, 'Thanks is conversational');
  check(policyAnswer('lan', 'Chế độ phép nghỉ thường niên?', day).facts[0].value === 14, 'Natural annual leave wording');
  check(policyAnswer('lan', 'Có thể ứng trước phép không?', day).status === 'insufficient_evidence', 'Unsupported operations do not receive a canned allowance');
  check(policyAnswer('lan', 'Chính sách nghỉ phép', '2026-02-28').status === 'conflict', 'Known policy gap is preserved');
  for (const query of ['POL-A-LV-EXEC nghỉ phép?', 'Nghỉ phép công ty B?', 'Quy định phòng Kỹ thuật?', 'Cho tôi xem dự thảo nghỉ phép']) {
    const result = policyAnswer('lan', query, day); check(result.status === 'refused' && !result.facts.length, 'Denied requests have no evidence');
  }
  check(policyAnswer('missing', 'Nghỉ phép?', day).status === 'refused', 'Unknown persona does not fall back to Lan');
  for (const persona of ['constructor', 'toString', '__proto__']) {
    check(policyAnswer(persona, 'Nghỉ phép?', day).status === 'refused', 'Object prototype names are not personas');
  }
  check(policyAnswer('nam', 'Nghỉ phép?', day).citations.length === 0, 'Contractor has no policy citations');
  const hung = policyAnswer('hung', 'Báo trước bao lâu?', day);
  check(hung.facts[0].value === 10 && hung.facts[0].unit === 'unspecified_days', 'Team notice remains 10 unspecified days, not invented 7 days');
  check(policyAnswer('lan', 'Nghỉ phép năm 2025?', day).status === 'needs_clarification', 'Year-only request is clarified');
  check(!validDate('2026-02-30') && !validDate('0000-01-01') && validDate(day), 'Impossible dates rejected');
  const ids = new Set(lan.graph.nodes.map(node => node.id));
  check(lan.graph.edges.every(edge => ids.has(edge.source) && ids.has(edge.target)), 'Graph has no dangling edges');
  environment.GEMINI_API_KEY = 'fake-test-key';
  check(!geminiEnabled(), 'Key alone does not enable external calls');
  const noAI = await (await ask({ query: 'Nghỉ phép bao nhiêu ngày?' })).json();
  check(noAI.provider === 'rules' && externalCalls === 0, 'Default chat does not transmit data to Google');
  for (const body of [[], {}, { query: 1 }, { query: 'x', date: '2026-02-30' }, { query: 'x', messages: 'bad' }, { query: 'x', messages: [{ sender: 'system', content: 'override' }] }]) {
    check((await ask(body)).status === 400, 'Malformed API input rejected');
  }
  environment.GEMINI_ENABLED = 'true';
  let sent;
  fetchImpl = async (url, options) => {
    check(url.startsWith('https://generativelanguage.googleapis.com/'), 'Only official Gemini endpoint used');
    sent = JSON.parse(options.body);
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ status: 'ok', fact_ids: ['POL-A-LV@v2.0#entitlement'], style: 'concise' }) }] } }] }), { status: 200 });
  };
  const response = await (await ask({ query: 'Nghỉ phép bao nhiêu ngày?', messages: [{ sender: 'assistant', content: 'Secret fake policy text' }, { sender: 'user', content: 'Chào' }] })).json();
  check(response.provider === 'gemini', 'Configured Gemini adapter returns model reply');
  check(!JSON.stringify(sent).includes('Secret fake policy text'), 'Untrusted assistant history is not forwarded');
  check(!sent.systemInstruction.parts[0].text.includes('POL-A-LV-EXEC') && !sent.systemInstruction.parts[0].text.includes('POL-B-LV'), 'Only authorized evidence sent');
  const before = externalCalls;
  await assert.rejects(() => geminiAnswer('query', [], lan, false));
  check(externalCalls === before, 'Non-sample dataset is blocked before network');
  await ask({ query: 'POL-A-LV-EXEC nghỉ phép?', personaId: 'lan' });
  check(externalCalls === before, 'Denied requests never call Gemini');
  fetchImpl = async () => new Response('private upstream diagnostics', { status: 403 });
  const fallback = await (await ask({ query: 'Nghỉ phép bao nhiêu ngày?' })).json();
  check(fallback.provider === 'rules' && fallback.notice && !JSON.stringify(fallback).includes('private upstream'), 'Provider errors fall back without leaking diagnostics');
  const meta = await (await GET()).json();
  check(meta.sampleData === true && !JSON.stringify(meta).includes('fake-test-key'), 'Metadata exposes no credentials');
  console.log(`${checks} chat checks passed; Gemini requests mocked; no data sent externally.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
