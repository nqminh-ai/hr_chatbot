const fs = require('node:fs');
const path = require('node:path');
const { createLoader } = require('./test-loader.cjs');
const root = path.resolve(__dirname, '..');
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-14T05:00:00Z'])); }
}
const load = createLoader({}, undefined, { Date: FixedDate });
const { policyAnswer } = load(path.join(root, 'src/lib/policy.server.ts'));
const { buildSnapshot } = load(path.join(root, 'src/lib/dataset.server.ts'));
const seed = JSON.parse(fs.readFileSync(path.join(root, '../data/knowledge.json'), 'utf8'));
const cases = JSON.parse(fs.readFileSync(path.join(root, '../tests/policy_contracts.json'), 'utf8'));

function fixtureSnapshot(item) {
  if (!item.fixture) return undefined;
  const data = structuredClone(seed);
  const fixture = item.fixture;
  const documents = data.documents.filter(document => document.policy_id === fixture.policy_id);
  if (!documents.length) throw new Error(`Unknown fixture policy: ${fixture.policy_id}`);
  for (const document of documents) {
    const version = document.version;
    if (fixture.audience_roles_by_version?.[version]) document.access.audience_roles = fixture.audience_roles_by_version[version];
    if (fixture.valid_to_by_version?.[version]) document.lifecycle.valid_to = fixture.valid_to_by_version[version];
    if (fixture.last_event_at_by_version?.[version]) document.lifecycle.events.at(-1).at = fixture.last_event_at_by_version[version];
  }
  return buildSnapshot(data, { allowInactiveMock: true });
}

const results = cases.map(item => {
  const result = policyAnswer(item.persona, item.query, item.date, item.history || [], undefined, fixtureSnapshot(item));
  return { id: item.id, actual: {
    status: result.status === 'ok' ? 'answered' : result.status, query_date: result.query_date,
    claims: Object.fromEntries(result.facts.map(fact => [fact.key, {
      value: fact.value, unit: fact.unit, source: `${fact.citation.doc_id}@${fact.citation.version}`,
    }])),
    citations: Object.fromEntries(result.citations.map(citation => [citation.clause_id, {
      doc_uid: citation.doc_uid, valid_from: citation.valid_from, valid_to: citation.valid_to,
      scope_level: citation.scope_level, text_source: citation.text_source, source_ref: citation.source_ref,
    }])),
  } };
});
if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(results));
else {
  const { isDeepStrictEqual } = require('node:util');
  const businessResult = actual => ({ status: actual.status, query_date: actual.query_date, claims: actual.claims });
  const failures = results.filter((item, index) => !isDeepStrictEqual(businessResult(item.actual), cases[index].expected));
  console.log(`${results.length - failures.length}/${results.length} TS contracts; failed=${failures.map(item => item.id)}`);
  process.exitCode = failures.length ? 1 : 0;
}
