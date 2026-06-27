// @ts-nocheck
// Supabase Edge Function: agent-proxy (DeepSeek V4 Flash backend, OpenAI-compatible)
// Auth + credit check via direct Supabase REST calls. Persistent memory loader.
// Migrated from NVIDIA NIM (Llama 3.3 70B) on 2026-06-11; memory injection 2026-06-11.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-v4-flash';
const MAX_TOKENS = 4096;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Use POST.' });

  try {
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!deepseekKey) return jsonResponse(500, { error: 'Missing DEEPSEEK_API_KEY secret.' });
    if (!supabaseUrl || !anonKey) return jsonResponse(500, { error: 'Missing Supabase env vars.' });

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return jsonResponse(401, { error: 'Missing bearer token.' });

    // 1. Verify user via Supabase Auth REST API
    const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey },
    });
    if (!authRes.ok) return jsonResponse(401, { error: 'Invalid or expired session.' });
    const authUser = await authRes.json();
    if (!authUser?.id) return jsonResponse(401, { error: 'Could not identify user.' });

    // 2. Parse request body
    const payload = await request.json().catch(() => null);
    if (!payload || !Array.isArray(payload.messages) || payload.messages.length === 0) {
      return jsonResponse(400, { error: 'messages must be a non-empty array.' });
    }

    // 3. Deduct 1 credit via RPC (runs as the user so auth.uid() works)
    let newBalance: number | null = null;
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_credit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const rpcJson = await rpcRes.json().catch(() => null);
    if (!rpcRes.ok) {
      const msg = rpcJson?.message || rpcJson?.error || '';
      if (msg.includes('NO_CREDITS')) {
        return jsonResponse(402, { error: 'Insufficient credits. Please top up.' });
      }
      return jsonResponse(500, { error: `Credit check failed: ${msg}` });
    }
    newBalance =
      rpcJson && typeof rpcJson === 'object' && typeof rpcJson.credits_balance === 'number'
        ? rpcJson.credits_balance
        : null;

    // 4. Fetch the user's agent memory and prepend it to the system prompt.
    // We use PostgREST with the user's JWT so RLS filters to their rows only.
    // Best-effort: failure leaves the agent without memory but doesn't break the turn.
    let memoryBlock = '';
    try {
      const memRes = await fetch(
        `${supabaseUrl}/rest/v1/agent_memory?select=id,scope,project_key,fact_key,fact_value,updated_at&order=scope.asc,updated_at.desc`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey,
            'Accept': 'application/json',
          },
        },
      );
      if (memRes.ok) {
        const rows = await memRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          memoryBlock = formatMemoryBlock(rows);
        }
      }
    } catch (_err) {
      // ignore — memory is best-effort
    }

    // 5. Call DeepSeek V4 Flash (OpenAI-compatible, synchronous)
    const { messages, tools, system, model } = payload;

    const dsMessages = [];
    const baseSystem = typeof system === 'string' && system.trim() ? system : '';
    const combinedSystem = memoryBlock ? `${memoryBlock}\n\n${baseSystem}` : baseSystem;
    if (combinedSystem) {
      dsMessages.push({ role: 'system', content: combinedSystem });
    }
    dsMessages.push(...messages);

    const dsBody: Record<string, unknown> = {
      model: typeof model === 'string' && model ? model : DEFAULT_MODEL,
      messages: dsMessages,
      max_tokens: MAX_TOKENS,
      temperature: 0.2,
      top_p: 0.7,
      stream: false,
    };
    if (Array.isArray(tools) && tools.length > 0) {
      dsBody.tools = tools;
      dsBody.tool_choice = 'auto';
    }

    const dsRes = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify(dsBody),
    });

    const dsJson = await dsRes.json().catch(() => null);
    if (!dsRes.ok) {
      const msg =
        dsJson?.error?.message ||
        dsJson?.detail ||
        dsJson?.message ||
        `DeepSeek request failed (${dsRes.status}).`;
      return jsonResponse(dsRes.status, { error: msg });
    }

    return jsonResponse(200, { response: dsJson, credits_balance: newBalance });

  } catch (err) {
    return jsonResponse(500, { error: err instanceof Error ? err.message : 'Unknown server error.' });
  }
});

// ── Memory formatting (Deno-side mirror of src/agent/memory.ts) ─────────────
// Kept duplicated rather than imported to keep the edge function self-contained.

interface MemoryRow {
  id: number;
  scope: 'user' | 'project';
  project_key: string | null;
  fact_key: string;
  fact_value: string;
  updated_at: string;
}

function formatMemoryBlock(rows: MemoryRow[]): string {
  // Escape vectors that could let a malicious fact_value break out of the
  // <memory> block: newlines (collapse to space), triple-backticks (would close
  // a code fence), and angle brackets (would close the </memory> tag early).
  const safe = (s: string) =>
    s.replaceAll('\n', ' ').replaceAll('```', "'''").replaceAll('<', '‹').replaceAll('>', '›');
  const userRows = rows.filter((r) => r.scope === 'user');
  const projectRows = rows.filter((r) => r.scope === 'project');
  const projectGroups = new Map<string, MemoryRow[]>();
  for (const r of projectRows) {
    const key = r.project_key ?? '(unnamed)';
    if (!projectGroups.has(key)) projectGroups.set(key, []);
    projectGroups.get(key)!.push(r);
  }
  const parts: string[] = ['<memory>'];
  if (userRows.length > 0) {
    parts.push('## What I remember about this user (global)');
    for (const r of userRows) parts.push(`- ${safe(r.fact_key)}: ${safe(r.fact_value)}`);
    parts.push('');
  }
  for (const [projectKey, rs] of projectGroups) {
    parts.push(`## What I remember about the project "${safe(projectKey)}"`);
    for (const r of rs) parts.push(`- ${safe(r.fact_key)}: ${safe(r.fact_value)}`);
    parts.push('');
  }
  parts.push('</memory>');
  return parts.join('\n');
}
