import { useCallback, useEffect, useRef, useState } from 'react';
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
 *
 * Uses an isMounted ref so that fetches in flight when the component unmounts
 * don't call state setters on a dead component. `forget` propagates errors to
 * the caller so the UI can react (the panel shows them via setError below).
 */
export function useAgentMemory(enabled: boolean): UseAgentMemoryResult {
  const [rows, setRows] = useState<AgentMemoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (isMounted.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await fetchUserMemory();
      if (isMounted.current) setRows(next);
    } catch (err) {
      if (isMounted.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [enabled]);

  const forget = useCallback(
    async (scope: MemoryScope, factKey: string, projectKey: string | null) => {
      try {
        await deleteMemory(scope, factKey, projectKey);
        await refresh();
      } catch (err) {
        if (isMounted.current) setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [refresh],
  );

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { rows, loading, error, refresh, forget };
}
