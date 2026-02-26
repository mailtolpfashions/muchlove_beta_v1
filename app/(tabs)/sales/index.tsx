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
import { BarChart3, Search, Download, Share2, X, SlidersHorizontal, Calendar, Wallet, Package, Clock, FileDown } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { Sale, SaleItem, SubscriptionSaleItem } from '@/types';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDateDDMMYYYY,
  isThisMonth,
  isToday,
  isYesterday,
  isLastWeek,
  isSameDay,
  capitalizeWords,
} from '@/utils/format';
import { openInvoice, shareInvoice, shareSalesReport } from '@/utils/invoice';
import { useAuth } from '@/providers/AuthProvider';
import { useAlert } from '@/providers/AlertProvider';
import DatePickerModal from '@/components/DatePickerModal';

const ALL = 'all';
const TODAY = 'today';
const YESTERDAY = 'yesterday';
const LAST_WEEK = 'last_week';
const THIS_MONTH = 'this_month';
const PICK_DATE = 'pick_date';

const CASH = 'cash';
const ONLINE = 'gpay';

const SERVICE = 'service';
const PRODUCT = 'product';
const OTHER = 'other';

export default function SalesScreen() {
  const { user, isAdmin } = useAuth();
  const { sales, reload, dataLoading, loadError } = useData();
  const { showAlert } = useAlert();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const [dateFilter, setDateFilter] = useState(TODAY);
  const [paymentFilter, setPaymentFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);

  const [tempDateFilter, setTempDateFilter] = useState(dateFilter);
  const [tempPaymentFilter, setTempPaymentFilter] = useState(paymentFilter);
  const [tempTypeFilter, setTempTypeFilter] = useState(typeFilter);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [tempPickedDate, setTempPickedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

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
    else if (dateFilter === PICK_DATE && pickedDate) filtered = filtered.filter(s => isSameDay(s.createdAt, pickedDate));
    else if (dateFilter === ALL && !isAdmin) filtered = filtered.filter(s => isToday(s.createdAt) || isYesterday(s.createdAt));
    // Admin ALL filter requires no further reduction

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
  }, [sortedSales, search, dateFilter, paymentFilter, typeFilter, pickedDate]);

  const openFilterModal = () => {
    setTempDateFilter(dateFilter);
    setTempPaymentFilter(paymentFilter);
    setTempTypeFilter(typeFilter);
    setTempPickedDate(pickedDate);
    setFilterModalVisible(true);
  };

  const handleApplyFilters = () => {
    setDateFilter(tempDateFilter);
    setPaymentFilter(tempPaymentFilter);
    setTypeFilter(tempTypeFilter);
    setPickedDate(tempPickedDate);
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

  const handleShare = async (sale: Sale) => {
    try {
      await shareInvoice(sale);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadReport = async () => {
    if (filteredSales.length === 0) {
      showAlert('No Data', 'No sales to export with current filters.');
      return;
    }
    setDownloading(true);
    try {
      const dateLabel = dateFilter === PICK_DATE && pickedDate
        ? formatDateDDMMYYYY(pickedDate)
        : dateFilters.find(f => f.value === dateFilter)?.label || 'All';
      const paymentLabel = paymentFilters.find(f => f.value === paymentFilter)?.label || 'All';
      const typeLabel = typeFilters.find(f => f.value === typeFilter)?.label || 'All';
      await shareSalesReport(filteredSales, { dateLabel, paymentLabel, typeLabel });
    } catch (e) {
      console.error(e);
      showAlert('Error', 'Failed to generate sales report PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const renderItem = ({ item }: { item: Sale }) => {
    const isCash = item.paymentMethod === 'cash';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.customerName}>{capitalizeWords(item.customerName)}</Text>
            <Text style={styles.saleId}>INV-{item.id.slice(0, 8).toUpperCase()}</Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={styles.totalAmount}>{formatCurrency(item.total)}</Text>
            <View style={[styles.paymentBadge, isCash ? styles.cashBadge : styles.onlineBadge]}>
              <Text style={[styles.paymentBadgeText, isCash ? styles.cashText : styles.onlineText]}>{isCash ? 'Cash' : 'UPI'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.itemsList}>
            {item.items.map((i: SaleItem, index: number) => (
              <Text key={index} style={styles.itemText}>{index > 0 ? ' • ' : ''}{capitalizeWords(i.itemName)} ×{i.quantity}</Text>
            ))}
            {item.subscriptionItems.map((si: SubscriptionSaleItem, index: number) => (
              <Text key={`s${index}`} style={styles.itemText}>{(item.items.length > 0 || index > 0) ? ' • ' : ''}{capitalizeWords(si.planName)} (sub)</Text>
            ))}
          </View>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.footerTop}>
            <View style={styles.metaRow}>
              <Clock size={10} color={Colors.textTertiary} />
              <Text style={styles.metaText}>{formatDateTime(item.createdAt)}</Text>
            </View>
            <View style={styles.actionBtnGroup}>
              <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownload(item)}>
                <Download size={12} color={Colors.primary} />
                <Text style={styles.downloadText}>Invoice</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(item)}>
                <Share2 size={12} color={Colors.surface} />
                <Text style={styles.shareText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.billedByText}>Billed by: {capitalizeWords(item.employeeName)}</Text>
        </View>
      </View>
    );
  };

  const dateFilters = isAdmin
    ? [{ label: 'All', value: ALL }, { label: 'Today', value: TODAY }, { label: 'Yesterday', value: YESTERDAY }, { label: 'Last Week', value: LAST_WEEK }, { label: 'This Month', value: THIS_MONTH }, { label: 'Pick Date', value: PICK_DATE }]
    : [{ label: 'All', value: ALL }, { label: 'Today', value: TODAY }, { label: 'Yesterday', value: YESTERDAY }];

  const paymentFilters = [{ label: 'All', value: ALL }, { label: 'Cash', value: CASH }, { label: 'Online/UPI', value: ONLINE }];
  const typeFilters = [{ label: 'All', value: ALL }, { label: 'Service', value: SERVICE }, { label: 'Product', value: PRODUCT }, { label: 'Others', value: OTHER }];

  return (
    <View style={styles.container}>
      {/* Search + Filter header */}
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
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={14} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={openFilterModal} style={[styles.filterTrigger, (dateFilter !== TODAY || paymentFilter !== ALL || typeFilter !== ALL) && styles.filterTriggerActive]}>
          <SlidersHorizontal size={18} color={(dateFilter !== TODAY || paymentFilter !== ALL || typeFilter !== ALL) ? Colors.surface : Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Active filters summary */}
      {(dateFilter !== TODAY || paymentFilter !== ALL || typeFilter !== ALL) && (
        <View style={styles.activeFiltersRow}>
          {dateFilter !== TODAY && (
            <View style={styles.activeFilterChip}>
              <Calendar size={10} color={Colors.primary} />
              <Text style={styles.activeFilterText}>
                {dateFilter === PICK_DATE && pickedDate
                  ? formatDateDDMMYYYY(pickedDate)
                  : dateFilters.find(f => f.value === dateFilter)?.label}
              </Text>
            </View>
          )}
          {paymentFilter !== ALL && (
            <View style={styles.activeFilterChip}>
              <Wallet size={10} color={Colors.primary} />
              <Text style={styles.activeFilterText}>{paymentFilters.find(f => f.value === paymentFilter)?.label}</Text>
            </View>
          )}
          {typeFilter !== ALL && (
            <View style={styles.activeFilterChip}>
              <Package size={10} color={Colors.primary} />
              <Text style={styles.activeFilterText}>{typeFilters.find(f => f.value === typeFilter)?.label}</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => { setDateFilter(TODAY); setPaymentFilter(ALL); setTypeFilter(ALL); setPickedDate(null); }} style={styles.clearFiltersBtn}>
            <X size={12} color={Colors.danger} />
            <Text style={styles.clearFiltersText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results count */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsCount}>{filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''}</Text>
        <View style={styles.resultsRight}>
          <Text style={styles.resultsTotal}>{formatCurrency(filteredSales.reduce((s, sale) => s + sale.total, 0))}</Text>
          {isAdmin && filteredSales.length > 0 && (
            <TouchableOpacity
              style={[styles.reportDownloadBtn, downloading && styles.reportDownloadBtnDisabled]}
              onPress={handleDownloadReport}
              disabled={downloading}
              activeOpacity={0.7}
            >
              <FileDown size={13} color={Colors.surface} />
              <Text style={styles.reportDownloadText}>{downloading ? 'Generating...' : 'PDF'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter modal */}
      <Modal
        animationType="fade"
        transparent
        visible={isFilterModalVisible}
        onRequestClose={handleCancelFilters}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalTitleRow}>
              <SlidersHorizontal size={18} color={Colors.primary} />
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={handleCancelFilters} style={styles.modalCloseBtn}>
                <X size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionTitle}>Date</Text>
            <View style={styles.filterGroup}>
              {dateFilters.map(f => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.filterBtn, tempDateFilter === f.value && styles.filterBtnActive]}
                  onPress={() => {
                    if (f.value === PICK_DATE) {
                      setShowDatePicker(true);
                    } else {
                      setTempDateFilter(f.value);
                      setTempPickedDate(null);
                    }
                  }}
                >
                  <Text style={[styles.filterBtnText, tempDateFilter === f.value && styles.filterBtnTextActive]}>
                    {f.value === PICK_DATE && tempDateFilter === PICK_DATE && tempPickedDate
                      ? formatDateDDMMYYYY(tempPickedDate)
                      : f.label}
                  </Text>
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

      <DatePickerModal
        visible={showDatePicker}
        title="Pick a Date"
        value={tempPickedDate}
        maxDate={new Date()}
        onSelect={(d) => {
          if (d) {
            setTempPickedDate(d);
            setTempDateFilter(PICK_DATE);
          }
        }}
        onClose={() => setShowDatePicker(false)}
      />

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

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  filterTrigger: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  filterTriggerActive: {
    backgroundColor: Colors.primary,
  },

  /* Active filters */
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.sm,
    gap: 6,
    flexWrap: 'wrap',
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeFilterText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearFiltersText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.danger,
  },

  /* Results row */
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.sm,
  },
  resultsCount: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  resultsTotal: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  resultsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  reportDownloadBtnDisabled: {
    opacity: 0.6,
  },
  reportDownloadText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.surface,
  },

  listContent: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: 100,
  },

  /* Error */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dangerLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.screen,
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
    color: Colors.surface,
  },

  /* Sale card */
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
  },
  customerName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  saleId: {
    fontSize: 9,
    color: Colors.textTertiary,
    marginTop: 2,
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: FontSize.title,
    fontWeight: '700',
    color: Colors.text,
  },
  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  cashBadge: {
    backgroundColor: '#D1FAE5',
  },
  onlineBadge: {
    backgroundColor: '#EDE9FE',
  },
  paymentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cashText: {
    color: '#10B981',
  },
  onlineText: {
    color: '#7C3AED',
  },
  cardBody: {
    paddingVertical: 6,
  },
  itemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  itemText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'column',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    gap: 4,
  },
  footerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  metaText: {
    fontSize: 9,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  billedByText: {
    fontSize: 9,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  actionBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  downloadText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  shareText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.surface,
  },

  /* Empty */
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },

  /* Filter modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.screen,
  },
  modalContent: {
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
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    flex: 1,
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.text,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterSectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  filterGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  filterBtn: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
  },
  filterBtnText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: FontSize.sm,
  },
  filterBtnTextActive: {
    color: Colors.surface,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.xxl,
    gap: Spacing.md,
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.xl,
  },
  modalBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  modalBtnPrimaryText: {
    color: Colors.surface,
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  modalBtnSecondary: {
    backgroundColor: Colors.background,
  },
  modalBtnSecondaryText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: FontSize.md,
  },
});