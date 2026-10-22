import { knowledgeSnapshot, type Policy, type Profile, type Clause } from './dataset.server';
import type { Citation, KnowledgeGraphData } from '../types';

export type Fact = { key: string; text: string; citation: Citation; value: number | string | null; unit: string };
export class PolicyConflict extends Error {}

export function scopePath(profile: Profile, snapshot: typeof knowledgeSnapshot = knowledgeSnapshot) {
  const scopes: string[] = [];
  let current: string | null = profile.team || profile.department;
  while (current) { scopes.push(current); current = snapshot.units[current].parent; }
  return scopes;
}

export function readable(policy: Policy, profile: Profile, scopes: string[]) {
  const access = policy.access;
  return scopes.includes(policy.scope.unit_id) && access.applies_to.includes(profile.contract_type)
    && (!access.allowed_roles.length || (access.allowed_roles as readonly string[]).includes(profile.role))
    && (!access.audience_roles.length || (access.audience_roles as readonly string[]).includes(profile.role))
    && ['Internal', 'Confidential'].includes(access.classification)
    && (access.classification !== 'Confidential' || access.allowed_roles.length > 0);
}

export function effective(policy: Policy, day: string) {
  const life = policy.lifecycle;
  return life.events.some(event => event.event === 'approved' && event.at <= day)
    && !life.events.some(event => event.event === 'revoked' && event.at <= day)
    && life.valid_from <= day && (!life.valid_to || day < life.valid_to);
}

export function selectVersions(documents: Policy[], day: string) {
  const groups = new Map<string, Policy[]>();
  for (const policy of documents.filter(item => item.lifecycle.events.some(event => event.event === 'approved'))) {
    const key = `${policy.policy_id}:${policy.scope.unit_id}:${policy.access.audience_roles.join(',')}`;
    groups.set(key, [...(groups.get(key) || []), policy]);
  }
  const selected: Policy[] = [];
  for (const versions of groups.values()) {
    const active = versions.filter(policy => effective(policy, day));
    const gap = !active.length && versions.some(policy => policy.lifecycle.valid_to && policy.lifecycle.valid_to <= day)
      && versions.some(policy => policy.lifecycle.valid_from > day);
    if (active.length > 1 || gap) throw new PolicyConflict();
    selected.push(...active);
  }
  return selected;
}

export function selectPolicies(profile: Profile, day: string, target: string | null, version: string | null, restricted: boolean,
  snapshot: typeof knowledgeSnapshot = knowledgeSnapshot) {
  const scopes = scopePath(profile, snapshot);
  const allowed = snapshot.data.documents.filter(policy => readable(policy, profile, scopes));
  const selected = selectVersions(allowed.filter(policy => (!target || policy.policy_id === target)
    && (!version || policy.version.toLowerCase() === version)
    && (!restricted || policy.access.classification === 'Confidential')), day);
  if (selected.length && (target || restricted)) {
    const floors = allowed.filter(policy => policy.clauses.some(clause => clause.is_floor)
      && selected.every(item => scopes.indexOf(policy.scope.unit_id) > scopes.indexOf(item.scope.unit_id)));
    return [...new Map([...selected, ...selectVersions(floors, day)].map(policy => [policy.doc_uid, policy])).values()];
  }
  return selected;
}

export function renderClause(clause: Clause) {
  const value = clause.typed_value;
  if (value.kind !== 'number') return clause.text_source;
  if (clause.key === 'entitlement') return `${value.value} ngày phép năm có hưởng lương.`;
  const units: Record<string, string> = { business_days: 'ngày làm việc', calendar_days: 'ngày lịch', unspecified_days: 'ngày (nguồn chưa xác định ngày làm việc hay ngày lịch)' };
  return `Thông báo trước tối thiểu ${value.value} ${units[value.unit]}.`;
}

export function resolveFacts(documents: Policy[], profile: Profile, keys: string[], snapshot: typeof knowledgeSnapshot = knowledgeSnapshot): Fact[] {
  const scopes = scopePath(profile, snapshot);
  const resolved = new Map<string, { policy: Policy; clause: Clause }>();
  const collisions = new Set<string>();
  const floors: { policy: Policy; clause: Clause }[] = [];
  const ordered = [...documents].sort((left, right) => scopes.indexOf(right.scope.unit_id) - scopes.indexOf(left.scope.unit_id) || left.doc_uid.localeCompare(right.doc_uid));
  for (const policy of ordered) for (const clause of policy.clauses) {
    const id = `${policy.scope.unit_id}:${clause.key}`;
    if (collisions.has(id)) throw new PolicyConflict();
    collisions.add(id); resolved.set(clause.key, { policy, clause });
    if (clause.is_floor) floors.push({ policy, clause });
  }
  for (const floor of floors) {
    const current = resolved.get(floor.clause.key)!;
    if (current.clause.typed_value.kind === 'unlimited') continue;
    if (current.clause.typed_value.kind !== 'number' || current.clause.typed_value.unit !== floor.clause.typed_value.unit) throw new PolicyConflict();
    if (Number(current.clause.typed_value.value) < Number(floor.clause.typed_value.value)) resolved.set(floor.clause.key, floor);
  }
  return [...resolved.values()].filter(({ clause }) => !keys.length || keys.includes(clause.key)).map(({ policy, clause }) => ({
    key: clause.key, text: renderClause(clause), value: clause.typed_value.value, unit: clause.typed_value.unit,
    citation: { doc_id: policy.policy_id, doc_uid: policy.doc_uid, version: policy.version,
      clause: clause.key, title: policy.title,
      text_source: clause.text_source, valid_from: policy.lifecycle.valid_from,
      valid_to: policy.lifecycle.valid_to, scope_level: policy.scope.level,
      source_ref: clause.source_ref, clause_id: clause.clause_id },
  }));
}

export const labels: Record<string, string> = { entitlement: 'Số ngày phép', notice_period: 'Báo trước', approver: 'Người phê duyệt', blackout_period: 'Thời gian hạn chế nghỉ', contingency: 'Trực thay' };
export function renderFacts(facts: Fact[], day: string) {
  if (facts.length === 1) return `${facts[0].text}\n\nTheo **${facts[0].citation.doc_id} ${facts[0].citation.version}**, áp dụng tại ${day}.`;
  return `Theo chính sách áp dụng tại ${day}:\n\n${facts.map(fact => `- **${labels[fact.key]}:** ${fact.text}`).join('\n')}`;
}

export function factGraph(facts: Fact[], profile: Profile): KnowledgeGraphData {
  const graph: KnowledgeGraphData = { nodes: [{ id: `user:${profile.user_id}`, label: profile.name, type: 'persona' }], edges: [] };
  const documents = new Set<string>();
  for (const fact of facts) {
    const id = `${fact.citation.doc_id}@${fact.citation.version}`;
    if (!documents.has(id)) {
      documents.add(id); graph.nodes.push({ id, label: id, type: 'policy' });
      graph.edges.push({ source: `user:${profile.user_id}`, target: id, label: 'áp dụng' });
    }
    const clauseId = `${id}#${fact.key}`;
    graph.nodes.push({ id: clauseId, label: fact.text, type: 'clause' });
    graph.edges.push({ source: id, target: clauseId, label: 'căn cứ' });
  }
  return graph;
}
