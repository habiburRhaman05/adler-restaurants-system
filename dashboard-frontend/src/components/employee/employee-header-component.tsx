/**
 * Employee Header Component
 * Page header with title, subtitle, and add button
 */

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmployeeHeaderProps {
  onAddClick: () => void;
  totalCount: number;
}

export function EmployeeHeader({ onAddClick, totalCount }: EmployeeHeaderProps) {
  return (
    <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">
          Team Management
        </p>
        <h1 className="text-3xl md:text-4xl font-bold mt-2 text-slate-900 tracking-tight">
          Employees
        </h1>
        <p className="text-slate-500 mt-2 font-medium">
          {totalCount > 0 
            ? `${totalCount} staff member${totalCount !== 1 ? 's' : ''} • Add, edit and manage your team`
            : 'Add your first employee to get started'}
        </p>
      </div>

      <Button
        onClick={onAddClick}
        className="rounded-xl h-11 px-6 font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-600/30 transition-all duration-200 hover:shadow-xl hover:shadow-blue-600/40 hover:-translate-y-0.5 whitespace-nowrap"
      >
        <Plus className="mr-2 h-4 w-4" /> Add employee
      </Button>
    </header>
  );
}
