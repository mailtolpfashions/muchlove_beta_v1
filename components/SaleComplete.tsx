import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, Spacing } from '@/constants/typography';
import { Check, Download, WifiOff } from 'lucide-react-native';
import { Sale } from '@/types';
import { openInvoice } from '@/utils/invoice';
import { useAlert } from '@/providers/AlertProvider';
import { capitalizeWords } from '@/utils/format';

interface SaleCompleteProps {
    sale: any;
    onClose: () => void;
}

export default function SaleComplete({ sale, onClose }: SaleCompleteProps) {
    const { showAlert } = useAlert();
    if (!sale) return null;

    const handleDownloadPdf = async () => {
        try {
            const mapped: Sale = {
                id: sale.id,
                customerId: sale.customer_id ?? '',
                customerName: sale.customer_name ?? 'Walk-in Customer',
                employeeId: sale.employee_id ?? '',
                employeeName: sale.employee_name ?? '',
                type: sale.type ?? 'service',
                paymentMethod: sale.payment_method,
                subtotal: Number(sale.subtotal),
                discountPercent: Number(sale.discount_percent ?? 0),
                discountAmount: Number(sale.discount_amount ?? 0),
                total: Number(sale.total),
                createdAt: sale.created_at ?? new Date().toISOString(),
                items: (sale.items || []).map((i: any) => ({
                    id: i.id,
                    itemId: i.itemId ?? i.service_id ?? '',
                    itemName: i.itemName ?? i.service_name ?? '',
                    itemCode: i.itemCode ?? i.service_code ?? '',
                    price: Number(i.price),
                    quantity: Number(i.quantity ?? 1),
                    kind: i.kind ?? 'service',
                })),
                subscriptionItems: (sale.subscription_items || []).map((s: any) => ({
                    id: s.id,
                    planId: s.plan_id ?? '',
                    planName: s.plan_name ?? '',
                    price: Number(s.price),
                    discountedPrice: Number(s.discounted_price ?? s.price),
                })),
            };
            await openInvoice(mapped);
        } catch (e) {
            showAlert('Error', 'Failed to generate invoice PDF.');
        }
    };

    return (
        <Modal visible={!!sale} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
              <View style={styles.container}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.headerArea}>
                        <View style={styles.successIconContainer}>
                            <Check size={32} color={Colors.surface} strokeWidth={3} />
                        </View>
                        <Text style={styles.title}>Sale Complete!</Text>
                        <Text style={styles.invoiceText}>Invoice #{sale.id ? sale.id.substring(0, 8).toUpperCase() : 'UNKNOWN'}</Text>

                        {sale._offline && (
                            <View style={styles.offlineBadge}>
                                <WifiOff size={12} color="#6B7280" />
                                <Text style={styles.offlineBadgeText}>Saved offline · will sync when online</Text>
                            </View>
                        )}

                        <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadPdf}>
                            <Download size={16} color={Colors.primary} />
                            <Text style={styles.downloadBtnText}>Download PDF</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.detailsArea}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Customer</Text>
                            <Text style={styles.infoValue}>{sale.customer_name ? capitalizeWords(sale.customer_name) : 'Walk-in Customer'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Billed by</Text>
                            <Text style={styles.infoValue}>{capitalizeWords(sale.employee_name)}</Text>
                        </View>

                        <View style={styles.divider} />

                        {/* Render Services & Products */}
                        {sale.items?.map((item: any, index: number) => (
                            <View key={`item_${index}`} style={styles.itemRow}>
                                <Text style={styles.itemName}>{capitalizeWords(item.itemName || item.name)} ×{item.quantity || 1}</Text>
                                <Text style={styles.itemPrice}>₹{Number(item.price).toFixed(2)}</Text>
                            </View>
                        ))}

                        {/* Render Subscriptions */}
                        {sale.subscription_items?.map((item: any, index: number) => (
                            <View key={`sub_${index}`} style={styles.itemRow}>
                                <Text style={styles.itemName}>{capitalizeWords(item.plan_name)} ×1</Text>
                                <Text style={styles.itemPrice}>₹{Number(item.price).toFixed(2)}</Text>
                            </View>
                        ))}

                        <View style={styles.divider} />

                        <View style={styles.itemRow}>
                            <Text style={styles.subtotalLabel}>Subtotal</Text>
                            <Text style={styles.subtotalValue}>₹{Number(sale.subtotal).toFixed(2)}</Text>
                        </View>

                        {sale.discount_amount > 0 && (
                            <View style={styles.itemRow}>
                                <Text style={styles.discountLabel}>Discount</Text>
                                <Text style={styles.discountValue}>-₹{Number(sale.discount_amount).toFixed(2)}</Text>
                            </View>
                        )}

                        <View style={styles.dividerHeavy} />

                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Total</Text>
                            <Text style={styles.totalValue}>₹{Number(sale.total).toFixed(2)}</Text>
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                        <Text style={styles.doneBtnText}>Done</Text>
                    </TouchableOpacity>
                </View>
              </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: Colors.overlay,
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: Colors.surface,
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        maxHeight: '85%',
    },
    content: {
        padding: Spacing.xl,
        paddingTop: Spacing.lg,
    },
    headerArea: {
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    successIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.success,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
        elevation: 4,
        shadowColor: Colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    title: {
        fontSize: FontSize.heading,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    invoiceText: {
        fontSize: FontSize.body,
        color: Colors.textSecondary,
        marginBottom: Spacing.lg,
        textTransform: 'uppercase',
    },
    downloadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primaryLight,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderRadius: BorderRadius.lg,
        gap: Spacing.sm,
    },
    downloadBtnText: {
        color: Colors.primary,
        fontWeight: '600',
        fontSize: FontSize.body,
    },
    detailsArea: {
        backgroundColor: Colors.background,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    infoLabel: {
        fontSize: FontSize.body,
        color: Colors.textSecondary,
    },
    infoValue: {
        fontSize: FontSize.body,
        color: Colors.text,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: Spacing.lg,
    },
    dividerHeavy: {
        height: 2,
        backgroundColor: Colors.text,
        marginVertical: Spacing.lg,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    itemName: {
        fontSize: FontSize.body,
        color: Colors.textSecondary,
        flex: 1,
        marginRight: Spacing.sm,
    },
    itemPrice: {
        fontSize: FontSize.body,
        color: Colors.text,
        fontWeight: '500',
    },
    subtotalLabel: {
        fontSize: FontSize.body,
        color: Colors.textSecondary,
    },
    subtotalValue: {
        fontSize: FontSize.body,
        color: Colors.text,
        fontWeight: '500',
    },
    discountLabel: {
        fontSize: FontSize.body,
        color: Colors.danger,
    },
    discountValue: {
        fontSize: FontSize.body,
        color: Colors.danger,
        fontWeight: '500',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: FontSize.title,
        fontWeight: '700',
        color: Colors.text,
    },
    totalValue: {
        fontSize: FontSize.title,
        fontWeight: '700',
        color: Colors.primary,
    },
    footer: {
        padding: Spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    doneBtn: {
        backgroundColor: Colors.primary,
        height: 56,
        borderRadius: BorderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    doneBtnText: {
        color: Colors.surface,
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    offlineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        gap: 6,
        marginBottom: Spacing.lg,
    },
    offlineBadgeText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
});
