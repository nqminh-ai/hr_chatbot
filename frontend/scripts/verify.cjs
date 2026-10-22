const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(frontendRoot, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function defaultPython() {
  if (process.env.APPOTA_PYTHON) return process.env.APPOTA_PYTHON;
  const virtualEnvironmentPython = process.platform === 'win32'
    ? path.join(repositoryRoot, '.venv', 'Scripts', 'python.exe')
    : path.join(repositoryRoot, '.venv', 'bin', 'python');
  if (existsSync(virtualEnvironmentPython)) return virtualEnvironmentPython;
  return process.platform === 'win32' ? 'python' : 'python3';
}

const pythonCommand = defaultPython();
const environment = { ...process.env, APPOTA_PYTHON: pythonCommand };

function run(label, command, args, options = {}) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || repositoryRoot,
    env: { ...environment, ...(options.env || {}) },
    stdio: 'inherit',
    shell: options.shell || false,
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

function runNpm(label, args, options = {}) {
  if (process.env.npm_execpath) {
    run(label, process.execPath, [process.env.npm_execpath, ...args], options);
    return;
  }
  run(label, npmCommand, args, { ...options, shell: process.platform === 'win32' });
}

run('Python validation and engine coverage', pythonCommand, ['-B', 'scripts/check_python_coverage.py']);
runNpm('Frontend and integration tests', ['test'], { cwd: frontendRoot });
runNpm('Frontend lint', ['run', 'lint'], { cwd: frontendRoot });
runNpm('Production build', ['run', 'build'], {
  cwd: frontendRoot,
  env: {
    APPOTA_DEMO_MODE: 'true',
    GEMINI_ENABLED: 'false',
    GEMINI_API_KEY: '',
    NEXT_PUBLIC_SUPABASE_URL: '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
  },
});

console.log('\nAll verification gates passed.');
