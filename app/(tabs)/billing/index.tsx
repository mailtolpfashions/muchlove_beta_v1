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
  ShoppingBag,
  ShoppingCart,
  RefreshCw,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { Customer, Sale, Service, SubscriptionPlan, Offer, CustomerSubscription, Combo } from '@/types';
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

type FilterTab = 'services' | 'products' | 'combos' | null;
type ListItem = { type: 'service'; data: Service } | { type: 'combo'; data: Combo };

// ── Subscription date helpers ──
const getSubscriptionEndDate = (sub: CustomerSubscription): Date => {
  const start = new Date(sub.startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + sub.planDurationMonths);
  return end;
};

const getDaysUntilExpiry = (sub: CustomerSubscription): number => {
  const end = getSubscriptionEndDate(sub);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export default function BillingScreen() {
  const { user } = useAuth();
  const { customers, services, subscriptions, offers, combos, customerSubscriptions, sales, addSale, reload, dataLoading, loadError } = useData();
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
  const [activeTab, setActiveTab] = useState<FilterTab>(null);
  const [serviceSort, setServiceSort] = useState<SortOption>('recent');
  const searchRef = useRef<TextInput>(null);

  // Bill state
  const [items, setItems] = useState<Service[]>([]);
  const [subs, setSubs] = useState<SubscriptionPlan[]>([]);
  const [addedCombos, setAddedCombos] = useState<Combo[]>([]);
  const [completedSale, setCompletedSale] = useState<any>(null);

  const resetBill = () => {
    setSelectedCustomer(null);
    setItems([]);
    setSubs([]);
    setAddedCombos([]);
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
    setActiveTab(null);
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

  const handleAddCombo = (combo: Combo) => {
    setAddedCombos(prev => [...prev, combo]);
  };

  const handleRemoveCombo = (index: number) => {
    setAddedCombos(prev => prev.filter((_, i) => i !== index));
  };

  const handlePlaceOrder = async (total: number, discountAmt: number, discountPercent: number, upiId?: string) => {
    if (!user || !selectedCustomer) {
      showAlert('Error', 'Something went wrong');
      return;
    }
    const comboTotal = addedCombos.reduce((acc, c) => acc + c.comboPrice, 0);
    const subtotal = items.reduce((acc, i: Service) => acc + i.price, 0) + subs.reduce((acc, s: SubscriptionPlan) => acc + s.price, 0) + comboTotal;

    // Build combo items with proportionally adjusted prices
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

  // Service popularity map — ranked by how often they appear in past sales
  const popularityMap = useMemo(() => {
    const counts: Record<string, number> = {};
    sales.forEach((s: Sale) => {
      s.items?.forEach((item: any) => {
        if (item.itemId && (item.kind === 'service' || item.kind === 'product')) {
          counts[item.itemId] = (counts[item.itemId] || 0) + item.quantity;
        }
      });
    });
    return counts;
  }, [sales]);

  // Unified filtered list (services + combos mixed together)
  const filteredList = useMemo((): ListItem[] => {
    let baseServices: Service[];
    let baseCombos: Combo[];

    switch (activeTab) {
      case 'services':
        baseServices = services.filter(s => s.kind === 'service');
        baseCombos = [];
        break;
      case 'products':
        baseServices = services.filter(s => s.kind === 'product');
        baseCombos = [];
        break;
      case 'combos':
        baseServices = [];
        baseCombos = [...combos];
        break;
      default:
        // No tab selected — show everything
        baseServices = [...services];
        baseCombos = [...combos];
        break;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      baseServices = baseServices.filter(
        s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
      );
      baseCombos = baseCombos.filter(
        c => c.name.toLowerCase().includes(q) || c.items.some(i => i.serviceName.toLowerCase().includes(q)),
      );
    }

    // Build unified list
    let serviceItems: ListItem[] = baseServices.map(s => ({ type: 'service' as const, data: s }));
    let comboItems: ListItem[] = baseCombos.map(c => ({ type: 'combo' as const, data: c }));
    const all = [...serviceItems, ...comboItems];

    // Sort
    switch (serviceSort) {
      case 'a-z':
        all.sort((a, b) => a.data.name.localeCompare(b.data.name));
        break;
      case 'z-a':
        all.sort((a, b) => b.data.name.localeCompare(a.data.name));
        break;
      case 'recent':
        // "Recent" = most sold first (popularity), unsold items at the bottom
        all.sort((a, b) => {
          const countA = a.type === 'service' ? (popularityMap[a.data.id] || 0) : 0;
          const countB = b.type === 'service' ? (popularityMap[b.data.id] || 0) : 0;
          if (countA !== countB) return countB - countA;
          return a.data.name.localeCompare(b.data.name);
        });
        break;
    }

    return all;
  }, [activeTab, searchQuery, services, combos, serviceSort, popularityMap]);

  const comboItemCount = addedCombos.reduce((acc, c) => acc + c.items.length, 0);
  const totalItems = items.length + subs.length + comboItemCount;

  const runningTotal = useMemo(() => {
    return items.reduce((acc, i) => acc + i.price, 0) + subs.reduce((acc, s) => acc + s.price, 0) + addedCombos.reduce((acc, c) => acc + c.comboPrice, 0);
  }, [items, subs, addedCombos]);

  const selectedCustomerSubscriptions = useMemo(() => {
    if (!selectedCustomer || !customerSubscriptions) return [];
    return customerSubscriptions.filter(cs => cs.customerId === selectedCustomer.id);
  }, [selectedCustomer, customerSubscriptions]);

  // Active subscriptions (not expired)
  const activeCustomerSubs = useMemo(() => {
    return selectedCustomerSubscriptions.filter(cs => {
      const endDate = getSubscriptionEndDate(cs);
      return endDate >= new Date() && cs.status === 'active';
    });
  }, [selectedCustomerSubscriptions]);

  // Subscriptions in renewal window (within 15 days of expiry)
  const renewableSubs = useMemo(() => {
    return activeCustomerSubs.filter(cs => {
      const days = getDaysUntilExpiry(cs);
      return days <= 15 && days >= 0;
    });
  }, [activeCustomerSubs]);

  // Can add a subscription to this bill?
  const canAddSub = useMemo(() => {
    if (!selectedCustomer) return false;
    if (subs.length >= 1) return false; // max 1 per bill
    if (activeCustomerSubs.length >= 2) return false; // already has max 2
    if (activeCustomerSubs.length >= 1 && renewableSubs.length === 0) return false; // not in renewal window
    return true;
  }, [selectedCustomer, subs.length, activeCustomerSubs.length, renewableSubs.length]);

  const isRenewal = activeCustomerSubs.length > 0 && renewableSubs.length > 0;

  const getQty = useCallback((serviceId: string) => items.filter(i => i.id === serviceId).length, [items]);

  const tabs: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: 'services', label: 'Services', icon: <Scissors size={14} /> },
    { key: 'products', label: 'Products', icon: <Package size={14} /> },
    ...(combos.length > 0 ? [{ key: 'combos' as FilterTab, label: 'Combos', icon: <ShoppingBag size={14} /> }] : []),
  ];

  const handleTabPress = (key: FilterTab) => {
    // Tapping the active tab deselects it (back to showing all)
    setActiveTab(prev => prev === key ? null : key);
  };

  // Group items in cart by id for display
  const cartGrouped = useMemo(() => {
    const map: Record<string, { service: Service; qty: number }> = {};
    items.forEach(i => {
      if (map[i.id]) map[i.id].qty += 1;
      else map[i.id] = { service: i, qty: 1 };
    });
    return Object.values(map);
  }, [items]);

  const renderListItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'combo') {
      const combo = item.data;
      const origTotal = combo.items.reduce((s: number, ci: any) => s + ci.originalPrice, 0);
      const savedPercent = origTotal > 0 ? Math.round(((origTotal - combo.comboPrice) / origTotal) * 100) : 0;
      const alreadyAdded = addedCombos.filter(c => c.id === combo.id).length;
      return (
        <View style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <View style={styles.itemNameRow}>
              <Text style={styles.itemName} numberOfLines={1}>{capitalizeWords(combo.name)}</Text>
              <View style={styles.comboBadgeSmall}>
                <Text style={styles.comboBadgeSmallText}>Combo</Text>
              </View>
              {savedPercent > 0 && (
                <View style={styles.comboPickerBadge}>
                  <Text style={styles.comboPickerBadgeText}>{savedPercent}% OFF</Text>
                </View>
              )}
            </View>
            <Text style={styles.comboPickerItems} numberOfLines={1}>
              {combo.items.map(i => capitalizeWords(i.serviceName)).join(' + ')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <Text style={styles.comboPickerPrice}>{formatCurrency(combo.comboPrice)}</Text>
              {origTotal > combo.comboPrice && (
                <Text style={styles.comboPickerOrigPrice}>{formatCurrency(origTotal)}</Text>
              )}
            </View>
          </View>
          <View style={styles.itemActions}>
            {alreadyAdded > 0 ? (
              <>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => {
                    const idx = addedCombos.findIndex(c => c.id === combo.id);
                    if (idx > -1) handleRemoveCombo(idx);
                  }}
                >
                  <Minus size={14} color={Colors.danger} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{alreadyAdded}</Text>
                <TouchableOpacity
                  style={[styles.qtyBtn, styles.qtyBtnAdd]}
                  onPress={() => handleAddCombo(combo)}
                >
                  <Plus size={14} color={Colors.primary} />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.qtyBtn, styles.qtyBtnAdd]}
                onPress={() => handleAddCombo(combo)}
              >
                <Plus size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    // Service row
    const service = item.data;
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
  }, [getQty, items, addedCombos]);

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
              {/* Top row: info + close */}
              <View style={styles.customerCardTop}>
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
                      {activeCustomerSubs.length > 0 && (
                        <View style={styles.subscriptionBadge}>
                          <CreditCard size={10} color={Colors.info} />
                          <Text style={styles.subscriptionBadgeText}>Subscribed</Text>
                        </View>
                      )}
                      {renewableSubs.length > 0 && (
                        <View style={styles.renewIconBadge}>
                          <RefreshCw size={10} color={Colors.warning} />
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

              {/* Renewal notice */}
              {renewableSubs.length > 0 && (
                <View style={styles.renewalNotice}>
                  {renewableSubs.map(rs => {
                    const daysLeft = getDaysUntilExpiry(rs);
                    return (
                      <View key={rs.id} style={styles.renewalNoticeRow}>
                        <RefreshCw size={12} color={Colors.warning} />
                        <Text style={styles.renewalNoticeText}>
                          {capitalizeWords(rs.planName)} {daysLeft > 0 ? `expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : 'has expired'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Subscription added to cart */}
              {subs.length > 0 && (
                <View style={styles.cardSubSection}>
                  {subs.map((sub, idx) => (
                    <View key={`card-sub-${idx}`} style={styles.cardSubRow}>
                      <CreditCard size={12} color={Colors.info} />
                      <Text style={styles.cardSubName} numberOfLines={1}>{capitalizeWords(sub.name)}</Text>
                      <Text style={styles.cardSubPrice}>{formatCurrency(sub.price)}</Text>
                      <TouchableOpacity onPress={() => setSubs(subs.filter((_, i) => i !== idx))}>
                        <X size={14} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Add / Renew subscription button */}
              {canAddSub && (
                <TouchableOpacity
                  style={styles.addSubInCardBtn}
                  onPress={() => setShowSubscriptionPicker(true)}
                >
                  {isRenewal ? (
                    <RefreshCw size={14} color={Colors.info} />
                  ) : (
                    <CreditCard size={14} color={Colors.info} />
                  )}
                  <Text style={styles.addSubInCardText}>
                    {isRenewal ? 'Renew Subscription' : 'Add Subscription'}
                  </Text>
                  <ChevronRight size={14} color={Colors.info} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowCustomerPicker(true)}>
              <Users size={18} color={Colors.primary} />
              <Text style={styles.actionBtnText}>Select or Add Customer</Text>
              <ChevronRight size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}
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
              {addedCombos.map((combo, idx) => {
                const origTotal = combo.items.reduce((s: number, ci: any) => s + ci.originalPrice, 0);
                const savings = origTotal - combo.comboPrice;
                return (
                <View
                  key={`combo-${idx}`}
                  style={[styles.cartRow, styles.cartRowBorder]}
                >
                  <View style={styles.cartRowInfo}>
                    <View style={styles.itemNameRow}>
                      <Text style={styles.cartRowName} numberOfLines={1}>{capitalizeWords(combo.name)}</Text>
                      <View style={styles.comboBadgeSmall}>
                        <Text style={styles.comboBadgeSmallText}>combo</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Text style={styles.cartRowPrice}>{formatCurrency(combo.comboPrice)}</Text>
                      {origTotal > combo.comboPrice && (
                        <Text style={styles.cartRowOrigPrice}>{formatCurrency(origTotal)}</Text>
                      )}
                    </View>
                    {savings > 0 && (
                      <Text style={styles.cartRowSavings}>You save {formatCurrency(savings)}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveCombo(idx)}>
                    <X size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Bill summary inline */}
        {totalItems > 0 && selectedCustomer && (
          <View style={styles.summarySection}>
            <BillSummary
              items={items}
              subs={subs}
              addedCombos={addedCombos}
              customer={selectedCustomer}
              offers={offers || []}
              customerSubscriptions={selectedCustomerSubscriptions}
              onAddQuantity={handleAddQuantity}
              onSubtractQuantity={handleSubtractQuantity}
              onRemoveItem={(index: number) => setItems(items.filter((_, i) => i !== index))}
              onRemoveSub={(index: number) => setSubs(subs.filter((_, i) => i !== index))}
              onRemoveCombo={handleRemoveCombo}
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
              behavior="padding"
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

              {/* Sort pills */}
              <View style={styles.sortRow}>
                <SortPills value={serviceSort} onChange={setServiceSort} />
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
                        onPress={() => handleTabPress(tab.key)}
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

              {/* Filtered list */}
              <FlatList
                data={filteredList}
                keyExtractor={(item) => `${item.type}-${item.data.id}`}
                renderItem={renderListItem}
                initialNumToRender={15}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews
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
        maxSelection={1}
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
  customerCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  customerMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  renewIconBadge: {
    backgroundColor: Colors.warningLight,
    padding: 3,
    borderRadius: 10,
  },
  renewalNotice: {
    marginTop: 8,
    gap: 4,
  },
  renewalNoticeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  renewalNoticeText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontWeight: '500' as const,
    flex: 1,
  },
  cardSubSection: {
    marginTop: 8,
    gap: 4,
  },
  cardSubRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardSubName: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '500' as const,
    color: Colors.info,
  },
  cardSubPrice: {
    fontSize: FontSize.sm,
    fontWeight: '600' as const,
    color: Colors.info,
  },
  addSubInCardBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  addSubInCardText: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '600' as const,
    color: Colors.info,
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
  },
  cartRowOrigPrice: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  cartRowSavings: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '600',
    marginTop: 1,
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
  // Combo styles
  comboBadgeSmall: {
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  comboBadgeSmallText: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.info,
    textTransform: 'uppercase',
  },
  comboPickerBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  comboPickerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },
  comboPickerItems: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  comboPickerPrice: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  comboPickerOrigPrice: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
});
