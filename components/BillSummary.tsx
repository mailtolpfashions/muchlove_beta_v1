import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, Dimensions
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Trash2, CreditCard, X, Wallet, Smartphone, Percent, Star } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, Spacing } from '@/constants/typography';
import { Service, SubscriptionPlan, UpiData, Customer, Offer, CustomerSubscription } from '@/types';
import { formatCurrency } from '@/utils/format';

interface BillSummaryProps {
  items: Service[];
  subs: SubscriptionPlan[];
  customer: Customer | null;
  offers: Offer[];
  customerSubscriptions: CustomerSubscription[];
  onRemoveItem: (index: number) => void;
  onRemoveSub: (index: number) => void;
  onAddQuantity?: (service: Service) => void;
  onSubtractQuantity?: (service: Service) => void;
  onPlaceOrder: (total: number, discountAmount: number, discountPercent: number, upiId?: string) => void;
  upiList: UpiData[];
}

const modalWidth = Dimensions.get('window').width * 0.8;

export default function BillSummary({
  items,
  subs,
  customer,
  offers,
  customerSubscriptions,
  onRemoveItem,
  onRemoveSub,
  onAddQuantity,
  onSubtractQuantity,
  onPlaceOrder,
  upiList,
}: BillSummaryProps) {
  const [isPaymentModalVisible, setPaymentModalVisible] = useState(false);
  const [isQrModalVisible, setQrModalVisible] = useState(false);
  const [activeUpiIndex, setActiveUpiIndex] = useState(0);

  const { serviceDiscount, serviceDiscountPercent, serviceDiscountLabel, subsDiscount, subsDiscountPercent, subsDiscountLabel, total, totalDiscount } = useMemo(() => {
    const subtotalServices = items.reduce((acc, i) => acc + i.price, 0);
    const subtotalSubs = subs.reduce((acc, s) => acc + s.price, 0);

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
      if (items.length > 0) {
        if (hasActiveSubscription) {
          const studentDiscount = customer.isStudent ? 30 : 0;
          const priceDiscount = subtotalActualServices < 2000 ? 30 : 20;
          serviceDiscountPercent = Math.max(studentDiscount, priceDiscount);
          serviceDiscount = subtotalActualServices * (serviceDiscountPercent / 100);
          serviceDiscountLabel = `Subscription Discount (${serviceDiscountPercent}%)`;
        } else {
          const bestVisitOffer = offers
            .filter(o => o.visitCount != null && o.visitCount >= 0 && customer.visitCount >= o.visitCount)
            .sort((a, b) => b.percent - a.percent)[0];

          if (bestVisitOffer) {
            serviceDiscountPercent = bestVisitOffer.percent;
            serviceDiscount = subtotalActualServices * (serviceDiscountPercent / 100);
            serviceDiscountLabel = `${bestVisitOffer.name} (${serviceDiscountPercent}%)`;
          }
        }
      }

      if (isPurchasingSubscription && customer.isStudent) {
        const studentOffer = offers.find(o => o.visitCount === -1); // student offer flag
        if (studentOffer) {
          subsDiscountPercent = studentOffer.percent;
          subsDiscount = subtotalSubs * (subsDiscountPercent / 100);
          subsDiscountLabel = `${studentOffer.name} (${subsDiscountPercent}%)`;
        }
      }
    }

    const totalDiscount = serviceDiscount + subsDiscount;
    const total = subtotalServices - serviceDiscount + subtotalSubs - subsDiscount;
    return { serviceDiscount, serviceDiscountPercent, serviceDiscountLabel, subsDiscount, subsDiscountPercent, subsDiscountLabel, total, totalDiscount };
  }, [items, subs, customer, offers]);

  const subtotal = items.reduce((acc, i) => acc + i.price, 0) + subs.reduce((acc, s) => acc + s.price, 0);

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
    setPaymentModalVisible(false);
    setActiveUpiIndex(0);
    setQrModalVisible(true);
  };

  const handlePlaceOrder = () => {
    if (total <= 0 && subtotal > 0) {
      onPlaceOrder(0, totalDiscount, Math.max(serviceDiscountPercent, subsDiscountPercent));
      return;
    }
    if (upiList.length === 0) {
      onPlaceOrder(total, totalDiscount, Math.max(serviceDiscountPercent, subsDiscountPercent));
    } else {
      setPaymentModalVisible(true);
    }
  };

  const onQrCodeClose = () => {
    setQrModalVisible(false);
    onPlaceOrder(total, totalDiscount, Math.max(serviceDiscountPercent, subsDiscountPercent), upiList[activeUpiIndex]?.id);
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
        <FlatList
          data={groupedItems}
          renderItem={({ item, index }) => (
            <View style={styles.itemRow}>
              <View style={styles.itemNameContainer}>
                <Text style={styles.itemName}>{item.service.name}</Text>

                <View style={styles.qtyContainer}>
                  {onSubtractQuantity && (
                    <TouchableOpacity onPress={() => onSubtractQuantity(item.service)} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  {onAddQuantity && (
                    <TouchableOpacity onPress={() => onAddQuantity(item.service)} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={styles.itemPrice}>{formatCurrency(item.service.price * item.quantity)}</Text>
            </View>
          )}
          keyExtractor={(item, index) => `${item.service.id}-${index}`}
          ListEmptyComponent={<Text style={styles.emptyText}>No services or products added</Text>}
        />
        <FlatList
          data={subs}
          renderItem={({ item, index }) => (
            <View style={styles.itemRow}>
              <Text style={styles.itemName}>{item.name} (Subscription)</Text>
              <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
              <TouchableOpacity onPress={() => onRemoveSub(index)}>
                <Trash2 size={16} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          )}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          ListEmptyComponent={items.length > 0 ? null : <Text style={styles.emptyText}>No subscriptions added</Text>}
        />
      </View>

      <View style={styles.totalsContainer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
        </View>
        {serviceDiscount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}><Star size={12} color={Colors.info} /> {serviceDiscountLabel}</Text>
            <Text style={styles.totalValue}>- {formatCurrency(serviceDiscount)}</Text>
          </View>
        )}
        {subsDiscount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}><Percent size={12} color={Colors.warning} /> {subsDiscountLabel}</Text>
            <Text style={styles.totalValue}>- {formatCurrency(subsDiscount)}</Text>
          </View>
        )}
        {(serviceDiscount > 0 || subsDiscount > 0) && (
          <Text style={styles.disclaimerText}>* Discounts are applicable only on services.</Text>
        )}
        <View style={[styles.totalRow, styles.grandTotalRow]}>
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

      <Modal animationType="fade" transparent={true} visible={isPaymentModalVisible} onRequestClose={() => setPaymentModalVisible(false)}>
        <View style={styles.paymentModalBackdrop}>
          <View style={styles.paymentModalContent}>
            <Text style={styles.paymentModalTitle}>Payment Method</Text>
            <Text style={styles.paymentModalSubtitle}>How would you like to pay?</Text>
            <TouchableOpacity style={styles.paymentOptionBtn} onPress={() => { onPlaceOrder(total, totalDiscount, Math.max(serviceDiscountPercent, subsDiscountPercent)); setPaymentModalVisible(false); }}>
              <Wallet size={20} color={Colors.primary} />
              <Text style={styles.paymentOptionText}>Cash</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.paymentOptionBtn} onPress={handleShowUpiQr}>
              <Smartphone size={20} color={Colors.primary} />
              <Text style={styles.paymentOptionText}>Online / UPI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.paymentOptionBtn, styles.cancelBtn]} onPress={() => setPaymentModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent={true} visible={isQrModalVisible} onRequestClose={onQrCodeClose}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { width: modalWidth + Spacing.xl * 2 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Scan to Pay</Text>
              <TouchableOpacity onPress={onQrCodeClose}><X size={24} color={Colors.text} /></TouchableOpacity>
            </View>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={handleScroll} style={{ width: modalWidth }} contentContainerStyle={{ alignItems: 'center' }}>
              {upiList.map((upi, index) => {
                const upiUri = `upi://pay?pa=${upi.upiId}&pn=${upi.payeeName}&am=${total}&cu=INR`;
                return (
                  <View key={index} style={[styles.qrSlide, { width: modalWidth }]}>
                    <QRCode value={upiUri} size={modalWidth * 0.8} />
                    <Text style={styles.upiPayeeName}>Paying to {upi.payeeName}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <Text style={styles.amountText}>Amount: {formatCurrency(total)}</Text>
            {upiList.length > 1 && (
              <View style={styles.pagination}>
                {upiList.map((_, i) => <View key={i} style={[styles.dot, activeUpiIndex === i && styles.activeDot]} />)}
              </View>
            )}
            <TouchableOpacity style={styles.doneBtn} onPress={onQrCodeClose}><Text style={styles.doneBtnText}>Done</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  itemsContainer: {
    marginBottom: Spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemNameContainer: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  itemName: {
    fontSize: FontSize.body,
    color: Colors.text,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: 4,
  },
  qtyBtn: {
    backgroundColor: Colors.borderLight,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  qtyText: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.text,
  },
  itemPrice: {
    fontSize: FontSize.body,
    color: Colors.text,
    textAlign: 'right',
    minWidth: 80,
  },
  emptyText: {
    paddingVertical: Spacing.sm,
    color: Colors.textSecondary,
  },
  totalsContainer: {
    marginTop: Spacing.md,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  totalValue: {
    fontSize: FontSize.body,
    color: Colors.text,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
  },
  grandTotalLabel: {
    fontSize: FontSize.title,
    fontWeight: '600',
    color: Colors.text,
  },
  grandTotalValue: {
    fontSize: FontSize.title,
    fontWeight: '600',
    color: Colors.text,
  },
  placeOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  placeOrderBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.surface,
  },
  placeOrderBtnDisabled: {
    backgroundColor: Colors.border,
  },
  disclaimerText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  modalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.heading,
    fontWeight: '600',
    color: Colors.text,
  },
  qrSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  upiPayeeName: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  amountText: {
    fontSize: FontSize.title,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.lg,
  },
  doneBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.surface,
  },
  paymentModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  paymentModalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '85%',
    alignItems: 'stretch',
  },
  paymentModalTitle: {
    fontSize: FontSize.heading,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  paymentModalSubtitle: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  paymentOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  paymentOptionText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  cancelBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: Colors.primary,
    width: 12,
  },
});