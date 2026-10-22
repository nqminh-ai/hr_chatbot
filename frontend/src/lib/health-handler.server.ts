import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { checkSupabaseConnection } from './supabase';

const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  const requestId = randomUUID();
  return NextResponse.json({ ...await checkSupabaseConnection({ requestId }), requestId }, { headers });
}
