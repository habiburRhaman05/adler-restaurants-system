import { useState } from "react";
import { Plus, X, Pencil, Trash2, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { useCreateSubCategory } from "../hooks/use-categories";
import { getCategoryIcon, getCategoryIconGradient } from "./category-visuals";
import type { CategoryTreeItem, CategoryChild } from "../api/category.service";
import { cn } from "@/lib/utils";

interface CategoryItemProps {
  category: CategoryTreeItem;
  onEdit: (category: CategoryTreeItem) => void;
  onDeleteRequest: (category: CategoryTreeItem | CategoryChild) => void;
}

export function CategoryItem({ category, onEdit, onDeleteRequest }: CategoryItemProps) {
  const createSubMut = useCreateSubCategory();
  const [subDraft, setSubDraft] = useState("");

  const Icon = getCategoryIcon(category.id);
  const gradient = getCategoryIconGradient(category.id);
  const subCategories = category.children ?? [];

  const handleAddSub = () => {
    const value = subDraft.trim();
    if (!value) return;
    createSubMut.mutate(
      { parentId: category.id, name: value },
      { onSuccess: () => setSubDraft("") }
    );
  };

  return (
    <Card className={cn("rounded-2xl border-slate-200/80 shadow-md shadow-slate-100/50 bg-white overflow-hidden transition-all duration-300 hover:border-blue-300 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5", !category.isActive && "opacity-75 grayscale-[0.5]")}>
      <CardHeader className="flex-row items-center gap-4 bg-gradient-to-r from-slate-50 to-blue-50/40 border-b border-slate-100 pb-4 pt-5 px-5">
        <div
          className={`h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-lg`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl font-bold text-slate-900 tracking-tight truncate">
              {category.name}
            </CardTitle>
            {!category.isActive && (
              <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-0 h-5 px-1.5 font-semibold">
                Inactive
              </Badge>
            )}
          </div>
          <p className="text-xs font-semibold text-slate-600 mt-1 uppercase tracking-wider">
            {category.qualifiedCount} qualified · {category.subCategoryCount} sub
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${category.name}`}
            className="h-8 w-8 text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-all"
            onClick={() => onEdit(category)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${category.name}`}
            className="h-8 w-8 text-slate-500 hover:text-red-700 hover:bg-red-50 transition-all"
            onClick={() => onDeleteRequest(category)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2 min-h-[28px]">
          {subCategories.length ? (
            subCategories.map((s) => (
              <Badge
                key={s.id}
                variant="secondary"
                className={cn("pl-3 pr-1.5 py-1 gap-1.5 border rounded-lg text-xs font-semibold transition-all", s.isActive ? "bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200" : "bg-slate-50 text-slate-500 border-slate-200")}
              >
                {s.name}
                <button
                  onClick={() => onDeleteRequest(s)}
                  aria-label={`Delete ${s.name}`}
                  className={cn("rounded-md p-0.5 transition-colors", s.isActive ? "hover:bg-blue-200 text-blue-700" : "hover:bg-slate-200 text-slate-500")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))
          ) : (
            <span className="text-xs font-medium text-slate-500 italic">No sub-categories</span>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Add sub-category"
            value={subDraft}
            onChange={(e) => setSubDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddSub()}
            className="h-10 rounded-lg border-slate-200 bg-slate-50 focus-visible:ring-blue-500/30 focus-visible:border-blue-400 text-sm font-medium transition-all"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddSub}
            disabled={createSubMut.isPending || !subDraft.trim()}
            className="rounded-lg h-10 border-slate-200 font-semibold text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
          >
            {createSubMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" /> Add
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
