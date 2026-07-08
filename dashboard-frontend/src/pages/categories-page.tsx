import { useState } from "react";

import { useCategoryTree } from "@/features/categories/hooks/use-categories";
import { AddCategoryDialog, CategoriesList, CategoryHeader, DeleteCategoryDialog, EditCategoryDialog } from "@/features/categories/components/index";
import type { CategoryTreeItem, CategoryChild } from "@/features/categories/api/category.service";

export function CategoriesPage() {
  const { data, isLoading, isError } = useCategoryTree();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryTreeItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryTreeItem | CategoryChild | null>(null);

  const categories = data?.data?.categories ?? [];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px]">
      <CategoryHeader onAddClick={() => setAddOpen(true)} />

      <CategoriesList
        categories={categories}
        isLoading={isLoading}
        isError={isError}
        onEdit={setEditing}
        onDeleteRequest={setDeleteTarget}
        onCreateClick={() => setAddOpen(true)}
      />

      <AddCategoryDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditCategoryDialog category={editing} onClose={() => setEditing(null)} />
      <DeleteCategoryDialog category={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
