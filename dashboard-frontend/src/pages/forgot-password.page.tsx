import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, MailCheck, UtensilsCrossed } from 'lucide-react';
import { useForgotPassword } from '@/features/auth/hooks/use-auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const forgot = useForgotPassword();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setFieldError('Please enter a valid email address.');
      return;
    }
    setFieldError(null);
    forgot.mutate(trimmed);
  };

  return (
    <AuthShell>
      {forgot.isSuccess ? (
        <div className="relative text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/15">
            <MailCheck className="h-8 w-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Check your email</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            If an account exists for <span className="text-slate-200 font-medium">{email.trim()}</span>,
            we&apos;ve sent a password reset link. It&apos;s valid for 30 minutes.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="relative mb-8 space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-white">Forgot password?</h2>
            <p className="text-sm text-slate-400">
              Enter your admin email and we&apos;ll send you a reset link.
            </p>
          </div>

          <form onSubmit={onSubmit} className="relative space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-slate-300">
                Email address
              </label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors duration-200 group-focus-within:text-blue-400" />
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  disabled={forgot.isPending}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`h-11 w-full rounded-xl border bg-white/[0.06] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200 focus:bg-white/[0.08] focus:ring-2 ${
                    fieldError
                      ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-white/[0.08] focus:border-blue-500/50 focus:ring-blue-500/20'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                />
              </div>
              {fieldError && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                  <span className="inline-block h-1 w-1 rounded-full bg-red-400" />
                  {fieldError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={forgot.isPending}
              className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all duration-300 hover:from-blue-500 hover:to-blue-400 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {forgot.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending link…
                </span>
              ) : (
                'Send reset link'
              )}
            </button>

            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </form>
        </>
      )}
    </AuthShell>
  );
}

/** Shared dark glassmorphism shell matching the login page. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0F172A] p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A]" />
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-blue-600/15 via-blue-500/8 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-sky-500/15 via-blue-400/8 to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">ADLER</h1>
            <p className="text-xs text-blue-300/70">Staff Planning</p>
          </div>
        </div>

        <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl">
          <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />
          {children}
        </div>
      </div>
    </div>
  );
}
