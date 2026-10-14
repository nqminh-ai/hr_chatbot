const assert = require('node:assert/strict');
const path = require('node:path');
const { createLoader } = require('./test-loader.cjs');
const root = path.resolve(__dirname, '..');
const load = createLoader();
const { buildSnapshot } = load(path.join(root, 'src/lib/dataset.server.ts'));
const { readLimitedBody, BodyLimitError, MAX_BODY_BYTES } = load(path.join(root, 'src/lib/request-body.server.ts'));
const seed = require('../../data/knowledge.json');
const mutations = [
  data => { data.activation_allowed = false; },
  data => { data.artifact_kind = 'design_fixture'; },
  data => { data.documents[0].clauses[0].typed_value.value = -1; },
  data => { data.documents[0].clauses[0].typed_value.value = NaN; },
  data => { data.documents[0].clauses[0].typed_value.value = true; },
  data => { data.documents[0].clauses[0].typed_value.unit = 'business_days'; },
  data => { data.documents[0].clauses[0].is_floor = false; },
  data => { data.documents[0].lifecycle.events[0].at = '2026-02-30'; },
  data => { data.documents[0].lifecycle.events.push({ event: 'approved', at: '2026-01-01', evidence_type: 'mock_fixture' }); },
  data => { data.documents[0].scope.unit_id = 'UNKNOWN'; },
  data => { data.documents[0].provenance.source_path = '../source.json'; },
  data => { data.documents[0].clauses[0].source_ref.line = 999; },
  data => { data.personas[0].team = 'TEAM_PAY_B'; },
  data => { data.documents.push(structuredClone(data.documents[0])); },
  data => { data.documents[2].supersedes = [data.documents[3].doc_uid]; },
];
async function main() {
  for (const mutate of mutations) {
    const data = structuredClone(seed);
    mutate(data);
    assert.throws(() => buildSnapshot(data), /Invalid policy metadata/);
  }
  const snapshot = buildSnapshot(seed);
  assert.ok(Object.isFrozen(snapshot.data.personas[0]));
  assert.ok(!Object.isFrozen(seed.personas[0]), 'validation does not mutate input');
  await assert.rejects(() => readLimitedBody(new Request('https://example.test', {
    method: 'POST', body: 'x', headers: { 'content-length': String(MAX_BODY_BYTES + 1) },
  })), BodyLimitError);
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(MAX_BODY_BYTES + 1)); },
    cancel() { canceled = true; },
  });
  await assert.rejects(() => readLimitedBody(new Request('https://example.test', {
    method: 'POST', body: stream, duplex: 'half',
  })), BodyLimitError);
  assert.ok(canceled, 'oversize stream canceled without needing Content-Length');
  const text = 'nghỉ phép';
  assert.equal(await readLimitedBody(new Request('https://example.test', { method: 'POST', body: text })), text);
  console.log(`${mutations.length} invalid metadata mutations rejected; frozen snapshot and bounded UTF-8 body checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
