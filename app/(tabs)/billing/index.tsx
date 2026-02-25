import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import {
  BarChart3,
  Users,
  X,
  ChevronRight,
  UserCheck,
  ShoppingCart,
  CreditCard,
  Zap,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { Customer, Sale, Service, SubscriptionPlan, Offer, CustomerSubscription } from '@/types';
import CustomerPicker from '@/components/CustomerPicker';
import ServicePicker from '@/components/ServicePicker';
import SubscriptionPicker from '@/components/SubscriptionPicker';
import BillSummary from '@/components/BillSummary';
import QuickPayment from '@/components/QuickPayment';
import SaleComplete from '@/components/SaleComplete';
import { useAuth } from '@/providers/AuthProvider';
import { usePayment } from '@/providers/PaymentProvider';
import { randomUUID } from 'expo-crypto';

export default function BillingScreen() {
  const { user } = useAuth();
  const { customers, services, subscriptions, offers, customerSubscriptions, sales, addSale, reload, dataLoading, loadError } = useData();
  const { upiList } = usePayment();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState<boolean>(false);
  const [showServicePicker, setShowServicePicker] = useState<boolean>(false);
  const [showSubscriptionPicker, setShowSubscriptionPicker] = useState<boolean>(false);
  const [showQuickPayment, setShowQuickPayment] = useState<boolean>(false);

  // Bill state
  const [items, setItems] = useState<Service[]>([]);
  const [subs, setSubs] = useState<SubscriptionPlan[]>([]);
  const [completedSale, setCompletedSale] = useState<any>(null);

  const resetBill = () => {
    setSelectedCustomer(null);
    setSelectedCustomer(null);
    setItems([]);
    setSubs([]);
  };

  const handleAddQuantity = (service: Service) => {
    setItems((prev) => [...prev, service]);
  };

  const handleSubtractQuantity = (service: Service) => {
    setItems((prev) => {
      const index = prev.findIndex((s) => s.id === service.id);
      if (index > -1) {
        const newItems = [...prev];
        newItems.splice(index, 1);
        return newItems;
      }
      return prev;
    });
  };

  const handlePlaceOrder = async (total: number, discountAmt: number, discountPercent: number, upiId?: string) => {
    if (!user || !selectedCustomer) {
      Alert.alert('Error', 'Something went wrong');
      return;
    }
    const subtotal = items.reduce((acc, i: Service) => acc + i.price, 0) + subs.reduce((acc, s: SubscriptionPlan) => acc + s.price, 0);

    const sale = {
      customer_id: selectedCustomer.id,
      customer_name: selectedCustomer.name,
      employee_id: user.id,
      employee_name: user.name,
      total,
      subtotal: subtotal,
      discount_amount: discountAmt,
      discount_percent: discountPercent,
      items: items.map(i => ({
        id: randomUUID(),
        itemId: i.id,
        itemName: i.name,
        itemCode: i.code,
        price: i.price,
        quantity: 1,
        kind: i.kind,
      })),
      subscription_items: subs.map(s => ({
        id: randomUUID(),
        plan_id: s.id,
        plan_name: s.name,
        price: s.price,
        discounted_price: s.price,
      })),
      payment_method: upiId ? 'gpay' : 'cash',
      type: subs.length > 0 ? 'subscription' : 'service',
    };

    try {
      const result = await addSale(sale as any);
      resetBill();
      setCompletedSale(result);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to place order');
    }
  };

  const handleQuickPayment = async (amount: number, upiId: string, note: string) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to do this.');
      return;
    }

    const sale = {
      customer_id: selectedCustomer ? selectedCustomer.id : null,
      customer_name: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
      employee_id: user.id,
      employee_name: user.name,
      total: amount,
      subtotal: amount,
      discount_amount: 0,
      discount_percent: 0,
      items: [
        {
          id: randomUUID(),
          itemId: null,
          itemName: note || 'Quick Payment',
          itemCode: 'QUICKPAY',
          price: amount,
          quantity: 1,
          kind: 'service',
        },
      ],
      subscription_items: [],
      payment_method: 'gpay',
      type: 'other',
    };

    try {
      const result = await addSale(sale as any);
      setShowQuickPayment(false);
      setCompletedSale(result);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to record quick payment');
    }
  };

  const topServices = React.useMemo(() => {
    const serviceCounts: Record<string, number> = {};
    sales.forEach((s: Sale) => {
      s.items?.forEach((item: any) => {
        if (item.itemId && (item.kind === 'service' || item.kind === 'product')) {
          serviceCounts[item.itemId] = (serviceCounts[item.itemId] || 0) + item.quantity;
        }
      });
    });

    const sortedServiceIds = Object.keys(serviceCounts).sort((a, b) => serviceCounts[b] - serviceCounts[a]);
    const top = sortedServiceIds
      .map(id => services.find(s => s.id === id))
      .filter((s): s is Service => s !== undefined);

    if (top.length < 5) {
      const remaining = services.filter(s => !top.some(t => t.id === s.id));
      top.push(...remaining.slice(0, 5 - top.length));
    }
    return top.slice(0, 5);
  }, [sales, services]);

  const totalItems = items.length + subs.length;

  const selectedCustomerSubscriptions = selectedCustomer && customerSubscriptions
    ? customerSubscriptions.filter(cs => cs.customerId === selectedCustomer.id)
    : [];

  return (
    <View style={styles.container}>
      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{loadError?.message}</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.errorBannerBtn}>
            <Text style={styles.errorBannerBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        ListHeaderComponent={
          <>
            <View style={styles.customerSection}>
              <Text style={styles.sectionTitle}>Customer</Text>
              {selectedCustomer ? (
                <View style={styles.customerCard}>
                  <View style={styles.customerInfo}>
                    <UserCheck size={20} color={Colors.primary} />
                    <View>
                      <Text style={styles.customerName}>{selectedCustomer.name}</Text>
                      <Text style={styles.customerMeta}>
                        {selectedCustomer.mobile} • {selectedCustomer.isStudent ? 'Student' : 'Not a student'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                    <X size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.selectBtn} onPress={() => setShowCustomerPicker(true)}>
                  <Users size={18} color={Colors.primary} />
                  <Text style={styles.selectBtnText}>Select or Add Customer</Text>
                  <ChevronRight size={18} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.billingSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Billing Items ({totalItems})</Text>
                {totalItems > 0 && (
                  <TouchableOpacity onPress={resetBill}>
                    <Text style={styles.clearBtn}>Clear all</Text>
                  </TouchableOpacity>
                )}
              </View>

              {topServices.length > 0 && (
                <View style={styles.topServicesWrapper}>
                  <Text style={styles.topServicesTitle}>Frequently Billed Services</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topServicesScroll}>
                    {topServices.map(service => {
                      const isSelected = items.some(i => i.id === service.id);
                      return (
                        <TouchableOpacity
                          key={service.id}
                          style={[styles.serviceChip, isSelected && styles.serviceChipSelected]}
                          onPress={() => setItems([...items, service])}
                        >
                          <Text style={[styles.serviceChipText, isSelected && styles.serviceChipTextSelected]}>{service.name}</Text>
                          <Text style={[styles.serviceChipPrice, isSelected && styles.serviceChipPriceSelected]}>₹{service.price}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <TouchableOpacity style={styles.selectBtn} onPress={() => setShowServicePicker(true)}>
                <ShoppingCart size={18} color={Colors.primary} />
                <Text style={styles.selectBtnText}>Add Services / Products</Text>
                <ChevronRight size={18} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.selectBtn} onPress={() => setShowSubscriptionPicker(true)}>
                <CreditCard size={18} color={Colors.primary} />
                <Text style={styles.selectBtnText}>Add Subscription</Text>
                <ChevronRight size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {upiList.length > 0 && (
              <QuickPayment
                upiList={upiList}
                onPayment={handleQuickPayment}
              />
            )}
          </>
        }
        data={totalItems > 0 ? ['summary'] : []}
        renderItem={() => (
          <BillSummary
            items={items}
            subs={subs}
            customer={selectedCustomer!}
            offers={offers || []}
            customerSubscriptions={selectedCustomerSubscriptions}
            onAddQuantity={handleAddQuantity}
            onSubtractQuantity={handleSubtractQuantity}
            onRemoveItem={(index: number) => setItems(items.filter((_, i) => i !== index))}
            onRemoveSub={(index: number) => setSubs(subs.filter((_, i) => i !== index))}
            onPlaceOrder={handlePlaceOrder}
            upiList={upiList}
          />
        )}
        keyExtractor={item => item}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || (dataLoading && !customers.length)}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          totalItems === 0 && upiList.length === 0 ? (
            <View style={styles.emptyState}>
              <BarChart3 size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>Start a New Bill</Text>
              <Text style={styles.emptySubtitle}>Select items to begin</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.content}
      />

      <CustomerPicker
        visible={showCustomerPicker}
        customers={customers}
        onClose={() => setShowCustomerPicker(false)}
        onSelect={(c: Customer) => {
          setSelectedCustomer(c);
          setShowCustomerPicker(false);
        }}
        selectedCustomer={selectedCustomer}
      />

      <ServicePicker
        visible={showServicePicker}
        services={services}
        onClose={() => setShowServicePicker(false)}
        onAdd={(newItems: Service[]) => {
          setItems([...items, ...newItems]);
          setShowServicePicker(false);
        }}
      />

      <SubscriptionPicker
        visible={showSubscriptionPicker}
        subscriptions={subscriptions}
        onClose={() => setShowSubscriptionPicker(false)}
        onAdd={(newSubs: SubscriptionPlan[]) => {
          setSubs([...subs, ...newSubs]);
          setShowSubscriptionPicker(false);
        }}
      />

      <SaleComplete
        sale={completedSale}
        onClose={() => setCompletedSale(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.screen,
    flexGrow: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dangerLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.screen,
    marginTop: Spacing.sm,
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
    fontWeight: '600' as const,
    color: '#fff',
  },
  sectionTitle: {
    fontSize: FontSize.title,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  customerSection: {
    marginBottom: Spacing.xl,
  },
  billingSection: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearBtn: {
    fontSize: FontSize.body,
    color: Colors.danger,
    fontWeight: '500' as const,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  selectBtnText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  customerName: {
    fontSize: FontSize.md,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  customerMeta: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: FontSize.heading,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  topServicesWrapper: {
    marginBottom: Spacing.xl,
  },
  topServicesTitle: {
    fontSize: FontSize.md,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  topServicesScroll: {
    gap: Spacing.sm,
    paddingRight: Spacing.xl,
  },
  serviceChip: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceChipSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  serviceChipText: {
    fontSize: FontSize.body,
    fontWeight: '500' as const,
    color: Colors.primary,
    marginBottom: 2,
  },
  serviceChipTextSelected: {
    color: Colors.primary,
  },
  serviceChipPrice: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  serviceChipPriceSelected: {
    color: Colors.primary,
  },
  quickPayContainer: {
    marginTop: Spacing.lg,
  },
});
