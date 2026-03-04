/**
 * Admin customer subscriptions — list, search, toggle status, CSV export.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import {
  Search,
  Download,
  X,
  CreditCard,
  Users,
  PauseCircle,
  PlayCircle,
  Trash2,
} from 'lucide-react-native';
import { useData } from '@/providers/DataProvider';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors } from '@/constants/web';
import { AnimatedPage } from '@/components/web/AnimatedPage';
import { DataTable, Column } from '@/components/web/DataTable';
import { StatCard } from '@/components/web/StatCard';
import { useAlert } from '@/providers/AlertProvider';
import { formatCurrency } from '@/utils/format';
import type { CustomerSubscription } from '@/types';

type StatusFilter = 'all' | 'active' | 'paused';

export default function AdminCustomerSubscriptions() {
  const {
    customerSubscriptions,
    updateCustomerSubscription,
    removeCustomerSubscription,
    dataLoading,
  } = useData();
  const { showAlert, showConfirm } = useAlert();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    let result = [...customerSubscriptions];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(cs =>
        cs.customerName.toLowerCase().includes(q) || cs.planName.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(cs => cs.status === statusFilter);
    }
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [customerSubscriptions, search, statusFilter]);

  const activeCount = customerSubscriptions.filter(cs => cs.status === 'active').length;
  const pausedCount = customerSubscriptions.filter(cs => cs.status === 'paused').length;
  const totalValue = customerSubscriptions.reduce((s, cs) => s + cs.planPrice, 0);

  const toggleStatus = async (cs: CustomerSubscription) => {
    const newStatus = cs.status === 'active' ? 'paused' : 'active';
    try {
      await updateCustomerSubscription({ id: cs.id, status: newStatus });
      showAlert('Updated', `${cs.customerName}'s subscription ${newStatus}`);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to update');
    }
  };

  const handleRemove = (cs: CustomerSubscription) => {
    showConfirm('Remove', `Remove ${cs.customerName}'s subscription to ${cs.planName}?`, async () => {
      try {
        await removeCustomerSubscription(cs.id);
        showAlert('Removed', 'Subscription removed');
      } catch (e: any) { showAlert('Error', e.message); }
    });
  };

  const exportCSV = () => {
    const header = 'Customer,Plan,Duration,Price,Status,Start Date,Assigned By';
    const rows = filtered.map(cs =>
      `"${cs.customerName}","${cs.planName}",${cs.planDurationMonths},${cs.planPrice},${cs.status},"${cs.startDate}","${cs.assignedByName}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'customer-subscriptions.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<CustomerSubscription>[] = [
    { key: 'customerName', title: 'Customer', sortable: true, width: '20%',
      render: (cs) => <Text style={s.cellBold}>{cs.customerName}</Text> },
    { key: 'planName', title: 'Plan', sortable: true, width: '16%',
      render: (cs) => <Text style={s.cell}>{cs.planName}</Text> },
    { key: 'planDurationMonths', title: 'Duration', width: '10%',
      render: (cs) => <Text style={s.cell}>{cs.planDurationMonths}M</Text> },
    { key: 'planPrice', title: 'Price', sortable: true, width: '10%',
      render: (cs) => <Text style={s.cellBold}>₹{formatCurrency(cs.planPrice)}</Text> },
    { key: 'status', title: 'Status', width: '10%',
      render: (cs) => (
        <Pressable onPress={() => toggleStatus(cs)}>
          <View style={[s.badge, cs.status === 'active' ? s.badgeActive : s.badgePaused]}>
            <Text style={[s.badgeText, cs.status === 'active' ? s.badgeActiveText : s.badgePausedText]}>
              {cs.status === 'active' ? 'Active' : 'Paused'}
            </Text>
          </View>
        </Pressable>
      ) },
    { key: 'startDate', title: 'Started', width: '12%', sortable: true,
      render: (cs) => <Text style={s.cellSmall}>{new Date(cs.startDate).toLocaleDateString('en-IN')}</Text> },
    { key: 'assignedByName', title: 'By', width: '12%',
      render: (cs) => <Text style={s.cellSmall}>{cs.assignedByName}</Text> },
    { key: 'actions', title: '', width: '8%',
      render: (cs) => (
        <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={() => handleRemove(cs)}>
          <Trash2 size={15} color="#DC2626" />
        </Pressable>
      ) },
  ];

  return (
    <AnimatedPage>
      <View style={s.statsRow}>
        <StatCard icon={<CreditCard size={22} color="#E91E63" />} label="Total" value={customerSubscriptions.length} gradient={WebColors.gradientRevenue} />
        <StatCard icon={<PlayCircle size={22} color="#0EA5E9" />} label="Active" value={activeCount} gradient={WebColors.gradientStaff} />
        <StatCard icon={<PauseCircle size={22} color="#F59E0B" />} label="Paused" value={pausedCount} gradient={WebColors.gradientRequests} />
        <StatCard icon={<Users size={22} color="#8B5CF6" />} label="Total Value" value={totalValue} prefix="₹" gradient={WebColors.gradientSales} />
      </View>

      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput style={s.searchInput} placeholder="Search subscriptions..." value={search} onChangeText={setSearch} placeholderTextColor={Colors.textTertiary} />
          {search ? <Pressable onPress={() => setSearch('')}><X size={16} color={Colors.textTertiary} /></Pressable> : null}
        </View>
        <View style={s.toolbarRight}>
          <View style={s.filterRow}>
            {(['all', 'active', 'paused'] as const).map(f => (
              <Pressable key={f} style={[s.filterChip, statusFilter === f && s.filterChipActive]} onPress={() => setStatusFilter(f)}>
                <Text style={[s.filterText, statusFilter === f && s.filterTextActive]}>{f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Paused'}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={s.exportBtn} onPress={exportCSV}>
            <Download size={16} color={Colors.textSecondary} />
            <Text style={s.exportText}>Export</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.tableCard}>
        <DataTable columns={columns} data={filtered} keyExtractor={cs => cs.id} loading={dataLoading} emptyTitle="No subscriptions found" emptySubtitle="Customer subscriptions will appear here" />
      </View>
    </AnimatedPage>
  );
}

const s = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 24, flexWrap: 'wrap' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#F1F1F4', flex: 1, maxWidth: 400, gap: 8 },
  searchInput: { flex: 1, fontSize: WebTypo.body, color: Colors.text, outlineStyle: 'none' as any },
  toolbarRight: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  filterRow: { flexDirection: 'row', gap: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterText: { fontSize: WebTypo.tiny, color: Colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: Colors.primary, fontWeight: '600' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#F1F1F4' },
  exportText: { fontSize: WebTypo.button, color: Colors.textSecondary, fontWeight: '500' },
  tableCard: { backgroundColor: '#FFF', borderRadius: 14, overflow: 'hidden', shadowColor: WebColors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },

  cell: { fontSize: WebTypo.table, color: Colors.text },
  cellBold: { fontSize: WebTypo.table, color: Colors.text, fontWeight: '600' },
  cellSmall: { fontSize: WebTypo.tiny, color: Colors.textSecondary },
  actionBtn: { padding: 6, borderRadius: 8, backgroundColor: Colors.primaryLight },
  deleteBtn: { backgroundColor: '#FEE2E2' },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  badgeText: { fontSize: WebTypo.tiny, fontWeight: '600' },
  badgeActive: { backgroundColor: '#D1FAE5' },
  badgeActiveText: { color: '#059669' },
  badgePaused: { backgroundColor: '#FEF3C7' },
  badgePausedText: { color: '#D97706' },
});
