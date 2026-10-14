import { validDate } from './calendar';
import type { ChatMessage, Conversation, Persona } from '../types';

const statuses = ['ok', 'insufficient_evidence', 'out_of_scope', 'conflict', 'error', 'refused', 'needs_clarification'];
const keys = ['entitlement', 'notice_period', 'approver', 'blackout_period', 'contingency'];
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 4000): value is string => typeof value === 'string' && value.length <= max;
const timestamp = (value: unknown) => text(value, 40) && validDate(value.slice(0, 10)) && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const list = (value: unknown, max: number, check: (item: unknown) => boolean) => Array.isArray(value) && value.length <= max && value.every(check);
function jsonValue(value: unknown, depth = 0): boolean {
  if (depth > 10) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= 4000;
  if (Array.isArray(value)) return value.length <= 400 && value.every(item => jsonValue(item, depth + 1));
  return record(value) && Object.keys(value).length <= 100 && Object.entries(value).every(([key, item]) => key.length <= 100 && jsonValue(item, depth + 1));
}
function citation(value: unknown): boolean {
  if (!record(value) || !['doc_id', 'version', 'clause', 'title'].every(key => text(value[key], 500))) return false;
  if (value.text_source !== undefined && !text(value.text_source)) return false;
  if (value.valid_from !== undefined && !validDate(value.valid_from)) return false;
  if (value.scope_level !== undefined && !['Group', 'Company', 'Department', 'Team'].includes(String(value.scope_level))) return false;
  if (value.clause_id !== undefined && !text(value.clause_id, 200)) return false;
  if (value.source_ref !== undefined) {
    const source = value.source_ref;
    if (!record(source) || !text(source.path, 500) || /(^\/|\\|\.\.|:)/.test(source.path)
      || !Number.isSafeInteger(source.line) || Number(source.line) < 1 || !text(source.json_pointer, 500)) return false;
  }
  return true;
}
function graph(value: unknown): boolean {
  if (!record(value) || !list(value.nodes, 200, node => record(node) && text(node.id, 200) && text(node.label, 500)
    && ['persona', 'policy', 'clause', 'org', 'action'].includes(String(node.type)) && (node.details === undefined || (record(node.details) && jsonValue(node.details))))) return false;
  const nodes = value.nodes as Record<string, unknown>[];
  const ids = new Set(nodes.map(node => node.id));
  return ids.size === nodes.length && list(value.edges, 400, edge => record(edge) && ids.has(edge.source) && ids.has(edge.target) && text(edge.label, 500));
}
function context(value: unknown): boolean {
  return record(value) && validDate(value.date) && (value.policyId === null || (text(value.policyId, 100) && /^(POL|GUD|DRF)-[A-Z0-9-]+$/.test(value.policyId)))
    && (value.version === null || (text(value.version, 40) && /^v\d+\.\d+$/.test(value.version)))
    && list(value.keys, 5, key => keys.includes(String(key))) && text(value.snapshotId, 64) && /^[a-f0-9]{64}$/.test(value.snapshotId);
}
export function validMessage(value: unknown): value is ChatMessage {
  return record(value) && text(value.id, 100) && ['user', 'assistant'].includes(String(value.sender)) && text(value.content)
    && timestamp(value.createdAt) && (value.status === undefined || statuses.includes(String(value.status)))
    && (value.queryDate === undefined || validDate(value.queryDate))
    && (value.provider === undefined || ['rules', 'gemini'].includes(String(value.provider)))
    && (value.citations === undefined || list(value.citations, 40, citation))
    && (value.graph === undefined || graph(value.graph))
    && (value.trace === undefined || (record(value.trace) && jsonValue(value.trace)));
}
export function validConversation(value: unknown, personas?: readonly string[]): value is Conversation {
  return record(value) && text(value.id, 100) && text(value.title, 200) && text(value.personaId, 100)
    && /^[a-z0-9_-]+$/.test(value.personaId) && (!personas || personas.includes(value.personaId))
    && validDate(value.date) && timestamp(value.updatedAt) && list(value.messages, 200, validMessage)
    && new Set((value.messages as ChatMessage[]).map(message => message.id)).size === (value.messages as ChatMessage[]).length
    && (value.context === undefined || context(value.context));
}
export function validReply(value: unknown): boolean {
  return record(value) && statuses.includes(String(value.status)) && validDate(value.query_date)
    && ['rules', 'gemini'].includes(String(value.provider)) && validMessage({ id: 'response', sender: 'assistant', content: value.answer,
    createdAt: new Date().toISOString(), status: value.status, queryDate: value.query_date,
    citations: value.citations, graph: value.graph, trace: value.trace, provider: value.provider })
    && context(value.context);
}
export function validPersonas(value: unknown): value is Persona[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(profile => record(profile)
    && ['userId', 'name', 'company', 'department', 'role', 'contractType', 'description'].every(key => text(profile[key], 500))
    && /^[a-z0-9_-]+$/.test(profile.userId as string) && (profile.team == null || text(profile.team, 100)))
    && new Set(value.map(profile => profile.userId)).size === value.length;
}
