const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');

function createLoader(environment = {}, fetchImpl = () => { throw new Error('Unexpected network request'); }, globals = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} };
    cache.set(file, loaded);
    const localRequire = createRequire(file);
    const customRequire = name => {
      if (name.startsWith('.')) {
        const resolved = path.resolve(path.dirname(file), name);
        if (fs.existsSync(resolved + '.ts')) return load(resolved + '.ts');
      }
      return localRequire(name);
    };
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new vm.Script(compiled, { filename: file }).runInNewContext({
      module: loaded, exports: loaded.exports, require: customRequire, process: { env: environment }, console,
      fetch: fetchImpl, AbortSignal, TextEncoder, TextDecoder, URL, Response, Request, ReadableStream,
      setTimeout, clearTimeout,
      ...globals,
    });
    return loaded.exports;
  }
  return load;
}
module.exports = { createLoader };
