import { BellRing } from 'lucide-react';

export function NotificationsPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans pb-24">
      <div className="w-full mx-auto space-y-6 max-w-5xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <BellRing className="h-6 w-6 text-slate-400" />
              Notifications
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              View and manage your alerts and messages.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-200/60 shadow-sm mt-4">
          <div className="h-16 w-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
            <BellRing className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No new notifications</h2>
          <p className="text-slate-500 max-w-sm">
            You're all caught up! When there are important updates or alerts, they will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
