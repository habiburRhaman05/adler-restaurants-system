/**
 * Employee Feature - Modal Components
 * Form modal for create/edit and confirmation dialogs
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { toast } from 'sonner';
import {
  type Employee,
  type EmployeeInput,
  EMPLOYMENT_TYPES,
  CONTRACT_TYPES,
} from '@/features/employees/api/employee.service';
import {
  validateEmployeeForm,
  DEPARTMENTS,
} from '@/lib/employee-utilities';

// ─────────────────────────────────────────────────────────────
// DEFAULT FORM VALUES
// ─────────────────────────────────────────────────────────────

const DEFAULT_FORM: EmployeeInput = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  department: 'Service',
  designation: '',
  employeeType: 'FULL_TIME',
  contractType: 'MONTHLY_SALARY',
  hourlyRate: 0,
  monthlySalary: 0,
  contractedHoursMonthly: 0,
  workloadPercent: 100,
  phone: '',
  address: '',
  hireDate: new Date().toISOString().split('T')[0], // yyyy-mm-dd
};

// ─────────────────────────────────────────────────────────────
// FORM MODAL COMPONENT
// ─────────────────────────────────────────────────────────────

interface EmployeeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Employee | null;
  onSave: (data: EmployeeInput) => void;
  isLoading: boolean;
}

export function EmployeeFormModal({
  open,
  onOpenChange,
  editing,
  onSave,
  isLoading,
}: EmployeeFormModalProps) {
  const [form, setForm] = useState<EmployeeInput>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form when editing
  useEffect(() => {
    if (editing && open) {
      const { id: _id, createdAt: _c, name: _name, categories, isActive, ...rest } = editing;
      setForm({
        ...DEFAULT_FORM,
        ...rest,
        firstName: rest.firstName || "",
        lastName: rest.lastName || "",
        // Password shouldn't be populated
        password: '',
        hireDate: rest.hireDate ? new Date(rest.hireDate).toISOString().split('T')[0] : '',
        hourlyRate: Number(rest.hourlyRate) || 0,
        monthlySalary: Number(rest.monthlySalary) || 0,
        contractedHoursMonthly: Number(rest.contractedHoursMonthly) || 0,
        workloadPercent: Number(rest.workloadPercent) || 0,
      });
      setErrors({});
    } else if (open) {
      setForm(DEFAULT_FORM);
      setErrors({});
    }
  }, [editing, open]);

  const handleChange = useCallback(
    (field: keyof EmployeeInput, value: any) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      // Clear error for this field
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: '' }));
      }
    },
    [errors]
  );

  const handleSubmit = useCallback(() => {
    // We send hireDate as ISO if it's set
    const submitData = {
      ...form,
      hireDate: form.hireDate ? new Date(form.hireDate).toISOString() : undefined,
    };
    
    // Validate form
    const validationErrors = validateEmployeeForm({ ...submitData, isNew: !editing });

    if (validationErrors.length > 0) {
      const errorMap = validationErrors.reduce(
        (acc, err) => ({ ...acc, [err.field]: err.message }),
        {}
      );
      setErrors(errorMap);
      toast.error('Please fix the errors before saving');
      return;
    }

    // Submit
    // Remove password if it's empty during edit to avoid validation errors on backend
    if (editing && !submitData.password) {
      delete submitData.password;
    }
    // Strip fields that aren't part of EmployeeInput but leak from the Employee type
    delete (submitData as any).name;
    delete (submitData as any).updatedAt;
    delete (submitData as any).lastLoginAt;
    delete (submitData as any).deactivatedAt;
    
    onSave(submitData);
  }, [form, editing, onSave]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen);
    }
  }, [isLoading, onOpenChange]);

  const isEditing = !!editing;
  const displayName = editing ? ([editing.firstName, editing.lastName].filter(Boolean).join(' ') || editing.name || editing.email) : '';
  const title = isEditing ? `Edit ${displayName}` : 'Add new employee';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl border-slate-200/60 bg-white/95 backdrop-blur-md shadow-2xl shadow-slate-900/20 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto px-1">
          {/* Personal Info Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Personal Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="First Name" error={errors.firstName} required>
                <Input
                  placeholder="John"
                  value={form.firstName || ''}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  disabled={isLoading}
                  className="rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white placeholder:text-slate-400"
                />
              </FormField>

              <FormField label="Last Name" error={errors.lastName} required>
                <Input
                  placeholder="Doe"
                  value={form.lastName || ''}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  disabled={isLoading}
                  className="rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white placeholder:text-slate-400"
                />
              </FormField>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Email" error={errors.email} required>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  disabled={isLoading}
                  className="rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white placeholder:text-slate-400"
                />
              </FormField>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Phone" error={errors.phone}>
                <Input
                  placeholder="+41 79 123 4567"
                  value={form.phone || ''}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  disabled={isLoading}
                  className="rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white"
                />
              </FormField>

              <FormField label="Address" error={errors.address}>
                <Input
                  placeholder="123 Main St, Zurich"
                  value={form.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  disabled={isLoading}
                  className="rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white"
                />
              </FormField>
            </div>
            
            <FormField label="Password" error={errors.password} required={!isEditing}>
              <Input
                type="password"
                placeholder={isEditing ? "Leave blank to keep current password" : "Enter password (min 6 characters)"}
                value={form.password || ''}
                onChange={(e) => handleChange('password', e.target.value)}
                disabled={isLoading}
                className="rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white"
              />
            </FormField>
          </div>

          <div className="h-px bg-slate-200" />

          {/* Employment Info Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Employment Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Department" error={errors.department} required>
                <Select value={form.department} onValueChange={(value) => handleChange('department', value)}>
                  <SelectTrigger disabled={isLoading} className="rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className='rounded-lg border-slate-200 bg-white'>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Designation" error={errors.designation} required>
                <Input
                  placeholder="e.g. Senior Chef"
                  value={form.designation || ''}
                  onChange={(e) => handleChange('designation', e.target.value)}
                  disabled={isLoading}
                  className="rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField label="Employment Type" required>
                <Select value={form.employeeType} onValueChange={(value) => handleChange('employeeType', value)}>
                  <SelectTrigger disabled={isLoading} className="rounded-lg border-slate-200 bg-slate-50/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className='rounded-lg border-slate-200 bg-white'>
                    {EMPLOYMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Contract Type" required>
                <Select value={form.contractType} onValueChange={(value) => handleChange('contractType', value)}>
                  <SelectTrigger disabled={isLoading} className="rounded-lg border-slate-200 bg-slate-50/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className='rounded-lg border-slate-200 bg-white'>
                    {CONTRACT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Hire Date">
                <Input
                  type="date"
                  value={form.hireDate || ''}
                  onChange={(e) => handleChange('hireDate', e.target.value)}
                  disabled={isLoading}
                  className="rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white"
                />
              </FormField>
            </div>

            {/* Dynamic Contract Fields */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              {form.contractType === 'HOURLY' && (
                <FormField label="Hourly Rate (CHF)" error={errors.hourlyRate} required>
                  <Input
                    type="number"
                    min="0"
                    placeholder="25"
                    value={form.hourlyRate || ''}
                    onChange={(e) => handleChange('hourlyRate', Number(e.target.value))}
                    disabled={isLoading}
                    className="rounded-lg border-slate-200 focus:bg-white"
                  />
                </FormField>
              )}

              {(form.contractType === 'MONTHLY_SALARY' || form.contractType === 'WORKLOAD_PERCENT') && (
                <FormField label="Monthly Salary (CHF)" error={errors.monthlySalary} required>
                  <Input
                    type="number"
                    min="0"
                    placeholder="4500"
                    value={form.monthlySalary || ''}
                    onChange={(e) => handleChange('monthlySalary', Number(e.target.value))}
                    disabled={isLoading}
                    className="rounded-lg border-slate-200 focus:bg-white"
                  />
                </FormField>
              )}

              {form.contractType === 'MONTHLY_SALARY' && (
                <FormField label="Contracted Hours/Mo" error={errors.contractedHoursMonthly} required>
                  <Input
                    type="number"
                    min="0"
                    placeholder="168"
                    value={form.contractedHoursMonthly || ''}
                    onChange={(e) => handleChange('contractedHoursMonthly', Number(e.target.value))}
                    disabled={isLoading}
                    className="rounded-lg border-slate-200 focus:bg-white"
                  />
                </FormField>
              )}

              {form.contractType === 'WORKLOAD_PERCENT' && (
                <FormField label="Workload (%)" error={errors.workloadPercent} required>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="80"
                    value={form.workloadPercent || ''}
                    onChange={(e) => handleChange('workloadPercent', Number(e.target.value))}
                    disabled={isLoading}
                    className="rounded-lg border-slate-200 focus:bg-white"
                  />
                </FormField>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 pt-4 border-t border-slate-100 mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="rounded-lg border-slate-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-600/25"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// DELETE CONFIRMATION DIALOG
// ─────────────────────────────────────────────────────────────

interface EmployeeDeleteConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  isLoading: boolean;
  onConfirm: () => void;
}

export function EmployeeDeleteConfirm({
  open,
  onOpenChange,
  employee,
  isLoading,
  onConfirm,
}: EmployeeDeleteConfirmProps) {
  return (
    <AlertDialog open={open} onOpenChange={(newOpen) => !isLoading && onOpenChange(newOpen)}>
      <AlertDialogContent className="rounded-2xl border-slate-200/60 bg-white/95 backdrop-blur-md shadow-2xl shadow-slate-900/20">
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-50">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-lg font-bold text-slate-900">
                Delete {[employee?.firstName, employee?.lastName].filter(Boolean).join(' ') || employee?.name || employee?.email}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500 mt-2">
                This will permanently remove the employee from the system. This action cannot be undone.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-3 mt-6">
          <AlertDialogCancel
            disabled={isLoading}
            className="rounded-lg border-slate-200 hover:bg-slate-50"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isLoading}
            onClick={onConfirm}
            className="rounded-lg bg-red-600 hover:bg-red-700 font-semibold shadow-lg shadow-red-600/25 text-white"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─────────────────────────────────────────────────────────────
// FORM FIELD COMPONENT
// ─────────────────────────────────────────────────────────────

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-slate-700 font-semibold text-sm">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}
