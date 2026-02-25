import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { BarChart3, Search, Download, Filter } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { Sale, SaleItem, SubscriptionSaleItem } from '@/types';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  isThisMonth,
  isToday,
  isYesterday,
  isLastWeek,
} from '@/utils/format';
import { openInvoice } from '@/utils/invoice';
import { useAuth } from '@/providers/AuthProvider';

const ALL = 'all';
const TODAY = 'today';
const YESTERDAY = 'yesterday';
const LAST_WEEK = 'last_week';
const THIS_MONTH = 'this_month';

const CASH = 'cash';
const ONLINE = 'gpay';

const SERVICE = 'service';
const PRODUCT = 'product';
const OTHER = 'other';

export default function SalesScreen() {
  const { user, isAdmin } = useAuth();
  const { sales, reload, dataLoading, loadError } = useData();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const [dateFilter, setDateFilter] = useState(TODAY);
  const [paymentFilter, setPaymentFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);

  const [tempDateFilter, setTempDateFilter] = useState(dateFilter);
  const [tempPaymentFilter, setTempPaymentFilter] = useState(paymentFilter);
  const [tempTypeFilter, setTempTypeFilter] = useState(typeFilter);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const visibleSales = useMemo(() => {
    if (!user || !sales) return [];
    return isAdmin ? sales : sales.filter((s: Sale) => s.employeeId === user.id);
  }, [sales, user, isAdmin]);

  const sortedSales = useMemo(() => {
    return [...visibleSales].sort((a: Sale, b: Sale) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [visibleSales]);

  const filteredSales = useMemo(() => {
    let filtered = sortedSales;

    if (dateFilter === TODAY) filtered = filtered.filter(s => isToday(s.createdAt));
    else if (dateFilter === YESTERDAY) filtered = filtered.filter(s => isYesterday(s.createdAt));
    else if (dateFilter === LAST_WEEK) filtered = filtered.filter(s => isLastWeek(s.createdAt));
    else if (dateFilter === THIS_MONTH) filtered = filtered.filter(s => isThisMonth(s.createdAt));
    // ALL filter requires no further reduction

    if (paymentFilter !== ALL) filtered = filtered.filter(s => s.paymentMethod === paymentFilter);

    if (typeFilter === SERVICE) {
      filtered = filtered.filter(s => s.items.some(i => i.kind === 'service') && s.type !== 'other');
    } else if (typeFilter === PRODUCT) {
      filtered = filtered.filter(s => s.items.some(i => i.kind === 'product') && s.type !== 'other');
    } else if (typeFilter === OTHER) {
      filtered = filtered.filter(s => s.type === 'other');
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(s =>
        s.customerName.toLowerCase().includes(q) ||
        s.employeeName.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [sortedSales, search, dateFilter, paymentFilter, typeFilter]);

  const openFilterModal = () => {
    setTempDateFilter(dateFilter);
    setTempPaymentFilter(paymentFilter);
    setTempTypeFilter(typeFilter);
    setFilterModalVisible(true);
  };

  const handleApplyFilters = () => {
    setDateFilter(tempDateFilter);
    setPaymentFilter(tempPaymentFilter);
    setTypeFilter(tempTypeFilter);
    setFilterModalVisible(false);
  };

  const handleCancelFilters = () => setFilterModalVisible(false);

  const handleDownload = async (sale: Sale) => {
    try {
      await openInvoice(sale);
    } catch (e) {
      console.error(e);
    }
  };

  const renderItem = ({ item }: { item: Sale }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <Text style={styles.saleId}>INV-{item.id.slice(0, 8).toUpperCase()}</Text>
        </View>
        <Text style={styles.totalAmount}>{formatCurrency(item.total)}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.itemsList}>
          {item.items.map((i: SaleItem, index: number) => (
            <Text key={index} style={styles.itemText}>{i.itemName} ×{i.quantity}</Text>
          ))}
          {item.subscriptionItems.map((si: SubscriptionSaleItem, index: number) => (
            <Text key={index} style={styles.itemText}>{si.planName} (sub)</Text>
          ))}
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.metaText}>{formatDateTime(item.createdAt)} by {item.employeeName}</Text>
        <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownload(item)}>
          <Download size={14} color={Colors.primary} />
          <Text style={styles.downloadText}>Invoice</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const dateFilters = isAdmin
    ? [{ label: 'All', value: ALL }, { label: 'Today', value: TODAY }, { label: 'Yesterday', value: YESTERDAY }, { label: 'Last Week', value: LAST_WEEK }, { label: 'This Month', value: THIS_MONTH }]
    : [{ label: 'All', value: ALL }, { label: 'Today', value: TODAY }, { label: 'Yesterday', value: YESTERDAY }];

  const paymentFilters = [{ label: 'All', value: ALL }, { label: 'Cash', value: CASH }, { label: 'Online/UPI', value: ONLINE }];
  const typeFilters = [{ label: 'All', value: ALL }, { label: 'Service', value: SERVICE }, { label: 'Product', value: PRODUCT }, { label: 'Others', value: OTHER }];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customer, employee, or ID..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity onPress={openFilterModal} style={styles.filterTrigger}>
          <Filter size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={isFilterModalVisible}
        onRequestClose={handleCancelFilters}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filters</Text>

            <Text style={styles.filterSectionTitle}>Date</Text>
            <View style={styles.filterGroup}>
              {dateFilters.map(f => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.filterBtn, tempDateFilter === f.value && styles.filterBtnActive]}
                  onPress={() => setTempDateFilter(f.value)}
                >
                  <Text style={[styles.filterBtnText, tempDateFilter === f.value && styles.filterBtnTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionTitle}>Payment Method</Text>
            <View style={styles.filterGroup}>
              {paymentFilters.map(f => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.filterBtn, tempPaymentFilter === f.value && styles.filterBtnActive]}
                  onPress={() => setTempPaymentFilter(f.value)}
                >
                  <Text style={[styles.filterBtnText, tempPaymentFilter === f.value && styles.filterBtnTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionTitle}>Type</Text>
            <View style={styles.filterGroup}>
              {typeFilters.map(f => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.filterBtn, tempTypeFilter === f.value && styles.filterBtnActive]}
                  onPress={() => setTempTypeFilter(f.value)}
                >
                  <Text style={[styles.filterBtnText, tempTypeFilter === f.value && styles.filterBtnTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={handleCancelFilters}>
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleApplyFilters}>
                <Text style={styles.modalBtnPrimaryText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{loadError?.message}</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.errorBannerBtn}>
            <Text style={styles.errorBannerBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={filteredSales}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || (dataLoading && !sales.length)}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <BarChart3 size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No sales yet</Text>
            <Text style={styles.emptySubtitle}>Completed sales will appear here</Text>
          </View>
        }
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
    padding: Spacing.screen,
    gap: Spacing.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  filterTrigger: {
    padding: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.screen,
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
    marginHorizontal: Spacing.card,
    marginBottom: Spacing.sm,
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
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.card,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingBottom: Spacing.sm,
  },
  customerName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  saleId: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  totalAmount: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  cardBody: {
    paddingVertical: Spacing.md,
  },
  itemsList: {
    gap: 4,
  },
  itemText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  metaText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  downloadText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.screen,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.card,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  filterSectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  filterGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  filterBtn: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterBtnText: {
    color: Colors.text,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.md,
  },
  modalBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  modalBtnPrimaryText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalBtnSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtnSecondaryText: {
    color: Colors.text,
    fontWeight: '600',
  },
});