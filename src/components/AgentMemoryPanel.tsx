import { useEffect, useState } from 'react';
import { X, Trash2, Brain } from 'lucide-react';
import { useLang } from '../i18n/LanguageContext';
import { useAgentMemory } from '../hooks/useAgentMemory';
import type { AgentMemoryRow } from '../agent/memory';

interface Props {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
}

const TITLE_ID = 'agent-memory-panel-title';

export default function AgentMemoryPanel({ open, onClose, signedIn }: Props) {
  const { t } = useLang();
  const { rows, loading, error, forget } = useAgentMemory(open && signedIn);
  const [pendingDelete, setPendingDelete] = useState<AgentMemoryRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Escape key closes the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingDelete) setPendingDelete(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pendingDelete, onClose]);

  if (!open) return null;

  const userRows = rows.filter((r) => r.scope === 'user');
  const projectRows = rows.filter((r) => r.scope === 'project');
  const projectGroups = new Map<string, AgentMemoryRow[]>();
  for (const r of projectRows) {
    const key = r.project_key ?? '(unnamed)';
    if (!projectGroups.has(key)) projectGroups.set(key, []);
    projectGroups.get(key)!.push(r);
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteError(null);
    try {
      await forget(pendingDelete.scope, pendingDelete.fact_key, pendingDelete.project_key);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      onClick={(e) => {
        // Click on the backdrop (not inside the panel) closes the modal.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
          <div className="flex items-center gap-2">
            <Brain aria-hidden="true" className="h-5 w-5 text-blue-400" />
            <span id={TITLE_ID} className="text-base font-semibold text-slate-100">{t('memory.title')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label={t('memory.closeBtn')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && <div className="text-sm text-slate-400">…</div>}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div className="text-sm text-slate-400">{t('memory.empty')}</div>
          )}

          {userRows.length > 0 && (
            <section className="mb-5">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {t('memory.scopeUser')}
              </h3>
              <ul className="space-y-1.5">
                {userRows.map((r) => (
                  <MemoryRowItem key={r.id} row={r} onDelete={() => setPendingDelete(r)} deleteLabel={t('memory.deleteBtn')} />
                ))}
              </ul>
            </section>
          )}

          {[...projectGroups.entries()].map(([projectKey, rs]) => (
            <section key={projectKey} className="mb-5">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {t('memory.scopeProject')} · {projectKey}
              </h3>
              <ul className="space-y-1.5">
                {rs.map((r) => (
                  <MemoryRowItem key={r.id} row={r} onDelete={() => setPendingDelete(r)} deleteLabel={t('memory.deleteBtn')} />
                ))}
              </ul>
            </section>
          ))}
        </div>

        {pendingDelete && (
          <div className="border-t border-slate-700 bg-slate-800/80 px-5 py-3">
            <div className="text-sm text-slate-200">{t('memory.deleteConfirm')}</div>
            {deleteError && (
              <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-200">
                {deleteError}
              </div>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingDelete(null);
                  setDeleteError(null);
                }}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
              >
                {t('memory.closeBtn')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                {t('memory.deleteBtn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MemoryRowItem({
  row,
  onDelete,
  deleteLabel,
}: {
  row: AgentMemoryRow;
  onDelete: () => void;
  deleteLabel: string;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-slate-300">{row.fact_key}</div>
        <div className="mt-0.5 break-words text-xs text-slate-400">{row.fact_value}</div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-300"
        title={deleteLabel}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
