export type ErrorTelemetryEvent = 'chat_error' | 'chat_fallback' | 'dependency_error';
export type ErrorTelemetryStage =
  | 'chat.bootstrap.authenticate'
  | 'chat.bootstrap.profile'
  | 'chat.bootstrap.response'
  | 'chat.authenticate'
  | 'chat.rate_limit'
  | 'chat.body'
  | 'chat.policy'
  | 'gemini.generate'
  | 'supabase.health';
export type ErrorTelemetryCode = 'bootstrap_failed' | 'gemini_unavailable' | 'internal_error' | 'health_unavailable';

interface ErrorTelemetryInput {
  event: ErrorTelemetryEvent;
  requestId: string;
  stage: ErrorTelemetryStage;
  code: ErrorTelemetryCode;
  error?: unknown;
  errorClass?: string;
  startedAt: number;
  severity?: 'warn' | 'error';
}

const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

function safeName(value: unknown, fallback: string) {
  return typeof value === 'string' && SAFE_NAME.test(value) ? value : fallback;
}

export function classifyError(error: unknown): string {
  if (error instanceof Error) return safeName(error.name, 'Error');
  if (error && typeof error === 'object' && 'name' in error) {
    return safeName((error as { name?: unknown }).name, 'UnknownError');
  }
  return safeName(typeof error, 'UnknownError');
}

export function elapsedMilliseconds(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

export function emitErrorTelemetry(input: ErrorTelemetryInput) {
  const record = {
    event: input.event,
    requestId: input.requestId,
    stage: safeName(input.stage, 'unknown'),
    code: safeName(input.code, 'unknown_error'),
    errorClass: safeName(input.errorClass, classifyError(input.error)),
    elapsedMs: elapsedMilliseconds(input.startedAt),
  };
  const output = JSON.stringify(record);
  if (input.severity === 'error') console.error(output);
  else console.warn(output);
  return record;
}
