/**
 * Admin dashboard — KPI stat cards, revenue chart, recent sales, and pending requests summary.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  IndianRupee,
  ShoppingBag,
  Users,
  ClipboardList,
  ArrowRight,
  Clock,
  TrendingUp,
} from 'lucide-react-native';
import { useData } from '@/providers/DataProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors } from '@/constants/web';
import { AnimatedPage } from '@/components/web/AnimatedPage';
import { StatCard } from '@/components/web/StatCard';
import { formatCurrency, formatDateTime, isToday, isThisMonth } from '@/utils/format';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { sales, users, leaveRequests, permissionRequests, attendance, dataLoading } = useData();

  // ── Compute stats ──────────────────────────────────────────

  const todaySales = useMemo(() => sales.filter(s => isToday(s.createdAt)), [sales]);
  const monthSales = useMemo(() => sales.filter(s => isThisMonth(s.createdAt)), [sales]);

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const monthRevenue = monthSales.reduce((sum, s) => sum + s.total, 0);
  const activeStaff = users.filter(u => u.approved).length;
  const pendingRequests =
    leaveRequests.filter(r => r.status === 'pending').length +
    permissionRequests.filter(r => r.status === 'pending').length;

  // Recent sales (last 8)
  const recentSales = useMemo(
    () => [...sales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
    [sales],
  );

  // Pending leave/permission (combined, sorted by newest)
  const pendingList = useMemo(() => {
    const leaves = leaveRequests
      .filter(r => r.status === 'pending')
      .map(r => ({ ...r, reqType: 'leave' as const }));
    const perms = permissionRequests
      .filter(r => r.status === 'pending')
      .map(r => ({ ...r, reqType: 'permission' as const }));
    return [...leaves, ...perms]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [leaveRequests, permissionRequests]);

  // 7-day revenue breakdown
  const weekData = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const dayTotal = sales
        .filter(s => {
          const sd = new Date(s.createdAt);
          return sd >= dayStart && sd <= dayEnd;
        })
        .reduce((sum, s) => sum + s.total, 0);
      days.push({ label: dayStr, value: dayTotal });
    }
    return days;
  }, [sales]);

  const maxWeekValue = Math.max(...weekData.map(d => d.value), 1);

  // ── Greeting ───────────────────────────────────────────────

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <AnimatedPage>
      {/* Greeting */}
      <View style={styles.greetingRow}>
        <View>
          <Text style={styles.greeting}>{greeting}, {user?.name?.split(' ')[0] || 'Admin'} 👋</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>
      </View>

      {/* KPI Cards */}
      <View style={styles.statsGrid}>
        <StatCard
          icon={<IndianRupee size={22} color={WebColors.gradientRevenue[0]} />}
          label="Today's Revenue"
          value={todayRevenue}
          prefix="₹"
          gradient={WebColors.gradientRevenue}
        />
        <StatCard
          icon={<ShoppingBag size={22} color={WebColors.gradientSales[0]} />}
          label="Today's Sales"
          value={todaySales.length}
          gradient={WebColors.gradientSales}
        />
        <StatCard
          icon={<Users size={22} color={WebColors.gradientStaff[0]} />}
          label="Active Staff"
          value={activeStaff}
          gradient={WebColors.gradientStaff}
        />
        <StatCard
          icon={<ClipboardList size={22} color={WebColors.gradientRequests[0]} />}
          label="Pending Requests"
          value={pendingRequests}
          gradient={WebColors.gradientRequests}
        />
      </View>

      {/* Two-column: Chart + Pending */}
      <View style={styles.twoCol}>
        {/* Left: Revenue chart */}
        <View style={[styles.card, styles.chartCard]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>7-Day Revenue</Text>
              <Text style={styles.cardSubtitle}>
                This month: {formatCurrency(monthRevenue)}
              </Text>
            </View>
            <TrendingUp size={20} color={Colors.primary} />
          </View>
          <View style={styles.chartArea}>
            {weekData.map((d, i) => (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max((d.value / maxWeekValue) * 100, 4)}%` as any,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{d.label}</Text>
                <Text style={styles.barValue}>
                  {d.value >= 1000 ? `${(d.value / 1000).toFixed(0)}K` : d.value > 0 ? d.value : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Right: Pending requests */}
        <View style={[styles.card, styles.pendingCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Pending Approvals</Text>
            <Pressable onPress={() => router.push('/admin/leave-approvals' as any)}>
              <ArrowRight size={18} color={Colors.primary} />
            </Pressable>
          </View>
          {pendingList.length === 0 ? (
            <View style={styles.emptyPending}>
              <Text style={styles.emptyPendingText}>No pending requests 🎉</Text>
            </View>
          ) : (
            pendingList.map(req => (
              <View key={req.id} style={styles.pendingItem}>
                <View style={styles.pendingDot} />
                <View style={styles.pendingInfo}>
                  <Text style={styles.pendingName} numberOfLines={1}>{req.employeeName}</Text>
                  <Text style={styles.pendingType}>
                    {req.reqType === 'permission' ? 'Permission' : 
                     (req as any).type === 'compensation' ? 'Comp Off' :
                     (req as any).type === 'earned' ? 'Earned Leave' :
                     (req as any).reason?.startsWith('[CORRECTION]') ? 'Correction' : 'Leave'}
                  </Text>
                </View>
                <Clock size={12} color={Colors.textTertiary} />
              </View>
            ))
          )}
        </View>
      </View>

      {/* Recent Sales */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Recent Sales</Text>
          <Pressable onPress={() => router.push('/admin/sales' as any)}>
            <Text style={styles.viewAll}>View all →</Text>
          </Pressable>
        </View>
        {recentSales.length === 0 ? (
          <Text style={styles.emptyPendingText}>No sales recorded yet</Text>
        ) : (
          <View>
            {/* Table header */}
            <View style={styles.miniTableHeader}>
              <Text style={[styles.miniTh, { flex: 2 }]}>Customer</Text>
              <Text style={[styles.miniTh, { flex: 1.5 }]}>Employee</Text>
              <Text style={[styles.miniTh, { flex: 1 }]}>Amount</Text>
              <Text style={[styles.miniTh, { flex: 1.5 }]}>Time</Text>
            </View>
            {recentSales.map(sale => (
              <View key={sale.id} style={styles.miniTableRow}>
                <Text style={[styles.miniTd, { flex: 2 }]} numberOfLines={1}>{sale.customerName}</Text>
                <Text style={[styles.miniTd, { flex: 1.5 }]} numberOfLines={1}>{sale.employeeName}</Text>
                <Text style={[styles.miniTd, styles.miniTdBold, { flex: 1 }]}>{formatCurrency(sale.total)}</Text>
                <Text style={[styles.miniTd, styles.miniTdMuted, { flex: 1.5 }]}>
                  {new Date(sale.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </AnimatedPage>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: WebTypo.h2,
    fontWeight: '700',
    color: Colors.text,
  },
  dateText: {
    fontSize: WebTypo.small,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 22,
    borderWidth: 1,
    borderColor: '#F8F0F3',
    shadowColor: WebColors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    marginBottom: 18,
  },
  chartCard: {
    flex: 2,
    minWidth: 400,
  },
  pendingCard: {
    flex: 1,
    minWidth: 280,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: WebTypo.h3,
    fontWeight: '700',
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: WebTypo.small,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  viewAll: {
    fontSize: WebTypo.small,
    fontWeight: '600',
    color: Colors.primary,
  },
  // Chart
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 160,
    marginTop: 8,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barTrack: {
    flex: 1,
    width: '100%',
    maxWidth: 40,
    backgroundColor: '#FFF0F5',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  barValue: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  // Pending list
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warning,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: WebTypo.body,
    fontWeight: '600',
    color: Colors.text,
  },
  pendingType: {
    fontSize: WebTypo.tiny,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyPending: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyPendingText: {
    fontSize: WebTypo.body,
    color: Colors.textTertiary,
  },
  // Mini table (recent sales)
  miniTableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 4,
  },
  miniTh: {
    fontSize: WebTypo.tableHeader,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FAFAFA',
  },
  miniTd: {
    fontSize: WebTypo.table,
    color: Colors.text,
  },
  miniTdBold: {
    fontWeight: '600',
  },
  miniTdMuted: {
    color: Colors.textSecondary,
  },
});
