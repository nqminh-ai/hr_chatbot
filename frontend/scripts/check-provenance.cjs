const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifyProvenance } = require('./provenance.cjs');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const seedPath = path.join(repositoryRoot, 'data', 'knowledge.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const report = verifyProvenance(seed, repositoryRoot);

assert.equal(report.verified, true);
assert.equal(report.sources, Object.keys(seed.source_sha256).length);
assert.equal(report.clauses, seed.documents.reduce((total, document) => total + document.clauses.length, 0));

function expectRejected(mutator, pattern) {
  const tampered = structuredClone(seed);
  mutator(tampered);
  assert.throws(() => verifyProvenance(tampered, repositoryRoot), pattern);
}

expectRejected(data => {
  const source = Object.keys(data.source_sha256)[0];
  data.source_sha256[source] = '0'.repeat(64);
}, /fingerprint mismatch/);

expectRejected(data => {
  data.documents[0].clauses[0].source_ref.line = 1;
}, /source line/);

expectRejected(data => {
  data.documents[0].provenance.line_end += 1;
}, /source range/);

expectRejected(data => {
  data.documents[0].clauses[0].source_ref.json_pointer = '/0/clauses/notice_period';
}, /clause text|policy\/version/);

expectRejected(data => {
  data.documents[0].clauses[0].text_source = 'tampered';
}, /clause text/);

expectRejected(data => {
  data.documents[0].clauses[0].typed_value.unit = 'calendar_days';
}, /typed unit/);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appota-provenance-'));
try {
  for (const name of Object.keys(seed.source_sha256)) {
    const destination = path.resolve(temporaryRoot, ...name.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.resolve(repositoryRoot, ...name.split('/')), destination);
  }
  const tamperedSource = Object.keys(seed.source_sha256)[0];
  fs.appendFileSync(path.resolve(temporaryRoot, ...tamperedSource.split('/')), '\n');
  assert.throws(() => verifyProvenance(seed, temporaryRoot), /fingerprint mismatch/);
} finally {
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  assert.equal(path.dirname(resolvedTemporaryRoot), path.resolve(os.tmpdir()));
  assert.match(path.basename(resolvedTemporaryRoot), /^appota-provenance-/);
  fs.rmSync(resolvedTemporaryRoot, { recursive: true, force: true });
}

console.log(`Provenance checks passed: ${report.sources} source files and ${report.clauses} clauses; 7 tamper controls rejected.`);
