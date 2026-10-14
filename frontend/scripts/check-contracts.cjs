const fs = require('node:fs');
const path = require('node:path');
const { createLoader } = require('./test-loader.cjs');
const root = path.resolve(__dirname, '..');
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-14T05:00:00Z'])); }
}
const { policyAnswer } = createLoader({}, undefined, { Date: FixedDate })(path.join(root, 'src/lib/policy.server.ts'));
const cases = JSON.parse(fs.readFileSync(path.join(root, '../tests/policy_contracts.json'), 'utf8'));
const results = cases.map(item => {
  const result = policyAnswer(item.persona, item.query, item.date, item.history || []);
  return { id: item.id, actual: {
    status: result.status === 'ok' ? 'answered' : result.status, query_date: result.query_date,
    claims: Object.fromEntries(result.facts.map(fact => [fact.key, {
      value: fact.value, unit: fact.unit, source: `${fact.citation.doc_id}@${fact.citation.version}`,
    }])),
  } };
});
if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(results));
else {
  const { isDeepStrictEqual } = require('node:util');
  const failures = results.filter((item, index) => !isDeepStrictEqual(item.actual, cases[index].expected));
  console.log(`${results.length - failures.length}/${results.length} TS contracts; failed=${failures.map(item => item.id)}`);
  process.exitCode = failures.length ? 1 : 0;
}
