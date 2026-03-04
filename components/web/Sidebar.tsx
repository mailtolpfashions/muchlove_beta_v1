/**
 * Glassmorphism sidebar navigation for the admin panel.
 * Supports collapse/expand with smooth animation.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import {
  LayoutDashboard,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  Receipt,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  UserCog,
  Tag,
  DollarSign,
  CreditCard,
  Wallet,
  Settings,
  Banknote,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors, WebLayout } from '@/constants/web';
import { useAuth } from '@/providers/AuthProvider';
import { APP_NAME } from '@/constants/app';

// ── Nav items (single source of truth) ───────────────────────

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, route: '/admin/dashboard' },
  { key: 'sales', label: 'Sales', icon: BarChart3, route: '/admin/sales' },
  { key: 'billing', label: 'Billing', icon: Receipt, route: '/admin/billing' },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck, route: '/admin/attendance' },
  { key: 'leave-approvals', label: 'Approvals', icon: ClipboardList, route: '/admin/leave-approvals' },
  { key: 'customers', label: 'Customers', icon: Users, route: '/admin/customers' },
  { key: 'staff', label: 'Staff', icon: UserCog, route: '/admin/staff' },
  { key: 'offers', label: 'Offers', icon: Tag, route: '/admin/offers' },
  { key: 'expenses', label: 'Expenses', icon: DollarSign, route: '/admin/expenses' },
  { key: 'customer-subscriptions', label: 'Subscriptions', icon: CreditCard, route: '/admin/customer-subscriptions' },
  { key: 'payments', label: 'Payments', icon: Wallet, route: '/admin/payments' },
  { key: 'attendance-config', label: 'Attendance Config', icon: Settings, route: '/admin/attendance-config' },
  { key: 'salary-management', label: 'Salary', icon: Banknote, route: '/admin/salary-management' },
] as const;

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const isActive = (route: string) => pathname === route || pathname.startsWith(route + '/');
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'A';

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      {/* Brand */}
      <View style={styles.brandSection}>
        {!collapsed && (
          <>
            <Text style={styles.brandName}>{APP_NAME}</Text>
            <Text style={styles.brandSub}>Admin Panel</Text>
          </>
        )}
        {collapsed && (
          <Text style={styles.brandInitial}>ML</Text>
        )}
      </View>

      {/* Collapse toggle */}
      <Pressable style={styles.toggleBtn} onPress={onToggle}>
        {collapsed
          ? <ChevronRight size={16} color={Colors.textSecondary} />
          : <ChevronLeft size={16} color={Colors.textSecondary} />
        }
      </Pressable>

      {/* Nav items */}
      <View style={styles.nav}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item.route);
          const Icon = item.icon;
          return (
            <NavItem
              key={item.key}
              icon={<Icon size={20} color={active ? Colors.primary : Colors.textSecondary} />}
              label={item.label}
              active={active}
              collapsed={collapsed}
              onPress={() => router.push(item.route as any)}
            />
          );
        })}
      </View>

      {/* User info + logout */}
      <View style={styles.footer}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {!collapsed && (
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Admin'}</Text>
              <Text style={styles.userRole}>Admin</Text>
            </View>
          )}
        </View>
        <Pressable
          style={[styles.logoutBtn, collapsed && styles.logoutBtnCollapsed]}
          onPress={logout}
        >
          <LogOut size={18} color={Colors.danger} />
          {!collapsed && <Text style={styles.logoutText}>Log out</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ── NavItem sub-component ────────────────────────────────────

function NavItem({ icon, label, active, collapsed, onPress }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      style={[
        styles.navItem,
        active && styles.navItemActive,
        hovered && !active && styles.navItemHover,
        collapsed && styles.navItemCollapsed,
      ]}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
      {active && <View style={styles.activeBar} />}
      {icon}
      {!collapsed && <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>}
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  sidebar: {
    width: WebLayout.sidebarWidth,
    backgroundColor: WebColors.sidebarBg,
    borderRightWidth: 1,
    borderRightColor: WebColors.sidebarBorder,
    // @ts-ignore web backdrop-filter
    backdropFilter: 'blur(12px)',
    justifyContent: 'flex-start',
    paddingTop: 24,
    paddingBottom: 16,
  },
  sidebarCollapsed: {
    width: WebLayout.sidebarCollapsed,
  },
  brandSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  brandName: {
    fontFamily: 'Billabong',
    fontSize: 30,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: WebTypo.tiny,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: -2,
  },
  brandInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
  },
  toggleBtn: {
    alignSelf: 'flex-end',
    marginRight: 12,
    marginBottom: 12,
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  nav: {
    flex: 1,
    paddingHorizontal: 10,
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: WebColors.sidebarActive,
  },
  navItemHover: {
    backgroundColor: WebColors.sidebarHover,
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  navLabel: {
    fontSize: WebTypo.body,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  navLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 10,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: WebTypo.small,
    fontWeight: '600',
    color: Colors.text,
  },
  userRole: {
    fontSize: WebTypo.tiny,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  logoutBtnCollapsed: {
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: WebTypo.small,
    fontWeight: '500',
    color: Colors.danger,
  },
});
