import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Search,
  Users,
  X,
  ChevronRight,
  UserCheck,
  CreditCard,
  Sparkles,
  Plus,
  Minus,
  Package,
  Scissors,
  Star,
  ShoppingBag,
  ShoppingCart,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { Customer, Sale, Service, SubscriptionPlan, Offer, CustomerSubscription } from '@/types';
import CustomerPicker from '@/components/CustomerPicker';
import SubscriptionPicker from '@/components/SubscriptionPicker';
import BillSummary from '@/components/BillSummary';
import QuickPayment from '@/components/QuickPayment';
import SaleComplete from '@/components/SaleComplete';
import { useAuth } from '@/providers/AuthProvider';
import { usePayment } from '@/providers/PaymentProvider';
import { formatCurrency, capitalizeWords } from '@/utils/format';
import { randomUUID } from 'expo-crypto';
import { useAlert } from '@/providers/AlertProvider';
import { useOfflineSync } from '@/providers/OfflineSyncProvider';
import SortPills, { SortOption } from '@/components/SortPills';

type FilterTab = 'popular' | 'services' | 'products';

export default function BillingScreen() {
  const { user } = useAuth();
  const { customers, services, subscriptions, offers, customerSubscriptions, sales, addSale, reload, dataLoading, loadError } = useData();
  const { upiList } = usePayment();
  const { showAlert, showConfirm } = useAlert();
  const { refreshPendingCount } = useOfflineSync();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showSubscriptionPicker, setShowSubscriptionPicker] = useState(false);
  const [showQuickPayment, setShowQuickPayment] = useState(false);

  // Service picker overlay state
  const [showServiceList, setShowServiceList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('popular');
  const [serviceSort, setServiceSort] = useState<SortOption>('a-z');
  const searchRef = useRef<TextInput>(null);

  // Bill state
  const [items, setItems] = useState<Service[]>([]);
  const [subs, setSubs] = useState<SubscriptionPlan[]>([]);
  const [completedSale, setCompletedSale] = useState<any>(null);

  const resetBill = () => {
    setSelectedCustomer(null);
    setItems([]);
    setSubs([]);
  };

  const confirmClearAll = () => {
    showConfirm(
      'Clear Bill',
      'Are you sure you want to remove all items?',
      resetBill,
      'Clear',
    );
  };

  const openServiceList = () => {
    setSearchQuery('');
    setActiveTab('popular');
    setShowServiceList(true);
  };

  const closeServiceList = () => {
    setShowServiceList(false);
    setSearchQuery('');
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
      showAlert('Error', 'Something went wrong');
      return;
    }
    const subtotal = items.reduce((acc, i: Service) => acc + i.price, 0) + subs.reduce((acc, s: SubscriptionPlan) => acc + s.price, 0);

    const sale = {
      customer_id: selectedCustomer.id,
      customer_name: selectedCustomer.name,
      employee_id: user.id,
      employee_name: user.name,
      total,
      subtotal,
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
      if (result?._offline) refreshPendingCount();
    } catch (error) {
      console.error(error);
      showAlert('Error', 'Failed to place order');
    }
  };

  const handleQuickPayment = async (amount: number, upiId: string, note: string, method: 'cash' | 'gpay') => {
    if (!user) {
      showAlert('Error', 'You must be logged in to do this.');
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
      payment_method: method,
      type: 'other',
    };

    try {
      const result = await addSale(sale as any);
      setShowQuickPayment(false);
      setCompletedSale(result);
      if (result?._offline) refreshPendingCount();
    } catch (error) {
      console.error(error);
      showAlert('Error', 'Failed to record quick payment');
    }
  };

  // Popular services ranked by sales frequency
  const popularServices = useMemo(() => {
    const serviceCounts: Record<string, number> = {};
    sales.forEach((s: Sale) => {
      s.items?.forEach((item: any) => {
        if (item.itemId && (item.kind === 'service' || item.kind === 'product')) {
          serviceCounts[item.itemId] = (serviceCounts[item.itemId] || 0) + item.quantity;
        }
      });
    });

    const sorted = Object.keys(serviceCounts).sort((a, b) => serviceCounts[b] - serviceCounts[a]);
    const top = sorted
      .map(id => services.find(s => s.id === id))
      .filter((s): s is Service => s !== undefined);

    // Fill remaining with newest services
    if (top.length < services.length) {
      const remaining = services.filter(s => !top.some(t => t.id === s.id));
      top.push(...remaining);
    }
    return top;
  }, [sales, services]);

  // Filtered list based on tab + search + sort
  const filteredList = useMemo(() => {
    let base: Service[];
    switch (activeTab) {
      case 'popular':
        base = popularServices;
        break;
      case 'services':
        base = services.filter(s => s.kind === 'service');
        break;
      case 'products':
        base = services.filter(s => s.kind === 'product');
        break;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter(
        s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
      );
    }

    // Sort (skip for popular tab if no explicit sort)
    if (activeTab !== 'popular' || serviceSort !== 'a-z') {
      const sorted = [...base];
      switch (serviceSort) {
        case 'a-z':
          sorted.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'z-a':
          sorted.sort((a, b) => b.name.localeCompare(a.name));
          break;
        case 'recent':
          sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          break;
      }
      return sorted;
    }

    return base;
  }, [activeTab, searchQuery, popularServices, services, serviceSort]);

  const totalItems = items.length + subs.length;

  const runningTotal = useMemo(() => {
    return items.reduce((acc, i) => acc + i.price, 0) + subs.reduce((acc, s) => acc + s.price, 0);
  }, [items, subs]);

  const listRef = useRef<FlatList>(null);

  const selectedCustomerSubscriptions = selectedCustomer && customerSubscriptions
    ? customerSubscriptions.filter(cs => cs.customerId === selectedCustomer.id)
    : [];

  const getQty = useCallback((serviceId: string) => items.filter(i => i.id === serviceId).length, [items]);

  const tabs: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: 'popular', label: 'Popular', icon: <Star size={14} /> },
    { key: 'services', label: 'Services', icon: <Scissors size={14} /> },
    { key: 'products', label: 'Products', icon: <Package size={14} /> },
  ];

  // Group items in cart by id for display
  const cartGrouped = useMemo(() => {
    const map: Record<string, { service: Service; qty: number }> = {};
    items.forEach(i => {
      if (map[i.id]) map[i.id].qty += 1;
      else map[i.id] = { service: i, qty: 1 };
    });
    return Object.values(map);
  }, [items]);

  const renderServiceRow = useCallback(({ item: service }: { item: Service }) => {
    const qty = getQty(service.id);
    return (
      <View style={styles.itemRow}>
        <View style={styles.itemInfo}>
          <View style={styles.itemNameRow}>
            <Text style={styles.itemName} numberOfLines={1}>{capitalizeWords(service.name)}</Text>
            <View style={[styles.kindBadge, service.kind === 'product' && styles.kindBadgeProduct]}>
              <Text style={[styles.kindBadgeText, service.kind === 'product' && styles.kindBadgeTextProduct]}>
                {capitalizeWords(service.kind)}
              </Text>
            </View>
          </View>
          <Text style={styles.itemPrice}>{formatCurrency(service.price)}</Text>
        </View>
        <View style={styles.itemActions}>
          {qty > 0 ? (
            <>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => handleSubtractQuantity(service)}
              >
                <Minus size={14} color={Colors.danger} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{qty}</Text>
              <TouchableOpacity
                style={[styles.qtyBtn, styles.qtyBtnAdd]}
                onPress={() => handleAddQuantity(service)}
              >
                <Plus size={14} color={Colors.primary} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.qtyBtn, styles.qtyBtnAdd]}
              onPress={() => handleAddQuantity(service)}
            >
              <Plus size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [getQty, items]);

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

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || (dataLoading && !customers.length)}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Customer & Subscription bar */}
        <View style={styles.customerSection}>
          {selectedCustomer ? (
            <View style={styles.customerCard}>
              <View style={styles.customerInfo}>
                <UserCheck size={18} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <View style={styles.customerNameRow}>
                    <Text style={styles.customerName}>{capitalizeWords(selectedCustomer.name)}</Text>
                    {selectedCustomer.isStudent && (
                      <View style={styles.studentBadge}>
                        <Text style={styles.studentBadgeText}>Student</Text>
                      </View>
                    )}
                    {selectedCustomerSubscriptions.length > 0 && (
                      <View style={styles.subscriptionBadge}>
                        <CreditCard size={10} color={Colors.info} />
                        <Text style={styles.subscriptionBadgeText}>Subscribed</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.customerMeta}>{selectedCustomer.mobile}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                <X size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowCustomerPicker(true)}>
              <Users size={18} color={Colors.primary} />
              <Text style={styles.actionBtnText}>Select or Add Customer</Text>
              <ChevronRight size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.subscriptionBtn} onPress={() => setShowSubscriptionPicker(true)}>
            <CreditCard size={16} color={Colors.info} />
            <Text style={styles.subscriptionBtnText}>Add Subscription</Text>
            {subs.length > 0 && (
              <View style={styles.subCountBadge}>
                <Text style={styles.subCountBadgeText}>{subs.length}</Text>
              </View>
            )}
            <ChevronRight size={14} color={Colors.info} />
          </TouchableOpacity>
        </View>

        {/* Add items button */}
        <View style={styles.addSection}>
          <TouchableOpacity style={styles.addServiceBtn} onPress={openServiceList}>
            <ShoppingCart size={20} color={Colors.surface} />
            <Text style={styles.addServiceBtnText}>Add Services / Products</Text>
          </TouchableOpacity>
        </View>

        {/* Cart items */}
        {totalItems > 0 && (
          <View style={styles.cartSection}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>Cart ({totalItems})</Text>
              <TouchableOpacity onPress={confirmClearAll}>
                <Text style={styles.cartClear}>Clear all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cartCard}>
              {cartGrouped.map(({ service, qty }, idx) => (
                <View
                  key={service.id}
                  style={[styles.cartRow, idx < cartGrouped.length - 1 && styles.cartRowBorder]}
                >
                  <View style={styles.cartRowInfo}>
                    <Text style={styles.cartRowName} numberOfLines={1}>{capitalizeWords(service.name)}</Text>
                    <Text style={styles.cartRowPrice}>{formatCurrency(service.price)} × {qty}</Text>
                  </View>
                  <View style={styles.cartRowActions}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => handleSubtractQuantity(service)}
                    >
                      <Minus size={14} color={Colors.danger} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{qty}</Text>
                    <TouchableOpacity
                      style={[styles.qtyBtn, styles.qtyBtnAdd]}
                      onPress={() => handleAddQuantity(service)}
                    >
                      <Plus size={14} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {subs.map((sub, idx) => (
                <View
                  key={`sub-${idx}`}
                  style={[styles.cartRow, (cartGrouped.length > 0 || idx < subs.length - 1) && styles.cartRowBorder]}
                >
                  <View style={styles.cartRowInfo}>
                    <View style={styles.itemNameRow}>
                      <Text style={styles.cartRowName} numberOfLines={1}>{capitalizeWords(sub.name)}</Text>
                      <View style={styles.subBadge}>
                        <Text style={styles.subBadgeText}>subscription</Text>
                      </View>
                    </View>
                    <Text style={styles.cartRowPrice}>{formatCurrency(sub.price)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSubs(subs.filter((_, i) => i !== idx))}>
                    <X size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bill summary inline */}
        {totalItems > 0 && selectedCustomer && (
          <View style={styles.summarySection}>
            <BillSummary
              items={items}
              subs={subs}
              customer={selectedCustomer}
              offers={offers || []}
              customerSubscriptions={selectedCustomerSubscriptions}
              onAddQuantity={handleAddQuantity}
              onSubtractQuantity={handleSubtractQuantity}
              onRemoveItem={(index: number) => setItems(items.filter((_, i) => i !== index))}
              onRemoveSub={(index: number) => setSubs(subs.filter((_, i) => i !== index))}
              onPlaceOrder={handlePlaceOrder}
              upiList={upiList}
            />
          </View>
        )}

        {/* Empty state */}
        {totalItems === 0 && (
          <View style={styles.emptyState}>
            <Scissors size={48} color={Colors.primaryLight} />
            <Text style={styles.emptyTitle}>Start a New Bill</Text>
            <Text style={styles.emptySubtitle}>Tap "Add Services" to begin</Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky footer when items selected but no customer yet */}
      {totalItems > 0 && !selectedCustomer && (
        <View style={styles.stickyFooter}>
          <View style={styles.footerInfo}>
            <View style={styles.footerBadge}>
              <ShoppingBag size={14} color={Colors.surface} />
              <Text style={styles.footerBadgeText}>{totalItems}</Text>
            </View>
            <View>
              <Text style={styles.footerItemCount}>{totalItems} item{totalItems !== 1 ? 's' : ''}</Text>
              <Text style={styles.footerTotal}>{formatCurrency(runningTotal)}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() => setShowCustomerPicker(true)}
          >
            <Text style={styles.footerBtnText}>Select Customer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Payment FAB */}
      {upiList.length > 0 && totalItems === 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowQuickPayment(true)}
          activeOpacity={0.85}
        >
          <Sparkles size={24} color={Colors.surface} />
        </TouchableOpacity>
      )}

      {/* ===== SERVICE PICKER MODAL ===== */}
      <Modal
        visible={showServiceList}
        animationType="slide"
        transparent
        onRequestClose={closeServiceList}
      >
        <View style={styles.serviceModalOverlay}>
          <View style={styles.serviceModalContent}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              {/* Modal header — same as CustomerPicker */}
              <View style={styles.serviceModalHeader}>
                <Text style={styles.serviceModalTitle}>Select Services / Products</Text>
                <TouchableOpacity onPress={closeServiceList}>
                  <X size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Search bar */}
              <View style={styles.serviceSearchBar}>
                <Search size={16} color={Colors.textTertiary} />
                <TextInput
                  ref={searchRef}
                  style={styles.serviceSearchInput}
                  placeholder="Search services or products..."
                  placeholderTextColor={Colors.textTertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color={Colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Category tabs */}
              <View style={styles.tabSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
                  {tabs.map(tab => {
                    const active = activeTab === tab.key;
                    return (
                      <TouchableOpacity
                        key={tab.key}
                        style={[styles.tabChip, active && styles.tabChipActive]}
                        onPress={() => setActiveTab(tab.key)}
                      >
                        {React.cloneElement(tab.icon as React.ReactElement<any>, {
                          color: active ? Colors.surface : Colors.textSecondary,
                        })}
                        <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Sort pills */}
              <View style={styles.sortRow}>
                <SortPills value={serviceSort} onChange={setServiceSort} />
              </View>

              {/* Filtered list */}
              <FlatList
                data={filteredList}
                keyExtractor={(item) => item.id}
                renderItem={renderServiceRow}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Search size={40} color={Colors.textTertiary} />
                    <Text style={styles.emptyTitle}>No items found</Text>
                    <Text style={styles.emptySubtitle}>Try a different search or category</Text>
                  </View>
                }
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
              />

              {/* Modal sticky footer showing cart count */}
              {totalItems > 0 && (
                <View style={styles.serviceModalFooter}>
                  <View style={styles.footerInfo}>
                    <View style={styles.footerBadge}>
                      <ShoppingBag size={14} color={Colors.surface} />
                      <Text style={styles.footerBadgeText}>{totalItems}</Text>
                    </View>
                    <View>
                      <Text style={styles.footerItemCount}>{totalItems} item{totalItems !== 1 ? 's' : ''}</Text>
                      <Text style={styles.footerTotal}>{formatCurrency(runningTotal)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.footerBtn} onPress={closeServiceList}>
                    <Text style={styles.footerBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      {/* Other modals */}
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

      <QuickPayment
        visible={showQuickPayment}
        upiList={upiList}
        onPayment={handleQuickPayment}
        onClose={() => setShowQuickPayment(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mainScroll: {
    flex: 1,
  },
  mainContent: {
    flexGrow: 1,
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
    color: Colors.surface,
  },

  /* Customer */
  customerSection: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  actionBtnText: {
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
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  customerNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  customerName: {
    fontSize: FontSize.md,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  studentBadge: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  studentBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  subscriptionBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  subscriptionBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600' as const,
    color: Colors.info,
  },
  subscriptionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.infoLight,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  subscriptionBtnText: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '600' as const,
    color: Colors.info,
  },
  subCountBadge: {
    backgroundColor: Colors.info,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center' as const,
  },
  subCountBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700' as const,
    color: Colors.surface,
  },
  customerMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },

  /* Add items */
  addSection: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  addServiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  addServiceBtnText: {
    fontSize: FontSize.title,
    fontWeight: '700' as const,
    color: Colors.surface,
  },

  /* Cart */
  cartSection: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.lg,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cartTitle: {
    fontSize: FontSize.title,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  cartClear: {
    fontSize: FontSize.body,
    fontWeight: '500' as const,
    color: Colors.danger,
  },
  cartCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
  },
  cartRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  cartRowInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  cartRowName: {
    fontSize: FontSize.md,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  cartRowPrice: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cartRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  subBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: Colors.infoLight,
  },
  subBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600' as const,
    color: Colors.info,
  },

  /* Summary */
  summarySection: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.lg,
  },

  /* Empty */
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
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

  /* Footer */
  stickyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    elevation: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  footerBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '700' as const,
    color: Colors.surface,
  },
  footerItemCount: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  footerTotal: {
    fontSize: FontSize.title,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  footerBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  footerBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600' as const,
    color: Colors.surface,
  },

  /* FAB */
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  /* ===== SERVICE PICKER MODAL STYLES ===== */
  serviceModalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  serviceModalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    height: '85%',
    paddingTop: Spacing.modal,
  },
  serviceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.modal,
  },
  serviceModalTitle: {
    fontSize: FontSize.heading,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  serviceSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.modal,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    height: 44,
  },
  serviceSearchInput: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.text,
    paddingVertical: 0,
  },
  serviceModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    elevation: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  /* Tab chips */
  tabSection: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  sortRow: {
    paddingHorizontal: Spacing.modal,
    paddingVertical: Spacing.sm,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.modal,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  tabChipActive: {
    backgroundColor: Colors.primary,
  },
  tabChipText: {
    fontSize: FontSize.sm,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabChipTextActive: {
    color: Colors.surface,
  },

  /* Item rows (in modal) */
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.modal,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  itemInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  itemName: {
    fontSize: FontSize.md,
    fontWeight: '500' as const,
    color: Colors.text,
    flexShrink: 1,
  },
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
  },
  kindBadgeProduct: {
    backgroundColor: Colors.accentLight,
  },
  kindBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  kindBadgeTextProduct: {
    color: Colors.accent,
  },
  itemPrice: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  qtyBtnAdd: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  qtyText: {
    fontSize: FontSize.md,
    fontWeight: '700' as const,
    color: Colors.text,
    minWidth: 18,
    textAlign: 'center',
  },
});
