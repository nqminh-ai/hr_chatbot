import { NextRequest, NextResponse } from 'next/server';
import { geminiAnswer, geminiEnabled } from './gemini.server';
import { isSampleDataset, policyAnswer, today, validDate, type HistoryTurn } from './policy.server';

const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  return NextResponse.json({ provider: geminiEnabled() ? 'gemini' : 'rules', sampleData: isSampleDataset, date: today() }, { headers });
}

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return NextResponse.json({ error: 'Yêu cầu phải dùng JSON.' }, { status: 415, headers });
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 100000) return NextResponse.json({ error: 'Cuộc hội thoại quá dài.' }, { status: 413, headers });
    let payload;
    try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Nội dung JSON không hợp lệ.' }, { status: 400, headers }); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400, headers });
    const { query, personaId = 'lan', date = today(), messages = [] } = payload;
    if (typeof query !== 'string' || !query.trim() || query.length > 4000 || typeof personaId !== 'string' || !validDate(date)
      || !Array.isArray(messages) || messages.length > 20 || messages.some(turn => !turn || !['user', 'assistant'].includes(turn.sender) || typeof turn.content !== 'string' || turn.content.length > 4000)) {
      return NextResponse.json({ error: 'Kiểm tra lại câu hỏi, ngày tra cứu và lịch sử hội thoại.' }, { status: 400, headers });
    }
    const history = messages as HistoryTurn[];
    const result = policyAnswer(personaId, query.trim(), date, history);
    let provider: 'rules' | 'gemini' = 'rules';
    let notice: string | undefined;
    if (geminiEnabled() && result.facts.length && !['refused', 'conflict'].includes(result.status)) {
      if (!isSampleDataset) return NextResponse.json({ error: 'Tích hợp Gemini hiện chỉ được bật với dữ liệu chính sách mẫu.' }, { status: 503, headers });
      try {
        result.answer = await geminiAnswer(query, history, result, isSampleDataset, req.signal);
        provider = 'gemini';
      } catch {
        if (req.signal.aborted) return new NextResponse(null, { status: 499 });
        notice = 'Gemini chưa phản hồi. Mình đang hiển thị kết quả đối chiếu từ dữ liệu mẫu.';
      }
    }
    const { facts: _facts, ...response } = result;
    return NextResponse.json({ ...response, provider, notice }, { headers });
  } catch {
    return NextResponse.json({ error: 'Chưa thể trả lời lúc này. Vui lòng thử lại.' }, { status: 503, headers });
  }
}
