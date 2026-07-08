import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useDeleteCategory } from "../hooks/use-categories";
import type { CategoryTreeItem, CategoryChild } from "../api/category.service";

interface DeleteCategoryDialogProps {
  category: CategoryTreeItem | CategoryChild | null;
  onClose: () => void;
}

export function DeleteCategoryDialog({ category, onClose }: DeleteCategoryDialogProps) {
  const deleteMut = useDeleteCategory();

  const handleDelete = () => {
    if (!category) return;
    deleteMut.mutate(category.id, { onSuccess: onClose });
  };

  return (
    <AlertDialog open={!!category} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="rounded-2xl border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-bold text-slate-900">
            Delete {category?.name}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600">
            Employees assigned to this category will keep their record, but the category will be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl font-semibold border-slate-200">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-red-600 hover:bg-red-700 font-semibold shadow-lg shadow-red-600/25 transition-all duration-200"
            onClick={handleDelete}
            disabled={deleteMut.isPending}
          >
            {deleteMut.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
