import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Wrench,
  CreditCard,
  Users,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Info,
  UserPlus,
  Tag,
  Wallet,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { APP_AUTHOR, APP_NAME, APP_VERSION } from '@/constants/app';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { CustomerSubscription } from '@/types';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, isAdmin } = useAuth();
  const { services, subscriptions, offers, users, customers, customerSubscriptions, loadError, reload } = useData();
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
      icon: Wrench,
      color: Colors.primary,
      bg: Colors.primaryLight,
      route: '/settings/inventory' as const,
    },
    {
      title: 'Staff',
      subtitle: `${users.length} employees`,
      icon: Users,
      color: Colors.info,
      bg: Colors.infoLight,
      route: '/settings/staff' as const,
    },
    {
      title: 'Customers',
      subtitle: `${customers.length} records`,
      icon: Users,
      color: Colors.info,
      bg: Colors.infoLight,
      route: '/settings/customers' as const,
    },
  ];

  const menuItems = isAdmin ? adminMenuItems : [];

  const subscriptionMenuItems = isAdmin ? [
    {
      title: 'Subscription Plans',
      subtitle: `${subscriptions.length} plans available`,
      icon: CreditCard,
      color: Colors.accent,
      bg: Colors.accentLight,
      route: '/settings/subscription-plans' as const,
    },
    {
      title: 'Customer Subscriptions',
      subtitle: `${subscribedCount} customers subscribed`,
      icon: UserPlus,
      color: Colors.accent,
      bg: Colors.accentLight,
      route: '/settings/customer-subscriptions' as const,
    },
  ] : [];

  const paymentsMenuItems = [
    {
      title: 'Payments',
      subtitle: 'UPI IDs & payment methods',
      icon: Wallet,
      color: Colors.success,
      bg: Colors.successLight,
      route: '/settings/payments' as const,
    },
  ];

  const offersMenuItems = isAdmin ? [
    {
      title: 'Offers',
      subtitle: `${offers.length} visit & promo offers`,
      icon: Tag,
      color: Colors.accent,
      bg: Colors.accentLight,
      route: '/settings/offers' as const,
    },
  ] : [];

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
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
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <ShieldCheck size={28} color={Colors.primary} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name}</Text>
          <Text style={styles.profileRole}>{isAdmin ? 'Administrator' : 'Employee'}</Text>
        </View>
      </View>

      {menuItems.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>MANAGEMENT</Text>
          <View style={styles.menuCard}>
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.menuItem, index < menuItems.length - 1 && styles.menuItemBorder]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.bg }]}>
                    <Icon size={20} color={item.color} />
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuTitle}>{item.title}</Text>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  </View>
                  <ChevronRight size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {subscriptionMenuItems.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>SUBSCRIPTIONS</Text>
          <View style={styles.menuCard}>
            {subscriptionMenuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.route}
                  style={[
                    styles.menuItem,
                    index < subscriptionMenuItems.length - 1 && styles.menuItemBorder,
                  ]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.bg }]}>
                    <Icon size={20} color={item.color} />
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuTitle}>{item.title}</Text>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  </View>
                  <ChevronRight size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {offersMenuItems.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>OFFERS</Text>
          <View style={styles.menuCard}>
            {offersMenuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.menuItem, index < offersMenuItems.length - 1 && styles.menuItemBorder]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.bg }]}>
                    <Icon size={20} color={item.color} />
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuTitle}>{item.title}</Text>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  </View>
                  <ChevronRight size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {isAdmin && (
        <>
          <Text style={styles.sectionLabel}>PAYMENTS</Text>
          <View style={styles.menuCard}>
            {paymentsMenuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.menuItem, index < paymentsMenuItems.length - 1 && styles.menuItemBorder]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.bg }]}>
                    <Icon size={20} color={item.color} />
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuTitle}>{item.title}</Text>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  </View>
                  <ChevronRight size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>APP INFO</Text>
      <View style={styles.menuCard}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setAboutModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: Colors.infoLight }]}>
            <Info size={20} color={Colors.info} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>About Us</Text>
            <Text style={styles.menuSubtitle}>Salon details and contact</Text>
          </View>
          <ChevronRight size={18} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <LogOut size={18} color={Colors.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>
        {APP_NAME} v{APP_VERSION}
      </Text>
      <Text style={styles.version}>Developed By {APP_AUTHOR}</Text>

      <Modal
        animationType="fade"
        transparent={true}
        visible={isAboutModalVisible}
        onRequestClose={() => setAboutModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setAboutModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.aboutTitle}>Much Love Beauty Salon</Text>
            <Text style={styles.aboutText}>Kundrathur, Chennai - 69</Text>
            <Text style={[styles.aboutText, { marginBottom: Spacing.xl }]}>Contact : 9092890546</Text>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setAboutModalVisible(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
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
    color: '#fff',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.screen,
    marginBottom: Spacing.xxl,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: FontSize.heading,
    fontWeight: '600',
    color: Colors.text,
  },
  profileRole: {
    fontSize: FontSize.body,
    color: Colors.primary,
    fontWeight: '500',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.xxl,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.card,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
    marginLeft: 14,
  },
  menuTitle: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
  },
  menuSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerLight,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.card,
  },
  logoutText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.danger,
  },
  version: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '85%',
    alignItems: 'stretch',
  },
  aboutTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  aboutText: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  closeBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  closeBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
