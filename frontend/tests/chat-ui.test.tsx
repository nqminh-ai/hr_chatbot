import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatClient } from '../src/components/ChatClient';
import { STORAGE_KEY, newConversation, serializeConversations } from '../src/lib/conversations';

const persona = { userId: 'lan', name: 'Lan', company: 'CTY_A', department: 'DEPT_MKT_A', role: 'Staff', contractType: 'Official', description: 'Sample' };
const context = { date: '2026-10-14', policyId: null, version: null, keys: ['entitlement'], snapshotId: 'a'.repeat(64) };
const bootstrap = { provider: 'rules', personas: [persona], supabase: { configured: true, connected: true, ready: true } };
const reply = { answer: '14 ngày phép', status: 'ok', query_date: '2026-10-14', provider: 'rules', context, citations: [], graph: { nodes: [], edges: [] }, trace: {} };
beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function ready() {
  render(<ChatClient />);
  await waitFor(() => expect(screen.queryByLabelText('Dừng trả lời')).toBeNull());
}
function send(text = 'Nghỉ phép?') {
  fireEvent.change(screen.getByLabelText('Tin nhắn'), { target: { value: text } });
  fireEvent.click(screen.getByLabelText('Gửi tin nhắn'));
}
it('shows JSON as answer source and uses server personas', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(bootstrap)));
  await ready();
  expect(screen.getByText('JSON mẫu')).toBeDefined();
  expect(screen.queryByText(/Supabase Live/)).toBeNull();
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Lan · Staff']);
});
it('recovers from broken storage and reports bootstrap failure', async () => {
  localStorage.setItem(STORAGE_KEY, '{broken');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  await ready();
  expect(screen.getByRole('status').textContent).toContain('Không tải được trạng thái hệ thống');
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(2);
});
it('keeps structured context on follow-up and restores citations safely', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(bootstrap)).mockImplementation(() => Promise.resolve(Response.json(reply)));
  vi.stubGlobal('fetch', fetcher); await ready();
  send(); await screen.findByText('14 ngày phép');
  send('Vậy ai duyệt?');
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  const payload = JSON.parse(fetcher.mock.calls[2][1].body);
  expect(payload.context).toEqual(context);
  expect(payload.messages).toEqual([{ sender: 'user', content: 'Nghỉ phép?' }]);
});
it('aborts on conversation switch and ignores a late old response', async () => {
  const chat = newConversation('lan', '2026-10-14');
  chat.title = 'Hội thoại cũ';
  chat.messages = [{ id: 'u', sender: 'user', content: 'Trước đây', createdAt: new Date().toISOString() }];
  localStorage.setItem(STORAGE_KEY, serializeConversations([chat]));
  let resolveOld!: (value: Response) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(bootstrap)).mockImplementation(() => new Promise<Response>(resolve => { resolveOld = resolve; }));
  vi.stubGlobal('fetch', fetcher); await ready(); send();
  const signal = fetcher.mock.calls[1][1].signal as AbortSignal;
  fireEvent.click(screen.getByText('Cuộc trò chuyện mới'));
  expect(signal.aborted).toBe(true);
  await act(async () => resolveOld(Response.json(reply)));
  expect(screen.queryByText('14 ngày phép')).toBeNull();
  expect(screen.getByRole('heading', { level: 2 })).toBeDefined();
});
it('stops a request and releases the input for the next message', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(bootstrap)).mockImplementation((_url, options) =>
    new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
  vi.stubGlobal('fetch', fetcher); await ready(); send();
  fireEvent.click(screen.getByLabelText('Dừng trả lời'));
  await screen.findByText('Đã dừng trả lời. Bạn có thể gửi câu hỏi tiếp theo.');
  send('Ai duyệt?');
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
});
it('rejects malformed API metadata before displaying a reply', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(bootstrap)).mockResolvedValue(Response.json({ ...reply, citations: {} })));
  await ready(); send();
  await screen.findByText('Phản hồi không hợp lệ. Vui lòng thử lại.');
  expect(screen.queryByText('14 ngày phép')).toBeNull();
});
it('stopping immediately releases input and ignores a transport that resolves late', async () => {
  let resolveOld!: (value: Response) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(bootstrap)).mockImplementationOnce(() =>
    new Promise<Response>(resolve => { resolveOld = resolve; })).mockImplementation(() => Promise.resolve(Response.json({ ...reply, answer: 'Phản hồi mới' })));
  vi.stubGlobal('fetch', fetcher); await ready(); send();
  fireEvent.click(screen.getByLabelText('Dừng trả lời'));
  send('Ai duyệt?');
  await screen.findByText('Phản hồi mới');
  await act(async () => resolveOld(Response.json(reply)));
  expect(screen.queryByText('14 ngày phép')).toBeNull();
});
it('aborts pending requests on unmount', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(bootstrap)).mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal('fetch', fetcher);
  const view = render(<ChatClient />);
  await waitFor(() => expect(screen.queryByLabelText('Dừng trả lời')).toBeNull());
  send();
  const signal = fetcher.mock.calls[1][1].signal as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
});
