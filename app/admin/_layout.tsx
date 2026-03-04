/**
 * Admin route group layout.
 * Wraps all admin screens with WebGuard (auth + admin check) and AdminLayout (sidebar + topbar).
 * The login screen is rendered bare (no guard / sidebar) to avoid redirect loops.
 */

import React from 'react';
import { Slot, usePathname } from 'expo-router';
import { WebGuard } from '@/components/web/WebGuard';
import { AdminLayout } from '@/components/web/AdminLayout';
import { useData } from '@/providers/DataProvider';

export default function AdminGroupLayout() {
  const pathname = usePathname();

  // Login page gets a bare slot — no auth guard, no sidebar/topbar
  if (pathname === '/admin/login') {
    return <Slot />;
  }

  return <AdminGuardedLayout />;
}

/** Separate component so hooks like useData are only called when authenticated */
function AdminGuardedLayout() {
  const { leaveRequests, permissionRequests } = useData();

  // Count pending requests for the top bar badge
  const pendingCount =
    leaveRequests.filter(r => r.status === 'pending').length +
    permissionRequests.filter(r => r.status === 'pending').length;

  return (
    <WebGuard>
      <AdminLayout pendingCount={pendingCount}>
        <Slot />
      </AdminLayout>
    </WebGuard>
  );
}
