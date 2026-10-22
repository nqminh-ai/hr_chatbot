import rules from '../../../data/intent_rules.json';
import { knowledgeSnapshot } from './dataset.server';
import { businessToday as today, validDate } from './calendar';
export { today, validDate };

export type HistoryTurn = { sender: 'user' | 'assistant'; content: string };
export type PolicyContext = { date: string; policyId: string | null; version: string | null; keys: string[]; snapshotId: string };
export const normalize = (text: string) => text.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const contains = (text: string, phrases: string[]) => phrases.some(phrase => new RegExp(`(?<!\\w)${escape(phrase)}(?!\\w)`).test(text));
const scopeCache = new WeakMap<object, { id: string; pattern: RegExp }[]>();
function scopesFor(snapshot: typeof knowledgeSnapshot) {
  const cached = scopeCache.get(snapshot);
  if (cached) return cached;
  const compiled = snapshot.data.organization.map(unit => {
    const prefix = '\\b(?:quy dinh|chinh sach|nghi phep|tai lieu)(?: (?:nghi phep|cua|tai|cho))* ';
    const aliases = (unit.query_aliases || []).map(alias => `${prefix}${escape(normalize(alias))}(?!\\w)`);
    return { id: unit.id, pattern: new RegExp([`(?<!\\w)${escape(normalize(unit.id))}(?!\\w)`, ...aliases].join('|')) };
  });
  scopeCache.set(snapshot, compiled);
  return compiled;
}

function updateContext(query: string, context: PolicyContext): PolicyContext {
  const text = normalize(query);
  const dates = [...new Set([...query.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(match => match[0]))];
  const policy = query.match(/\b(?:POL|GUD|DRF)-[A-Z0-9-]+\b/i)?.[0].toUpperCase();
  const version = query.match(/\bv\d+\.\d+\b/i)?.[0].toLowerCase();
  let keys = Object.entries(rules.slots).filter(([, phrases]) => contains(text, phrases)).map(([key]) => key);
  if (keys.includes('notice_period')) keys = keys.filter(key => key !== 'entitlement');
  return { ...context,
    date: dates.length === 1 && validDate(dates[0]) ? dates[0] : contains(text, rules.current_date) ? today() : context.date,
    policyId: policy || context.policyId, version: version || (policy ? null : context.version),
    keys: keys.length ? keys : contains(text, rules.topics) ? Object.keys(rules.slots) : context.keys,
  };
}

export function validContext(value: unknown): value is PolicyContext {
  if (!value || typeof value !== 'object') return false;
  const context = value as PolicyContext;
  return validDate(context.date) && (context.policyId === null || (typeof context.policyId === 'string' && /^(?:POL|GUD|DRF)-[A-Z0-9-]+$/.test(context.policyId)))
    && (context.version === null || (typeof context.version === 'string' && /^v\d+\.\d+$/.test(context.version)))
    && Array.isArray(context.keys) && context.keys.length <= 5 && context.keys.every(key => Object.hasOwn(rules.slots, key))
    && typeof context.snapshotId === 'string';
}

export function resolveIntent(query: string, day: string, history: HistoryTurn[], previous?: PolicyContext,
  snapshot: typeof knowledgeSnapshot = knowledgeSnapshot) {
  let context: PolicyContext = previous?.snapshotId === snapshot.id ? { ...previous }
    : { date: day, policyId: null, version: null, keys: [], snapshotId: snapshot.id };
  if (!previous) for (const turn of history.filter(turn => turn.sender === 'user').slice(-20)) context = updateContext(turn.content, context);
  const text = normalize(query);
  const dates = [...new Set([...query.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(match => match[0]))];
  context = updateContext(query, context);
  const currentKeys = Object.entries(rules.slots).filter(([, phrases]) => contains(text, phrases)).map(([key]) => key);
  const summary = contains(text, rules.summary) && context.keys.length > 0;
  const topic = contains(text, rules.topics) || /\bnghi (?:bao nhieu|may) ngay\b/.test(text)
    || contains(text, rules.unsupported)
    || currentKeys.some(key => key !== 'entitlement') || /\b(?:pol|gud|drf)-[a-z0-9-]+\b/.test(text) || summary;
  let status: 'route' | 'out_of_scope' | 'insufficient_evidence' | 'needs_clarification' = 'route';
  const draft = contains(text, ['du thao', 'draft']);
  if (!topic || contains(text, rules.out_of_scope)) status = 'out_of_scope';
  else if (contains(text, rules.unsupported)) status = 'insufficient_evidence';
  else if (contains(text, ['luong cua toi', 'muc luong'])) status = 'needs_clarification';
  else if (!draft && (dates.length > 1 || (dates.length === 1 && !validDate(dates[0]))
    || (!dates.length && /\b(?:nam (?:sau|truoc)|20\d{2})\b/.test(text)))) status = 'needs_clarification';
  else if (!draft && /\bv\d+\.\d+\b/i.test(query) && !context.policyId) status = 'needs_clarification';
  const keys = currentKeys.length ? currentKeys.filter(key => key !== 'entitlement' || !currentKeys.includes('notice_period')) : summary ? context.keys : [];
  return { status, text, context, keys, draft,
    restricted: /confidential|tai lieu mat|executive|board|ban giam doc|lanh dao/.test(text),
    scopeIds: scopesFor(snapshot).filter(scope => scope.pattern.test(text)).map(scope => scope.id),
    company: text.match(/\b(?:cong ty|cty) ([ab])\b/)?.[1].toUpperCase(),
    missingBackup: /khong.*(?:ai|nguoi).*(?:truc|thay)|khong co.*backup/.test(text),
  };
}
