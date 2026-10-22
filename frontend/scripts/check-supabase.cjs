const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PGlite, types } = require('@electric-sql/pglite');
const { createLoader } = require('./test-loader.cjs');
const root = path.resolve(__dirname, '../..');
const tables = ['dataset_info', 'source_hashes', 'migration_decisions', 'organization', 'personas', 'documents', 'clauses', 'lifecycle_events', 'supersedes'];
const corpus = [...tables, 'chat_conversations', 'chat_messages', 'policy_inventory'];
const python = process.env.APPOTA_PYTHON || (process.platform === 'win32'
  ? path.join(root, '.venv/Scripts/python.exe') : path.join(root, '.venv/bin/python'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const normalizedLines = value => value.replace(/\r\n/g, '\n').trim();
function runPython(code, input) {
  const result = spawnSync(python, ['-B', '-c', code], { cwd: root, input, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
async function main() {
  // Keep SQL DATE as YYYY-MM-DD; JavaScript Date would shift it by local TZ.
  const db = await PGlite.create({ parsers: { [types.DATE]: value => value } });
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
    await db.exec(read('supabase/schema.sql'));
    await db.exec('GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role; GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;');
    const raw = JSON.parse(read('data/knowledge.json'));
    const fresh = runPython(`import json,sys,tempfile
from pathlib import Path
from engine.storage import initialize_database
from scripts.export_sqlite_to_supabase import generate_seed
with tempfile.TemporaryDirectory() as folder:
    db, output = Path(folder)/'a.db', Path(folder)/'seed.sql'
    initialize_database(db,json.load(sys.stdin))
    generate_seed(db,output)
    print(output.read_text(encoding='utf-8'))`, JSON.stringify(raw));
    assert.equal(normalizedLines(fresh), normalizedLines(read('supabase/seed.sql')), 'Committed seed must match fixture export');
    await db.exec(fresh);
    // Exercise the legacy TIMESTAMPTZ column and the non-destructive repair.
    await db.exec('ALTER TABLE dataset_info ALTER COLUMN created_on DROP DEFAULT; ALTER TABLE dataset_info ALTER COLUMN created_on TYPE timestamptz USING created_on::timestamptz;');
    await db.exec(read('supabase/migrations/20261015_dataset_created_on_date.sql'));
    await db.exec(read('supabase/migrations/20261015_dataset_created_on_date.sql'));
    await db.exec("INSERT INTO chat_conversations (id,user_id) VALUES ('00000000-0000-0000-0000-000000000001','lan'); INSERT INTO chat_messages (conversation_id,sender,content) VALUES ('00000000-0000-0000-0000-000000000001','user','sample');");
    const before = (await db.query('SELECT count(*) AS count FROM chat_messages')).rows[0].count;
    // Recreate the previous permissive deployment, including a column-level grant.
    await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated; GRANT SELECT (name) ON personas TO anon; CREATE POLICY "Public read for personas" ON personas FOR SELECT USING (true); CREATE POLICY "Public full access to messages" ON chat_messages FOR ALL USING (true);');
    await db.exec(read('supabase/migrations/20261015_close_public_access.sql'));
    await db.exec(read('supabase/migrations/20261015_close_public_access.sql')); // idempotent
    await db.exec(read('supabase/migrations/20261022_governance_activation_gate.sql'));
    await db.exec(read('supabase/migrations/20261022_governance_activation_gate.sql')); // idempotent
    await db.exec(read('supabase/verify_access.sql'));
    let denied = 0;
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role};`);
      assert.equal((await db.query('SELECT public.knowledge_health() AS ready')).rows[0].ready, false);
      for (const table of corpus) {
        await assert.rejects(() => db.query(`SELECT * FROM public.${table}`), /permission denied/); denied++;
      }
      for (const sql of ["INSERT INTO chat_conversations (title) VALUES ('bad')", "UPDATE chat_messages SET content='bad'", 'DELETE FROM chat_messages']) {
        await assert.rejects(() => db.exec(sql), /permission denied/); denied++;
      }
      await db.exec('RESET ROLE;');
    }
    await db.exec('SET ROLE service_role;');
    assert.equal((await db.query('SELECT count(*) AS count FROM documents')).rows[0].count, raw.documents.length);
    await db.exec('RESET ROLE;');
    assert.equal((await db.query('SELECT count(*) AS count FROM chat_messages')).rows[0].count, before);
    // A repeated fresh import fails rather than silently leaving stale rows.
    await assert.rejects(() => db.exec(fresh), /duplicate key/);
    await db.exec('ROLLBACK;');
    await db.exec("UPDATE clauses SET value_number=99 WHERE clause_id='POL-A-LV@v2.0#entitlement';");
    const upsert = runPython('import json,sys; from scripts.export_sqlite_to_supabase import seed_sql; print(seed_sql(json.load(sys.stdin), "upsert"))', JSON.stringify(raw));
    await db.exec(upsert);
    const actual = {};
    for (const table of tables) actual[table] = (await db.query(`SELECT * FROM ${table}`)).rows;
    const evidence = runPython('import json,sys; from scripts.export_sqlite_to_supabase import verify_readback; data=json.load(sys.stdin); print(json.dumps(verify_readback(data["tables"],data["expected"])))', JSON.stringify({ tables: actual, expected: raw }));
    const environment = { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sample-anon-key' };
    const endpoints = [];
    const loader = createLoader(environment);
    // The real SDK is injected through global fetch, so restore it after the probe.
    const originalFetch = global.fetch;
    try {
      global.fetch = async url => { endpoints.push(String(url)); return new Response('true', { status: 200, headers: { 'Content-Type': 'application/json' } }); };
      const probe = loader(path.join(root, 'frontend/src/lib/supabase.ts'));
      assert.deepEqual(JSON.parse(JSON.stringify(probe.cachedSupabaseStatus())), { configured: true, connected: false, checking: true });
      assert.equal(endpoints.length, 0, 'Reading bootstrap health cache must not start network I/O');
      assert.deepEqual(JSON.parse(JSON.stringify(await probe.checkSupabaseConnection())), { configured: true, connected: true, ready: true });
      assert.deepEqual(JSON.parse(JSON.stringify(await probe.checkSupabaseConnection())), { configured: true, connected: true, ready: true });
      assert.equal(endpoints.length, 1, 'Health result must be cached');
      assert.ok(endpoints[0].endsWith('/rest/v1/rpc/knowledge_health'));
      assert.ok(!endpoints.some(endpoint => /dataset_info|personas/.test(endpoint)), 'Health must never read protected tables');
      assert.equal(probe.cachedSupabaseStatus(Date.now() + 30_001).stale, true);
      assert.equal(probe.supabaseStatusNeedsRefresh(probe.cachedSupabaseStatus(Date.now() + 30_001)), true);

      const failedEndpoints = [];
      global.fetch = async url => { failedEndpoints.push(String(url)); return new Response('{"message":"private supabase diagnostic"}', { status: 503, headers: { 'Content-Type': 'application/json' } }); };
      const failedProbe = createLoader(environment)(path.join(root, 'frontend/src/lib/supabase.ts'));
      const telemetryLines = [];
      const originalWarn = console.warn;
      console.warn = line => { telemetryLines.push(String(line)); };
      try {
        assert.deepEqual(JSON.parse(JSON.stringify(await failedProbe.checkSupabaseConnection({ requestId: 'health-test-request' }))), { configured: true, connected: false, error: 'health_unavailable' });
      } finally { console.warn = originalWarn; }
      assert.deepEqual(JSON.parse(JSON.stringify(await failedProbe.checkSupabaseConnection())), { configured: true, connected: false, error: 'health_unavailable' });
      assert.equal(failedEndpoints.length, 1, 'Failed health result must be cached');
      assert.ok(failedEndpoints[0].endsWith('/rest/v1/rpc/knowledge_health'));
      assert.equal(telemetryLines.length, 1, 'Failed health probe must emit one telemetry event');
      const telemetry = JSON.parse(telemetryLines[0]);
      assert.deepEqual(Object.keys(telemetry).sort(), ['code', 'elapsedMs', 'errorClass', 'event', 'requestId', 'stage']);
      assert.equal(telemetry.event, 'dependency_error');
      assert.equal(telemetry.requestId, 'health-test-request');
      assert.equal(telemetry.stage, 'supabase.health');
      assert.equal(telemetry.code, 'health_unavailable');
      assert.equal(telemetry.errorClass, 'SupabaseRpcError');
      assert.ok(Number.isInteger(telemetry.elapsedMs) && telemetry.elapsedMs >= 0);
      assert.ok(!telemetryLines[0].includes(environment.NEXT_PUBLIC_SUPABASE_URL));
      assert.ok(!telemetryLines[0].includes(environment.NEXT_PUBLIC_SUPABASE_ANON_KEY));
      assert.ok(!telemetryLines[0].includes('private supabase diagnostic'));
    } finally { global.fetch = originalFetch; }
    console.log(`${denied} public operations denied; single-RPC health is cached; inactive mock health is false; service_role preserved; migrations idempotent; chat rows intact.`);
    console.log(`All nine PostgreSQL tables match exported snapshot: ${JSON.parse(evidence).dataset_sha256}`);
  } finally { await db.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
