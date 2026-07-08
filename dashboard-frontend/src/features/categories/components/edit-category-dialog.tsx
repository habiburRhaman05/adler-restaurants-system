import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { useUpdateCategory } from "../hooks/use-categories";
import type { CategoryTreeItem, CategoryChild } from "../api/category.service";

interface EditCategoryDialogProps {
  category: CategoryTreeItem | CategoryChild | null;
  onClose: () => void;
}

export function EditCategoryDialog({ category, onClose }: EditCategoryDialogProps) {
  const updateMut = useUpdateCategory();
  const [form, setForm] = useState<{ name: string; isActive: boolean }>({ name: "", isActive: true });

  useEffect(() => {
    if (category) {
      setForm({
        name: category.name,
        isActive: category.isActive,
      });
    }
  }, [category]);

  const handleSave = () => {
    if (!category) return;
    updateMut.mutate({ id: category.id, data: form }, { onSuccess: onClose });
  };

  return (
    <Dialog open={!!category} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">Edit category</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="font-semibold text-slate-700 text-sm">Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-xl h-11 border-slate-200 bg-slate-50 focus-visible:ring-blue-500/30 focus-visible:border-blue-400 transition-all"
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold text-slate-900">Active Status</Label>
              <p className="text-xs text-slate-500 font-medium">Inactive categories cannot be assigned</p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(c) => setForm({ ...form, isActive: c })}
              className="data-[state=checked]:bg-violet-500 data-[state=unchecked]:bg-slate-300"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl font-semibold border-slate-200 hover:bg-slate-50" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200"
            onClick={handleSave}
            disabled={updateMut.isPending}
          >
            {updateMut.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
