import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShoppingBag } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useBilling } from '@/providers/BillingProvider';
import { useData } from '@/providers/DataProvider';
import { useAuth } from '@/providers/AuthProvider';
import { usePayment } from '@/providers/PaymentProvider';
import { useAlert } from '@/providers/AlertProvider';
import { useOfflineSync } from '@/providers/OfflineSyncProvider';
import { CustomerSubscription } from '@/types';
import { randomUUID } from 'expo-crypto';
import { capitalizeWords, formatCurrency } from '@/utils/format';
import BillSummary from '@/components/BillSummary';
import SaleComplete from '@/components/SaleComplete';

// ── Subscription date helpers ──
const getSubscriptionEndDate = (sub: CustomerSubscription): Date => {
  const start = new Date(sub.startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + sub.planDurationMonths);
  return end;
};

export default function CheckoutScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { offers, customerSubscriptions, addSale } = useData();
  const { upiList } = usePayment();
  const { showAlert } = useAlert();
  const { refreshPendingCount } = useOfflineSync();

  const {
    items,
    setItems,
    subs,
    setSubs,
    addedCombos,
    selectedCustomer,
    handleRemoveCombo,
    resetBill,
    completedSale,
    setCompletedSale,
  } = useBilling();

  const selectedCustomerSubscriptions = useMemo(() => {
    if (!selectedCustomer || !customerSubscriptions) return [];
    return customerSubscriptions.filter(cs => cs.customerId === selectedCustomer.id);
  }, [selectedCustomer, customerSubscriptions]);

  const comboItemCount = addedCombos.reduce((acc, c) => acc + c.items.length, 0);
  const totalItems = items.length + subs.length + comboItemCount;

  const runningTotal = useMemo(() => {
    return items.reduce((acc, i) => acc + i.price, 0) +
      subs.reduce((acc, s) => acc + s.price, 0) +
      addedCombos.reduce((acc, c) => acc + c.comboPrice, 0);
  }, [items, subs, addedCombos]);

  const handlePlaceOrder = async (total: number, discountAmt: number, discountPercent: number, upiId?: string) => {
    if (!user || !selectedCustomer) {
      showAlert('Error', 'Something went wrong');
      return;
    }
    const comboTotal = addedCombos.reduce((acc, c) => acc + c.comboPrice, 0);
    const subtotal = items.reduce((acc, i) => acc + i.price, 0) +
      subs.reduce((acc, s) => acc + s.price, 0) + comboTotal;

    const comboSaleItems = addedCombos.flatMap(combo => {
      const origTotal = combo.items.reduce((s, ci) => s + ci.originalPrice, 0);
      return combo.items.map(ci => ({
        id: randomUUID(),
        itemId: ci.serviceId,
        itemName: `${ci.serviceName} (${combo.name})`,
        itemCode: 'COMBO',
        price: origTotal > 0 ? Math.round((ci.originalPrice / origTotal) * combo.comboPrice) : combo.comboPrice,
        originalPrice: ci.originalPrice,
        quantity: 1,
        kind: ci.serviceKind,
      }));
    });

    const sale = {
      customer_id: selectedCustomer.id,
      customer_name: selectedCustomer.name,
      employee_id: user.id,
      employee_name: user.name,
      total,
      subtotal,
      discount_amount: discountAmt,
      discount_percent: discountPercent,
      items: [
        ...items.map(i => ({
          id: randomUUID(),
          itemId: i.id,
          itemName: i.name,
          itemCode: i.code,
          price: i.price,
          quantity: 1,
          kind: i.kind,
        })),
        ...comboSaleItems,
      ],
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
      setCompletedSale(result);
      resetBill();
      if (result?._offline) refreshPendingCount();
    } catch (error) {
      console.error(error);
      showAlert('Error', 'Failed to place order');
    }
  };

  const handleSaleCompleteClose = () => {
    setCompletedSale(null);
    router.back();
  };

  // Guard: if cart is empty (e.g. after placing order), go back
  if (totalItems === 0 && !completedSale) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <ShoppingBag size={48} color={Colors.primaryLight} />
          <Text style={styles.emptyTitle}>Cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add items to proceed with checkout</Text>
          <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}>
            <Text style={styles.goBackBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerRight}>
          <View style={styles.itemCountBadge}>
            <Text style={styles.itemCountText}>{totalItems} item{totalItems !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      </View>

      {/* Customer info bar */}
      {selectedCustomer && (
        <View style={styles.customerBar}>
          <Text style={styles.customerBarName}>{capitalizeWords(selectedCustomer.name)}</Text>
          <Text style={styles.customerBarMobile}>{selectedCustomer.mobile}</Text>
        </View>
      )}

      {/* Bill Summary */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentInner}
      >
        <BillSummary
          items={items}
          subs={subs}
          addedCombos={addedCombos}
          customer={selectedCustomer}
          offers={offers || []}
          customerSubscriptions={selectedCustomerSubscriptions}
          onRemoveItem={(index: number) => setItems(prev => prev.filter((_, i) => i !== index))}
          onRemoveSub={(index: number) => setSubs(prev => prev.filter((_, i) => i !== index))}
          onRemoveCombo={handleRemoveCombo}
          onPlaceOrder={handlePlaceOrder}
          upiList={upiList}
        />
      </ScrollView>

      {/* Sale Complete overlay */}
      <SaleComplete
        sale={completedSale}
        onClose={handleSaleCompleteClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.text,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  itemCountBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  itemCountText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  customerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingVertical: 10,
    backgroundColor: Colors.primaryLight,
  },
  customerBarName: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.primary,
  },
  customerBarMobile: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    opacity: 0.7,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.md,
    paddingBottom: 40,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: FontSize.heading,
    fontWeight: '600',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  goBackBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: BorderRadius.lg,
  },
  goBackBtnText: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.surface,
  },
});
