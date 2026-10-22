import { knowledgeSnapshot } from './dataset.server';
import { normalize, resolveIntent, today, validDate, type HistoryTurn, type PolicyContext } from './intent.server';
import { factGraph, PolicyConflict, renderFacts, resolveFacts, scopePath, selectPolicies, type Fact } from './policy-resolution.server';
import type { Citation, KnowledgeGraphData } from '../types';

export { normalize, today, validDate };
export type { Fact, HistoryTurn, PolicyContext };
export type PolicyResult = {
  status: 'ok' | 'refused' | 'conflict' | 'needs_clarification' | 'insufficient_evidence' | 'out_of_scope';
  answer: string; query_date: string; citations: Citation[]; graph: KnowledgeGraphData;
  trace: Record<string, unknown>; facts: Fact[]; context: PolicyContext;
};
export const isSampleDataset = knowledgeSnapshot.data.artifact_kind === 'mock_runtime';
const messages = {
  refused: 'Mình chưa có chính sách được phép áp dụng cho yêu cầu này trong bối cảnh hiện tại. Bạn nên liên hệ HR để làm rõ.',
  conflict: 'Chính sách tại ngày này có khoảng trống, chồng lấn hoặc điều khoản chưa tương thích. Cần HR làm rõ trước khi áp dụng.',
  needs_clarification: 'Bạn làm rõ chính sách và ngày cần tra cứu nhé. Chính sách có thể thay đổi trong năm nên cần một ngày cụ thể.',
  insufficient_evidence: 'Trong bộ chính sách mẫu hiện tại, mình chưa có căn cứ cho nội dung này. Bạn cần HR xác nhận thêm.',
  out_of_scope: 'Hiện mình hỗ trợ chính sách nghỉ phép. Bạn muốn hỏi về ngày phép, báo trước hay phê duyệt?',
};

export function policyAnswer(personaId: string, query: string, day: string, history: HistoryTurn[] = [], previous?: PolicyContext,
  snapshot: typeof knowledgeSnapshot = knowledgeSnapshot): PolicyResult {
  const intent = resolveIntent(query, day, history, previous, snapshot);
  const context = intent.context;
  const result: PolicyResult = { status: 'ok', answer: '', query_date: intent.context.date, citations: [], facts: [],
    graph: { nodes: [], edges: [] }, context,
    trace: { snapshot_id: snapshot.id, data_kind: 'sample', query_date: intent.context.date } };
  const fail = (status: keyof typeof messages) => ({ ...result, status, answer: messages[status] });
  const profile = snapshot.profiles[personaId];
  if (!profile) return fail('refused');
  if (/^(xin chao|chao|hello|hi|hey|alo)[!.? ]*$/.test(intent.text)) return { ...result, answer: 'Chào bạn! Mình có thể giúp tra cứu ngày phép, thời hạn báo trước và người phê duyệt.' };
  if (/^(cam on|thanks|thank you|ok|okay|oke|duoc roi|hieu roi)[!.? ]*$/.test(intent.text)) return { ...result, answer: 'Rất vui vì giúp được bạn. Bạn còn muốn làm rõ điều gì về chính sách nghỉ phép?' };
  const scopes = scopePath(profile, snapshot);
  if (intent.draft || intent.scopeIds.some(id => !scopes.includes(id)) || (intent.company && profile.company !== `CTY_${intent.company}`)) return fail('refused');
  if (intent.status !== 'route') return fail(intent.status);
  const otherPerson = snapshot.data.personas.find(person => person.user_id !== personaId && intent.text.includes(`cua ${normalize(person.name)}`));
  if (otherPerson) return fail('needs_clarification');
  return answerPolicies(result, profile, intent.keys, intent.restricted, intent.missingBackup, snapshot);
}

function answerPolicies(result: PolicyResult, profile: typeof knowledgeSnapshot.data.personas[number], keys: string[], restricted: boolean,
  missingBackup: boolean, snapshot: typeof knowledgeSnapshot): PolicyResult {
  try {
    const { date, policyId, version } = result.context;
    const documents = selectPolicies(profile, date, policyId, version, restricted, snapshot);
    if (!documents.length) return { ...result, status: 'refused', answer: messages.refused };
    const facts = resolveFacts(documents, profile, keys, snapshot);
    if (!facts.length) return { ...result, status: 'insufficient_evidence', answer: messages.insufficient_evidence };
    return { ...result, facts, citations: facts.map(fact => fact.citation), graph: factGraph(facts, profile),
      status: missingBackup ? 'insufficient_evidence' : 'ok',
      answer: renderFacts(facts, date) + (missingBackup ? '\n\nChưa có căn cứ cho phép nghỉ khi thiếu người trực thay. Cần HR hoặc quản lý xác nhận.' : ''),
      context: { ...result.context, keys: facts.map(fact => fact.key) },
      trace: { ...result.trace, status: missingBackup ? 'insufficient_evidence' : 'ok',
        matched_policies: [...new Set(facts.map(fact => `${fact.citation.doc_id}@${fact.citation.version}`))], clause_keys: facts.map(fact => fact.key) },
    };
  } catch (error) {
    if (!(error instanceof PolicyConflict)) throw error;
    return { ...result, status: 'conflict', answer: messages.conflict };
  }
}
