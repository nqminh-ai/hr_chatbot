import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import seed from '../../../data/knowledge.json';
import schema from '../../../schemas/knowledge_runtime_v2.schema.json';

type RawDataset = typeof seed;
export type Clause = RawDataset['documents'][number]['clauses'][number];
export type Policy = Omit<RawDataset['documents'][number], 'clauses'> & { clauses: Clause[] };
export type Dataset = Omit<RawDataset, 'documents'> & { documents: Policy[] };
export type Profile = Dataset['personas'][number];
const levels = ['Group', 'Company', 'Department', 'Team'];
const ajv = new Ajv2020({ strict: false, strictNumbers: true, allErrors: false });
addFormats(ajv);
const validate = ajv.compile<Dataset>(schema);

function requireValid(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(`Invalid policy metadata: ${code}`);
}

function unique<T>(items: T[], key: (item: T) => string): Record<string, T> {
  const entries = items.map(item => [key(item), item] as const);
  requireValid(new Set(entries.map(([id]) => id)).size === entries.length, 'duplicate_id');
  return Object.assign(Object.create(null) as Record<string, T>, Object.fromEntries(entries));
}

function organization(data: Dataset) {
  const units = unique(data.organization, unit => unit.id);
  const profiles = unique(data.personas, profile => profile.user_id);
  const roots = data.organization.filter(unit => unit.parent === null);
  requireValid(roots.length === 1 && roots[0].level === 'Group', 'root');
  function path(start: string): string[] {
    const visited: string[] = [];
    let current: string | null = start;
    while (current) {
      requireValid(units[current] && !visited.includes(current), 'organization_cycle');
      visited.push(current);
      current = units[current].parent;
    }
    return visited;
  }
  for (const unit of data.organization) {
    path(unit.id);
    if (unit.parent) requireValid(levels.indexOf(units[unit.parent].level) + 1 === levels.indexOf(unit.level), 'parent_level');
  }
  for (const profile of data.personas) {
    requireValid(profile.user_id === profile.user_id.toLowerCase().trim(), 'persona_id');
    const chain = path(profile.team || profile.department);
    for (const [id, level] of [[profile.company, 'Company'], [profile.department, 'Department'], [profile.team, 'Team']]) {
      if (id) requireValid(chain.includes(id) && units[id]?.level === level, 'persona_chain');
    }
  }
  return { units, profiles };
}

function lifecycle(policy: Policy) {
  const life = policy.lifecycle;
  requireValid(!life.valid_to || life.valid_to > life.valid_from, 'validity');
  const transitions: Record<string, string[]> = { start: ['drafted', 'approved'], drafted: ['approved'], approved: ['superseded', 'revoked'], superseded: [], revoked: [] };
  const states: Record<string, string> = { drafted: 'Draft', approved: 'Approved', superseded: 'Superseded', revoked: 'Revoked' };
  let previous = 'start';
  let priorDate = '';
  for (const event of life.events) {
    requireValid(transitions[previous].includes(event.event) && event.at >= priorDate, 'lifecycle_transition');
    requireValid(event.event !== 'approved' || event.at <= life.valid_from, 'late_approval');
    previous = event.event;
    priorDate = event.at;
  }
  requireValid(states[previous] === life.state, 'lifecycle_state');
  requireValid(previous !== 'superseded' || life.valid_to === priorDate, 'superseded_end');
}

function clauses(policy: Policy) {
  unique(policy.clauses, clause => clause.key);
  for (const clause of policy.clauses) {
    const value = clause.typed_value;
    requireValid(clause.clause_id === `${policy.doc_uid}#${clause.key}`, 'clause_id');
    const numeric = ['entitlement', 'notice_period'].includes(clause.key);
    requireValid(numeric ? ['number', 'unlimited'].includes(value.kind) : value.kind === 'enum', 'value_kind');
    requireValid(value.kind !== 'unlimited' || clause.key === 'entitlement', 'unlimited_kind');
    const units = clause.key === 'entitlement' ? ['annual_paid_days', 'not_applicable']
      : clause.key === 'notice_period' ? ['business_days', 'calendar_days', 'unspecified_days'] : ['not_applicable'];
    requireValid(units.includes(value.unit), 'value_unit');
    requireValid(!clause.is_floor || (value.kind === 'number' && value.unit !== 'unspecified_days'), 'floor');
    requireValid(clause.is_floor || clause.comparison === 'none', 'comparison');
    requireValid(clause.source_ref.path === policy.provenance.source_path, 'clause_source');
    requireValid(clause.source_ref.line >= policy.provenance.line_start && clause.source_ref.line <= policy.provenance.line_end, 'source_line');
  }
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

export function buildSnapshot(raw: unknown) {
  requireValid(validate(raw), 'schema');
  const data: Dataset = JSON.parse(JSON.stringify(raw));
  const { units, profiles } = organization(data);
  const policies = unique(data.documents, policy => policy.doc_uid);
  unique(data.documents.flatMap(policy => policy.clauses), clause => clause.clause_id);
  for (const policy of data.documents) {
    requireValid(policy.doc_uid === `${policy.policy_id}@${policy.version}`, 'policy_id');
    requireValid(units[policy.scope.unit_id]?.level === policy.scope.level, 'scope_level');
    const source = policy.provenance.source_path;
    requireValid(!source.startsWith('/') && !source.includes('\\') && !source.includes(':') && !source.split('/').includes('..'), 'source_path');
    requireValid((data.source_sha256 as Record<string, string>)[source] === policy.provenance.sha256, 'source_hash');
    lifecycle(policy);
    clauses(policy);
    for (const priorId of policy.supersedes) {
      const prior = policies[priorId];
      requireValid(prior && priorId !== policy.doc_uid && prior.policy_id === policy.policy_id
        && prior.scope.unit_id === policy.scope.unit_id && prior.scope.level === policy.scope.level
        && prior.lifecycle.valid_from < policy.lifecycle.valid_from, 'supersedes');
    }
  }
  const id = createHash('sha256').update(JSON.stringify(data)).update('\0').update(JSON.stringify(schema)).digest('hex');
  return freeze({ data, units, profiles, id });
}

export const knowledgeSnapshot = buildSnapshot(seed);
