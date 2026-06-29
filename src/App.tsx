import React, { useEffect, useMemo, useRef, useState } from 'react';
import { exportBqTemplateWorkbook } from './bq-tools';
import { buildBqMappingContext } from './lib/format';
import AuthGuard from './components/AuthGuard';
import AppHeader from './components/AppHeader';
import AppSidebar from './components/AppSidebar';
import ModelViewer from './components/ModelViewer';
import KPIGrid from './components/KPIGrid';
import ResultsTable from './components/ResultsTable';
import BQMappingPanel from './components/BQMappingPanel';
import CopilotPanel from './components/CopilotPanel';
import AuditPanel from './components/AuditPanel';
import GuidePage from './components/GuidePage';
import DwgPanel from './components/DwgPanel';
import RvtAuditPanel from './components/RvtAuditPanel';
import PasswordResetModal from './components/PasswordResetModal';
import ViewerErrorBoundary from './components/ViewerErrorBoundary';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './auth/AuthProvider';
import { useCredits } from './hooks/useCredits';
import { useLang } from './i18n/LanguageContext';
import { useBimEngine } from './hooks/useBimEngine';
import { useIfcModels } from './hooks/useIfcModels';
import { useBqMapping } from './hooks/useBqMapping';
import { useVoComparison } from './hooks/useVoComparison';
import { useAudit } from './hooks/useAudit';
import { useDwgTakeoff } from './hooks/useDwgTakeoff';
import { useRvtConvert, RVT_CREDIT_COST } from './hooks/useRvtConvert';
import { useBilling } from './hooks/useBilling';
import type { ToolContext } from './agent/tools';
import type { ActiveTab } from './lib/format';
import toast from 'react-hot-toast';

interface WorkspaceContextPanelProps {
  activeTab: ActiveTab;
  compareState: string;
  totalPendingRates: number;
  totalRatedActions: number;
  totalHighRiskQuantityItems: number;
  totalCommercialOmissions: number;
  totalCommercialAdditions: number;
  mappedLabelCount: number;
  mappingCandidatesCount: number;
  auditState: string;
  dwgItemCount: number;
}

function WorkspaceContextPanel({
  activeTab,
  compareState,
  totalPendingRates,
  totalRatedActions,
  totalHighRiskQuantityItems,
  totalCommercialOmissions,
  totalCommercialAdditions,
  mappedLabelCount,
  mappingCandidatesCount,
  auditState,
  dwgItemCount,
}: WorkspaceContextPanelProps) {
  const nextTitle = activeTab === 'valuation'
    ? 'Confirm BQ mappings'
    : activeTab === 'audit'
      ? 'Run quantity audit'
      : activeTab === 'dwg'
        ? 'Upload DWG drawing'
        : compareState === 'success'
          ? 'Resolve pending rates'
          : 'Load IFC files to begin';

  const nextCopy = activeTab === 'valuation'
    ? `${mappedLabelCount}/${mappingCandidatesCount} QS descriptions mounted.`
    : activeTab === 'audit'
      ? auditState === 'done' ? 'Audit report is ready for review.' : 'Run JKR/SMM2 checks after loading an IFC.'
      : activeTab === 'dwg'
        ? dwgItemCount > 0 ? `${dwgItemCount} DWG takeoff items detected.` : 'Parse a DWG to create reviewable BOQ rows.'
        : compareState === 'success'
          ? `${totalPendingRates} rows need pricing before export.`
          : 'Upload base IFC, revision IFC, and BQ from the left rail before comparison.';

  return (
    <aside className="hidden h-full min-h-[44rem] border-l border-white/10 bg-[#070b11] px-5 py-5 xl:block">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Next</div>
      <div className="mt-3 rounded-lg border border-cyan-400/25 bg-cyan-400/[0.055] p-4">
        <div className="text-base font-black text-white">{nextTitle}</div>
        <div className="mt-2 text-sm leading-6 text-slate-300">{nextCopy}</div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="border-b border-white/10 pb-4">
          <div className="text-base font-black text-amber-300">{totalPendingRates} pending rates</div>
          <div className="mt-1 text-sm text-slate-400">Likely Star Rate build-up.</div>
        </div>
        <div className="border-b border-white/10 pb-4">
          <div className="text-base font-black text-amber-300">{totalHighRiskQuantityItems} quantity reviews</div>
          <div className="mt-1 text-sm text-slate-400">Confirm fallback quantities before export.</div>
        </div>
        <div className="border-b border-white/10 pb-4">
          <div className="text-base font-black text-cyan-300">{totalRatedActions} export-ready</div>
          <div className="mt-1 text-sm text-slate-400">Rows can already enter the workbook.</div>
        </div>
        <div className="border-b border-white/10 pb-4">
          <div className="text-base font-black text-white">{totalCommercialOmissions + totalCommercialAdditions} VO actions</div>
          <div className="mt-1 text-sm text-slate-400">{totalCommercialOmissions} omissions, {totalCommercialAdditions} additions.</div>
        </div>
      </div>

      <div className="mt-7 rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <div className="text-base font-black text-white">Copilot</div>
        <div className="mt-2 text-sm leading-6 text-slate-300">
          I can prepare a short review list from the current tab and highlight blockers for QS follow-up.
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState<ActiveTab>('copilot');


  // ── Auth & credits ────────────────────────────────────────────────────
  const { user, signOut, passwordRecovery, updatePassword, dismissPasswordRecovery } = useAuth();
  const { balance: creditsBalance, loading: creditsLoading, error: creditsError, refresh: refreshCredits, setBalance: setCreditsBalance } = useCredits(user?.id);

  // ── Scroll sync refs (kept in App because they bridge two JSX subtrees) ─
  const resultsTableScrollRef = useRef<HTMLDivElement>(null);
  const resultsScrollbarRef = useRef<HTMLDivElement>(null);
  const resultsScrollbarInnerRef = useRef<HTMLDivElement>(null);

  // ── Hook: BIM Engine ──────────────────────────────────────────────────
  const bimEngine = useBimEngine();
  const { containerRef, engineRef, sysLog, setSysLog, ensureEngine } = bimEngine;

  // We use a ref-based callback for resetComparison to break the init cycle
  // (ifcModels needs resetComparison, but voComparison needs ifc state).
  const resetComparisonRef = useRef<() => void>(() => {});

  // ── Hook: IFC Models ──────────────────────────────────────────────────
  const ifcModels = useIfcModels({
    ensureEngine,
    setSysLog,
    setActiveTab,
    resetComparison: () => resetComparisonRef.current(),
  });
  const { v1File, v2File, v1Components, v2Components, v1State, v2State, v1Error, v2Error, activeIfcSlot, v1InputRef, v2InputRef, handleIFCUpload, resetWorkspace } = ifcModels;

  // ── Hook: BQ Mapping ─────────────────────────────────────────────────
  const bqMapping = useBqMapping({ setSysLog, v1Components, v2Components });
  const { bqItems, bqFileName, bqError, mappingError, labelMappings, setLabelMappings, mappingDrafts, setMappingDrafts, setMappingError, bqInputRef, handleBqUpload } = bqMapping;

  // ── Hook: VO Comparison (actual) ──────────────────────────────────────
  const voComparison = useVoComparison({
    ensureEngine,
    engineRef,
    v1State, v2State,
    v1Components, v2Components,
    bqItems, labelMappings,
    setSysLog, setActiveTab,
    setMappingError,
    setLabelMappings,
    mappingDrafts, setMappingDrafts,
  });
  const {
    voResults, compareState, compareMessage, selectedRowKey, isRunning,
    resetComparison, runVOComparison, focusCommercialAction, runCompareForAgent,
    resultRows, mappingCandidates, mappedLabelCount, contractBqCount, mappingRows,
    orphanRows, orphanInstanceCount, orphanPreview,
    updateLabelMapping, stageDraftMapping,
    totalChanges, totalProtectedValue, totalFormworkAlerts, totalStarRateCandidates,
    totalEotFlags, totalCommercialOmissions, totalCommercialAdditions,
    totalPendingRates, totalRatedActions, totalHighRiskQuantityItems, totalNetValue,
  } = voComparison;

  // Wire up the resetComparison ref now that we have it
  resetComparisonRef.current = resetComparison;

  // ── Hook: Audit ───────────────────────────────────────────────────────
  const audit = useAudit({ ensureEngine, setSysLog, setActiveTab });
  const { auditResult, auditState, auditError, auditDurationMs, runAudit } = audit;

  // ── Hook: DWG Takeoff ─────────────────────────────────────────────────
  const dwg = useDwgTakeoff({ setSysLog, setActiveTab });
  const { dwgResult, dwgLoading, dwgError, dwgInputRef, handleDwgUpload } = dwg;

  // ── Hook: RVT Convert ─────────────────────────────────────────────────
  const billing = useBilling({
    user, creditsBalance, refreshCredits, setCreditsBalance, setSysLog,
    voResults, v1File, v2File, bqItems, labelMappings,
  });
  const { billingError, billingNotice, showPaywall, setShowPaywall, isStartingCheckout, isExporting, exportWorkbook, handleTopUpCheckout } = billing;

  const rvt = useRvtConvert({
    ensureEngine, setSysLog, setActiveTab,
    user, setCreditsBalance, setShowPaywall, refreshCredits,
  });
  const { rvtFile, rvtUrn, rvtConvertStatus, rvtConvertProgress, rvtConvertError, rvtAuditResult, rvtAuditDurationMs, rvtInputRef, handleRvtUpload, runRvtAudit } = rvt;

  // ── Engine resize effect (bridges engine + comparison state) ──────────
  useEffect(() => {
    if (!engineRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      engineRef.current?.onWindowResize();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [compareState, voResults, activeTab, engineRef]);

  // ── Scroll sync effect ────────────────────────────────────────────────
  useEffect(() => {
    const main = resultsTableScrollRef.current;
    const bottom = resultsScrollbarRef.current;
    const inner = resultsScrollbarInnerRef.current;
    if (!main || !bottom || !inner) return;

    inner.style.width = `${main.scrollWidth}px`;
    bottom.scrollLeft = main.scrollLeft;

    let syncingFromMain = false;
    let syncingFromBottom = false;

    const syncFromMain = () => {
      if (syncingFromBottom) return;
      syncingFromMain = true;
      bottom.scrollLeft = main.scrollLeft;
      syncingFromMain = false;
    };

    const syncFromBottom = () => {
      if (syncingFromMain) return;
      syncingFromBottom = true;
      main.scrollLeft = bottom.scrollLeft;
      syncingFromBottom = false;
    };

    main.addEventListener('scroll', syncFromMain);
    bottom.addEventListener('scroll', syncFromBottom);

    const resizeObserver = new ResizeObserver(() => {
      inner.style.width = `${main.scrollWidth}px`;
      bottom.scrollLeft = main.scrollLeft;
    });

    resizeObserver.observe(main);

    return () => {
      main.removeEventListener('scroll', syncFromMain);
      bottom.removeEventListener('scroll', syncFromBottom);
      resizeObserver.disconnect();
    };
  }, [activeTab, compareState, voResults, selectedRowKey]);

  // ── Derived flags ─────────────────────────────────────────────────────
  const showReportPanel = compareState === 'success' || compareState === 'error';
  const showOverviewTab = activeTab === 'overview';
  const showValuationTab = activeTab === 'valuation';

  // ── Agent tool context ────────────────────────────────────────────────
  const agentToolContext: ToolContext = useMemo(() => ({
    baseComponents: v1Components,
    revisionComponents: v2Components,
    voResults,
    bqItems,
    bqContext: buildBqMappingContext(bqItems, labelMappings),
    baseFileName: v1File?.name ?? null,
    revisionFileName: v2File?.name ?? null,
    runCompare: runCompareForAgent,
    getActiveIfcHandle: () => {
      const handle = engineRef.current?.getIfcHandle() ?? null;
      // DEV ONLY: expose to window for console debugging.
      if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as Record<string, unknown>).__ifcHandle = handle;
      return handle;
    },
    activeIfcSlot,
    dwgItems: dwgResult?.items,
    dwgFileName: dwgResult?.fileName ?? null,
  }), [v1Components, v2Components, voResults, bqItems, labelMappings, v1File, v2File, runCompareForAgent, activeIfcSlot, dwgResult, engineRef]);

  // ── JSX ───────────────────────────────────────────────────────────────
  return (
    <AuthGuard>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#090f17', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)' },
          error: {
            iconTheme: { primary: '#f59e0b', secondary: '#090f17' },
            style: { background: '#140f08', color: '#fde68a', border: '1px solid rgba(245,158,11,0.35)' },
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#090f17' },
          },
        }}
      />
      <div className="min-h-screen w-full overflow-x-hidden bg-[radial-gradient(circle_at_72%_-12%,_rgba(34,211,238,0.12),_transparent_32%),radial-gradient(circle_at_18%_12%,_rgba(59,130,246,0.13),_transparent_28%),#030507] font-sans text-slate-300">
      {/* ── HEADER (Idea Nest) ────────────────────────────── */}
      <AppHeader
        creditsBalance={creditsBalance}
        creditsLoading={creditsLoading}
        onSignOut={signOut}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {/* Hidden file inputs (triggered from sidebar buttons) */}
      <input ref={v1InputRef} type="file" className="hidden" accept=".ifc,.IFC,application/octet-stream" onChange={(e) => handleIFCUpload(e, 'v1')} disabled={isRunning} />
      <input ref={v2InputRef} type="file" className="hidden" accept=".ifc,.IFC,application/octet-stream" onChange={(e) => handleIFCUpload(e, 'v2')} disabled={isRunning} />
      <input ref={bqInputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleBqUpload} disabled={isRunning} />
      <input ref={dwgInputRef} type="file" className="hidden" accept=".dwg,.DWG" onChange={handleDwgUpload} />
      <input ref={rvtInputRef} type="file" className="hidden" accept=".rvt,.RVT" onChange={handleRvtUpload} />

      {/* ── BODY: sidebar + main ───────────────────────────── */}
      <div className="mx-auto max-w-[1500px] px-5 pb-7 pt-4">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#050911] shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
          <header className="grid min-h-[60px] grid-cols-1 border-b border-white/10 bg-[#070b11] xl:grid-cols-[260px_minmax(0,1fr)_280px]">
            <div className="border-b border-white/10 px-5 py-3 xl:border-b-0 xl:border-r xl:border-white/10">
              <div className="text-sm font-black text-white">Idea Nest · VO Review</div>
              <div className="mt-1 text-xs text-slate-400">
                {v1File ? 'Base loaded' : 'Base pending'} · {v2File ? 'Revision loaded' : 'Revision pending'} · {bqItems.length > 0 ? 'BQ ready' : 'BQ pending'}
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 px-4 py-3">
              {[
                ['copilot', 'Copilot'],
                ['overview', 'VO Results'],
                ['audit', 'Audit'],
                ['valuation', 'BQ Mapping'],
                ['dwg', 'DWG'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key as ActiveTab)}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                    activeTab === key ? 'bg-[#172235] text-white' : 'text-slate-400 hover:bg-white/[0.035] hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="hidden items-center justify-end px-5 xl:flex">
              <div className="rounded-full border border-cyan-400/25 bg-cyan-400/5 px-3 py-1.5 text-xs font-black text-cyan-300">
                Credits {creditsLoading ? '...' : creditsBalance ?? '-'}
              </div>
            </div>
          </header>
          <div className="grid min-h-[calc(100vh-152px)] grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
        <AppSidebar
          v1File={v1File} v2File={v2File} bqFileName={bqFileName}
          v1Components={v1Components} v2Components={v2Components} bqItems={bqItems}
          v1State={v1State} v2State={v2State} voResults={voResults}
          isRunning={isRunning} isExporting={isExporting}
          onUploadBase={() => v1InputRef.current?.click()}
          onUploadRevision={() => v2InputRef.current?.click()}
          onUploadBq={() => bqInputRef.current?.click()}
          onRunCompare={runVOComparison}
          onExportExcel={exportWorkbook}
          onExportBqTemplate={exportBqTemplateWorkbook}
          onRunAudit={runAudit}
          auditState={auditState}
          onUploadRvt={() => rvtInputRef.current?.click()}
          onResetWorkspace={resetWorkspace}
        />

        <main className="min-w-0 overflow-x-hidden bg-[#030507]">


      <div className="flex min-h-full flex-col">
        <div className={showOverviewTab ? '' : 'hidden'}>
          <ViewerErrorBoundary>
            <ModelViewer
              containerRef={containerRef}
              sysLog={sysLog}
              v1File={v1File} v2File={v2File}
              v1State={v1State} v2State={v2State}
              v1Components={v1Components} v2Components={v2Components}
              v1Error={v1Error} v2Error={v2Error}
              bqFileName={bqFileName} bqItems={bqItems}
              bqError={bqError} mappingError={mappingError}
              compareMessage={compareMessage}
              onResetCamera={() => engineRef.current?.resetCamera()}
              onToggleClipping={() => engineRef.current?.toggleClipping()}
            />
          </ViewerErrorBoundary>
        </div>

        {showOverviewTab ? (
          showReportPanel ? (
            <div className="flex flex-col border-t border-white/10 bg-[#030507]">
              <div className="flex items-end justify-between gap-4 px-5 py-5">
                <div>
                  <h2 className="text-2xl font-black text-white">VO Results</h2>
                  <p className="mt-1 text-sm text-slate-400">Only the numbers and review blockers that matter right now.</p>
                </div>
                <div className="hidden gap-2 md:flex">
                  <span className="rounded-full border border-cyan-400/25 px-3 py-1 text-xs font-bold text-cyan-300">All</span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-400">Pending</span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-400">Mismatch</span>
                </div>
              </div>
              {compareState === "error" ? (
                <div className="m-4 rounded border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{compareMessage}</div>
              ) : (
                <>
                <KPIGrid
                  totalChanges={totalChanges}
                  totalCommercialOmissions={totalCommercialOmissions}
                  totalCommercialAdditions={totalCommercialAdditions}
                  totalNetValue={totalNetValue}
                  totalPendingRates={totalPendingRates}
                  totalProtectedValue={totalProtectedValue}
                  rawModified={voResults?.modified.length ?? 0}
                  totalRatedActions={totalRatedActions}
                  totalHighRiskQuantityItems={totalHighRiskQuantityItems}
                  mappedLabelCount={mappedLabelCount}
                  mappingCandidatesCount={mappingCandidates.length}
                  contractBqCount={contractBqCount}
                  totalFormworkAlerts={totalFormworkAlerts}
                  totalStarRateCandidates={totalStarRateCandidates}
                  totalEotFlags={totalEotFlags}
                />
                <ResultsTable
                  resultRows={resultRows}
                  selectedRowKey={selectedRowKey}
                  onRowClick={focusCommercialAction}
                  scrollRef={resultsTableScrollRef}
                  scrollbarRef={resultsScrollbarRef}
                  scrollbarInnerRef={resultsScrollbarInnerRef}
                />
              </>
            )}
            </div>
          ) : (
            <section className="border-t border-white/10 px-5 py-10">
              <h2 className="text-2xl font-black text-white">VO Results</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                Run VO Comparison after both IFC files are loaded. The results table,
                quantity blockers, pending rates, and export readiness will appear here.
              </p>
            </section>
          )
        ) : showValuationTab ? (
          <BQMappingPanel
            mappingRows={mappingRows}
            bqFileName={bqFileName}
            bqItems={bqItems}
            bqError={bqError}
            mappingError={mappingError}
            orphanRows={orphanRows}
            orphanInstanceCount={orphanInstanceCount}
            orphanPreview={orphanPreview}
            mappedLabelCount={mappedLabelCount}
            mappingCandidatesCount={mappingCandidates.length}
            totalPendingRates={totalPendingRates}
            contractBqCount={contractBqCount}
            compareMessage={compareMessage}
            onUpdateMapping={updateLabelMapping}
            onStageDraft={stageDraftMapping}
          />
        ) : activeTab === 'audit' ? (
          <AuditPanel
            auditResult={auditResult}
            auditState={auditState}
            auditError={auditError}
            auditDurationMs={auditDurationMs}
            onRunAudit={runAudit}
            canRun={v1State === 'ready' || v2State === 'ready'}
          />
        ) : activeTab === 'guide' ? (
          <GuidePage />
        ) : activeTab === 'dwg' ? (
          <DwgPanel
            result={dwgResult}
            loading={dwgLoading}
            error={dwgError}
            onUpload={() => dwgInputRef.current?.click()}
          />
        ) : activeTab === 'rvt' ? (
          <RvtAuditPanel
            rvtFile={rvtFile}
            rvtUrn={rvtUrn}
            convertStatus={rvtConvertStatus}
            convertProgress={rvtConvertProgress}
            convertError={rvtConvertError}
            auditResult={rvtAuditResult}
            auditDurationMs={rvtAuditDurationMs}
            creditCost={RVT_CREDIT_COST}
            onUpload={() => rvtInputRef.current?.click()}
            onRunAudit={runRvtAudit}
            canRunAudit={!!rvtFile && rvtConvertStatus === 'idle' && !!user}
          />
        ) : (
          <div className="h-full p-4">
            <div className="min-h-0 flex-1">
              <CopilotPanel
                toolContext={agentToolContext}
                signedIn={!!user}
                onCreditsUpdate={(balance) => setCreditsBalance(balance)}
              />
            </div>
          </div>
        )}
      </div>
      </main>
      <WorkspaceContextPanel
        activeTab={activeTab}
        compareState={compareState}
        totalPendingRates={totalPendingRates}
        totalRatedActions={totalRatedActions}
        totalHighRiskQuantityItems={totalHighRiskQuantityItems}
        totalCommercialOmissions={totalCommercialOmissions}
        totalCommercialAdditions={totalCommercialAdditions}
        mappedLabelCount={mappedLabelCount}
        mappingCandidatesCount={mappingCandidates.length}
        auditState={auditState}
        dwgItemCount={dwgResult?.items.length ?? 0}
      />
      </div>
      </section>
      </div>
      </div>
      {billingNotice && (
        <div className={`mx-6 mt-4 rounded-2xl border px-4 py-3 text-sm ${billingNotice.tone === 'success' ? 'border-emerald-900/70 bg-emerald-950/30 text-emerald-200' : 'border-blue-900/70 bg-blue-950/30 text-blue-200'}`}>
          {billingNotice.message}
        </div>
      )}
      {billingError && (
        <div className="mx-6 mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {billingError}
        </div>
      )}
      {creditsError && (
        <div className="mx-6 mt-4 rounded-2xl border border-amber-900/70 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {t('toast.creditsRefreshed', { error: creditsError })}
        </div>
      )}
      {showPaywall && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#090f17]/95 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.75)]">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">{t('paywall.label')}</div>
            <h2 className="mt-4 text-3xl font-black text-white">{t('paywall.title')}</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">{t('paywall.message')}</p>
            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/70 px-4 py-4 text-sm text-slate-300">
              {t('paywall.balance')} <span className="font-black text-white">{creditsBalance ?? 0}</span> {t('paywall.unit')}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="flex-1 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
                onClick={handleTopUpCheckout}
                disabled={isStartingCheckout || !user}
              >
                {isStartingCheckout ? t('paywall.redirecting') : t('paywall.topUp')}
              </button>
              <button
                type="button"
                className="rounded-2xl border border-slate-600 bg-slate-800 px-5 py-4 text-sm font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
                onClick={() => setShowPaywall(false)}
              >
                {t('paywall.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {passwordRecovery && (
        <PasswordResetModal updatePassword={updatePassword} onDismiss={dismissPasswordRecovery} />
      )}
    </AuthGuard>
  );
}
