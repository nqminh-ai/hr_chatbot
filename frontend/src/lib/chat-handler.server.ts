import { after, NextRequest, NextResponse } from 'next/server';
import { geminiAnswer, geminiEnabled, geminiModel } from './gemini.server';
import { isSampleDataset, policyAnswer, today, validDate, type HistoryTurn } from './policy.server';

import { cachedSupabaseStatus, checkSupabaseConnection, supabaseStatusNeedsRefresh } from './supabase';
import { BodyLimitError, readLimitedBody } from './request-body.server';
import { validContext } from './intent.server';
import { knowledgeSnapshot } from './dataset.server';
import { randomUUID } from 'node:crypto';
import { authenticateRequest, AuthenticationError, type RequestIdentity } from './auth.server';
import { consumeRateLimit, rateLimitHeaders, rateLimitKey } from './rate-limit.server';
import { emitErrorTelemetry, type ErrorTelemetryStage } from './telemetry.server';

const headers = { 'Cache-Control': 'no-store' };

function authenticationFailure(error: unknown, requestId: string) {
  if (error instanceof AuthenticationError) {
    const message = error.status === 503 ? 'Xác thực production chưa được cấu hình.' : 'Bạn cần đăng nhập để tiếp tục.';
    return NextResponse.json({ error: message, code: error.code, requestId }, { status: error.status, headers });
  }
  return null;
}

function profilesFor(identity: RequestIdentity) {
  if (!identity.userId) return knowledgeSnapshot.data.personas;
  const profile = knowledgeSnapshot.profiles[identity.userId];
  return profile ? [profile] : [];
}

function publicPersona(profile: typeof knowledgeSnapshot.data.personas[number]) {
  return {
      userId: profile.user_id, name: profile.name, company: profile.company,
      department: profile.department, team: profile.team, role: profile.role,
      contractType: profile.contract_type, description: profile.description,
  };
}

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let stage: ErrorTelemetryStage = 'chat.bootstrap.authenticate';
  try {
    const identity = authenticateRequest(req);
    stage = 'chat.bootstrap.profile';
    const profiles = profilesFor(identity);
    if (!profiles.length) return NextResponse.json({ error: 'Tài khoản chưa được gán hồ sơ chính sách.', code: 'persona_not_assigned', requestId }, { status: 403, headers });
    const supabaseStatus = cachedSupabaseStatus();
    if (supabaseStatusNeedsRefresh(supabaseStatus)) after(async () => { await checkSupabaseConnection({ requestId }); });
    stage = 'chat.bootstrap.response';
    return NextResponse.json({
      requestId,
      provider: geminiEnabled() ? 'gemini' : 'rules',
      sampleData: isSampleDataset,
      date: today(),
      personas: profiles.map(publicPersona),
      auth: { mode: identity.mode, userId: identity.userId },
      snapshotId: knowledgeSnapshot.id,
      dataSource: 'knowledge.json',
      supabase: supabaseStatus
    }, { headers });
  } catch (error) {
    const failure = authenticationFailure(error, requestId);
    if (failure) return failure;
    emitErrorTelemetry({ event: 'chat_error', requestId, stage, code: 'bootstrap_failed', error, startedAt, severity: 'error' });
    return NextResponse.json({ error: 'Chưa thể tải trạng thái hệ thống.', requestId }, { status: 503, headers });
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let stage: ErrorTelemetryStage = 'chat.authenticate';
  try {
    let identity: RequestIdentity;
    try { identity = authenticateRequest(req); }
    catch (error) {
      const failure = authenticationFailure(error, requestId);
      if (failure) return failure;
      throw error;
    }
    stage = 'chat.rate_limit';
    if (identity.userId && !knowledgeSnapshot.profiles[identity.userId]) {
      return NextResponse.json({ error: 'Tài khoản chưa được gán hồ sơ chính sách.', code: 'persona_not_assigned', requestId }, { status: 403, headers });
    }
    const rate = consumeRateLimit(rateLimitKey(req, identity));
    const responseHeaders = { ...headers, ...rateLimitHeaders(rate) };
    if (!rate.allowed) return NextResponse.json({ error: 'Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau.', code: 'rate_limited', requestId }, { status: 429, headers: responseHeaders });
    stage = 'chat.body';
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return NextResponse.json({ error: 'Yêu cầu phải dùng JSON.' }, { status: 415, headers: responseHeaders });
    let raw: string;
    try { raw = await readLimitedBody(req); }
    catch (error) {
      if (error instanceof BodyLimitError) return NextResponse.json({ error: 'Cuộc hội thoại quá dài.' }, { status: 413, headers: responseHeaders });
      return NextResponse.json({ error: 'Nội dung UTF-8 không hợp lệ.' }, { status: 400, headers: responseHeaders });
    }
    let payload;
    try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Nội dung JSON không hợp lệ.' }, { status: 400, headers: responseHeaders }); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400, headers: responseHeaders });
    const { query, personaId: requestedPersona, date = today(), messages = [], context } = payload;
    if (identity.userId && requestedPersona !== undefined && requestedPersona !== identity.userId) {
      return NextResponse.json({ error: 'Không được phép đổi hồ sơ nhân sự.', code: 'persona_mismatch', requestId }, { status: 403, headers: responseHeaders });
    }
    const personaId = identity.userId || requestedPersona || 'lan';
    if (typeof query !== 'string' || !query.trim() || query.length > 4000 || typeof personaId !== 'string' || !validDate(date)
      || (context !== undefined && !validContext(context))
      || !Array.isArray(messages) || messages.length > 20 || messages.some(turn => !turn || !['user', 'assistant'].includes(turn.sender) || typeof turn.content !== 'string' || turn.content.length > 4000)) {
      return NextResponse.json({ error: 'Kiểm tra lại câu hỏi, ngày tra cứu và lịch sử hội thoại.' }, { status: 400, headers: responseHeaders });
    }
    const history = messages as HistoryTurn[];
    stage = 'chat.policy';
    const result = policyAnswer(personaId, query.trim(), date, history, context);
    let provider: 'rules' | 'gemini' = 'rules';
    let notice: string | undefined;
    if (geminiEnabled() && result.facts.length && result.status === 'ok') {
      if (!isSampleDataset) return NextResponse.json({ error: 'Tích hợp Gemini hiện chỉ được bật với dữ liệu chính sách mẫu.' }, { status: 503, headers: responseHeaders });
      const geminiStartedAt = Date.now();
      try {
        stage = 'gemini.generate';
        result.answer = await geminiAnswer(query, history, result, isSampleDataset, req.signal);
        provider = 'gemini';
      } catch (error) {
        if (req.signal.aborted) return new NextResponse(null, { status: 499 });
        emitErrorTelemetry({ event: 'chat_fallback', requestId, stage, code: 'gemini_unavailable', error, startedAt: geminiStartedAt });
        notice = 'Gemini chưa phản hồi. Mình đang hiển thị kết quả đối chiếu từ dữ liệu mẫu.';
      }
    }
    // Internal policy facts are intentionally excluded from the public response.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { facts: _facts, ...response } = result;
    return NextResponse.json({ ...response, provider, notice, requestId,
      generation: { render_mode: 'verified_facts', model: provider === 'gemini' ? geminiModel() : null } }, { headers: responseHeaders });
  } catch (error) {
    emitErrorTelemetry({ event: 'chat_error', requestId, stage, code: 'internal_error', error, startedAt, severity: 'error' });
    return NextResponse.json({ error: 'Chưa thể trả lời lúc này. Vui lòng thử lại.', requestId }, { status: 503, headers });
  }
}
