import type { Conversation } from '../types';

export const STORAGE_KEY = 'appota-conversations-v1';
export function businessToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function newConversation(personaId = 'lan', date = businessToday()): Conversation {
  return { id: crypto.randomUUID(), title: 'Cuộc trò chuyện mới', personaId, date, messages: [], updatedAt: new Date().toISOString() };
}
export function restoreConversations(raw: string | null): Conversation[] {
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('Invalid history');
  return value.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string'
    && ['lan', 'hung', 'mai', 'nam'].includes(item.personaId) && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    && typeof item.updatedAt === 'string' && Array.isArray(item.messages)
    && item.messages.every((message: { id?: unknown; sender?: unknown; content?: unknown }) => message && typeof message.id === 'string'
      && ['user', 'assistant'].includes(String(message.sender)) && typeof message.content === 'string'));
}
