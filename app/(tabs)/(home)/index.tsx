import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  TrendingUp,
  Users,
  IndianRupee,
  CalendarCheck,
  CreditCard,
  LogOut,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { formatCurrency, isToday } from '@/utils/format';
import { Sale } from '@/types';

export default function DashboardScreen() {
  const { user, logout, isAdmin } = useAuth();
  const { stats, sales, reload, dataLoading, loadError } = useData();
  const [refreshing, setRefreshing] = React.useState(false);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const displayStats = isAdmin ? stats : employeeStats;
  const cards = useMemo(() => {
    if (isAdmin) {
      if (!stats) return [];
      return [
        { title: "Today's Sales", value: formatCurrency(stats.todaySalesTotal), subtitle: `${stats.todaySalesCount} transactions`, icon: IndianRupee, color: Colors.success, bg: Colors.successLight },
        { title: 'Total Revenue', value: formatCurrency(stats.totalSalesAmount), subtitle: `${stats.totalSalesCount} all-time sales`, icon: TrendingUp, color: Colors.primary, bg: Colors.primaryLight },
        { title: 'Total Customers', value: stats.totalCustomers.toString(), subtitle: 'Registered customers', icon: Users, color: Colors.info, bg: Colors.infoLight },
        { title: 'Subscriptions', value: stats.activeSubscriptions.toString(), subtitle: 'Active subscriptions', icon: CreditCard, color: Colors.accent, bg: Colors.accentLight },
      ];
    }
    
    if (!employeeStats) return [];
    return [
      { title: "My Today's Sales", value: formatCurrency(employeeStats.todaySalesTotal), subtitle: `${employeeStats.todaySalesCount} transactions today`, icon: IndianRupee, color: Colors.success, bg: Colors.successLight },
      { title: 'My Today\'s Transactions', value: employeeStats.todaySalesCount.toString(), subtitle: 'By me', icon: Users, color: Colors.info, bg: Colors.infoLight },
    ];
  }, [isAdmin, stats, employeeStats]);

  if (dataLoading && !refreshing) {
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
      <View style={styles.greetingRow}>
        <View style={styles.greetingLeft}>
          <Text style={styles.greeting}>Hello, {user?.name} 👋</Text>
          <Text style={styles.roleTag}>{user?.role === 'admin' ? 'Administrator' : 'Employee'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn} testID="logout-button">
          <LogOut size={20} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.dateRow}>
        <CalendarCheck size={14} color={Colors.textSecondary} />
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>
      </View>

      <View style={styles.cardsGrid}>
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <View key={index} style={styles.statCard}>
              <View style={[styles.iconCircle, { backgroundColor: card.bg }]}>
                <Icon size={20} color={card.color} />
              </View>
              <Text style={styles.cardValue}>{card.value}</Text>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
            </View>
          );
        })}
      </View>

      {displayStats && (
      <View style={styles.quickInfo}>
        <Text style={styles.quickInfoTitle}>{isAdmin ? 'Quick Overview' : 'My Overview'}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{isAdmin ? "Today's Transactions" : "My Today's Transactions"}</Text>
          <Text style={styles.infoValue}>{displayStats.todaySalesCount}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{isAdmin ? "Today's Revenue" : "My Today's Revenue"}</Text>
          <Text style={[styles.infoValue, { color: Colors.success }]}>
            {formatCurrency(displayStats.todaySalesTotal)}
          </Text>
        </View>
        {isAdmin && <>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Avg Sale Value</Text>
            <Text style={styles.infoValue}>
              {displayStats.totalSalesCount > 0
                ? formatCurrency(displayStats.totalSalesAmount / displayStats.totalSalesCount)
                : '₹0.00'}
            </Text>
          </View>
        </>}
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
    paddingBottom: Spacing.screenBottom,
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
    color: '#fff',
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  greetingLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: FontSize.xxl,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  roleTag: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600' as const,
    marginTop: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  dateText: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    width: '48%' as unknown as number,
    flexGrow: 1,
    flexBasis: '45%' as unknown as number,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.card,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardValue: {
    fontSize: FontSize.xl,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  cardTitle: {
    fontSize: FontSize.body,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cardSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  quickInfo: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.screen,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  quickInfoTitle: {
    fontSize: FontSize.title,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: FontSize.md,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
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