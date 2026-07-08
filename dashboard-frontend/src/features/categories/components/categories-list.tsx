import { AlertTriangle } from "lucide-react";
import type { CategoryTreeItem, CategoryChild } from "../api/category.service";
import { CategoryItem } from "./category-item";
import { CategoryCardSkeleton } from "./category-card-skeleton";
import { CategoryEmptyState } from "./category-empty-state";

interface CategoriesListProps {
  categories: CategoryTreeItem[];
  isLoading: boolean;
  isError: boolean;
  onEdit: (category: CategoryTreeItem) => void;
  onDeleteRequest: (category: CategoryTreeItem | CategoryChild) => void;
  onCreateClick: () => void;
}

export function CategoriesList({
  categories,
  isLoading,
  isError,
  onEdit,
  onDeleteRequest,
  onCreateClick,
}: CategoriesListProps) {
  if (isError) {
    return (
      <div className="py-16 text-center">
        <div className="h-20 w-20 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <p className="text-red-700 font-semibold">Failed to load categories.</p>
        <p className="text-slate-500 text-sm mt-1">Please try again later.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <CategoryCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="grid gap-5 md:grid-cols-2">
        <CategoryEmptyState onCreateClick={onCreateClick} />
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {categories.map((category) => (
        <CategoryItem
          key={category.id}
          category={category}
          onEdit={onEdit}
          onDeleteRequest={onDeleteRequest}
        />
      ))}
    </div>
  );
}
