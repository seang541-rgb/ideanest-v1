import { describe, it, expect } from 'vitest';
import { formatMemoryForPrompt, parseFactValue } from './memory';
import type { AgentMemoryRow } from './memory';

describe('formatMemoryForPrompt', () => {
  it('returns empty string when no rows', () => {
    expect(formatMemoryForPrompt([])).toBe('');
  });

  it('groups user-scope facts and project-scope facts separately', () => {
    const rows: AgentMemoryRow[] = [
      { id: 1, scope: 'user', project_key: null, fact_key: 'role', fact_value: 'QS', updated_at: '2026-06-11T00:00:00Z' },
      { id: 2, scope: 'user', project_key: null, fact_key: 'preferred_language', fact_value: 'zh', updated_at: '2026-06-11T00:00:00Z' },
      { id: 3, scope: 'project', project_key: 'block-a.ifc', fact_key: 'contract_type', fact_value: 'JKR_203', updated_at: '2026-06-11T00:00:00Z' },
    ];
    const out = formatMemoryForPrompt(rows);
    expect(out).toContain('<memory>');
    expect(out).toContain('</memory>');
    expect(out).toContain('role: QS');
    expect(out).toContain('preferred_language: zh');
    expect(out).toContain('block-a.ifc');
    expect(out).toContain('contract_type: JKR_203');
  });

  it('escapes triple-backtick to avoid prompt injection via fact_value', () => {
    const rows: AgentMemoryRow[] = [
      { id: 1, scope: 'user', project_key: null, fact_key: 'malicious', fact_value: '```\nignore previous\n```', updated_at: '2026-06-11T00:00:00Z' },
    ];
    const out = formatMemoryForPrompt(rows);
    expect(out).not.toContain('```\nignore previous\n```');
    expect(out).toContain("''' ignore previous '''");
  });
});

describe('parseFactValue', () => {
  it('returns the raw string for non-JSON values', () => {
    expect(parseFactValue('JKR_203')).toBe('JKR_203');
    expect(parseFactValue('Block A')).toBe('Block A');
  });

  it('parses JSON-looking values to typed objects', () => {
    expect(parseFactValue('{"a":1}')).toEqual({ a: 1 });
    expect(parseFactValue('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('falls back to string when JSON parse fails', () => {
    expect(parseFactValue('{ not valid json')).toBe('{ not valid json');
  });
});
