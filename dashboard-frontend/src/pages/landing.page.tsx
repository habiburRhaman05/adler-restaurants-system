import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  UtensilsCrossed,
  CalendarRange,
  Users,
  Layers,
  ArrowLeftRight,
  BarChart3,
  Sparkles,
  CheckCircle2,
  Quote,
  Menu,
  X,
} from 'lucide-react';

const features = [
  {
    icon: CalendarRange,
    title: 'Smart Scheduling',
    description: 'Plan shifts with intelligent conflict detection and availability management. Drag-and-drop interface for effortless weekly planning.',
    color: 'from-blue-600 to-sky-500',
    bgLight: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    icon: Users,
    title: 'Employee Management',
    description: 'Comprehensive employee profiles with roles, departments, contracts, and workload tracking. Everything in one place.',
    color: 'from-amber-500 to-orange-500',
    bgLight: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    icon: Layers,
    title: 'Category Planning',
    description: 'Organize staff by departments and categories. Define rates, max shifts per week, and sub-roles for granular control.',
    color: 'from-sky-500 to-blue-600',
    bgLight: 'bg-sky-50',
    iconColor: 'text-sky-600',
  },
  {
    icon: ArrowLeftRight,
    title: 'Shift Swaps & Approvals',
    description: 'Employees can request shift swaps with automatic rule checking. Managers review and approve with one click.',
    color: 'from-purple-500 to-violet-600',
    bgLight: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    icon: BarChart3,
    title: 'Reports & Insights',
    description: 'Generate detailed reports on labor costs, attendance trends, and scheduling efficiency. Data-driven decisions made easy.',
    color: 'from-rose-500 to-pink-600',
    bgLight: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },
  {
    icon: Sparkles,
    title: 'Rule Compliance',
    description: 'Automatic violation detection for labor laws, contract limits, and company policies. Stay compliant effortlessly.',
    color: 'from-teal-500 to-cyan-600',
    bgLight: 'bg-teal-50',
    iconColor: 'text-teal-600',
  },
];

const stats = [
  { value: '500+', label: 'Restaurants' },
  { value: '15K+', label: 'Employees Managed' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4.8★', label: 'User Rating' },
];

export function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#1E293B] font-['Poppins',sans-serif]">
      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/25">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-[#1E293B]">ADLER</span>
                <span className="hidden sm:inline text-sm font-medium text-[#64748B] ml-2">Staff Planning</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollTo('features')} className="text-sm font-medium text-[#64748B] hover:text-[#1E293B] transition-colors">
                Features
              </button>
              <button onClick={() => scrollTo('stats')} className="text-sm font-medium text-[#64748B] hover:text-[#1E293B] transition-colors">
                Stats
              </button>
              <button onClick={() => scrollTo('testimonials')} className="text-sm font-medium text-[#64748B] hover:text-[#1E293B] transition-colors">
                Testimonials
              </button>
              <Link
                to="/login"
                className="text-sm font-semibold text-[#64748B] hover:text-[#1E293B] transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center h-12 w-12 rounded-xl hover:bg-black/[0.04] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-black/[0.06] bg-white/95 backdrop-blur-xl">
            <div className="px-4 py-4 space-y-3">
              <button onClick={() => scrollTo('features')} className="block w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-[#64748B] hover:text-[#1E293B] hover:bg-black/[0.04] transition-all">
                Features
              </button>
              <button onClick={() => scrollTo('stats')} className="block w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-[#64748B] hover:text-[#1E293B] hover:bg-black/[0.04] transition-all">
                Stats
              </button>
              <button onClick={() => scrollTo('testimonials')} className="block w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-[#64748B] hover:text-[#1E293B] hover:bg-black/[0.04] transition-all">
                Testimonials
              </button>
              <div className="pt-3 border-t border-black/[0.06] space-y-3">
                <Link
                  to="/login"
                  className="block w-full text-center px-4 py-3 rounded-xl text-sm font-semibold text-[#64748B] hover:bg-black/[0.04] transition-all"
                >
                  Sign in
                </Link>
                <Link
                  to="/login"
                  className="block w-full text-center px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/25"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative min-h-screen flex items-center pt-20 md:pt-28 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-blue-500/10 via-blue-400/5 to-transparent blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-sky-400/30 via-blue-300/10 to-transparent blur-3xl" />
          <div className="absolute top-1/3 right-1/4 h-[300px] w-[300px] rounded-full bg-blue-500/5 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.08) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Text */}
            <div
              className={`transition-all duration-1000 ease-out ${
                mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-50 px-4 py-1.5 text-sm text-blue-700 font-medium mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                <span>All-in-one Staff Management Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight">
                Streamline Your
                <br />
                <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
                  Team Scheduling
                </span>
              </h1>

              <p className="mt-6 text-lg md:text-xl text-[#64748B] leading-relaxed max-w-lg">
                Plan shifts, manage employees, handle approvals, and generate reports — 
                all in one beautifully designed platform. Built for modern hospitality teams.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 h-14 px-8 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-base font-semibold shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                >
                  Get Started Free
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <button
                  onClick={() => scrollTo('features')}
                  className="inline-flex items-center gap-2 h-14 px-8 rounded-xl border-2 border-black/[0.08] bg-white/80 text-[#1E293B] text-base font-semibold hover:bg-white hover:border-black/[0.15] transition-all duration-200"
                >
                  View Features
                </button>
              </div>

              {/* Trust indicators */}
              <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-[#64748B]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>

            {/* Right: Visual Card */}
            <div
              className={`transition-all duration-1000 delay-300 ease-out ${
                mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
            >
              <div className="relative">
                {/* Floating card mockup */}
                <div className="relative rounded-2xl bg-white border border-black/[0.08] shadow-2xl overflow-hidden">
                  <div className="h-3 bg-gradient-to-r from-blue-500 to-sky-500" />
                  <div className="p-6 sm:p-8 space-y-6">
                    {/* Mini header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 text-white flex items-center justify-center">
                          <UtensilsCrossed className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-sm">ADLER</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-xs text-[#64748B] font-medium">Live</span>
                      </div>
                    </div>

                    {/* Stats cards */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Active Staff', value: '24', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                        { label: 'Plans', value: '6', color: 'bg-[#FEEBC4] text-amber-800 border-amber-200' },
                        { label: 'Swaps', value: '3', color: 'bg-sky-50 text-sky-700 border-sky-200' },
                      ].map((stat) => (
                        <div key={stat.label} className={`rounded-xl border p-3 ${stat.color}`}>
                          <p className="text-[10px] font-medium opacity-75">{stat.label}</p>
                          <p className="text-xl font-bold mt-1">{stat.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Mini schedule */}
                    <div className="space-y-2">
                      {[
                        { day: 'Monday', shift: 'Lunch', staff: '5/6', ok: true },
                        { day: 'Tuesday', shift: 'Dinner', staff: '4/4', ok: true },
                        { day: 'Wednesday', shift: 'Lunch', staff: '3/6', ok: false },
                      ].map((row) => (
                        <div key={row.day} className="flex items-center justify-between py-2 px-3 rounded-lg bg-black/[0.02]">
                          <div className="flex items-center gap-3 text-sm">
                            <span className="font-semibold w-20">{row.day}</span>
                            <span className="text-[#64748B]">{row.shift}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-semibold ${row.ok ? 'text-blue-600' : 'text-rose-600'}`}>
                              {row.staff}
                            </span>
                            <div className={`h-2 w-2 rounded-full ${row.ok ? 'bg-blue-500' : 'bg-rose-500'}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Decorative dots */}
                <div className="absolute -bottom-4 -right-4 w-24 h-24 opacity-20">
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div key={i} className="h-2 w-2 rounded-full bg-blue-500" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Section ── */}
      <section id="stats" className="relative py-16 md:py-20 bg-white border-y border-black/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-extrabold text-blue-600">{stat.value}</p>
                <p className="mt-2 text-sm font-medium text-[#64748B]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Everything you need to{' '}
              <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
                manage your team
              </span>
            </h2>
            <p className="mt-4 text-lg text-[#64748B]">
              Powerful tools designed for hospitality staff management. From scheduling to reporting, we've got you covered.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl bg-white border border-black/[0.06] p-6 hover:shadow-lg hover:border-blue-500/20 hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.bgLight} ${feature.iconColor} mb-4`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-[#1E293B]">{feature.title}</h3>
                <p className="mt-2 text-sm text-[#64748B] leading-relaxed">{feature.description}</p>
                <div className="mt-4 h-1 w-0 group-hover:w-full bg-gradient-to-r rounded-full transition-all duration-500 ${feature.color}" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-16 md:py-24 bg-gradient-to-b from-white to-[#F5F7FA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Trusted by{' '}
              <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
                industry leaders
              </span>
            </h2>
            <p className="mt-4 text-lg text-[#64748B]">
              See what our customers have to say about ADLER.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "ADLER has completely transformed how we schedule our 60-person team. The conflict detection alone saves us hours every week.",
                author: 'Maria Schneider',
                role: 'Operations Director, Grand Hotel Zurich',
              },
              {
                quote: "The shift swap approval workflow is a game-changer. Our staff love being able to request swaps directly, and I love the automatic rule checking.",
                author: 'James Chen',
                role: 'General Manager, Bistro Central Geneva',
              },
              {
                quote: "We reduced scheduling time by 70% after switching to ADLER. The reports give us insights we never had before.",
                author: 'Sophie Laurent',
                role: 'HR Director, Lakeview Resorts',
              },
            ].map((testimonial) => (
              <div
                key={testimonial.author}
                className="relative rounded-2xl bg-white border border-black/[0.06] p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <Quote className="h-8 w-8 text-blue-500/20 mb-4" />
                <p className="text-sm md:text-base text-[#64748B] leading-relaxed italic">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div className="mt-6 pt-4 border-t border-black/[0.06]">
                  <p className="font-bold text-[#1E293B] text-sm">{testimonial.author}</p>
                  <p className="text-xs text-[#64748B] mt-0.5">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-16 md:py-24 bg-[#101010]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Ready to streamline your scheduling?
          </h2>
          <p className="mt-4 text-lg text-[#A09F9A] max-w-2xl mx-auto">
            Join hundreds of restaurants and hospitality businesses using ADLER to manage their teams more efficiently.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 h-14 px-8 rounded-xl bg-gradient-to-r from-blue-500 to-sky-500 text-white text-base font-semibold shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 h-14 px-8 rounded-xl border-2 border-white/[0.15] text-white text-base font-semibold hover:bg-white/10 transition-all duration-200"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#101010] border-t border-white/[0.06] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <Link to="/" className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/25">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-lg font-bold tracking-tight text-white">ADLER</span>
                  <span className="text-sm font-medium text-[#64748B] ml-2">Staff Planning</span>
                </div>
              </Link>
              <p className="text-sm text-[#64748B] max-w-md leading-relaxed">
                A modern staff planning platform for hospitality businesses. 
                Simplifying scheduling, management, and reporting.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Product</h4>
              <ul className="space-y-3">
                {['Features', 'Pricing', 'Integrations', 'Changelog'].map((item) => (
                  <li key={item}>
                    <button onClick={() => scrollTo('features')} className="text-sm text-[#64748B] hover:text-white transition-colors">
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Company</h4>
              <ul className="space-y-3">
                {['About', 'Blog', 'Contact', 'Privacy'].map((item) => (
                  <li key={item}>
                    <span className="text-sm text-[#64748B] hover:text-white transition-colors cursor-pointer">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[#64748B]">
              &copy; {new Date().getFullYear()} ADLER Staff Planning. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <span className="text-sm text-[#64748B] hover:text-white cursor-pointer transition-colors">Terms</span>
              <span className="text-sm text-[#64748B] hover:text-white cursor-pointer transition-colors">Privacy</span>
              <span className="text-sm text-[#64748B] hover:text-white cursor-pointer transition-colors">Cookies</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Scroll to top button ── */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 z-50 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all duration-300 hover:shadow-blue-600/50 hover:-translate-y-1 ${
          showScrollTop ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
        }`}
        aria-label="Scroll to top"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}
