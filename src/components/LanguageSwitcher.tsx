import { useLang, type Lang } from '../i18n/LanguageContext';

const LANGUAGE_OPTIONS: { lang: Lang; label: string }[] = [
  { lang: 'zh', label: '\u4e2d\u6587' },
  { lang: 'en', label: 'EN' },
  { lang: 'ms', label: 'BM' },
];

export default function LanguageSwitcher() {
  const { lang, setLang } = useLang();

  return (
    <div
      className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-[#0b111c] p-1"
      aria-label="Language selector"
    >
      {LANGUAGE_OPTIONS.map((option) => (
        <button
          key={option.lang}
          type="button"
          onClick={() => setLang(option.lang)}
          className={`h-7 rounded-md px-2.5 text-[11px] font-black transition ${
            lang === option.lang
              ? 'bg-[#172235] text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-200'
          }`}
          aria-pressed={lang === option.lang}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
