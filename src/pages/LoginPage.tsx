import React, { useState } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useLang } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

const workflowSteps: [string, string, string][] = [
  ['01', 'login.workflow1Title', 'login.workflow1Copy'],
  ['02', 'login.workflow2Title', 'login.workflow2Copy'],
  ['03', 'login.workflow3Title', 'login.workflow3Copy'],
  ['04', 'login.workflow4Title', 'login.workflow4Copy'],
  ['05', 'login.workflow5Title', 'login.workflow5Copy'],
];

const proofPoints: [string, string][] = [
  ['login.proof1Title', 'login.proof1Copy'],
  ['login.proof2Title', 'login.proof2Copy'],
  ['login.proof3Title', 'login.proof3Copy'],
  ['login.proof4Title', 'login.proof4Copy'],
];

export default function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const { t } = useLang();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'forgot') {
        const msg = await resetPassword(email);
        setMessage(msg);
      } else if (mode === 'login') {
        await signIn(email, password);
      } else {
        const signUpMessage = await signUp(email, password);
        if (signUpMessage) setMessage(signUpMessage);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === 'forgot' ? t('login.modeForgot') : mode === 'login' ? t('login.modeLogin') : t('login.modeSignup');

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_72%_-12%,_rgba(34,211,238,0.12),_transparent_32%),radial-gradient(circle_at_18%_12%,_rgba(59,130,246,0.13),_transparent_28%),#030507] px-5 py-7 text-slate-100">
      <div className="mx-auto max-w-[1440px]">
        <header className="flex min-h-16 items-center justify-between gap-5">
          <div className="inline-flex min-h-[54px] items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.035] px-3 py-2 shadow-[0_18px_46px_rgba(0,0,0,0.22)]">
            <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-[11px] border border-cyan-300/15 bg-[radial-gradient(circle_at_50%_46%,_rgba(34,211,238,0.14),_rgba(59,130,246,0.08)_48%,_rgba(255,255,255,0.035))]">
              <img src="/ideanest-symbol-transparent.png" alt="Idea Nest logo" className="h-auto w-11" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-white">Idea Nest VO Copilot</div>
              <div className="text-xs text-slate-400">{t('login.brandSubtitle')}</div>
            </div>
          </div>
          <LanguageSwitcher />
        </header>

        <main className="grid gap-12 pt-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
              {t('login.eyebrow')}
            </div>
            <h1 className="mt-7 max-w-[820px] text-[46px] font-black leading-[0.98] tracking-normal text-white sm:text-[64px] lg:text-[84px]">
              {t('login.heroTitle')}
            </h1>
            <p className="mt-6 max-w-[720px] text-lg leading-8 text-slate-300 lg:text-xl">
              {t('login.heroCopy')}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => document.getElementById('ideanest-auth-email')?.focus()}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-500 px-5 text-sm font-black text-white transition hover:bg-blue-400"
              >
                {t('login.btnLogin')}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="min-h-11 rounded-lg border border-white/10 bg-transparent px-5 text-sm font-black text-blue-100 transition hover:border-blue-400/40 hover:bg-blue-500/10"
              >
                {t('login.tabSignup')}
              </button>
            </div>

            <div className="mt-16 grid max-w-[960px] grid-cols-1 border-t border-white/10 sm:grid-cols-2 lg:grid-cols-5">
              {workflowSteps.map(([step, labelKey, copyKey], index) => (
                <div key={step} className={`min-h-[116px] px-0 py-5 pr-5 ${index < workflowSteps.length - 1 ? 'lg:border-r lg:border-white/10' : ''}`}>
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{step}</div>
                  <div className="mt-3 text-base font-extrabold text-white">{t(labelKey)}</div>
                  <div className="mt-1.5 text-xs leading-5 text-slate-400">{t(copyKey)}</div>
                </div>
              ))}
            </div>

            <div className="mt-11 grid max-w-[960px] gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {proofPoints.map(([labelKey, copyKey]) => (
                <div key={labelKey} className="border-t border-white/10 pt-4">
                  <div className="font-extrabold text-white">{t(labelKey)}</div>
                  <div className="mt-1.5 text-sm leading-6 text-slate-400">{t(copyKey)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#090f17]/90 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.36)] backdrop-blur-xl">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{t('login.secureAccess')}</div>
            <h2 className="mt-2 text-3xl font-black text-white">{title}</h2>

            {mode !== 'forgot' && (
              <div className="mt-6 grid grid-cols-2 gap-1 rounded-[10px] border border-white/10 p-1">
                <button
                  type="button"
                  className={`rounded-lg px-4 py-2 text-sm font-extrabold transition ${mode === 'login' ? 'bg-[#172235] text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  onClick={() => setMode('login')}
                >
                  {t('login.tabLogin')}
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-4 py-2 text-sm font-extrabold transition ${mode === 'signup' ? 'bg-[#172235] text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  onClick={() => setMode('signup')}
                >
                  {t('login.tabSignup')}
                </button>
              </div>
            )}

            <form className="mt-7 space-y-5" onSubmit={submit}>
              <label className="block space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{t('login.email')}</span>
                <input
                  id="ideanest-auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-h-12 w-full rounded-lg border border-white/10 bg-[#121b2a] px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                  placeholder={t('login.emailPlaceholder')}
                  autoComplete="email"
                  required
                />
              </label>

              {mode !== 'forgot' && (
                <label className="block space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{t('login.password')}</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-h-12 w-full rounded-lg border border-white/10 bg-[#121b2a] px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                    placeholder={t('login.passwordPlaceholder')}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={6}
                    required
                  />
                </label>
              )}

              {mode === 'login' && (
                <button
                  type="button"
                  className="text-xs text-blue-300 transition hover:text-blue-200"
                  onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                >
                  {t('login.forgotPassword')}
                </button>
              )}

              {mode === 'forgot' && (
                <button
                  type="button"
                  className="text-xs text-slate-400 transition hover:text-slate-200"
                  onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                >
                  {t('login.backToLogin')}
                </button>
              )}

              {error && <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{error}</div>}
              {message && <div className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">{message}</div>}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg bg-blue-500 px-5 text-sm font-black text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {submitting ? t('login.processing') : mode === 'forgot' ? t('login.btnForgot') : mode === 'login' ? t('login.btnLogin') : t('login.btnSignup')}
              </button>
            </form>

            <p className="mt-5 text-xs leading-5 text-slate-400">
              {t('login.submitHelp')}
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
