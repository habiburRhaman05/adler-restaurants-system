import { useState } from "react";
import { Mail, Shield, Clock, Loader2, Key } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import { initials, formatDate } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { z } from "zod";

const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
});

type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export function ProfilePage() {
  const user = useAuthStore((s) => s.admin);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
  });

  const [passForm, setPassForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const updateMut = useMutation({
    mutationFn: (data: UpdateProfileInput) => apiClient.patch<{ data: { admin: any; passwordChanged?: boolean } }>('/auth/admin/profile', data),
    onSuccess: (res) => {
      if (res.data.passwordChanged) {
        toast.success("Profile updated. Please log in again with your new password.");
        logout();
      } else {
        toast.success("Profile updated successfully");
        if (res.data.admin) {
          setUser({ ...user, ...res.data.admin });
        }
      }
      setPassForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update profile");
    }
  });

  const handleSaveInfo = () => {
    updateMut.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
    });
  };

  const handleSavePassword = () => {
    if (!passForm.currentPassword || !passForm.newPassword) {
      toast.error("Please enter both current and new passwords");
      return;
    }
    if (passForm.newPassword !== passForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    updateMut.mutate({
      currentPassword: passForm.currentPassword,
      newPassword: passForm.newPassword,
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1100px]">
      <header>
        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Account</p>
        <h1 className="text-3xl md:text-4xl font-bold mt-1 text-slate-900 tracking-tight">Profile</h1>
        <p className="text-slate-500 mt-1 font-medium">Manage your personal information and security.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        {/* Left panel */}
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white h-fit">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <div className="h-24 w-24 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-2xl font-bold overflow-hidden">
              {user?.avatar ? <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" /> : initials(user?.name)}
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">{user?.name}</h2>
            <p className="text-sm font-medium text-slate-500">{user?.email}</p>
            <Badge variant="outline" className="mt-3 capitalize border-primary/20 text-primary bg-primary/5 font-semibold px-3 py-1">
              <Shield className="h-3.5 w-3.5 mr-1.5" /> {user?.role}
            </Badge>
            <div className="mt-6 w-full space-y-2 text-left text-sm">
              <div className="flex items-center gap-2 text-slate-500 font-medium"><Mail className="h-4 w-4 text-slate-400" /> {user?.email}</div>
              <div className="flex items-center gap-2 text-slate-500 font-medium"><Clock className="h-4 w-4 text-slate-400" /> Joined {formatDate(user?.createdAt)}</div>
            </div>
          </CardContent>
        </Card>

        {/* Right panel */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="bg-slate-100/50 p-1 rounded-xl">
            <TabsTrigger value="info" className="rounded-lg font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary">Personal info</TabsTrigger>
            <TabsTrigger value="security" className="rounded-lg font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-6">
            <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4"><CardTitle className="text-lg font-bold text-slate-900">Personal information</CardTitle></CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-2 p-6">
                <div className="space-y-2"><Label className="font-semibold text-slate-700">First Name</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="rounded-xl h-11 border-slate-200 bg-slate-50" /></div>
                <div className="space-y-2"><Label className="font-semibold text-slate-700">Last Name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="rounded-xl h-11 border-slate-200 bg-slate-50" /></div>
                <div className="space-y-2 md:col-span-2"><Label className="font-semibold text-slate-700">Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl h-11 border-slate-200 bg-slate-50" /></div>
                
                <div className="md:col-span-2 flex justify-end">
                  <Button onClick={handleSaveInfo} disabled={updateMut.isPending} className="rounded-xl font-semibold shadow-md shadow-primary/20">
                    {updateMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4"><CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2"><Key className="h-5 w-5 text-slate-500" /> Change Password</CardTitle></CardHeader>
              <CardContent className="space-y-5 p-6">
                <div className="space-y-2 max-w-md">
                  <Label className="font-semibold text-slate-700">Current Password</Label>
                  <Input type="password" value={passForm.currentPassword} onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })} className="rounded-xl h-11 border-slate-200 bg-slate-50" />
                </div>
                <div className="grid gap-5 md:grid-cols-2 max-w-2xl">
                  <div className="space-y-2">
                    <Label className="font-semibold text-slate-700">New Password</Label>
                    <Input type="password" value={passForm.newPassword} onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })} className="rounded-xl h-11 border-slate-200 bg-slate-50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold text-slate-700">Confirm New Password</Label>
                    <Input type="password" value={passForm.confirmPassword} onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })} className="rounded-xl h-11 border-slate-200 bg-slate-50" />
                  </div>
                </div>
                <div className="flex justify-end max-w-2xl pt-2">
                  <Button onClick={handleSavePassword} disabled={updateMut.isPending} variant="destructive" className="rounded-xl font-semibold shadow-md">
                    {updateMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Change Password
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
