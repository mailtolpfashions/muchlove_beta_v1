import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Info,
  LogOut,
  Scissors,
  UsersRound,
  UserRoundSearch,
  Crown,
  UserRoundPlus,
  Sparkles,
  Wallet,
  BadgePercent,
  Package,
  Phone,
  MapPin,
  Store,
  X,
  ShieldCheck,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { useAlert } from '@/providers/AlertProvider';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { APP_AUTHOR, APP_NAME, APP_VERSION, BUSINESS_NAME, BUSINESS_ADDRESS, BUSINESS_CONTACT } from '@/constants/app';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { CustomerSubscription } from '@/types';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, isAdmin } = useAuth();
  const { showConfirm } = useAlert();
  const { services, subscriptions, offers, combos, users, customers, customerSubscriptions, loadError, reload } = useData();
  const subscribedCount = customerSubscriptions.filter((s: CustomerSubscription) => s.status === 'active').length;
  const [refreshing, setRefreshing] = useState(false);
  const [isAboutModalVisible, setAboutModalVisible] = useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const adminMenuItems = [
    {
      title: 'Inventory',
      subtitle: `${services.length} items configured`,
      icon: Scissors,
      color: '#E91E63',
      bg: '#FCE4EC',
      route: '/settings/inventory' as const,
    },
    {
      title: 'Staff',
      subtitle: `${users.length} employees`,
      icon: UsersRound,
      color: '#7C3AED',
      bg: '#EDE9FE',
      route: '/settings/staff' as const,
    },
    {
      title: 'Customers',
      subtitle: `${customers.length} records`,
      icon: UserRoundSearch,
      color: '#0EA5E9',
      bg: '#E0F2FE',
      route: '/settings/customers' as const,
    },
  ];

  const menuItems = isAdmin ? adminMenuItems : [];

  const subscriptionMenuItems = isAdmin ? [
    {
      title: 'Subscription Plans',
      subtitle: `${subscriptions.length} plans available`,
      icon: Crown,
      color: '#D4AF37',
      bg: '#FDF6E3',
      route: '/settings/subscription-plans' as const,
    },
    {
      title: 'Customer Subscriptions',
      subtitle: `${subscribedCount} customers subscribed`,
      icon: UserRoundPlus,
      color: '#F59E0B',
      bg: '#FEF3C7',
      route: '/settings/customer-subscriptions' as const,
    },
  ] : [];

  const offersMenuItems = isAdmin ? [
    {
      title: 'Offers',
      subtitle: `${offers.length} visit & promo offers`,
      icon: BadgePercent,
      color: '#EC4899',
      bg: '#FCE7F3',
      route: '/settings/offers' as const,
    },
    {
      title: 'Combos',
      subtitle: `${combos.length} combo deals`,
      icon: Package,
      color: '#8B5CF6',
      bg: '#EDE9FE',
      route: '/settings/combos' as const,
    },
  ] : [];

  const paymentsMenuItems = [
    {
      title: 'Payments',
      subtitle: 'UPI IDs & payment methods',
      icon: Wallet,
      color: '#10B981',
      bg: '#D1FAE5',
      route: '/settings/payments' as const,
    },
  ];

  const handleLogout = () => {
    showConfirm(
      'Logout',
      'Are you sure you want to logout?',
      logout,
      'Logout',
    );
  };

  const renderSection = (label: string, items: typeof menuItems) => {
    if (items.length === 0) return null;
    return (
      <>
        <Text style={styles.sectionLabel}>{label}</Text>
        <View style={styles.menuCard}>
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.menuItem, index < items.length - 1 && styles.menuItemBorder]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.6}
              >
                <View style={[styles.menuIcon, { backgroundColor: item.bg }]}>
                  <Icon size={20} color={item.color} strokeWidth={2} />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
                <View style={styles.chevronCircle}>
                  <ChevronRight size={14} color={Colors.textTertiary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{loadError.message}</Text>
          <TouchableOpacity onPress={() => reload()} style={styles.errorBannerBtn}>
            <Text style={styles.errorBannerBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Profile Card */}
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
          <Text style={styles.profileName}>{user?.name}</Text>
          <View style={styles.roleBadge}>
            <ShieldCheck size={12} color={isAdmin ? Colors.primary : Colors.info} />
            <Text style={[styles.roleText, !isAdmin && { color: Colors.info }]}>{isAdmin ? 'Administrator' : 'Employee'}</Text>
          </View>
        </View>
        <Sparkles size={20} color={Colors.accent} />
      </View>

      {renderSection('MANAGEMENT', menuItems)}
      {renderSection('SUBSCRIPTIONS', subscriptionMenuItems)}
      {renderSection('OFFERS', offersMenuItems)}
      {isAdmin && renderSection('PAYMENTS', paymentsMenuItems)}

      {/* App Info */}
      <Text style={styles.sectionLabel}>APP INFO</Text>
      <View style={styles.menuCard}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setAboutModalVisible(true)}
          activeOpacity={0.6}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#FFF0F5' }]}>
            <Store size={20} color={Colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>About Us</Text>
            <Text style={styles.menuSubtitle}>Salon details & contact</Text>
          </View>
          <View style={styles.chevronCircle}>
            <ChevronRight size={14} color={Colors.textTertiary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
        <LogOut size={18} color={Colors.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={styles.footerInfo}>
        <Text style={styles.version}>{APP_NAME} v{APP_VERSION}</Text>
        <Text style={styles.versionSub}>Developed by {APP_AUTHOR}</Text>
      </View>

      {/* About Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={isAboutModalVisible}
        onRequestClose={() => setAboutModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setAboutModalVisible(false)}
        >
          <View style={styles.modalContent}>
            {/* Close X */}
            <TouchableOpacity style={styles.modalClose} onPress={() => setAboutModalVisible(false)}>
              <X size={18} color={Colors.textTertiary} />
            </TouchableOpacity>

            {/* Gradient logo circle */}
            <LinearGradient
              colors={['#E91E63', '#AD1457']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aboutLogo}
            >
              <Scissors size={28} color="#fff" />
            </LinearGradient>

            <Text style={styles.aboutTitle}>{BUSINESS_NAME}</Text>

            <View style={styles.aboutDivider} />

            <View style={styles.aboutRow}>
              <View style={styles.aboutIconCircle}>
                <MapPin size={14} color={Colors.primary} />
              </View>
              <Text style={styles.aboutValue}>{BUSINESS_ADDRESS}</Text>
            </View>

            <View style={styles.aboutRow}>
              <View style={styles.aboutIconCircle}>
                <Phone size={14} color={Colors.primary} />
              </View>
              <Text style={styles.aboutValue}>{BUSINESS_CONTACT}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    color: Colors.surface,
  },

  /* Profile */
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
  profileName: {
    fontSize: FontSize.heading,
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
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  roleText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  /* Section */
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
    marginLeft: 14,
  },
  menuTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  menuSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerLight,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
  },
  logoutText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.danger,
  },

  /* Footer */
  footerInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  version: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  versionSub: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  /* About Modal */
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.overlay,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 28,
    width: '85%',
    alignItems: 'center',
    position: 'relative',
  },
  modalClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  aboutTitle: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  aboutDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    width: '80%',
    marginVertical: 18,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    width: '100%',
  },
  aboutIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutValue: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    flex: 1,
    fontWeight: '500',
  },
});
