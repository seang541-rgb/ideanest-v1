import { Coins, HelpCircle, LogOut } from 'lucide-react';
import { useLang } from '../i18n/LanguageContext';
import type { ActiveTab } from '../lib/format';

interface AppHeaderProps {
  creditsBalance: number | null;
  creditsLoading: boolean;
  onSignOut: () => void;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

const NAV_TABS: { key: ActiveTab; i18nKey: string }[] = [
  { key: 'copilot', i18nKey: 'header.tab.copilot' },
  { key: 'overview', i18nKey: 'header.tab.overview' },
  { key: 'audit', i18nKey: 'header.tab.audit' },
  { key: 'valuation', i18nKey: 'header.tab.valuation' },
  { key: 'dwg', i18nKey: 'header.tab.dwg' },
];

export default function AppHeader({
  creditsBalance,
  creditsLoading,
  onSignOut,
  activeTab,
  onTabChange,
}: AppHeaderProps) {
  const { t, lang, setLang } = useLang();

  return (
    <header className="sticky top-0 z-40 min-h-16 border-b border-white/10 bg-[#030507]/95 backdrop-blur-xl">
      <div className="flex min-h-16 items-center justify-between gap-4 px-5">
        <div className="inline-flex min-h-[46px] shrink-0 items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.035] px-3 py-1.5 shadow-[0_18px_46px_rgba(0,0,0,0.22)]">
          <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-[11px] border border-cyan-300/15 bg-[radial-gradient(circle_at_50%_46%,_rgba(34,211,238,0.14),_rgba(59,130,246,0.08)_48%,_rgba(255,255,255,0.035))]">
            <img src="/ideanest-symbol-transparent.png" alt="Idea Nest logo" className="h-auto w-11" />
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-extrabold leading-4 text-white">Idea Nest VO Copilot</div>
            <div className="mt-0.5 text-xs leading-4 text-slate-400">{t('header.tagline')}</div>
          </div>
        </div>

        <nav className="hidden items-center gap-1 rounded-[10px] border border-white/10 bg-[#0b111c] p-1 md:flex">
          {NAV_TABS.map(({ key, i18nKey }) => (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              className={`rounded-lg px-3 py-2 text-xs font-extrabold transition ${
                activeTab === key
                  ? 'bg-[#172235] text-white shadow-sm'
                  : 'text-slate-400 hover:bg-white/[0.035] hover:text-slate-200'
              }`}
            >
              {t(i18nKey)}
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onTabChange('guide')}
            className={`grid h-9 w-9 place-items-center rounded-lg border transition ${
              activeTab === 'guide'
                ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
                : 'border-white/10 bg-[#0b111c] text-slate-400 hover:text-white'
            }`}
            title={t('sidebar.guide')}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <div className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-400/5 px-3 text-cyan-300">
            <Coins className="h-3.5 w-3.5" />
            <span className="hidden text-[10px] font-black uppercase tracking-wider sm:inline">{t('header.credits')}</span>
            <span className="text-xs font-black text-white">{creditsLoading ? '...' : creditsBalance ?? '-'}</span>
          </div>
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
            className="h-9 rounded-lg border border-white/10 bg-[#0b111c] px-3 text-[11px] font-black text-slate-300 transition hover:text-white"
          >
            {lang === 'en' ? '中文' : 'EN'}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-[#0b111c] px-3 text-[11px] font-bold text-slate-300 transition hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{t('header.signOut')}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
