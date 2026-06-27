import { supabase } from '../lib/supabase';

export type MemoryScope = 'user' | 'project';

export interface AgentMemoryRow {
  id: number;
  scope: MemoryScope;
  project_key: string | null;
  fact_key: string;
  fact_value: string;
  updated_at: string;
}

/**
 * Fetch all memory rows for the authenticated user (RLS filters automatically).
 * Returns rows ordered by scope then most-recently-updated.
 */
export async function fetchUserMemory(): Promise<AgentMemoryRow[]> {
  const { data, error } = await supabase
    .from('agent_memory')
    .select('id, scope, project_key, fact_key, fact_value, updated_at')
    .order('scope', { ascending: true })
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`fetchUserMemory failed: ${error.message}`);
  return (data ?? []) as AgentMemoryRow[];
}

/**
 * Upsert one fact. Calls the SECURITY DEFINER RPC so auth.uid() is honored.
 * Project-scope facts require a non-empty project_key.
 */
export async function upsertMemory(
  scope: MemoryScope,
  factKey: string,
  factValue: string,
  projectKey: string | null = null,
): Promise<AgentMemoryRow> {
  const { data, error } = await supabase.rpc('upsert_agent_memory', {
    p_scope: scope,
    p_project_key: projectKey,
    p_fact_key: factKey,
    p_fact_value: factValue,
  });
  if (error) throw new Error(`upsertMemory failed: ${error.message}`);
  return data as AgentMemoryRow;
}

/**
 * Delete one fact by its composite key. Returns the number of rows deleted (0 or 1).
 */
export async function deleteMemory(
  scope: MemoryScope,
  factKey: string,
  projectKey: string | null = null,
): Promise<number> {
  const { data, error } = await supabase.rpc('delete_agent_memory', {
    p_scope: scope,
    p_project_key: projectKey,
    p_fact_key: factKey,
  });
  if (error) throw new Error(`deleteMemory failed: ${error.message}`);
  return typeof data === 'number' ? data : 0;
}

/**
 * Render memory rows as a compact prompt-safe block to prepend to the system prompt.
 * Returns '' when there are no rows.
 *
 * The output looks like:
 *
 *   <memory>
 *   ## What I remember about this user (global)
 *   - role: QS
 *   - preferred_language: zh
 *
 *   ## What I remember about the project "block-a.ifc"
 *   - contract_type: JKR_203
 *   - last_vo_value: MYR 250,000
 *   </memory>
 *
 * Triple-backtick sequences inside fact values are escaped to triple-single-quote
 * to prevent prompt injection via memory poisoning.
 */
export function formatMemoryForPrompt(rows: AgentMemoryRow[]): string {
  if (rows.length === 0) return '';
  const safe = (s: string) => s.replaceAll('\n', ' ').replaceAll('```', "'''");

  const userRows = rows.filter((r) => r.scope === 'user');
  const projectRows = rows.filter((r) => r.scope === 'project');
  const projectGroups = new Map<string, AgentMemoryRow[]>();
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

/**
 * Best-effort parse of fact_value: if it looks like JSON, parse it; otherwise
 * return the raw string. Used by UI rendering for typed display.
 */
export function parseFactValue(raw: string): unknown {
  const trimmed = raw.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}
