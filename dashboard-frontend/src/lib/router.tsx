import { AppLayout } from '@/components/layouts/app-layout';
import { ProtectedRoute } from '@/lib/protected-route';
import { createBrowserRouter } from 'react-router-dom';

import { ApprovalsPage } from '@/pages/approvals.page';
import { AttendancePage } from '@/pages/attendance-page';
import { CategoriesPage } from '@/pages/categories-page';
import { EmployeesPage } from '@/pages/employees-page';
import { LandingPage } from '@/pages/landing.page';
import { LoginPage } from '@/pages/login.page';
import { NotFoundPage } from '@/pages/not-found.page';
import { OverviewPage } from '@/pages/overview.page';

import { ProfilePage } from '@/pages/profile.page';
import { ReportsPage } from '@/pages/reports.page';
import { SettingsPage } from '@/pages/settings.page';
import DemandPage from '@/pages/DemandPage';
import { ScheduleListPage } from '@/pages/schedule-list.page';
import { ScheduleDetailPage } from '@/pages/schedule-detail.page';
import { LeavesPage } from '@/pages/leaves-page';
import { NotificationsPage } from '@/pages/notifications.page';

export const router = createBrowserRouter([
  {
    // Public landing page
    path: '/',
    element: <LandingPage />,
    errorElement: <NotFoundPage />,
  },
  {
    // Authenticated dashboard
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'employees', element: <EmployeesPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'approvals', element: <ApprovalsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'demands', element: <DemandPage /> },
      { path: 'schedule', element: <ScheduleListPage /> },
      { path: 'schedule/:id', element: <ScheduleDetailPage /> },
      { path: 'leaves', element: <LeavesPage /> },
      { path: 'attendance', element: <AttendancePage /> },
      { path: 'notifications', element: <NotificationsPage /> },
    ],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
