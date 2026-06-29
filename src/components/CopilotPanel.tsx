import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Loader2, RefreshCw, Send, Sparkles, Wrench } from 'lucide-react';
import { AgentSession, type AgentEvent } from '../agent/agent-client';
import type { ToolContext } from '../agent/tools';
import AgentMemoryPanel from './AgentMemoryPanel';
import { useLang } from '../i18n/LanguageContext';

interface ChatEntry {
  id: string;
  kind: 'user' | 'assistant' | 'tool' | 'error';
  text: string;
  meta?: string;
}

interface CopilotPanelProps {
  toolContext: ToolContext;
  signedIn: boolean;
  onCreditsUpdate?: (balance: number) => void;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function truncate(str: string, n = 400) {
  return str.length > n ? `${str.slice(0, n)}...` : str;
}

function statusText(ready: boolean, readyText: string, fallback: string) {
  return ready ? readyText : fallback;
}

export default function CopilotPanel({ toolContext, signedIn, onCreditsUpdate }: CopilotPanelProps) {
  const { t } = useLang();
  const sessionRef = useRef<AgentSession | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeToolLabel, setActiveToolLabel] = useState<string | null>(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const baseReady = toolContext.baseComponents.length > 0;
  const revReady = toolContext.revisionComponents.length > 0;
  const compareReady = !!toolContext.voResults;

  const samplePrompts = [
    t('copilot.sample1'),
    t('copilot.sample2'),
    t('copilot.sample3'),
    t('copilot.sample4'),
  ];

  useEffect(() => {
    if (!sessionRef.current) {
      sessionRef.current = new AgentSession(toolContext);
    } else {
      sessionRef.current.updateContext(toolContext);
    }
  }, [toolContext]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, busy, activeToolLabel]);

  const pushEntry = useCallback((entry: ChatEntry) => {
    setEntries((prev) => [...prev, entry]);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      if (!signedIn) {
        pushEntry({ id: newId(), kind: 'error', text: t('copilot.notSignedIn') });
        return;
      }
      if (!sessionRef.current) sessionRef.current = new AgentSession(toolContext);
      else sessionRef.current.updateContext(toolContext);

      pushEntry({ id: newId(), kind: 'user', text: trimmed });
      setInput('');
      setBusy(true);
      setActiveToolLabel(null);

      const handleEvent = (event: AgentEvent) => {
        switch (event.kind) {
          case 'assistant_text':
            if (event.text) pushEntry({ id: newId(), kind: 'assistant', text: event.text });
            break;
          case 'tool_start':
            setActiveToolLabel(event.name);
            pushEntry({
              id: newId(),
              kind: 'tool',
              text: event.name,
              meta: truncate(JSON.stringify(event.input), 200),
            });
            break;
          case 'tool_end':
            setActiveToolLabel(null);
            pushEntry({
              id: newId(),
              kind: 'tool',
              text: `${event.name} - ${event.durationMs}ms`,
              meta: truncate(JSON.stringify(event.result), 400),
            });
            break;
          case 'credits':
            if (typeof event.balance === 'number' && onCreditsUpdate) onCreditsUpdate(event.balance);
            break;
          case 'error':
            pushEntry({ id: newId(), kind: 'error', text: event.message });
            break;
        }
      };

      try {
        await sessionRef.current.send(trimmed, handleEvent);
      } catch (err) {
        pushEntry({
          id: newId(),
          kind: 'error',
          text: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setBusy(false);
        setActiveToolLabel(null);
      }
    },
    [busy, onCreditsUpdate, pushEntry, signedIn, toolContext, t],
  );

  const handleReset = () => {
    sessionRef.current?.reset();
    setEntries([]);
    setActiveToolLabel(null);
  };

  const statusLine = useMemo(() => {
    const base = statusText(baseReady, `${toolContext.baseComponents.length} components`, t('copilot.notLoaded'));
    const rev = statusText(revReady, `${toolContext.revisionComponents.length} components`, t('copilot.notLoaded'));
    const compare = compareReady ? t('copilot.cached') : t('copilot.notRun');
    return [
      `Base IFC: ${base}`,
      `Revision IFC: ${rev}`,
      `Comparison: ${compare}`,
    ].join(' | ');
  }, [baseReady, compareReady, revReady, t, toolContext.baseComponents.length, toolContext.revisionComponents.length]);

  return (
    <div className="flex h-full min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#050911] shadow-[0_24px_90px_rgba(0,0,0,0.26)]">
      <div className="flex min-h-[62px] items-center justify-between gap-4 border-b border-white/10 bg-white/[0.025] px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
            <Sparkles className="h-4 w-4" />
            {t('copilot.title')}
          </div>
          <div className="mt-1 truncate text-xs text-slate-400">{statusLine}</div>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-[#0b111c] px-3 text-xs font-bold text-slate-300 transition hover:border-blue-400/35 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('copilot.reset')}
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {entries.length === 0 && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <div className="font-bold text-blue-300">Ready when your IFC files are.</div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Upload the project files from the left rail, then ask Copilot to compare,
                summarize commercial impact, resolve pending rates, or prepare the VO export.
              </p>

              <div className="mt-5 grid gap-2 md:grid-cols-2">
                {samplePrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="min-h-11 rounded-lg border border-white/10 bg-[#0b111c] px-3 text-left text-xs font-semibold text-slate-200 transition hover:border-blue-400/35 hover:bg-blue-500/10 hover:text-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <aside className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.045] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Next</div>
              <div className="mt-3 text-sm font-bold text-white">
                {compareReady ? 'Review current VO context' : 'Load IFC files to begin'}
              </div>
              <div className="mt-2 text-xs leading-5 text-slate-400">
                {compareReady
                  ? 'Ask Copilot to summarize omissions, additions, pending rates, or export readiness.'
                  : 'Upload base IFC, revision IFC, and BQ from the left rail before running comparison.'}
              </div>
            </aside>
          </div>
        )}

        <div className="space-y-3">
          {entries.map((entry) => {
            if (entry.kind === 'user') {
              return (
                <div key={entry.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-xl rounded-tr-sm bg-blue-500 px-3.5 py-2 text-sm font-medium text-white shadow">
                    {entry.text}
                  </div>
                </div>
              );
            }
            if (entry.kind === 'assistant') {
              return (
                <div key={entry.id} className="flex justify-start">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-tl-sm border border-white/10 bg-white/[0.045] px-3.5 py-2 text-sm leading-6 text-slate-100 shadow">
                    {entry.text}
                  </div>
                </div>
              );
            }
            if (entry.kind === 'tool') {
              return (
                <div key={entry.id} className="flex justify-start">
                  <details className="w-full max-w-[85%] rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-1.5 text-xs text-slate-400">
                    <summary className="flex cursor-pointer items-center gap-2 font-mono">
                      <Wrench className="h-3 w-3 text-amber-300" />
                      {entry.text}
                    </summary>
                    {entry.meta && (
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 font-mono text-[11px] text-amber-100">
                        {entry.meta}
                      </pre>
                    )}
                  </details>
                </div>
              );
            }
            return (
              <div key={entry.id} className="flex justify-start">
                <div className="max-w-[85%] rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                  {entry.text}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-400/20 bg-blue-400/5 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
              <div className="flex-1">
                <div className="text-xs font-semibold text-blue-200">
                  {activeToolLabel ? t('copilot.executing', { tool: activeToolLabel }) : t('copilot.thinking')}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {activeToolLabel ? t('copilot.toolRunning') : t('copilot.analyzing')}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend(input);
        }}
        className="border-t border-white/10 bg-white/[0.025] p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend(input);
              }
            }}
            rows={2}
            placeholder={signedIn ? t('copilot.placeholder') : t('copilot.placeholderSignedOut')}
            disabled={busy || !signedIn}
            className="min-h-12 flex-1 resize-none rounded-lg border border-white/10 bg-[#0b111c] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/10 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setMemoryOpen(true)}
            disabled={!signedIn}
            title={t('memory.openBtn')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#0b111c] text-slate-400 transition hover:border-blue-400/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Brain className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={busy || entries.length === 0}
            title={t('copilot.reset')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#0b111c] text-slate-400 transition hover:border-blue-400/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={busy || !signedIn || !input.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-blue-500 px-4 text-sm font-black text-white shadow transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {t('copilot.send')}
          </button>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          {t('copilot.creditCost')}
        </div>
      </form>
      <AgentMemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} signedIn={signedIn} />
    </div>
  );
}
