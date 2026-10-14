import { NextRequest, NextResponse } from 'next/server';
import { geminiAnswer, geminiEnabled, geminiModel } from './gemini.server';
import { isSampleDataset, policyAnswer, today, validDate, type HistoryTurn } from './policy.server';

import { checkSupabaseConnection } from './supabase';
import { BodyLimitError, readLimitedBody } from './request-body.server';
import { validContext } from './intent.server';
import { knowledgeSnapshot } from './dataset.server';
import { randomUUID } from 'node:crypto';

const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  const supabaseStatus = await checkSupabaseConnection();
  return NextResponse.json({
    provider: geminiEnabled() ? 'gemini' : 'rules',
    sampleData: isSampleDataset,
    date: today(),
    personas: knowledgeSnapshot.data.personas.map(profile => ({
      userId: profile.user_id, name: profile.name, company: profile.company,
      department: profile.department, team: profile.team, role: profile.role,
      contractType: profile.contract_type, description: profile.description,
    })),
    snapshotId: knowledgeSnapshot.id,
    dataSource: 'knowledge.json',
    supabase: supabaseStatus
  }, { headers });
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return NextResponse.json({ error: 'Yêu cầu phải dùng JSON.' }, { status: 415, headers });
    let raw: string;
    try { raw = await readLimitedBody(req); }
    catch (error) {
      if (error instanceof BodyLimitError) return NextResponse.json({ error: 'Cuộc hội thoại quá dài.' }, { status: 413, headers });
      return NextResponse.json({ error: 'Nội dung UTF-8 không hợp lệ.' }, { status: 400, headers });
    }
    let payload;
    try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Nội dung JSON không hợp lệ.' }, { status: 400, headers }); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400, headers });
    const { query, personaId = 'lan', date = today(), messages = [], context } = payload;
    if (typeof query !== 'string' || !query.trim() || query.length > 4000 || typeof personaId !== 'string' || !validDate(date)
      || (context !== undefined && !validContext(context))
      || !Array.isArray(messages) || messages.length > 20 || messages.some(turn => !turn || !['user', 'assistant'].includes(turn.sender) || typeof turn.content !== 'string' || turn.content.length > 4000)) {
      return NextResponse.json({ error: 'Kiểm tra lại câu hỏi, ngày tra cứu và lịch sử hội thoại.' }, { status: 400, headers });
    }
    const history = messages as HistoryTurn[];
    const result = policyAnswer(personaId, query.trim(), date, history, context);
    let provider: 'rules' | 'gemini' = 'rules';
    let notice: string | undefined;
    if (geminiEnabled() && result.facts.length && result.status === 'ok') {
      if (!isSampleDataset) return NextResponse.json({ error: 'Tích hợp Gemini hiện chỉ được bật với dữ liệu chính sách mẫu.' }, { status: 503, headers });
      try {
        result.answer = await geminiAnswer(query, history, result, isSampleDataset, req.signal);
        provider = 'gemini';
      } catch {
        if (req.signal.aborted) return new NextResponse(null, { status: 499 });
        console.warn(JSON.stringify({ event: 'chat_fallback', requestId, code: 'gemini_unavailable' }));
        notice = 'Gemini chưa phản hồi. Mình đang hiển thị kết quả đối chiếu từ dữ liệu mẫu.';
      }
    }
    // Internal policy facts are intentionally excluded from the public response.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { facts: _facts, ...response } = result;
    return NextResponse.json({ ...response, provider, notice, requestId,
      generation: { render_mode: 'verified_facts', model: provider === 'gemini' ? geminiModel() : null } }, { headers });
  } catch {
    console.error(JSON.stringify({ event: 'chat_error', requestId, code: 'internal_error' }));
    return NextResponse.json({ error: 'Chưa thể trả lời lúc này. Vui lòng thử lại.', requestId }, { status: 503, headers });
  }
}
