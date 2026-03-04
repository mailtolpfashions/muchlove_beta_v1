/**
 * Master layout for the admin panel — Sidebar + TopBar + scrollable content.
 * Handles responsive sidebar collapse.
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Dimensions, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { WebColors, WebLayout } from '@/constants/web';

// ── Page titles derived from route pathname ──────────────────

const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/sales': 'Sales History',
  '/admin/billing': 'Billing Management',
  '/admin/attendance': 'Attendance Management',
  '/admin/leave-approvals': 'Leave & Permission Approvals',
  '/admin/customers': 'Customer Management',
  '/admin/staff': 'Staff Management',
  '/admin/offers': 'Offers & Discounts',
  '/admin/expenses': 'Expense Management',
  '/admin/customer-subscriptions': 'Customer Subscriptions',
  '/admin/payments': 'UPI Payments',
  '/admin/attendance-config': 'Attendance Configuration',
  '/admin/salary-management': 'Salary Management',
};

interface Props {
  children: React.ReactNode;
  pendingCount?: number;
}

export function AdminLayout({ children, pendingCount = 0 }: Props) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || 'Admin';

  // Auto-collapse sidebar on narrow screens
  const [collapsed, setCollapsed] = useState(() => {
    if (Platform.OS !== 'web') return false;
    return Dimensions.get('window').width < WebLayout.breakLg;
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onResize = ({ window }: { window: { width: number } }) => {
      setCollapsed(window.width < WebLayout.breakLg);
    };
    const sub = Dimensions.addEventListener('change', onResize);
    return () => sub?.remove();
  }, []);

  return (
    <View style={styles.root}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <View style={styles.main}>
        <TopBar title={title} pendingCount={pendingCount} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: WebColors.pageBg,
    // @ts-ignore web min-height
    minHeight: '100vh',
  },
  main: {
    flex: 1,
    flexDirection: 'column',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: WebLayout.contentPadding,
    maxWidth: WebColors.contentMaxWidth,
    // Center content when viewport is very wide
    alignSelf: 'stretch',
    width: '100%',
  },
});
