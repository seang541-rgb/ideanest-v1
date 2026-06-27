import { useCallback, useEffect, useState } from 'react';
import { fetchUserMemory, deleteMemory, type AgentMemoryRow, type MemoryScope } from '../agent/memory';

export interface UseAgentMemoryResult {
  rows: AgentMemoryRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  forget: (scope: MemoryScope, factKey: string, projectKey: string | null) => Promise<void>;
}

/**
 * Loads the authenticated user's memory rows and provides a refresh + forget API.
 * Pass `enabled=false` to skip loading (e.g. when user is not signed in).
 */
export function useAgentMemory(enabled: boolean): UseAgentMemoryResult {
  const [rows, setRows] = useState<AgentMemoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchUserMemory();
      setRows(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const forget = useCallback(
    async (scope: MemoryScope, factKey: string, projectKey: string | null) => {
      await deleteMemory(scope, factKey, projectKey);
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { rows, loading, error, refresh, forget };
}
