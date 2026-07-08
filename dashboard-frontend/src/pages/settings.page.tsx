import { useState } from "react";
import { Mail, Shield, Clock, Loader2, KeyRound, Save, User, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth.store";
import { useUpdateProfile, useForgotPassword } from "@/features/auth/hooks/use-auth";
import { initials, formatDate } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Combined Account page: profile + security in one place.
 * Mounted at BOTH /dashboard/settings and /dashboard/profile so every
 * existing sidebar / dropdown link keeps working.
 */
export function SettingsPage() {
  const user = useAuthStore((s) => s.admin);
  const setUser = useAuthStore((s) => s.setUser);

  const updateMut = useUpdateProfile();
  const forgotMut = useForgotPassword();

  // ── Profile form ──
  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
  });

  // ── Password form ──
  const [passForm, setPassForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleSaveInfo = () => {
    const email = form.email.trim();
    if (!email || !EMAIL_RE.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (!form.firstName.trim() && !form.lastName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    updateMut.mutate(
      {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        name: [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" "),
        email,
      },
      {
        onSuccess: (result) => {
          if (!result.passwordChanged && user) {
            setUser({
              ...user,
              firstName: result.admin.firstName ?? null,
              lastName: result.admin.lastName ?? null,
              email: result.admin.email,
              name:
                [result.admin.firstName, result.admin.lastName].filter(Boolean).join(" ") ||
                result.admin.email.split("@")[0] ||
                "",
            });
          }
        },
      }
    );
  };

  const handleSavePassword = () => {
    if (!passForm.currentPassword || !passForm.newPassword) {
      toast.error("Please enter both your current and new password.");
      return;
    }
    if (passForm.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (passForm.newPassword !== passForm.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    updateMut.mutate(
      { currentPassword: passForm.currentPassword, newPassword: passForm.newPassword },
      { onSuccess: () => setPassForm({ currentPassword: "", newPassword: "", confirmPassword: "" }) }
    );
  };

  const handleForgot = () => {
    if (!user?.email) {
      toast.error("No email on file for this account.");
      return;
    }
    forgotMut.mutate(user.email, {
      onSuccess: () =>
        toast.success("Reset link sent", {
          description: `Check ${user.email} — the link is valid for 30 minutes.`,
        }),
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1100px]">
      <header>
        <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Account</p>
        <h1 className="text-3xl md:text-4xl font-bold mt-1 text-slate-900 tracking-tight">Profile &amp; Settings</h1>
        <p className="text-slate-500 mt-1 font-medium">Manage your personal information and account security.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        {/* ── Identity card ── */}
        <Card className="rounded-2xl border-slate-200/80 shadow-md shadow-slate-100/50 bg-white/90 backdrop-blur-sm h-fit">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200/60 text-blue-600 flex items-center justify-center text-2xl font-bold overflow-hidden shadow-sm">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                initials(user?.name)
              )}
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">{user?.name}</h2>
            <p className="text-sm font-medium text-slate-500">{user?.email}</p>
            <Badge variant="outline" className="mt-3 capitalize border-blue-200 text-blue-700 bg-blue-50 font-semibold px-3 py-1">
              <Shield className="h-3.5 w-3.5 mr-1.5" /> {user?.role}
            </Badge>
            <div className="mt-6 w-full space-y-2.5 text-left text-sm border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="truncate">{user?.email}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <Clock className="h-4 w-4 text-slate-400 shrink-0" /> Joined {formatDate(user?.createdAt)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Tabs: profile / security ── */}
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="bg-slate-100 p-1.5 rounded-xl h-auto">
            <TabsTrigger value="profile" className="rounded-lg font-semibold px-5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-700 data-[state=active]:border data-[state=active]:border-blue-200">
              <User className="h-4 w-4 mr-2" /> Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-lg font-semibold px-5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-700 data-[state=active]:border data-[state=active]:border-blue-200">
              <KeyRound className="h-4 w-4 mr-2" /> Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card className="rounded-2xl border-slate-200/80 shadow-md shadow-slate-100/50 bg-white/90 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-50/80 to-blue-50/30 border-b border-slate-100 pb-4 pt-5 px-6">
                <CardTitle className="text-lg font-bold text-slate-900">Personal information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-2 p-6">
                <div className="space-y-2">
                  <Label className="font-semibold text-slate-700">First name</Label>
                  <Input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="rounded-xl h-11 border-slate-200 bg-slate-50/50 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 font-medium transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-slate-700">Last name</Label>
                  <Input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="rounded-xl h-11 border-slate-200 bg-slate-50/50 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 font-medium transition-all"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="font-semibold text-slate-700">Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="rounded-xl h-11 border-slate-200 bg-slate-50/50 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 font-medium transition-all"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end pt-2">
                  <Button
                    onClick={handleSaveInfo}
                    disabled={updateMut.isPending}
                    className="rounded-xl h-11 px-6 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200"
                  >
                    {updateMut.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                    ) : (
                      <><Save className="mr-2 h-4 w-4" /> Save changes</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <Card className="rounded-2xl border-slate-200/80 shadow-md shadow-slate-100/50 bg-white/90 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-50/80 to-blue-50/30 border-b border-slate-100 pb-4 pt-5 px-6">
                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-slate-500" /> Change password
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                <div className="space-y-2 max-w-md">
                  <Label className="font-semibold text-slate-700">Current password</Label>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={passForm.currentPassword}
                    onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
                    className="rounded-xl h-11 border-slate-200 bg-slate-50/50 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 font-medium transition-all"
                  />
                </div>
                <div className="grid gap-5 md:grid-cols-2 max-w-2xl">
                  <div className="space-y-2">
                    <Label className="font-semibold text-slate-700">New password</Label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={passForm.newPassword}
                      onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                      className="rounded-xl h-11 border-slate-200 bg-slate-50/50 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 font-medium transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold text-slate-700">Confirm new password</Label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={passForm.confirmPassword}
                      onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                      className="rounded-xl h-11 border-slate-200 bg-slate-50/50 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 font-medium transition-all"
                    />
                  </div>
                </div>

                <p className="text-xs text-slate-400 font-medium max-w-2xl">
                  Minimum 8 characters. After changing your password every session is signed out
                  and you&apos;ll log in again with the new one.
                </p>

                <div className="flex items-center justify-between max-w-2xl pt-2 flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleForgot}
                    disabled={forgotMut.isPending}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors disabled:opacity-50"
                  >
                    {forgotMut.isPending ? "Sending reset link…" : "Forgot your password? Email me a reset link"}
                  </button>
                  <Button
                    onClick={handleSavePassword}
                    disabled={updateMut.isPending}
                    className="rounded-xl h-11 px-6 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200"
                  >
                    {updateMut.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…</>
                    ) : (
                      <><CheckCircle2 className="mr-2 h-4 w-4" /> Change password</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
