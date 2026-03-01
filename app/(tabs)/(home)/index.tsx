import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import {
  TrendingUp,
  Users,
  IndianRupee,
  CalendarDays,
  Crown,
  LogOut,
  Sparkles,
  ShieldCheck,
  BarChart3,
  Clock,
  Zap,
  UsersRound,
  Scissors,
  UserRoundPlus,
  AlertTriangle,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart } from 'react-native-chart-kit';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { formatCurrency, isToday } from '@/utils/format';
import { Sale, Expense, CustomerSubscription, Customer, SaleItem } from '@/types';

const isThisCalendarMonth = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

export default function DashboardScreen() {
  const { user, logout, isAdmin } = useAuth();
  const { stats, sales, allExpenses, customerSubscriptions, customers, reload, dataLoading, loadError } = useData();
  const [refreshing, setRefreshing] = React.useState(false);
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  const chartConfig = useMemo(() => ({
    backgroundColor: Colors.surface,
    backgroundGradientFrom: Colors.surface,
    backgroundGradientTo: Colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(233, 30, 99, ${opacity})`,
    labelColor: () => Colors.textTertiary,
    barPercentage: 0.5,
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: Colors.borderLight,
    },
    style: {
      borderRadius: 12,
    },
  }), []);

  const dateText = useMemo(() =>
    new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  [sales]);

  const last7DaysChart = useMemo(() => {
    if (!isAdmin || !sales.length) return null;

    const days = 7;
    const dailyTotals: number[] = [];
    const labels: string[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const dayTotal = sales
        .filter((s: Sale) => {
          const sDate = new Date(s.createdAt);
          return sDate >= d && sDate < nextD;
        })
        .reduce((sum: number, s: Sale) => sum + s.total, 0);

      dailyTotals.push(dayTotal);
      labels.push(dayNames[d.getDay()]);
    }

    const total7 = dailyTotals.reduce((a, b) => a + b, 0);

    return { labels, data: dailyTotals, total: total7 };
  }, [sales, isAdmin]);

  const employeeStats = useMemo(() => {
    if (!user || isAdmin) return null;
    const mySales = sales.filter((s: Sale) => s.employeeId === user.id);
    const todayMy = mySales.filter((s: Sale) => isToday(s.createdAt));
    return {
      todaySalesCount: todayMy.length,
      todaySalesTotal: todayMy.reduce((sum: number, s: Sale) => sum + s.total, 0),
      totalSalesCount: mySales.length,
      totalSalesAmount: mySales.reduce((sum: number, s: Sale) => sum + s.total, 0),
    };
  }, [sales, user, isAdmin]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const displayStats = isAdmin ? stats : employeeStats;

  const { monthRevenue, monthCount, monthExpensesTotal } = useMemo(() => {
    const monthSales = sales.filter((s: Sale) => isThisCalendarMonth(s.createdAt));
    return {
      monthRevenue: monthSales.reduce((sum: number, s: Sale) => sum + s.total, 0),
      monthCount: monthSales.length,
      monthExpensesTotal: allExpenses
        .filter((e: Expense) => isThisCalendarMonth(e.expenseDate))
        .reduce((sum: number, e: Expense) => sum + e.amount, 0),
    };
  }, [sales, allExpenses]);

  const activeSubsCount = useMemo(() =>
    customerSubscriptions.filter((s: CustomerSubscription) => s.status === 'active').length,
  [customerSubscriptions]);

  // Subscriptions expiring within 7 days
  const expiringSubs = useMemo(() => {
    if (!isAdmin) return [];
    const now = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    return customerSubscriptions
      .filter((s: CustomerSubscription) => {
        if (s.status !== 'active') return false;
        const start = new Date(s.startDate);
        const end = new Date(start);
        end.setMonth(end.getMonth() + s.planDurationMonths);
        return end >= now && end <= soon;
      })
      .sort((a: CustomerSubscription, b: CustomerSubscription) => {
        const endA = new Date(a.startDate); endA.setMonth(endA.getMonth() + a.planDurationMonths);
        const endB = new Date(b.startDate); endB.setMonth(endB.getMonth() + b.planDurationMonths);
        return endA.getTime() - endB.getTime();
      });
  }, [customerSubscriptions, isAdmin]);

  // New customers this month
  const newCustomersMonth = useMemo(() => {
    if (!isAdmin) return 0;
    return customers.filter((c: Customer) => isThisCalendarMonth(c.createdAt)).length;
  }, [customers, isAdmin]);

  // Top service by count (most sold) and top service by revenue (most income)
  const { topServiceByCount, topServiceByRevenue } = useMemo(() => {
    if (!isAdmin) return { topServiceByCount: null, topServiceByRevenue: null };
    const monthSales = sales.filter((s: Sale) => isThisCalendarMonth(s.createdAt));
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    for (let i = 0; i < monthSales.length; i++) {
      const s = monthSales[i];
      for (let j = 0; j < s.items.length; j++) {
        const item = s.items[j];
        if (!map[item.itemId]) map[item.itemId] = { name: item.itemName, count: 0, revenue: 0 };
        map[item.itemId].count += item.quantity;
        map[item.itemId].revenue += item.price * item.quantity;
      }
    }
    const list = Object.values(map);
    if (list.length === 0) return { topServiceByCount: null, topServiceByRevenue: null };
    let byCount = list[0];
    let byRevenue = list[0];
    for (let i = 1; i < list.length; i++) {
      if (list[i].count > byCount.count) byCount = list[i];
      if (list[i].revenue > byRevenue.revenue) byRevenue = list[i];
    }
    return { topServiceByCount: byCount, topServiceByRevenue: byRevenue };
  }, [sales, isAdmin]);

  const employeeRevenue = useMemo(() => {
    if (!isAdmin) return [];
    const monthSales = sales.filter((s: Sale) => isThisCalendarMonth(s.createdAt));
    const map: Record<string, { name: string; total: number; count: number }> = {};
    monthSales.forEach((s: Sale) => {
      if (!map[s.employeeId]) map[s.employeeId] = { name: s.employeeName, total: 0, count: 0 };
      map[s.employeeId].total += s.total;
      map[s.employeeId].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [sales, isAdmin]);

  const cards = useMemo(() => {
    if (isAdmin) {
      if (!stats) return [];
      return [
        { title: "Today's Sales", value: formatCurrency(stats.todaySalesTotal), subtitle: `${stats.todaySalesCount} transactions`, icon: IndianRupee, color: '#10B981', bg: '#D1FAE5' },
        { title: 'This Month', value: formatCurrency(monthRevenue), subtitle: `${monthCount} sales this month`, icon: TrendingUp, color: '#E91E63', bg: '#FCE4EC' },
        { title: 'Month Expenses', value: formatCurrency(monthExpensesTotal), subtitle: `${monthCount} sales this month`, icon: CalendarDays, color: '#EF4444', bg: '#FEE2E2' },
        { title: 'Net Profit', value: formatCurrency(monthRevenue - monthExpensesTotal), subtitle: monthCount > 0 ? `Avg: ${formatCurrency(monthRevenue / monthCount)}` : 'No sales yet', icon: TrendingUp, color: monthRevenue - monthExpensesTotal >= 0 ? '#10B981' : '#EF4444', bg: monthRevenue - monthExpensesTotal >= 0 ? '#D1FAE5' : '#FEE2E2' },
      ];
    }
    
    if (!employeeStats) return [];
    return [
      { title: "My Today's Sales", value: formatCurrency(employeeStats.todaySalesTotal), subtitle: `${employeeStats.todaySalesCount} transactions today`, icon: IndianRupee, color: '#10B981', bg: '#D1FAE5' },
      { title: 'My Transactions', value: employeeStats.todaySalesCount.toString(), subtitle: 'Today', icon: Zap, color: '#8B5CF6', bg: '#EDE9FE' },
    ];
  }, [isAdmin, stats, employeeStats, sales, allExpenses, monthRevenue, monthCount, monthExpensesTotal]);

  // Only show full-screen spinner on very first load when no cached data exists.
  // Once cache is hydrated (or data arrives), render the dashboard immediately.
  const hasData = sales.length > 0 || stats.totalCustomers > 0;
  if (dataLoading && !refreshing && !hasData) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{loadError?.message}</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.errorBannerBtn}>
            <Text style={styles.errorBannerBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Profile greeting card */}
      <View style={styles.profileCard}>
        <LinearGradient
          colors={['#E91E63', '#AD1457']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarGradient}
        >
          <Text style={styles.avatarInitial}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
        </LinearGradient>
        <View style={styles.profileInfo}>
          <Text style={styles.greeting}>Hello, {user?.name} 👋</Text>
          <View style={styles.roleBadge}>
            <ShieldCheck size={10} color={isAdmin ? Colors.primary : Colors.info} />
            <Text style={[styles.roleText, !isAdmin && { color: Colors.info }]}>{isAdmin ? 'Administrator' : 'Employee'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn} testID="logout-button">
          <LogOut size={18} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Date row */}
      <View style={styles.dateRow}>
        <CalendarDays size={13} color={Colors.textTertiary} />
        <Text style={styles.dateText}>
          {dateText}
        </Text>
      </View>

      {/* Stat cards */}
      <View style={styles.cardsGrid}>
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <View key={index} style={styles.statCard}>
              <View style={[styles.iconSquircle, { backgroundColor: card.bg }]}>
                <Icon size={20} color={card.color} strokeWidth={2} />
              </View>
              <Text style={styles.cardValue}>{card.value}</Text>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
            </View>
          );
        })}
      </View>

      {/* 7-day revenue chart (admin only) */}
      {isAdmin && last7DaysChart && (
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleRow}>
              <BarChart3 size={18} color={Colors.primary} />
              <Text style={styles.chartTitle}>Last 7 Days</Text>
            </View>
            <Text style={styles.chartTotal}>{formatCurrency(last7DaysChart.total)}</Text>
          </View>
          <BarChart
            data={{
              labels: last7DaysChart.labels,
              datasets: [{ data: last7DaysChart.data.length ? last7DaysChart.data : [0] }],
            }}
            width={SCREEN_WIDTH - Spacing.screen * 2 - Spacing.screen * 2 + 16}
            height={180}
            chartConfig={chartConfig}
            style={styles.chart}
            fromZero
            showValuesOnTopOfBars
            withInnerLines={false}
            yAxisLabel=""
            yAxisSuffix=""
          />
        </View>
      )}

      {/* Quick Overview (admin only) */}
      {isAdmin && (
        <View style={styles.quickInfo}>
          <View style={styles.quickInfoHeader}>
            <Sparkles size={18} color={Colors.primary} />
            <Text style={styles.quickInfoTitle}>Quick Overview</Text>
          </View>

          {/* Active Subscriptions */}
          <View style={styles.overviewRow}>
            <View style={[styles.overviewIconCircle, { backgroundColor: '#EDE9FE' }]}>
              <Crown size={16} color="#8B5CF6" />
            </View>
            <Text style={styles.infoLabel}>Active Subscriptions</Text>
            <Text style={styles.infoValue}>{activeSubsCount}</Text>
          </View>
          <View style={styles.divider} />

          {/* New Customers */}
          <View style={styles.overviewRow}>
            <View style={[styles.overviewIconCircle, { backgroundColor: '#DBEAFE' }]}>
              <UserRoundPlus size={16} color="#3B82F6" />
            </View>
            <Text style={styles.infoLabel}>New Customers (Month)</Text>
            <Text style={styles.infoValue}>{newCustomersMonth}</Text>
          </View>
          <View style={styles.divider} />

          {/* Total Customers */}
          <View style={styles.overviewRow}>
            <View style={[styles.overviewIconCircle, { backgroundColor: '#D1FAE5' }]}>
              <UsersRound size={16} color="#10B981" />
            </View>
            <Text style={styles.infoLabel}>Total Customers</Text>
            <Text style={styles.infoValue}>{stats.totalCustomers}</Text>
          </View>

          {/* Expiring Subscriptions */}
          {expiringSubs.length > 0 && (
            <>
              <View style={styles.sectionDivider} />
              <Text style={styles.sectionLabel}>Expiring Soon</Text>
              {expiringSubs.map((sub: CustomerSubscription) => {
                const end = new Date(sub.startDate);
                end.setMonth(end.getMonth() + sub.planDurationMonths);
                return (
                  <View key={sub.id} style={styles.overviewRow}>
                    <View style={[styles.overviewIconCircle, { backgroundColor: '#FEF3C7' }]}>
                      <AlertTriangle size={14} color="#F59E0B" />
                    </View>
                    <Text style={styles.infoLabel} numberOfLines={1}>
                      {sub.customerName} — {sub.planName}
                    </Text>
                    <Text style={[styles.infoValue, { color: '#F59E0B', fontSize: FontSize.sm }]}>
                      {end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                );
              })}
            </>
          )}

          {/* Top Service & Top Revenue */}
          {(topServiceByCount || topServiceByRevenue) && (
            <>
              <View style={styles.sectionDivider} />
              {topServiceByCount && (
                <View style={styles.overviewRow}>
                  <View style={[styles.overviewIconCircle, { backgroundColor: '#FCE4EC' }]}>
                    <Scissors size={14} color={Colors.primary} />
                  </View>
                  <Text style={styles.infoLabel} numberOfLines={1}>Top Service</Text>
                  <Text style={styles.infoValue}>{topServiceByCount.name} ({topServiceByCount.count}×)</Text>
                </View>
              )}
              {topServiceByRevenue && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.overviewRow}>
                    <View style={[styles.overviewIconCircle, { backgroundColor: '#D1FAE5' }]}>
                      <IndianRupee size={14} color="#10B981" />
                    </View>
                    <Text style={styles.infoLabel} numberOfLines={1}>Top Revenue</Text>
                    <Text style={styles.infoValue}>{topServiceByRevenue.name} ({formatCurrency(topServiceByRevenue.revenue)})</Text>
                  </View>
                </>
              )}
            </>
          )}

          {/* Staff Revenue */}
          {employeeRevenue.length > 0 && (
            <>
              <View style={styles.sectionDivider} />
              <Text style={styles.sectionLabel}>Staff Revenue</Text>
              {employeeRevenue.map((emp, i) => (
                <View key={i} style={styles.overviewRow}>
                  <View style={[styles.overviewIconCircle, { backgroundColor: '#EDE9FE' }]}>
                    <Users size={14} color="#8B5CF6" />
                  </View>
                  <Text style={styles.infoLabel} numberOfLines={1}>
                    {emp.name} ({emp.count} sales)
                  </Text>
                  <Text style={styles.infoValue}>{formatCurrency(emp.total)}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Employee overview (non-admin) */}
      {!isAdmin && employeeStats && (
        <View style={styles.quickInfo}>
          <View style={styles.quickInfoHeader}>
            <Clock size={18} color={Colors.info} />
            <Text style={styles.quickInfoTitle}>My Performance</Text>
          </View>
          <View style={styles.overviewRow}>
            <View style={[styles.overviewIconCircle, { backgroundColor: '#DBEAFE' }]}>
              <Zap size={16} color="#3B82F6" />
            </View>
            <Text style={styles.infoLabel}>Total Sales</Text>
            <Text style={styles.infoValue}>{employeeStats.totalSalesCount}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.overviewRow}>
            <View style={[styles.overviewIconCircle, { backgroundColor: '#D1FAE5' }]}>
              <IndianRupee size={16} color="#10B981" />
            </View>
            <Text style={styles.infoLabel}>Total Revenue</Text>
            <Text style={styles.infoValue}>{formatCurrency(employeeStats.totalSalesAmount)}</Text>
          </View>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.screen,
    paddingBottom: 100,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dangerLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  errorBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.danger,
  },
  errorBannerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.sm,
  },
  errorBannerBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.surface,
  },

  /* Profile card */
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: '#fff',
  },
  profileInfo: {
    marginLeft: 14,
    flex: 1,
  },
  greeting: {
    fontSize: FontSize.title,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: Colors.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
  },

  /* Date */
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
    marginLeft: 4,
  },
  dateText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: '500',
  },

  /* Cards grid */
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: '48%' as unknown as number,
    flexGrow: 1,
    flexBasis: '45%' as unknown as number,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  iconSquircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.2,
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  cardSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  /* Chart */
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.screen,
    marginBottom: Spacing.xl,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  chartTotal: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  chart: {
    marginLeft: -16,
    borderRadius: 12,
  },

  /* Quick overview */
  quickInfo: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  quickInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  quickInfoTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  overviewIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
    marginLeft: 44,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* Loading */
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
});