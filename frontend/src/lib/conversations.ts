import type { Conversation } from '../types';
import { businessToday } from './calendar';
import { validConversation } from './chat-validation';
export { businessToday };

export const STORAGE_KEY = 'appota-conversations-v2';
export const LEGACY_STORAGE_KEY = 'appota-conversations-v1';
export function newConversation(personaId = 'lan', date = businessToday()): Conversation {
  return { id: crypto.randomUUID(), title: 'Cuộc trò chuyện mới', personaId, date, messages: [], updatedAt: new Date().toISOString() };
}
export function restoreConversations(raw: string | null, personas?: readonly string[]): Conversation[] {
  if (!raw) return [];
  if (raw.length > 2_000_000) throw new Error('History exceeds storage limit');
  const value = JSON.parse(raw);
  const items = Array.isArray(value) ? value : value?.version === 2 ? value.conversations : null;
  if (!Array.isArray(items) || items.length > 30) throw new Error('Invalid history version or size');
  return items.filter(item => validConversation(item, personas));
}
export function serializeConversations(chats: Conversation[]): string {
  const conversations = chats.slice(0, 30).map(chat => ({ ...chat, messages: chat.messages.slice(-200) }));
  const value = JSON.stringify({ version: 2, conversations });
  if (value.length > 2_000_000) throw new Error('History exceeds storage limit');
  return value;
}
