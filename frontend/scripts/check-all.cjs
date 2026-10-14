const { spawnSync } = require('node:child_process');
const path = require('node:path');
const checks = ['check-data.cjs', 'check-contracts.cjs', 'check-gemini.cjs', 'check-chat.cjs',
  '../node_modules/vitest/vitest.mjs', 'check-supabase.cjs'];
for (const check of checks) {
  const args = [path.resolve(__dirname, check), ...(check.endsWith('vitest.mjs') ? ['run'] : [])];
  const result = spawnSync(process.execPath, args, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
