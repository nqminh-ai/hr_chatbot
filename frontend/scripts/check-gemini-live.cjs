const path = require('node:path');
const fs = require('node:fs');
const { loadEnvConfig } = require('@next/env');
const { createLoader } = require('./test-loader.cjs');
const root = path.resolve(__dirname, '..');
loadEnvConfig(root);
const folder = path.join(root, '../docs/evidence');
function record(report) {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'gemini_live.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing');
  const environment = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, GEMINI_MODEL: process.env.GEMINI_MODEL };
  const load = createLoader(environment, fetch);
  const { policyAnswer } = load(path.join(root, 'src/lib/policy.server.ts'));
  const { geminiAnswer, geminiModel } = load(path.join(root, 'src/lib/gemini.server.ts'));
  const policy = policyAnswer('lan', 'Nghỉ phép bao nhiêu ngày?', '2026-10-14');
  const before = Date.now();
  const answer = await geminiAnswer('Nghỉ phép bao nhiêu ngày?', [], policy, true);
  if (!answer.includes('14 ngày')) throw new Error('Verified rendering failed');
  const report = { model: geminiModel(), passed: true, render_mode: 'verified_facts', duration_ms: Date.now() - before,
    checked_at: new Date().toISOString(), fixture_date: '2026-10-14' };
  record(report);
}
main().catch(error => {
  const status = /Gemini request failed \((\d+)\)/.exec(error.message)?.[1];
  const errorCode = error.name === 'TimeoutError' ? 'timeout' : status ? `upstream_${status}` : 'request_or_validation_failed';
  record({ passed: false, error_code: errorCode, checked_at: new Date().toISOString(), fixture_date: '2026-10-14' });
  process.exitCode = 1;
});
