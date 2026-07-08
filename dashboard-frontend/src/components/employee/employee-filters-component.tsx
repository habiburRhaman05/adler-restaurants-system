/**
 * Employee Filters Component
 * Search input, department filter, status filter
 */

import { Search, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEPARTMENTS } from '@/lib/employee-utilities';

interface EmployeeFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  departmentFilter: string;
  onDepartmentChange: (dept: string) => void;
  isActiveFilter: string;
  onIsActiveChange: (isActive: string) => void;
  isFetching: boolean;
}

export function EmployeeFilters({
  searchQuery,
  onSearchChange,
  departmentFilter,
  onDepartmentChange,
  isActiveFilter,
  onIsActiveChange,
  isFetching,
}: EmployeeFiltersProps) {
  return (
    <Card className="rounded-2xl border-slate-200/60 shadow-md shadow-slate-100/50 bg-white/80 backdrop-blur-sm transition-all duration-200 overflow-hidden">
      <CardContent className="flex flex-col sm:flex-row gap-4 p-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={isFetching}
            className="rounded-lg pl-10 border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-300 transition-all"
          />
        </div>

        {/* Department Filter */}
        <Select value={departmentFilter} onValueChange={onDepartmentChange} disabled={isFetching}>
          <SelectTrigger className="rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-300 transition-all w-full sm:w-[180px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-slate-200 shadow-lg">
            <SelectItem value="all">All Departments</SelectItem>
            {DEPARTMENTS.map((dept) => (
              <SelectItem key={dept} value={dept}>
                {dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={isActiveFilter} onValueChange={onIsActiveChange} disabled={isFetching}>
          <SelectTrigger className="rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-300 transition-all w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-slate-200 shadow-lg">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {/* Loading Indicator */}
        {isFetching && (
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
            <span>Updating...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
