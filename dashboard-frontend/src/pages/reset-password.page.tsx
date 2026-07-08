import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useResetPassword } from '@/features/auth/hooks/use-auth';
import { AuthShell } from './forgot-password.page';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const reset = useResetPassword();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setFieldError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setFieldError('Passwords do not match.');
      return;
    }
    setFieldError(null);
    reset.mutate(
      { token, newPassword: password },
      {
        onSuccess: () => {
          toast.success('Password reset successfully', {
            description: 'Sign in with your new password.',
          });
          navigate('/login', { replace: true });
        },
      }
    );
  };

  // A reset page without a token is a dead end — explain instead of failing silently.
  if (!token) {
    return (
      <AuthShell>
        <div className="relative text-center space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-white">Invalid reset link</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            This link is missing its reset token. Please use the full link from your email, or
            request a new one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="relative mb-8 space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-white">Choose a new password</h2>
        <p className="text-sm text-slate-400">Minimum 8 characters. You&apos;ll sign in with it right after.</p>
      </div>

      <form onSubmit={onSubmit} className="relative space-y-5">
        <PasswordField
          id="new-password"
          label="New password"
          value={password}
          onChange={setPassword}
          show={show}
          onToggleShow={() => setShow((s) => !s)}
          disabled={reset.isPending}
          hasError={!!fieldError}
        />
        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          show={show}
          onToggleShow={() => setShow((s) => !s)}
          disabled={reset.isPending}
          hasError={!!fieldError}
        />

        {fieldError && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-red-400">
            <span className="inline-block h-1 w-1 rounded-full bg-red-400" />
            {fieldError}
          </p>
        )}

        <button
          type="submit"
          disabled={reset.isPending}
          className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all duration-300 hover:from-blue-500 hover:to-blue-400 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {reset.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Resetting…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Reset password
            </span>
          )}
        </button>

        <Link
          to="/login"
          className="flex items-center justify-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}

function PasswordField({
  id, label, value, onChange, show, onToggleShow, disabled, hasError,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  disabled: boolean;
  hasError: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-300">{label}</label>
      <div className="relative group">
        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors duration-200 group-focus-within:text-blue-400" />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 w-full rounded-xl border bg-white/[0.06] pl-10 pr-11 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200 focus:bg-white/[0.08] focus:ring-2 ${
            hasError
              ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
              : 'border-white/[0.08] focus:border-blue-500/50 focus:ring-blue-500/20'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        />
        <button
          type="button"
          onClick={onToggleShow}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
