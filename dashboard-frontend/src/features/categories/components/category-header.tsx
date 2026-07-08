import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CategoryHeaderProps {
  onAddClick: () => void;
}

export function CategoryHeader({ onAddClick }: CategoryHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-blue-700 font-semibold">
          Categories of work
        </p>
        <h1 className="text-3xl md:text-4xl font-bold mt-1 text-slate-900 tracking-tight">
          Categories
        </h1>
        <p className="text-slate-600 mt-1 font-medium">
          Define what roles staff can be scheduled for.
        </p>
      </div>
      <Button
        onClick={onAddClick}
        className="rounded-xl h-11 px-6 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5"
      >
        <Plus className="mr-2 h-4 w-4" /> Add category
      </Button>
    </header>
  );
}
