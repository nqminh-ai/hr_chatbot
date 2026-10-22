import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChatComposer } from '../src/components/chat/ChatComposer';
import { ChatMessageItem } from '../src/components/chat/ChatMessageItem';
import { InspectorDrawer } from '../src/components/InspectorDrawer';
import type { ChatMessage, Citation } from '../src/types';

afterEach(cleanup);

const citation: Citation = {
  doc_id: 'POL-A-LV',
  version: 'v2.0',
  clause: 'entitlement',
  title: 'Quy chế nghỉ phép',
  valid_from: '2026-03-01',
  valid_to: null,
};

it('keeps composer submit, trim and stop behavior behind its component boundary', () => {
  const onSendMessage = vi.fn();
  const onStop = vi.fn();
  const view = render(<ChatComposer isLoading={false} onSendMessage={onSendMessage} onStop={onStop} provider="rules" />);
  const input = screen.getByLabelText('Tin nhắn');
  fireEvent.change(input, { target: { value: '  Ai duyệt?  ' } });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
  expect(onSendMessage).toHaveBeenCalledWith('Ai duyệt?');
  expect((input as HTMLTextAreaElement).value).toBe('');

  view.rerender(<ChatComposer isLoading onSendMessage={onSendMessage} onStop={onStop} provider="gemini" />);
  fireEvent.click(screen.getByLabelText('Dừng trả lời'));
  expect(onStop).toHaveBeenCalledOnce();
  expect(screen.getByText(/Google Gemini/)).toBeDefined();
});

it('keeps citation selection and per-message trace state inside a message item', () => {
  const onSelectCitation = vi.fn();
  const message: ChatMessage = {
    id: 'assistant-1',
    sender: 'assistant',
    content: 'Bạn có 14 ngày phép.',
    createdAt: '2026-10-22T00:00:00.000Z',
    citations: [citation],
    trace: { stage: 'policy_resolution' },
  };
  render(<ChatMessageItem message={message} onSelectCitation={onSelectCitation} />);
  fireEvent.click(screen.getByRole('button', { name: /POL-A-LV/ }));
  expect(onSelectCitation).toHaveBeenCalledWith(citation, message);
  fireEvent.click(screen.getByText('Xem Trace Log nghiệp vụ'));
  expect(screen.getByText(/policy_resolution/)).toBeDefined();
});

it('keeps citations, graph and trace as independent inspector panels', () => {
  const onClose = vi.fn();
  render(
    <InspectorDrawer
      isOpen
      onClose={onClose}
      citations={[citation]}
      selectedCitation={citation}
      queryDate="2026-10-22"
      graph={{
        nodes: [{ id: 'policy-1', label: 'Policy A', type: 'policy' }],
        edges: [{ source: 'policy-1', target: 'clause-1', label: 'HAS_CLAUSE' }],
      }}
      trace={{ status: 'ok' }}
    />,
  );
  expect(screen.getByText('Quy chế nghỉ phép')).toBeDefined();
  fireEvent.click(screen.getByRole('tab', { name: 'Sơ đồ Graph' }));
  expect(screen.getByText('Policy A')).toBeDefined();
  expect(screen.getByText(/HAS_CLAUSE/)).toBeDefined();
  fireEvent.click(screen.getByRole('tab', { name: 'Trace Log' }));
  expect(screen.getByText(/"status": "ok"/)).toBeDefined();
  fireEvent.click(screen.getByLabelText('Đóng nguồn và chính sách'));
  expect(onClose).toHaveBeenCalledOnce();
});
