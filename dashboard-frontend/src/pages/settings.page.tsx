import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Mail, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateProfile } from "@/features/settings/hooks/use-settings";
import { useAuthStore } from "@/stores/auth.store";
import { toast } from "sonner";

export function SettingsPage() {
  const updateMut = useUpdateProfile();
  const user = useAuthStore((s) => s.admin);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  // --- Profile form state ---
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  // --- Change password form state ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // --- Forgot password modal state ---
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState(user?.email ?? "");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    
    try {
      const res = await updateMut.mutateAsync({ name, email });
      if (res?.data?.admin) {
        setUser(res.data.admin);
      }
      toast.success(res?.message || "Profile updated successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile.");
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword) {
      setPasswordError("Please fill in both password fields.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await updateMut.mutateAsync({ currentPassword, newPassword });
      
      if (res?.data?.passwordChanged) {
        toast.success(res.message || "Profile updated. Please log in again with your new password.");
        logout(); // Revokes session locally and forces user to login screen
        return;
      }
      
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to change password.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const openForgotModal = () => {
    setResetEmail(user?.email ?? "");
    setResetSent(false);
    setResetError(null);
    setForgotOpen(true);
  };

  const handleSendResetLink = async () => {
    setResetError(null);
    setResetSent(false);

    if (!resetEmail) {
      setResetError("Please enter your email address.");
      return;
    }

    setIsSendingReset(true);
    try {
      // NOTE: replace with your real forgot-password endpoint call, e.g.
      // await api.post("/auth/forgot-password", { email: resetEmail });
      await new Promise((resolve) => setTimeout(resolve, 800));
      setResetSent(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Failed to send reset link.");
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[900px]">
      <header>
        <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Settings</p>
        <h1 className="text-3xl md:text-4xl font-bold mt-1 text-slate-900 tracking-tight">Admin settings</h1>
        <p className="text-slate-500 mt-1 font-medium">Profile, rules and notification preferences.</p>
      </header>

      <Card className="rounded-2xl border-slate-200/80 shadow-md shadow-slate-100/50 bg-white/90 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50/80 to-blue-50/30 border-b border-slate-100 pb-4 pt-5 px-6">
          <CardTitle className="text-lg font-bold text-slate-900">Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2 p-6">
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold text-sm">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border-slate-200 bg-slate-50/50 h-11 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 font-medium transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold text-sm">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border-slate-200 bg-slate-50/50 h-11 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 font-medium transition-all"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200/80 shadow-md shadow-slate-100/50 bg-white/90 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50/80 to-blue-50/30 border-b border-slate-100 pb-4 pt-5 px-6">
          <CardTitle className="text-lg font-bold text-slate-900">Security</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2 p-6">
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold text-sm">Current password</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="rounded-xl border-slate-200 bg-slate-50/50 h-11 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 font-medium transition-all"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold text-sm">New password</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-xl border-slate-200 bg-slate-50/50 h-11 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 font-medium transition-all"
            />
          </div>

          <div className="md:col-span-2 -mt-1">
            <button
              type="button"
              onClick={openForgotModal}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            >
              Forgot your password?
            </button>
          </div>

          {passwordError && (
            <p className="md:col-span-2 text-sm font-medium text-red-600">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="md:col-span-2 text-sm font-medium text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Password updated successfully.
            </p>
          )}

          <div className="md:col-span-2 flex justify-end pt-2">
            <Button
              onClick={handleChangePassword}
              disabled={isSavingPassword}
              variant="outline"
              className="rounded-xl h-11 px-6 font-semibold border-slate-200"
            >
              {isSavingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating…
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4 mr-2" /> Change password
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4">
        <Button
          onClick={save}
          disabled={updateMut.isPending}
          className="rounded-xl h-12 px-8 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:shadow-xl hover:shadow-blue-600/30 text-base"
        >
          {updateMut.isPending ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" /> Save changes
            </>
          )}
        </Button>
      </div>

      {/* Forgot password modal */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md bg-white/90 backdrop-blur-sm border border-slate-200/80 shadow-md shadow-slate-100/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Reset your password</DialogTitle>
            <DialogDescription className="text-slate-500">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label className="text-slate-700 font-semibold text-sm">Email</Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="rounded-xl border-slate-200 bg-slate-50/50 h-11 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 font-medium transition-all placeholder:text-slate-400"
            />
            {resetError && <p className="text-sm font-medium text-red-600">{resetError}</p>}
            {resetSent && (
              <p className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Reset link sent — check your inbox.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setForgotOpen(false)} className="rounded-xl font-semibold">
              Cancel
            </Button>
            <Button
              onClick={handleSendResetLink}
              disabled={isSendingReset}
              className="rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSendingReset ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" /> Send reset link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}