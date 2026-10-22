const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function invalid(message) {
  throw new Error(`Provenance verification failed: ${message}`);
}

function safeSourcePath(root, name) {
  if (typeof name !== 'string' || !name || path.posix.isAbsolute(name)
      || name.includes('\\') || name.includes(':') || name.split('/').includes('..')) {
    invalid('source path must stay within the repository');
  }
  let target;
  try {
    target = fs.realpathSync(path.resolve(root, ...name.split('/')));
  } catch {
    invalid(`cannot read source evidence: ${name}`);
  }
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    invalid(`source path escapes through a symbolic link: ${name}`);
  }
  return target;
}

function decodePointerToken(token) {
  if (/~(?:[^01]|$)/.test(token)) invalid('source JSON pointer has an invalid escape');
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function pointerValue(raw, pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) {
    invalid('source pointer must be an absolute JSON pointer');
  }
  let value = raw;
  for (const encoded of pointer.slice(1).split('/')) {
    const token = decodePointerToken(encoded);
    if (Array.isArray(value)) {
      if (!/^(0|[1-9]\d*)$/.test(token) || Number(token) >= value.length) {
        invalid('source JSON pointer does not resolve');
      }
      value = value[Number(token)];
    } else if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, token)) {
      value = value[token];
    } else {
      invalid('source JSON pointer does not resolve');
    }
  }
  return value;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sameTypedValue(actual, expected) {
  if (actual === null || expected === null) return actual === expected;
  return typeof actual === typeof expected && Object.is(actual, expected);
}

function normalizedText(value) {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function topLevelObjectRanges(content) {
  const ranges = [];
  let depth = 0;
  let start = 0;
  let inString = false;
  let escaped = false;
  const lines = content.toString('utf8').split(/\r\n|[\n\r]/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    for (const character of lines[lineIndex]) {
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
      } else if (character === '"') {
        inString = true;
      } else if (character === '[' || character === '{') {
        if (character === '{' && depth === 1) start = lineIndex + 1;
        depth += 1;
      } else if (character === ']' || character === '}') {
        if (character === '}' && depth === 2) ranges.push([start, lineIndex + 1]);
        depth -= 1;
      }
    }
  }
  return ranges;
}

function verifyProvenance(raw, repositoryRoot = path.resolve(__dirname, '..', '..')) {
  if (!raw || typeof raw !== 'object' || !raw.source_sha256 || !Array.isArray(raw.documents)) {
    invalid('dataset structure is incomplete');
  }

  let root;
  try {
    root = fs.realpathSync(repositoryRoot);
  } catch {
    invalid('repository root is unavailable');
  }

  const sources = Object.create(null);
  const bytesByPath = Object.create(null);
  const rangesByPath = Object.create(null);
  for (const [name, expected] of Object.entries(raw.source_sha256)) {
    const sourcePath = safeSourcePath(root, name);
    let content;
    try {
      content = fs.readFileSync(sourcePath);
      sources[name] = JSON.parse(content.toString('utf8'));
    } catch {
      invalid(`cannot read source evidence: ${name}`);
    }
    const actual = crypto.createHash('sha256').update(content).digest('hex');
    if (actual !== expected) invalid(`actual source fingerprint mismatch: ${name}`);
    bytesByPath[name] = content;
    rangesByPath[name] = topLevelObjectRanges(content);
  }

  const transformations = [];
  let clauseCount = 0;
  for (const document of raw.documents) {
    const provenance = document.provenance;
    const sourcePath = provenance?.source_path;
    const content = bytesByPath[sourcePath];
    if (!content || provenance.sha256 !== raw.source_sha256[sourcePath]) {
      invalid('document source fingerprint differs');
    }
    const lines = content.toString('utf8').split(/\r\n|[\n\r]/);
    if (!Number.isInteger(provenance.line_start) || !Number.isInteger(provenance.line_end)
        || provenance.line_start < 1 || provenance.line_start > provenance.line_end
        || provenance.line_end > lines.length) {
      invalid('document source range is outside the actual file');
    }

    for (const clause of document.clauses) {
      clauseCount += 1;
      const source = clause.source_ref;
      if (source?.path !== sourcePath) invalid('clause source differs from document source');
      const sourceDocumentSet = sources[source.path];
      if (!sourceDocumentSet) invalid('clause source is not fingerprinted');
      const value = pointerValue(sourceDocumentSet, source.json_pointer);
      if (!value || typeof value !== 'object' || Array.isArray(value) || value.text !== clause.text_source) {
        invalid('clause text differs from actual evidence');
      }
      if (!Number.isInteger(source.line) || source.line < provenance.line_start || source.line > provenance.line_end) {
        invalid('clause source line is outside its document');
      }
      const keyLine = new RegExp(`^\\s*"${escapeRegex(clause.key)}":\\s*\\{\\s*$`);
      if (!keyLine.test(lines[source.line - 1])) invalid('clause source line does not identify its key');

      const pointerParts = source.json_pointer.split('/');
      const pointerIndex = pointerParts.length > 1 ? decodePointerToken(pointerParts[1]) : '';
      if (!/^(0|[1-9]\d*)$/.test(pointerIndex)) invalid('clause pointer does not identify a source document');
      const sourceIndex = Number(pointerIndex);
      const sourceDocument = sourceDocumentSet[sourceIndex];
      if (!sourceDocument || sourceDocument.doc_id !== document.policy_id || sourceDocument.version !== document.version) {
        invalid('clause pointer belongs to another policy/version');
      }
      const exactRange = rangesByPath[source.path][sourceIndex];
      if (!exactRange || provenance.line_start !== exactRange[0] || provenance.line_end !== exactRange[1]) {
        invalid('document source range differs from actual evidence');
      }

      const typed = clause.typed_value;
      if (typed.kind === 'unlimited') {
        if (value.value !== 99 || typed.value !== null) invalid('unrecognized unlimited transformation');
        transformations.push({ clause_id: clause.clause_id, decision: 'M03', owner_confirmed: false });
      } else if (!sameTypedValue(value.value, typed.value)) {
        invalid('typed value differs from actual evidence');
      }
      if (Boolean(value.is_floor ?? false) !== clause.is_floor) invalid('floor differs from actual evidence');

      let expectedUnit = 'not_applicable';
      if (clause.key === 'entitlement' && typed.kind === 'number') {
        expectedUnit = 'annual_paid_days';
      } else if (clause.key === 'notice_period') {
        const text = normalizedText(value.text);
        expectedUnit = text.includes('ngay lam viec') ? 'business_days'
          : text.includes('ngay lich') ? 'calendar_days' : 'unspecified_days';
      }
      if (typed.unit !== expectedUnit) invalid('typed unit differs from actual evidence');
    }
  }

  return {
    verified: true,
    sources: Object.keys(sources).length,
    clauses: clauseCount,
    mock_transformations: transformations,
  };
}

module.exports = { pointerValue, verifyProvenance };
