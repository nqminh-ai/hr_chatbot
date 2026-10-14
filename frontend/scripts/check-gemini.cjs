const assert = require('node:assert/strict');
const path = require('node:path');
const { createLoader } = require('./test-loader.cjs');
const root = path.resolve(__dirname, '..');
const load = createLoader({ GEMINI_API_KEY: 'fake-test-key' });
const { policyAnswer } = load(path.join(root, 'src/lib/policy.server.ts'));
const { renderModelSelection } = load(path.join(root, 'src/lib/gemini.server.ts'));
const policy = policyAnswer('lan', 'Nghỉ phép bao nhiêu ngày?', '2026-10-14');
const valid = { status: 'ok', fact_ids: ['POL-A-LV@v2.0#entitlement'], style: 'concise' };
const bad = [
  'Bạn có 99 ngày phép năm.', { ...valid, answer: 'Bạn có 99 ngày phép năm.' },
  { ...valid, status: 'refused' }, { ...valid, style: 'unlimited' }, { ...valid, fact_ids: [] },
  { ...valid, fact_ids: ['POL-A-LV-EXEC@v1.0#entitlement'] },
  { ...valid, fact_ids: ['POL-A-LV@v2.0#entitlement', 'POL-A-LV@v2.0#entitlement'] },
];
for (const response of bad) assert.throws(() => renderModelSelection(response, policy));
for (const style of ['concise', 'bullets']) {
  const text = renderModelSelection({ ...valid, style }, policy);
  assert.ok(text.includes('14 ngày') && !text.includes('99 ngày'));
}
const insufficient = { ...policy, status: 'insufficient_evidence', answer: 'Chưa có căn cứ cho phép ngoại lệ.' };
assert.equal(renderModelSelection({ ...valid, status: insufficient.status }, insufficient), insufficient.answer);
console.log(`${bad.length} unsafe model outputs rejected; both styles render verified facts and preserve refusal constraints.`);
