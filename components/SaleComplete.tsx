import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, Spacing } from '@/constants/typography';
import { Check, Download } from 'lucide-react-native';

interface SaleCompleteProps {
    sale: any;
    onClose: () => void;
}

export default function SaleComplete({ sale, onClose }: SaleCompleteProps) {
    if (!sale) return null;

    const handleDownloadPdf = () => {
        Alert.alert('Coming Soon', 'PDF generation is not yet implemented.');
    };

    return (
        <Modal visible={!!sale} animationType="slide" transparent={false} onRequestClose={onClose}>
            <View style={styles.container}>
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.headerArea}>
                        <View style={styles.successIconContainer}>
                            <Check size={48} color={Colors.surface} strokeWidth={3} />
                        </View>
                        <Text style={styles.title}>Sale Complete!</Text>
                        <Text style={styles.invoiceText}>Invoice #{sale.id ? sale.id.substring(0, 8).toUpperCase() : 'UNKNOWN'}</Text>

                        <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadPdf}>
                            <Download size={16} color={Colors.primary} />
                            <Text style={styles.downloadBtnText}>Download PDF</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.detailsArea}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Customer</Text>
                            <Text style={styles.infoValue}>{sale.customer_name || 'Walk-in Customer'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Billed by</Text>
                            <Text style={styles.infoValue}>{sale.employee_name}</Text>
                        </View>

                        <View style={styles.divider} />

                        {/* Render Services & Products */}
                        {sale.items?.map((item: any, index: number) => (
                            <View key={`item_${index}`} style={styles.itemRow}>
                                <Text style={styles.itemName}>{item.itemName || item.name} ×{item.quantity || 1}</Text>
                                <Text style={styles.itemPrice}>₹{Number(item.price).toFixed(2)}</Text>
                            </View>
                        ))}

                        {/* Render Subscriptions */}
                        {sale.subscription_items?.map((item: any, index: number) => (
                            <View key={`sub_${index}`} style={styles.itemRow}>
                                <Text style={styles.itemName}>{item.plan_name} ×1</Text>
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
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        padding: Spacing.xl,
        paddingTop: Platform.OS === 'ios' ? 80 : 60,
    },
    headerArea: {
        alignItems: 'center',
        marginBottom: Spacing.xxl,
    },
    successIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
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
        backgroundColor: Colors.surface,
        padding: Spacing.xl,
        borderRadius: BorderRadius.xl,
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
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.text,
    },
    totalValue: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.primary,
    },
    footer: {
        padding: Spacing.xl,
        paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl,
        backgroundColor: Colors.background,
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
});
