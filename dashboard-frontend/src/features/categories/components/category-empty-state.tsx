import { Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CategoryEmptyStateProps {
  onCreateClick: () => void;
}

export function CategoryEmptyState({ onCreateClick }: CategoryEmptyStateProps) {
  return (
    <div className="md:col-span-2 py-16 text-center">
      <div className="h-20 w-20 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
        <Layers className="h-10 w-10 text-blue-400" />
      </div>
      <p className="text-slate-600 font-medium mb-4">No categories yet.</p>
      <Button
        onClick={onCreateClick}
        variant="outline"
        className="rounded-xl border-slate-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 font-semibold"
      >
        <Sparkles className="mr-1.5 h-4 w-4" /> Create first category
      </Button>
    </div>
  );
}
