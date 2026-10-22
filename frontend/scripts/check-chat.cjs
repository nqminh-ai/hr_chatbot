const assert = require('node:assert/strict');
const path = require('node:path');
const { createLoader } = require('./test-loader.cjs');
const root = path.resolve(__dirname, '..');
const environment = { APPOTA_DEMO_MODE: 'true', APPOTA_RATE_LIMIT_MAX: '100' };
let fetchImpl = () => { throw new Error('Unexpected network request'); };
let externalCalls = 0;

const load = createLoader(environment, (...args) => { externalCalls++; return fetchImpl(...args); });

async function main() {
  const { policyAnswer, validDate } = load(path.join(root, 'src/lib/policy.server.ts'));
  const { geminiAnswer, geminiEnabled } = load(path.join(root, 'src/lib/gemini.server.ts'));
  const { signTrustedIdentity } = load(path.join(root, 'src/lib/auth.server.ts'));
  const { POST, GET } = load(path.join(root, 'src/lib/chat-handler.server.ts'));
  const { NextRequest } = require('next/server');
  const ask = (body, requestHeaders = {}) => POST(new NextRequest('https://example.test/api/chat', { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...requestHeaders }, body: JSON.stringify(body) }));
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
  check(historicalSource.valid_from === '2024-01-01' && historicalSource.valid_to === '2026-03-01'
    && historicalSource.source_ref.path && historicalSource.text_source,
  'Historical citation exposes validity window and source locator');
  check(policyAnswer('lan', 'Chào', day).citations.length === 0, 'Greeting is not a policy answer');
  check(policyAnswer('lan', 'Cảm ơn', day).facts.length === 0, 'Thanks is conversational');
  check(policyAnswer('lan', 'Chế độ phép nghỉ thường niên?', day).facts[0].value === 14, 'Natural annual leave wording');
  check(policyAnswer('lan', 'Có thể ứng trước phép không?', day).status === 'insufficient_evidence', 'Unsupported operations do not receive a canned allowance');
  const transitionEve = policyAnswer('lan', 'Chính sách nghỉ phép', '2026-02-28');
  check(transitionEve.status === 'ok' && transitionEve.facts.some(fact => fact.value === 12)
    && transitionEve.citations.every(citation => citation.doc_uid === 'POL-A-LV@v1.0'), 'Day before transition uses v1');
  const transitionDay = policyAnswer('lan', 'Chính sách nghỉ phép', '2026-03-01');
  check(transitionDay.status === 'ok' && transitionDay.facts.some(fact => fact.value === 14)
    && transitionDay.citations.every(citation => citation.doc_uid === 'POL-A-LV@v2.0'), 'Transition day uses v2');
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
  const telemetryLines = [];
  const originalWarn = console.warn;
  console.warn = line => { telemetryLines.push(String(line)); };
  let fallback;
  try { fallback = await (await ask({ query: 'Nghỉ phép bao nhiêu ngày?' })).json(); }
  finally { console.warn = originalWarn; }
  check(fallback.provider === 'rules' && fallback.notice && !JSON.stringify(fallback).includes('private upstream'), 'Provider errors fall back without leaking diagnostics');
  check(telemetryLines.length === 1, 'Provider failure emits one structured telemetry event');
  const telemetry = JSON.parse(telemetryLines[0]);
  check(JSON.stringify(Object.keys(telemetry).sort()) === JSON.stringify(['code', 'elapsedMs', 'errorClass', 'event', 'requestId', 'stage']),
  'Telemetry schema contains only approved fields');
  check(telemetry.event === 'chat_fallback' && telemetry.requestId === fallback.requestId
    && telemetry.stage === 'gemini.generate' && telemetry.code === 'gemini_unavailable'
    && telemetry.errorClass === 'GeminiHttpError' && Number.isInteger(telemetry.elapsedMs) && telemetry.elapsedMs >= 0,
  'Fallback telemetry carries correlation, stage, error class and elapsed time');
  check(!telemetryLines[0].includes('Nghỉ phép') && !telemetryLines[0].includes('fake-test-key')
    && !telemetryLines[0].includes('private upstream') && !telemetryLines[0].includes('Gemini request failed'),
  'Fallback telemetry excludes prompts, credentials and error messages');
  const meta = await (await GET(new NextRequest('https://example.test/api/chat'))).json();
  check(meta.sampleData === true && !JSON.stringify(meta).includes('fake-test-key'), 'Metadata exposes no credentials');
  environment.GEMINI_ENABLED = 'false';
  environment.APPOTA_DEMO_MODE = 'false';
  delete environment.APPOTA_AUTH_MODE;
  check((await ask({ query: 'hello' })).status === 503, 'Production fails closed when authentication is not configured');
  environment.APPOTA_AUTH_MODE = 'trusted-header';
  environment.APPOTA_AUTH_SECRET = 'test-secret-with-at-least-32-characters';
  const signedHeaders = (userId, method = 'POST') => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    return {
      'x-appota-user-id': userId,
      'x-appota-auth-timestamp': timestamp,
      'x-appota-auth-signature': signTrustedIdentity(environment.APPOTA_AUTH_SECRET, timestamp, userId, method, '/api/chat'),
    };
  };
  check((await ask({ query: 'hello' })).status === 401, 'Unsigned production request is rejected');
  check((await ask({ query: 'hello' }, { ...signedHeaders('lan'), 'x-appota-auth-signature': 'invalid' })).status === 401, 'Invalid identity signature is rejected');
  const staleTimestamp = String(Math.floor(Date.now() / 1000) - 61);
  const staleHeaders = { 'x-appota-user-id': 'lan', 'x-appota-auth-timestamp': staleTimestamp,
    'x-appota-auth-signature': signTrustedIdentity(environment.APPOTA_AUTH_SECRET, staleTimestamp, 'lan', 'POST', '/api/chat') };
  check((await ask({ query: 'hello' }, staleHeaders)).status === 401, 'Expired identity signature is rejected');
  check((await ask({ query: 'hello' }, signedHeaders('unknown'))).status === 403, 'Authenticated identity without a persona is rejected');
  check((await ask({ query: 'hello', personaId: 'mai' }, signedHeaders('lan'))).status === 403, 'Authenticated caller cannot select another persona');
  const authenticated = await ask({ query: 'Nghỉ phép bao nhiêu ngày?' }, signedHeaders('lan'));
  check(authenticated.status === 200 && (await authenticated.json()).citations[0].doc_id === 'POL-A-LV', 'Server binds policy lookup to authenticated identity');
  const signedGet = new NextRequest('https://example.test/api/chat', { headers: signedHeaders('lan', 'GET') });
  const privateMeta = await (await GET(signedGet)).json();
  check(privateMeta.personas.length === 1 && privateMeta.personas[0].userId === 'lan', 'Production bootstrap exposes only the authenticated persona');
  environment.APPOTA_RATE_LIMIT_MAX = '2';
  const maiHeaders = signedHeaders('mai');
  check((await ask({ query: 'hello' }, maiHeaders)).status === 200, 'First request remains inside quota');
  check((await ask({ query: 'hello' }, maiHeaders)).status === 200, 'Second request remains inside quota');
  const limited = await ask({ query: 'hello' }, maiHeaders);
  check(limited.status === 429 && Number(limited.headers.get('Retry-After')) >= 1, 'Quota returns 429 with Retry-After');
  console.log(`${checks} chat checks passed; Gemini requests mocked; no data sent externally.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
