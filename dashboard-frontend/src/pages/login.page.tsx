import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowRight, Sparkles, UtensilsCrossed } from 'lucide-react';
import { loginSchema, type LoginInput } from '@/features/auth/schemas/auth.schema';
import { useLogin } from '@/features/auth/hooks/use-auth';

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { mutate: login, isPending } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    // Trigger entrance animations after mount
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const onSubmit = (data: LoginInput) => {
    login(data);
  };

  // Use the raw form field registration and inject handlers for floating labels
  const emailField = register('email');
  const passwordField = register('password');

  return (
    <div className="relative min-h-screen flex overflow-hidden bg-[#0F172A]">
      {/* ── Animated gradient background ── */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A]" />

        {/* Animated orbs */}
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] animate-pulse-slow rounded-full bg-gradient-to-br from-blue-600/15 via-blue-500/8 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] animate-pulse-slower rounded-full bg-gradient-to-tr from-sky-500/15 via-blue-400/8 to-transparent blur-3xl" />
        <div className="absolute top-1/2 left-1/3 h-[400px] w-[400px] animate-pulse-medium rounded-full bg-gradient-to-r from-sky-400/8 to-blue-600/8 blur-3xl" />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex w-full max-w-[1200px] mx-auto ">
        {/* ── Left: Brand / Illustration ── */}
        <div
          className={`hidden lg:flex lg:w-1/2 flex-col justify-between p-12 transition-all duration-1000 ease-out ${
            mounted ? 'translate-x-0 opacity-100' : '-translate-x-12 opacity-0'
          }`}
        >
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">ADLER</h1>
              <p className="text-sm text-blue-300/70">Staff Planning</p>
            </div>
          </div>

          {/* Tagline */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Staff Management Platform</span>
            </div>
            <h2 className="text-4xl font-bold leading-tight text-white">
              Streamline your
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-sky-400 bg-clip-text text-transparent">
                team scheduling
              </span>
            </h2>
            <p className="max-w-md text-base leading-relaxed text-slate-400">
              Plan shifts, manage employees, and handle approvals — all in one place.
              Intelligent scheduling for modern teams.
            </p>

            {/* Feature list */}
            <div className="space-y-3">
              {[
                'Smart shift planning & conflict detection',
                'Real-time availability management',
                'Approval workflows & reporting',
              ].map((feature, i) => (
                <div
                  key={feature}
                  className="flex items-center gap-3 transition-all duration-700"
                  style={{ transitionDelay: `${i * 150}ms` }}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20">
                    <div className="h-2 w-2 rounded-full bg-blue-400" />
                  </div>
                  <span className="text-sm text-slate-300">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-sm text-slate-500">© 2026 ADLER Staff Planning. All rights reserved.</p>
        </div>

        {/* ── Right: Login Form ── */}
        <div className="flex w-full lg:w-1/2 items-center justify-center p-4 sm:p-8">
          <div
            className={`w-full max-w-[420px] transition-all duration-1000 ease-out ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">ADLER</h1>
                <p className="text-xs text-blue-300/70">Staff Planning</p>
              </div>
            </div>

            {/* Glassmorphism card */}
            <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl">
              {/* Subtle glow */}
              <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />

              {/* Header */}
              <div className="relative mb-8 space-y-1.5">
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Welcome back
                </h2>
                <p className="text-sm text-slate-400">
                  Sign in to your account to continue
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="relative space-y-5">
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-slate-300"
                  >
                    Email address
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors duration-200 group-focus-within:text-blue-400" />
                    <input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      autoComplete="email"
                      disabled={isPending}
                      {...emailField}
                      className={`h-11 w-full rounded-xl border bg-white/[0.06] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200 focus:bg-white/[0.08] focus:ring-2 ${
                        errors.email
                          ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-white/[0.08] focus:border-blue-500/50 focus:ring-blue-500/20'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    />
                    {/* Focus glow */}
                    <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-200 group-focus-within:opacity-100">
                      <div className="absolute inset-0 rounded-xl ring-1 ring-blue-500/20" />
                    </div>
                  </div>
                  {errors.email && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                      <span className="inline-block h-1 w-1 rounded-full bg-red-400" />
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-sm font-medium text-slate-300"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                      tabIndex={-1}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors duration-200 group-focus-within:text-blue-400" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      disabled={isPending}
                      {...passwordField}
                      className={`h-11 w-full rounded-xl border bg-white/[0.06] pl-10 pr-11 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200 focus:bg-white/[0.08] focus:ring-2 ${
                        errors.password
                          ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-white/[0.08] focus:border-blue-500/50 focus:ring-blue-500/20'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                      <span className="inline-block h-1 w-1 rounded-full bg-red-400" />
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isPending}
                  className="relative h-11 w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all duration-300 hover:from-blue-500 hover:to-blue-400 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none group"
                >
                  {/* Ripple effect on hover */}
                  <div className="absolute inset-0 -translate-x-full skew-x-12 bg-white/[0.08] transition-transform duration-500 group-hover:translate-x-full" />

                  {isPending ? (
                    <span className="relative flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    <span className="relative flex items-center justify-center gap-2">
                      Sign in
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>
                  )}
                </button>
              </form>
            </div>

            {/* Bottom text */}
            <p className="mt-6 text-center text-xs text-slate-500">
              Protected by enterprise-grade security &bull; Cookies used for authentication
            </p>
          </div>
        </div>
      </div>

      {/* ── Inline keyframes for custom animations ── */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.5; }
          50% { transform: scale(1.1) translate(30px, -20px); opacity: 0.8; }
        }
        @keyframes pulse-slower {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.3; }
          50% { transform: scale(1.15) translate(-20px, 30px); opacity: 0.6; }
        }
        @keyframes pulse-medium {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.2; }
          50% { transform: scale(1.08) translate(15px, 15px); opacity: 0.4; }
        }
        .animate-pulse-slow { animation: pulse-slow 8s ease-in-out infinite; }
        .animate-pulse-slower { animation: pulse-slower 10s ease-in-out infinite; }
        .animate-pulse-medium { animation: pulse-medium 7s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
