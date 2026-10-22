import { describe, expect, it } from 'vitest';
import { newConversation, restoreConversations, serializeConversations } from '../src/lib/conversations';
import type { Conversation } from '../src/types';

function fixture(): Conversation {
  const chat = newConversation('lan', '2026-10-14');
  chat.messages = [{ id: 'bot', sender: 'assistant', content: '14 ngày', createdAt: new Date().toISOString(), status: 'ok',
    queryDate: '2026-10-14', provider: 'rules', citations: [{ doc_id: 'POL-A-LV', version: 'v2.0', clause: 'entitlement', title: 'Policy',
      valid_from: '2026-03-01', valid_to: null }],
    graph: { nodes: [{ id: 'p', label: 'Policy', type: 'policy' }], edges: [] }, trace: { status: 'ok' } }];
  return chat;
}
describe('browser history', () => {
  it('restores v2 and legacy without changing metadata', () => {
    const chat = fixture();
    expect(restoreConversations(serializeConversations([chat]), ['lan'])).toEqual([chat]);
    expect(restoreConversations(JSON.stringify([chat]), ['lan'])).toEqual([chat]);
  });
  it.each([
    (c: Conversation) => { c.date = '2026-02-30'; },
    (c: Conversation) => { c.personaId = 'unknown'; },
    (c: Conversation) => { c.messages[0].createdAt = 'not-a-date'; },
    (c: Conversation) => { c.messages[0].citations = {} as never; },
    (c: Conversation) => { c.messages[0].graph!.nodes[0].type = 'invalid' as never; },
    (c: Conversation) => { c.messages[0].graph!.edges.push({ source: 'p', target: 'missing', label: 'bad' }); },
    (c: Conversation) => { c.messages[0].trace = [] as never; },
    (c: Conversation) => { c.messages[0].content = 'x'.repeat(4001); },
    (c: Conversation) => { c.context = { date: '2026-10-14', policyId: null, version: null, keys: ['bad'], snapshotId: 'fake' }; },
  ])('drops corrupted conversations before rendering', mutate => {
    const good = fixture(), bad = fixture(); mutate(bad);
    expect(restoreConversations(JSON.stringify([bad, good]), ['lan'])).toEqual([good]);
  });
  it.each([
    ['missing query date', (c: Conversation) => { delete c.messages[0].queryDate; }],
    ['future citation', (c: Conversation) => { c.messages[0].citations![0].valid_from = '2026-10-15'; }],
    ['expired citation', (c: Conversation) => { c.messages[0].citations![0].valid_to = '2026-10-14'; }],
    ['missing validity metadata', (c: Conversation) => { delete c.messages[0].citations![0].valid_from; }],
  ])('drops stored history with %s', (_label, mutate) => {
    const bad = fixture();
    mutate(bad);
    expect(restoreConversations(serializeConversations([bad]), ['lan'])).toEqual([]);
  });
  it('rejects unknown versions and bounds storage size', () => {
    expect(() => restoreConversations('{"version":99,"conversations":[]}')).toThrow();
    expect(() => restoreConversations(' '.repeat(2_000_001))).toThrow();
    expect(() => restoreConversations(JSON.stringify(Array.from({ length: 31 }, fixture)))).toThrow();
  });
});
