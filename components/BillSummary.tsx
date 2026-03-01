import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, useWindowDimensions
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Trash2, CreditCard, X, Wallet, Smartphone, Percent, Star, ArrowLeft, CheckCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, Spacing } from '@/constants/typography';
import { Service, SubscriptionPlan, UpiData, Customer, Offer, CustomerSubscription, Combo } from '@/types';
import { formatCurrency, capitalizeWords } from '@/utils/format';
import { useAlert } from '@/providers/AlertProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineSync } from '@/providers/OfflineSyncProvider';
import { useData } from '@/providers/DataProvider';

interface BillSummaryProps {
  items: Service[];
  subs: SubscriptionPlan[];
  addedCombos?: Combo[];
  customer: Customer | null;
  offers: Offer[];
  customerSubscriptions: CustomerSubscription[];
  onRemoveItem: (index: number) => void;
  onRemoveSub: (index: number) => void;
  onRemoveCombo?: (index: number) => void;
  onPlaceOrder: (total: number, discountAmount: number, discountPercent: number, upiId?: string) => void;
  upiList: UpiData[];
}

function BillSummary({
  items,
  subs,
  addedCombos = [],
  customer,
  offers,
  customerSubscriptions,
  onRemoveItem,
  onRemoveSub,
  onRemoveCombo,
  onPlaceOrder,
  upiList,
}: BillSummaryProps) {
  const { showAlert } = useAlert();
  const { width: screenWidth } = useWindowDimensions();
  const modalWidth = screenWidth * 0.8;
  const insets = useSafeAreaInsets();
  const { isOffline } = useOfflineSync();
  const { offlineSalesEnabled, subscriptions } = useData();
  const [paymentStep, setPaymentStep] = useState<'closed' | 'method' | 'qr'>('closed');
  const [activeUpiIndex, setActiveUpiIndex] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'upi'>('upi');

  const { serviceDiscount, serviceDiscountPercent, serviceDiscountLabel, subsDiscount, subsDiscountPercent, subsDiscountLabel, total, totalDiscount } = useMemo(() => {
    const subtotalServices = items.reduce((acc, i) => acc + i.price, 0);
    const subtotalSubs = subs.reduce((acc, s) => acc + s.price, 0);
    const subtotalCombos = addedCombos.reduce((acc, c) => acc + c.comboPrice, 0);

    const subtotalActualServices = items
      .filter(i => i.kind === 'service')
      .reduce((acc, i) => acc + i.price, 0);

    let serviceDiscount = 0;
    let serviceDiscountPercent = 0;
    let serviceDiscountLabel = '';
    let subsDiscount = 0;
    let subsDiscountPercent = 0;
    let subsDiscountLabel = '';

    const isPurchasingSubscription = subs.length > 0;
    const hasActiveSubscription = customerSubscriptions.some((sub: CustomerSubscription) => sub.status === 'active');

    if (customer) {
      // ── Service discounts ──
      if (items.length > 0) {
        if (hasActiveSubscription) {
          // Look up the active subscription's plan for discount settings
          const activeSub = customerSubscriptions.find((sub: CustomerSubscription) => sub.status === 'active');
          const activePlan = activeSub ? subscriptions.find((p: SubscriptionPlan) => p.id === activeSub.planId) : null;
          const planDiscountPercent = activePlan?.discountPercent ?? 30;
          const planMaxCartValue = activePlan?.maxCartValue ?? 2000;

          if (subtotalActualServices <= planMaxCartValue) {
            serviceDiscountPercent = planDiscountPercent;
          } else {
            serviceDiscountPercent = 0;
          }
          serviceDiscount = subtotalActualServices * (serviceDiscountPercent / 100);
          serviceDiscountLabel = serviceDiscountPercent > 0
            ? `Subscription Discount (${serviceDiscountPercent}%)`
            : '';
        } else {
          // Find best visit-based or student offer that applies to services
          const serviceOffers = offers.filter(o => {
            const appliesToServices = !o.appliesTo || o.appliesTo === 'services' || o.appliesTo === 'both';
            if (!appliesToServices) return false;
            if (o.studentOnly && !customer.isStudent) return false;
            if (o.visitCount != null && o.visitCount >= 0) {
              return o.visitCount === 0 ? customer.visitCount === 0 : customer.visitCount >= o.visitCount;
            }
            if (o.visitCount === -1) {
              return customer.isStudent;
            }
            return false;
          });

          const bestServiceOffer = serviceOffers.sort((a, b) => b.percent - a.percent)[0];
          if (bestServiceOffer) {
            serviceDiscountPercent = bestServiceOffer.percent;
            serviceDiscount = subtotalActualServices * (serviceDiscountPercent / 100);
            serviceDiscountLabel = `${bestServiceOffer.name} (${serviceDiscountPercent}%)`;
          }
        }
      }

      // ── Subscription discounts ──
      if (isPurchasingSubscription) {
        const subsOffers = offers.filter(o => {
          const appliesToSubs = o.appliesTo === 'subscriptions' || o.appliesTo === 'both';
          if (!appliesToSubs) return false;
          if (o.studentOnly && !customer.isStudent) return false;
          // Student offer flag or any offer targeting subs
          if (o.visitCount === -1) return customer.isStudent;
          if (o.visitCount != null && o.visitCount >= 0) {
            return o.visitCount === 0 ? customer.visitCount === 0 : customer.visitCount >= o.visitCount;
          }
          return false;
        });

        const bestSubsOffer = subsOffers.sort((a, b) => b.percent - a.percent)[0];
        if (bestSubsOffer) {
          subsDiscountPercent = bestSubsOffer.percent;
          subsDiscount = subtotalSubs * (subsDiscountPercent / 100);
          subsDiscountLabel = `${bestSubsOffer.name} (${subsDiscountPercent}%)`;
        }
      }
    }

    const totalDiscount = serviceDiscount + subsDiscount;
    const total = subtotalServices - serviceDiscount + subtotalCombos + subtotalSubs - subsDiscount;
    return { serviceDiscount, serviceDiscountPercent, serviceDiscountLabel, subsDiscount, subsDiscountPercent, subsDiscountLabel, total, totalDiscount };
  }, [items, subs, addedCombos, customer, offers, customerSubscriptions, subscriptions]);

  const subtotal = items.reduce((acc, i) => acc + i.price, 0) + subs.reduce((acc, s) => acc + s.price, 0) + addedCombos.reduce((acc, c) => acc + c.comboPrice, 0);

  // Group items by ID for the view 
  const groupedItems = useMemo(() => {
    const groups: Record<string, { service: Service; quantity: number }> = {};
    items.forEach(item => {
      if (!groups[item.id]) {
        groups[item.id] = { service: item, quantity: 1 };
      } else {
        groups[item.id].quantity += 1;
      }
    });
    return Object.values(groups);
  }, [items]);

  const handleShowUpiQr = () => {
    setActiveUpiIndex(0);
    setPaymentStep('qr');
  };

  const handlePlaceOrder = () => {
    if (total <= 0 && subtotal > 0) {
      onPlaceOrder(0, totalDiscount, Math.max(serviceDiscountPercent, subsDiscountPercent));
      return;
    }
    // Always show payment method picker
    setSelectedMethod(upiList.length > 0 ? 'upi' : 'cash');
    setPaymentStep('method');
  };

  const handleCashPayment = () => {
    setPaymentStep('closed');
    onPlaceOrder(total, totalDiscount, Math.max(serviceDiscountPercent, subsDiscountPercent));
  };

  const handleUpiPaymentDone = () => {
    setPaymentStep('closed');
    onPlaceOrder(total, totalDiscount, Math.max(serviceDiscountPercent, subsDiscountPercent), upiList[activeUpiIndex]?.id);
  };

  const salesBlockedOffline = isOffline && !offlineSalesEnabled;

  const handleMethodConfirm = () => {
    // If offline sales are disabled by admin and we're offline, block everything
    if (salesBlockedOffline) {
      showAlert(
        'Offline Sales Disabled',
        'Offline sales have been disabled by your admin. Please connect to the internet to make sales.',
      );
      return;
    }
    if (selectedMethod === 'cash') {
      if (isOffline) {
        showAlert(
          'Internet Required',
          'Cash sales require an internet connection to prevent fraud. Please connect to Wi-Fi/mobile data, or use UPI payment.',
        );
        return;
      }
      handleCashPayment();
    } else {
      if (upiList.length === 0) {
        showAlert('No UPI Configured', 'Please add a UPI ID in Settings → Payments to accept online payments.');
        return;
      }
      handleShowUpiQr();
    }
  };

  const handlePaymentBack = () => {
    if (paymentStep === 'qr') setPaymentStep('method');
    else setPaymentStep('closed');
  };

  const handleScroll = (event: any) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / modalWidth);
    if (slide !== activeUpiIndex) {
      setActiveUpiIndex(slide);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bill Summary</Text>

      <View style={styles.itemsContainer}>
        {groupedItems.length > 0 ? (
          groupedItems.map((item, index) => (
            <View style={[styles.itemRow, index === groupedItems.length - 1 && subs.length === 0 && styles.itemRowLast]} key={`${item.service.id}-${index}`}>
              <View style={styles.itemNameContainer}>
                <Text style={styles.itemName}>{capitalizeWords(item.service.name)}</Text>
                <Text style={styles.qtyText}> ×{item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>{formatCurrency(item.service.price * item.quantity)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No services or products added</Text>
        )}
        {subs.length > 0 ? (
          subs.map((item, index) => (
            <View style={[styles.itemRow, index === subs.length - 1 && styles.itemRowLast]} key={`sub-${item.id}-${index}`}>
              <View style={styles.itemNameContainer}>
                <Text style={styles.itemName}>{capitalizeWords(item.name)}</Text>
                <View style={styles.subTag}>
                  <Text style={styles.subTagText}>Subscription</Text>
                </View>
              </View>
              <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
            </View>
          ))
        ) : (
          items.length > 0 ? null : <Text style={styles.emptyText}>No subscriptions added</Text>
        )}
        {addedCombos.length > 0 && addedCombos.map((combo, index) => {
          const origTotal = combo.items.reduce((s: number, ci: any) => s + ci.originalPrice, 0);
          const savings = origTotal - combo.comboPrice;
          return (
          <View style={[styles.itemRow, index === addedCombos.length - 1 && styles.itemRowLast]} key={`combo-${combo.id}-${index}`}>
            <View style={styles.itemNameContainer}>
              <Text style={styles.itemName}>{capitalizeWords(combo.name)}</Text>
              <View style={styles.comboTag}>
                <Text style={styles.comboTagText}>Combo · {combo.items.length} items</Text>
              </View>
              {savings > 0 && (
                <Text style={styles.comboSavingsText}>Save {formatCurrency(savings)}</Text>
              )}
            </View>
            <View style={styles.comboPriceContainer}>
              <Text style={styles.itemPrice}>{formatCurrency(combo.comboPrice)}</Text>
              {origTotal > combo.comboPrice && (
                <Text style={styles.comboOrigPrice}>{formatCurrency(origTotal)}</Text>
              )}
            </View>
          </View>
          );
        })}
      </View>

      <View style={styles.totalsContainer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
        </View>
        {serviceDiscount > 0 && (
          <View style={styles.totalRow}>
            <View style={styles.discountLabelRow}>
              <Star size={12} color={Colors.info} />
              <Text style={styles.discountLabel}>{serviceDiscountLabel}</Text>
            </View>
            <Text style={styles.discountValue}>- {formatCurrency(serviceDiscount)}</Text>
          </View>
        )}
        {subsDiscount > 0 && (
          <View style={styles.totalRow}>
            <View style={styles.discountLabelRow}>
              <Percent size={12} color={Colors.warning} />
              <Text style={styles.discountLabel}>{subsDiscountLabel}</Text>
            </View>
            <Text style={styles.discountValue}>- {formatCurrency(subsDiscount)}</Text>
          </View>
        )}
        {(serviceDiscount > 0 || subsDiscount > 0) && (
          <Text style={styles.disclaimerText}>* Discounts on services only{addedCombos.length > 0 ? '. Combos at fixed price, no extra discounts.' : '.'}</Text>
        )}
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.placeOrderBtn, (!customer || subtotal === 0) && styles.placeOrderBtnDisabled]}
        onPress={handlePlaceOrder}
        disabled={!customer || subtotal === 0}
      >
        <CreditCard size={18} color={Colors.surface} />
        <Text style={styles.placeOrderBtnText}>
          {!customer ? "Select customer to continue" : "Place Order"}
        </Text>
      </TouchableOpacity>

      {/* Payment Flow Modal (method → qr) */}
      <Modal animationType="slide" transparent visible={paymentStep !== 'closed'} onRequestClose={handlePaymentBack}>
        <View style={styles.paymentModalBackdrop}>
          <View style={paymentStep === 'qr' ? [styles.qrModalContent, { paddingBottom: Math.max(Spacing.xl, insets.bottom + Spacing.md) }] : [styles.paymentModalContent, { paddingBottom: Math.max(Spacing.xl, insets.bottom + Spacing.md) }]}>
            {/* Header with back / close */}
            <View style={styles.paymentModalHeader}>
              <TouchableOpacity onPress={handlePaymentBack} style={styles.paymentCloseBtn}>
                {paymentStep === 'qr' ? (
                  <ArrowLeft size={20} color={Colors.text} />
                ) : (
                  <X size={18} color={Colors.textTertiary} />
                )}
              </TouchableOpacity>
              <Text style={styles.paymentModalTitle}>
                {paymentStep === 'qr' ? 'Scan to Pay' : 'Payment Method'}
              </Text>
              <View style={{ width: 36 }} />
            </View>

            {/* Step: Payment Method */}
            {paymentStep === 'method' && (
              <>
                <Text style={styles.paymentModalSubtitle}>How would you like to pay?</Text>
                <View style={styles.paymentMethodRow}>
                  <TouchableOpacity style={[styles.paymentMethodCard, selectedMethod === 'cash' && styles.paymentMethodCardSelected]} onPress={() => setSelectedMethod('cash')}>
                    <View style={[styles.paymentMethodIcon, { backgroundColor: '#D1FAE5' }]}>
                      <Wallet size={24} color="#10B981" />
                    </View>
                    <Text style={styles.paymentMethodLabel}>Cash</Text>
                    {selectedMethod === 'cash' && (
                      <CheckCircle size={16} color={Colors.primary} style={{ position: 'absolute', top: 8, right: 8 }} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.paymentMethodCard, selectedMethod === 'upi' && styles.paymentMethodCardSelected]} onPress={() => setSelectedMethod('upi')}>
                    <View style={[styles.paymentMethodIcon, { backgroundColor: Colors.primaryLight }]}>
                      <Smartphone size={24} color={Colors.primary} />
                    </View>
                    <Text style={styles.paymentMethodLabel}>Online / UPI</Text>
                    {selectedMethod === 'upi' && (
                      <CheckCircle size={16} color={Colors.primary} style={{ position: 'absolute', top: 8, right: 8 }} />
                    )}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.confirmMethodBtn} onPress={handleMethodConfirm}>
                  <Text style={styles.confirmMethodBtnText}>
                    {selectedMethod === 'cash' ? 'Confirm Cash Payment' : 'Show QR Code'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step: QR Code */}
            {paymentStep === 'qr' && (
              <>
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={handleScroll} style={{ width: modalWidth }} contentContainerStyle={{ alignItems: 'center' }}>
                  {upiList.map((upi, index) => {
                    const upiUri = `upi://pay?pa=${upi.upiId}&pn=${upi.payeeName}&am=${total}&cu=INR`;
                    return (
                      <View key={index} style={[styles.qrSlide, { width: modalWidth }]}>
                        <View style={styles.qrCardWrapper}>
                          <QRCode value={upiUri} size={modalWidth * 0.7} />
                        </View>
                        <Text style={styles.upiPayeeName}>{upi.payeeName}</Text>
                        <Text style={styles.upiId}>{upi.upiId}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
                <View style={styles.qrAmountBadge}>
                  <Text style={styles.qrAmountLabel}>Amount</Text>
                  <Text style={styles.qrAmountValue}>{formatCurrency(total)}</Text>
                </View>
                {upiList.length > 1 && (
                  <View style={styles.pagination}>
                    {upiList.map((_, i) => <View key={i} style={[styles.dot, activeUpiIndex === i && styles.activeDot]} />)}
                  </View>
                )}
                <TouchableOpacity style={styles.doneBtn} onPress={handleUpiPaymentDone}>
                  <Text style={styles.doneBtnText}>Payment Received</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default React.memo(BillSummary);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  itemsContainer: {
    marginBottom: Spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  itemName: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
  },
  subTag: {
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  subTagText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.info,
  },
  comboTag: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  comboTagText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.success,
  },
  comboPriceContainer: {
    alignItems: 'flex-end',
  },
  comboOrigPrice: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
    textAlign: 'right',
  },
  comboSavingsText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '600',
    marginTop: 2,
  },
  qtyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  itemPrice: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
    minWidth: 80,
  },
  removeBtn: {
    padding: 6,
    marginLeft: 6,
  },
  emptyText: {
    paddingVertical: Spacing.md,
    color: Colors.textTertiary,
    fontSize: FontSize.body,
  },
  totalsContainer: {
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  totalLabel: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  totalValue: {
    fontSize: FontSize.body,
    color: Colors.text,
    fontWeight: '500',
  },
  discountLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  discountLabel: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  discountValue: {
    fontSize: FontSize.body,
    color: Colors.success,
    fontWeight: '600',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
  },
  grandTotalLabel: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.text,
  },
  grandTotalValue: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.primary,
  },
  placeOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  placeOrderBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.surface,
  },
  placeOrderBtnDisabled: {
    backgroundColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  disclaimerText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },

  /* Payment Method Modal */
  paymentModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.overlay,
    padding: Spacing.screen,
  },
  paymentModalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    width: '100%',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  paymentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  paymentModalTitle: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.text,
  },
  paymentCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentModalSubtitle: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  paymentMethodCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentMethodCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  confirmMethodBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  confirmMethodBtnText: {
    color: Colors.surface,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  paymentMethodIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentMethodLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },

  /* QR Code Modal */
  qrModalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  qrSlide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCardWrapper: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  upiPayeeName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.md,
  },
  upiId: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  qrAmountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: 999,
  },
  qrAmountLabel: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  qrAmountValue: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.primary,
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  doneBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.surface,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  activeDot: {
    backgroundColor: Colors.primary,
    width: 20,
  },
});