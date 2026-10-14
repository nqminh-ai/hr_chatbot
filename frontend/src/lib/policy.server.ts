import { createHash } from 'node:crypto';
import seed from '../../../data/knowledge.json';
import type { Citation, KnowledgeGraphData } from '../types';

type Clause = typeof seed.documents[number]['clauses'][number];
type Policy = typeof seed.documents[number];
type Profile = typeof seed.personas[number];
export type Fact = { key: string; text: string; citation: Citation; value: number | string | null; unit: string };
export type HistoryTurn = { sender: 'user' | 'assistant'; content: string };
export type PolicyResult = {
  status: 'ok' | 'refused' | 'conflict' | 'needs_clarification' | 'insufficient_evidence' | 'out_of_scope';
  answer: string; query_date: string; citations: Citation[]; graph: KnowledgeGraphData;
  trace: Record<string, unknown>; facts: Fact[];
};

export const isSampleDataset = seed.artifact_kind === 'mock_runtime';
const snapshot = createHash('sha256').update(JSON.stringify(seed)).digest('hex');
const labels: Record<string, string> = { entitlement: 'Số ngày phép', notice_period: 'Báo trước', approver: 'Người phê duyệt', blackout_period: 'Thời gian hạn chế nghỉ', contingency: 'Trực thay' };
export const normalize = (text: string) => text.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function validDate(day: unknown): day is string {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
}

function scopePath(profile: Profile) {
  const scopes: string[] = [];
  let current: string | null = profile.team || profile.department;
  while (current) {
    if (scopes.includes(current)) throw new Error('Invalid organization');
    scopes.push(current);
    const unit = seed.organization.find(item => item.id === current);
    if (!unit) throw new Error('Invalid scope');
    current = unit.parent;
  }
  return scopes;
}

function readable(policy: Policy, profile: Profile, scopes: string[]) {
  const access = policy.access;
  return scopes.includes(policy.scope.unit_id) && access.applies_to.includes(profile.contract_type)
    && (!access.allowed_roles.length || (access.allowed_roles as readonly string[]).includes(profile.role))
    && (!access.audience_roles.length || (access.audience_roles as readonly string[]).includes(profile.role))
    && ['Internal', 'Confidential'].includes(access.classification)
    && (access.classification !== 'Confidential' || access.allowed_roles.length > 0);
}

function effective(policy: Policy, day: string) {
  const lifecycle = policy.lifecycle;
  return lifecycle.events.some(event => event.event === 'approved' && event.at <= day)
    && !lifecycle.events.some(event => event.event === 'revoked' && event.at <= day)
    && lifecycle.valid_from <= day && (!lifecycle.valid_to || day < lifecycle.valid_to);
}

function renderClause(clause: Clause) {
  const value = clause.typed_value;
  if (value.kind !== 'number') return clause.text_source;
  if (clause.key === 'entitlement') return `${value.value} ngày phép năm có hưởng lương.`;
  const units: Record<string, string> = { business_days: 'ngày làm việc', calendar_days: 'ngày lịch', unspecified_days: 'ngày (nguồn chưa xác định ngày làm việc hay ngày lịch)' };
  return `Thông báo trước tối thiểu ${value.value} ${units[value.unit] || value.unit}.`;
}

function makeFact(policy: Policy, clause: Clause): Fact {
  return { key: clause.key, text: renderClause(clause), value: clause.typed_value.value, unit: clause.typed_value.unit,
    citation: { doc_id: policy.policy_id, version: policy.version, clause: clause.key, title: policy.title,
      text_source: renderClause(clause), valid_from: policy.lifecycle.valid_from, scope_level: policy.scope.level } };
}

export function policyAnswer(personaId: string, query: string, day: string, history: HistoryTurn[] = []): PolicyResult {
  const result: PolicyResult = { status: 'ok', answer: '', query_date: day, facts: [], citations: [], graph: { nodes: [], edges: [] }, trace: { snapshot_id: snapshot, data_kind: 'sample', query_date: day } };
  const fail = (status: PolicyResult['status'], answer: string) => ({ ...result, status, answer });
  const profile = seed.personas.find(item => item.user_id === personaId);
  if (!profile) return fail('refused', 'Không tìm thấy bối cảnh tra cứu phù hợp. Bạn hãy chọn lại trong phần thiết lập.');
  const text = normalize(query);
  if (/^(xin chao|chao|hello|hi|hey|alo)[!.? ]*$/.test(text)) return fail('ok', 'Chào bạn! Mình có thể giúp tra cứu ngày phép, thời hạn báo trước và người phê duyệt. Bạn cứ hỏi tự nhiên, rồi hỏi tiếp nếu cần làm rõ.');
  if (/^(cam on|thanks|thank you|ok|okay|oke|duoc roi|hieu roi)[!.? ]*$/.test(text)) return fail('ok', 'Rất vui vì giúp được bạn. Bạn còn muốn làm rõ điều gì về chính sách nghỉ phép?');
  const dates = [...new Set([...query.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(match => match[0]))];
  if (dates.length > 1 || (dates.length === 1 && !validDate(dates[0]))) return fail('needs_clarification', 'Bạn muốn tra cứu tại ngày nào? Hãy chọn một ngày hợp lệ, ví dụ 2026-10-14.');
  if (dates.length) day = dates[0];
  if (!dates.length) {
    for (const turn of [...history].reverse().filter(item => item.sender === 'user')) {
      const priorDates = [...new Set([...turn.content.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(match => match[0]))];
      if (priorDates.length === 1 && validDate(priorDates[0])) { day = priorDates[0]; break; }
    }
  }
  if (!dates.length && /hom nay|hien tai|bay gio/.test(text)) day = today();
  if (!dates.length && /\b(?:nam (?:sau|truoc)|20\d{2})\b/.test(text)) return fail('needs_clarification', 'Chính sách có thể đổi trong năm. Bạn cho mình ngày cụ thể để đối chiếu đúng phiên bản nhé.');
  result.query_date = day; result.trace.query_date = day;
  const scopes = scopePath(profile);
  const requestedScopes = seed.organization.filter(unit => unit.query_aliases.some(alias => text.includes(normalize(alias))));
  if (requestedScopes.some(unit => !scopes.includes(unit.id))) return fail('refused', 'Phạm vi được hỏi khác với bối cảnh tra cứu hiện tại. Bạn có thể đổi bối cảnh trong phần thiết lập.');
  const otherPerson = seed.personas.find(person => person.user_id !== personaId && text.includes(`cua ${normalize(person.name)}`));
  if (otherPerson) return fail('needs_clarification', `Để tra cứu cho ${otherPerson.name}, bạn hãy đổi bối cảnh nhân sự trong phần thiết lập. Mình sẽ mở hội thoại riêng để tránh trộn chính sách.`);
  const company = text.match(/\b(?:cong ty|cty) ([ab])\b/);
  const target = query.match(/\b(?:POL|GUD|DRF)-[A-Z0-9-]+\b/i)?.[0].toUpperCase();
  const version = query.match(/\bv\d+\.\d+\b/i)?.[0].toLowerCase();
  const restricted = /confidential|tai lieu mat|executive|ban giam doc|lanh dao/.test(text);
  if ((company && profile.company !== `CTY_${company[1].toUpperCase()}`) || /du thao|\bdraft\b/.test(text)) return fail('refused', 'Mình chưa có chính sách được phép áp dụng cho yêu cầu này trong bối cảnh hiện tại.');
  if (version && !target) return fail('needs_clarification', 'Bạn muốn xem phiên bản này của tài liệu nào?');
  const visible = seed.documents.filter(policy => readable(policy, profile, scopes))
    .filter(policy => (!target || policy.policy_id === target) && (!version || policy.version.toLowerCase() === version))
    .filter(policy => !restricted || policy.access.classification === 'Confidential');
  const groups = new Map<string, Policy[]>();
  for (const policy of visible.filter(item => item.lifecycle.events.some(event => event.event === 'approved'))) {
    const key = `${policy.policy_id}:${policy.scope.unit_id}:${policy.access.audience_roles.join(',')}`;
    groups.set(key, [...(groups.get(key) || []), policy]);
  }
  let selected: Policy[] = [];
  for (const versions of groups.values()) {
    const active = versions.filter(policy => effective(policy, day));
    if (active.length > 1 || (!active.length && versions.some(policy => policy.lifecycle.valid_to && policy.lifecycle.valid_to <= day) && versions.some(policy => policy.lifecycle.valid_from > day))) return fail('conflict', 'Các phiên bản chính sách tại ngày này có khoảng trống hoặc chồng lấn. Mình chưa thể kết luận; cần HR làm rõ.');
    selected.push(...active);
  }
  if (!selected.length) return fail('refused', 'Chưa có quy định nghỉ phép phù hợp với hợp đồng và phạm vi hiện tại. Bạn nên liên hệ HR để làm rõ điều khoản áp dụng.');
  if (target || restricted) {
    const floors = seed.documents.filter(policy => readable(policy, profile, scopes) && effective(policy, day) && policy.clauses.some(clause => clause.is_floor) && selected.some(item => scopes.indexOf(policy.scope.unit_id) > scopes.indexOf(item.scope.unit_id)));
    selected = [...new Map([...selected, ...floors].map(policy => [policy.doc_uid, policy])).values()];
  }
  selected.sort((a, b) => scopes.indexOf(b.scope.unit_id) - scopes.indexOf(a.scope.unit_id) || a.doc_uid.localeCompare(b.doc_uid));
  const resolved = new Map<string, { policy: Policy; clause: Clause }>();
  const collisions = new Set<string>();
  const floors: { policy: Policy; clause: Clause }[] = [];
  for (const policy of selected) for (const clause of policy.clauses) {
    const key = `${policy.scope.unit_id}:${clause.key}`;
    if (collisions.has(key)) return fail('conflict', 'Có nhiều điều khoản cùng cấp áp dụng đồng thời. Mình cần HR xác nhận trước khi trả lời.');
    collisions.add(key); resolved.set(clause.key, { policy, clause });
    if (clause.is_floor) floors.push({ policy, clause });
  }
  for (const floor of floors) {
    const current = resolved.get(floor.clause.key)!;
    if (current.clause.typed_value.kind === 'unlimited') continue;
    if (current.clause.typed_value.kind !== 'number' || current.clause.typed_value.unit !== floor.clause.typed_value.unit) return fail('conflict', 'Loại ngày trong chính sách chưa tương thích để đối chiếu sàn. Cần HR xác nhận.');
    if (Number(current.clause.typed_value.value) < Number(floor.clause.typed_value.value)) resolved.set(floor.clause.key, floor);
  }
  const unsupported = /ung truoc|bao luu|chuyen ngay phep|cong don|carry.?over|ban ngay phep|mua ngay phep|nghi om|thai san|tham nien|con lai|da nghi|so du/.test(text);
  if (unsupported) return fail('insufficient_evidence', 'Trong bộ chính sách mẫu hiện tại, mình chưa có căn cứ cho nội dung này. Mình không thể suy ra số ngày phép còn lại hoặc xác nhận quyền ứng trước/chuyển phép. Bạn cần HR xác nhận thêm.');
  if (/thoi tiet|chung khoan|gia vang|viet code|lap trinh/.test(text)) return fail('out_of_scope', 'Hiện mình hỗ trợ chính sách nghỉ phép. Bạn muốn hỏi về ngày phép, báo trước hay phê duyệt?');
  const slots: Record<string, RegExp> = { notice_period: /bao truoc|thong bao|dang ky lich|bao lau/, approver: /duyet|phe duyet/, blackout_period: /release|cam nghi|khong duoc nghi/, contingency: /truc|thay the|nguoi thay|backup/, entitlement: /bao nhieu|may ngay|so ngay|che do|thuong nien/ };
  let keys = Object.keys(slots).filter(key => slots[key].test(text));
  if (keys.includes('notice_period')) keys = keys.filter(key => key !== 'entitlement');
  if (!keys.length && /tom tat|ngan gon|noi lai|giai thich|vi sao|tai sao|dieu do|the thi/.test(text)) {
    const previous = normalize(history.filter(turn => turn.sender === 'user').at(-1)?.content || '');
    keys = Object.keys(slots).filter(key => slots[key].test(previous));
  }
  const facts = [...resolved.values()].map(({ policy, clause }) => makeFact(policy, clause)).filter(fact => !keys.length || keys.includes(fact.key));
  if (!facts.length) return fail('insufficient_evidence', 'Mình chưa thấy điều khoản về nội dung này trong chính sách áp dụng. Bạn muốn mình kiểm tra mục khác không?');
  result.facts = facts; result.citations = facts.map(fact => fact.citation);
  result.answer = facts.length === 1 ? `${facts[0].text}\n\nTheo **${facts[0].citation.doc_id} ${facts[0].citation.version}**, áp dụng tại ${day}.` : `Theo chính sách áp dụng tại ${day}:\n\n${facts.map(fact => `- **${labels[fact.key] || fact.key}:** ${fact.text}`).join('\n')}`;
  if (/khong.*(?:ai|nguoi).*(?:truc|thay)|khong co.*backup/.test(text)) {
    result.status = 'insufficient_evidence';
    result.answer += '\n\nChưa có căn cứ cho phép nghỉ khi thiếu người trực thay. Cần HR hoặc quản lý xác nhận; mình không thể kết luận được miễn điều kiện này.';
  }
  const graph = result.graph;
  graph.nodes.push({ id: `user:${profile.user_id}`, label: profile.name, type: 'persona' });
  const documents = new Set<string>();
  for (const fact of facts) {
    const id = `${fact.citation.doc_id}@${fact.citation.version}`;
    if (!documents.has(id)) { documents.add(id); graph.nodes.push({ id, label: id, type: 'policy' }); graph.edges.push({ source: `user:${profile.user_id}`, target: id, label: 'áp dụng' }); }
    const clauseId = `${id}#${fact.key}`;
    graph.nodes.push({ id: clauseId, label: fact.text, type: 'clause' }); graph.edges.push({ source: id, target: clauseId, label: 'căn cứ' });
  }
  result.trace = { ...result.trace, status: result.status, matched_policies: [...documents], clause_keys: facts.map(fact => fact.key) };
  return result;
}
