/**
 * Admin UPI Payments management — CRUD UPI IDs, CSV export.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import {
  Plus,
  Search,
  Download,
  X,
  Wallet,
  Trash2,
  Edit2,
} from 'lucide-react-native';
import { usePayment } from '@/providers/PaymentProvider';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors } from '@/constants/web';
import { AnimatedPage } from '@/components/web/AnimatedPage';
import { DataTable, Column } from '@/components/web/DataTable';
import { StatCard } from '@/components/web/StatCard';
import { useAlert } from '@/providers/AlertProvider';
import { capitalizeWords } from '@/utils/format';
import type { UpiData } from '@/types';

export default function AdminPayments() {
  const { upiList, addUpi, updateUpi, removeUpi } = usePayment();
  const { showAlert, showConfirm } = useAlert();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UpiData | null>(null);

  // Form
  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return upiList;
    const q = search.toLowerCase();
    return upiList.filter(u =>
      u.payeeName.toLowerCase().includes(q) || u.upiId.toLowerCase().includes(q)
    );
  }, [upiList, search]);

  const openAdd = () => { setEditing(null); setUpiId(''); setPayeeName(''); setShowModal(true); };
  const openEdit = (item: UpiData) => { setEditing(item); setUpiId(item.upiId); setPayeeName(item.payeeName); setShowModal(true); };

  const handleSave = async () => {
    if (!upiId.trim() || !payeeName.trim()) {
      showAlert('Error', 'Both UPI ID and Payee Name are required');
      return;
    }
    try {
      if (editing) {
        await updateUpi({ id: editing.id, upiId: upiId.trim(), payeeName: capitalizeWords(payeeName.trim()) });
      } else {
        await addUpi({ upiId: upiId.trim(), payeeName: capitalizeWords(payeeName.trim()) });
      }
      setShowModal(false);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save');
    }
  };

  const handleRemove = (item: UpiData) => {
    showConfirm('Delete UPI', `Delete "${item.payeeName}"?`, async () => {
      try { await removeUpi(item.id); } catch (e: any) { showAlert('Error', e.message); }
    });
  };

  const exportCSV = () => {
    const header = 'Payee Name,UPI ID';
    const rows = filtered.map(u => `"${u.payeeName}","${u.upiId}"`);
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'upi-list.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<UpiData>[] = [
    { key: 'payeeName', title: 'Payee Name', sortable: true, width: '30%',
      render: (u) => <Text style={s.cellBold}>{u.payeeName}</Text> },
    { key: 'upiId', title: 'UPI ID', sortable: true, width: '40%',
      render: (u) => <Text style={s.cell}>{u.upiId}</Text> },
    { key: 'actions', title: '', width: '20%',
      render: (u) => (
        <View style={s.actionsRow}>
          <Pressable style={s.actionBtn} onPress={() => openEdit(u)}>
            <Edit2 size={15} color={Colors.primary} />
          </Pressable>
          <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={() => handleRemove(u)}>
            <Trash2 size={15} color="#DC2626" />
          </Pressable>
        </View>
      ) },
  ];

  return (
    <AnimatedPage>
      <View style={s.statsRow}>
        <StatCard icon={<Wallet size={22} color="#8B5CF6" />} label="UPI Accounts" value={upiList.length} gradient={WebColors.gradientSales} />
      </View>

      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput style={s.searchInput} placeholder="Search UPI..." value={search} onChangeText={setSearch} placeholderTextColor={Colors.textTertiary} />
          {search ? <Pressable onPress={() => setSearch('')}><X size={16} color={Colors.textTertiary} /></Pressable> : null}
        </View>
        <View style={s.toolbarRight}>
          <Pressable style={s.exportBtn} onPress={exportCSV}>
            <Download size={16} color={Colors.textSecondary} />
            <Text style={s.exportText}>Export</Text>
          </Pressable>
          <Pressable style={s.addBtn} onPress={openAdd}>
            <Plus size={18} color="#FFF" />
            <Text style={s.addBtnText}>Add UPI</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.tableCard}>
        <DataTable columns={columns} data={filtered} keyExtractor={u => u.id} loading={false} emptyTitle="No UPI accounts" emptySubtitle="Add UPI IDs to accept payments" />
      </View>

      {/* Add / Edit Modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <Pressable style={s.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={s.modal} onPress={e => e.stopPropagation()}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editing ? 'Edit UPI' : 'Add UPI'}</Text>
              <Pressable onPress={() => setShowModal(false)}><X size={20} color={Colors.textSecondary} /></Pressable>
            </View>
            <ScrollView style={s.form} showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Payee Name *</Text>
              <TextInput style={s.input} value={payeeName} onChangeText={setPayeeName} placeholder="e.g. Your Name" placeholderTextColor={Colors.textTertiary} />
              <Text style={s.label}>UPI ID *</Text>
              <TextInput style={s.input} value={upiId} onChangeText={setUpiId} placeholder="e.g. yourname@okaxis" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            </ScrollView>
            <Pressable style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveBtnText}>{editing ? 'Save Changes' : 'Add UPI'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </AnimatedPage>
  );
}

const s = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 24, flexWrap: 'wrap' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#F1F1F4', flex: 1, maxWidth: 400, gap: 8 },
  searchInput: { flex: 1, fontSize: WebTypo.body, color: Colors.text, outlineStyle: 'none' as any },
  toolbarRight: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#F1F1F4' },
  exportText: { fontSize: WebTypo.button, color: Colors.textSecondary, fontWeight: '500' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  addBtnText: { fontSize: WebTypo.button, color: '#FFF', fontWeight: '600' },
  tableCard: { backgroundColor: '#FFF', borderRadius: 14, overflow: 'hidden', shadowColor: WebColors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },

  cell: { fontSize: WebTypo.table, color: Colors.text },
  cellBold: { fontSize: WebTypo.table, color: Colors.text, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 6 },
  actionBtn: { padding: 6, borderRadius: 8, backgroundColor: Colors.primaryLight },
  deleteBtn: { backgroundColor: '#FEE2E2' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#FFF', borderRadius: 16, width: 420, maxHeight: '70%', padding: 28, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: WebTypo.h3, fontWeight: '700', color: Colors.text },
  form: { maxHeight: 300 },
  label: { fontSize: WebTypo.tiny, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4, marginTop: 14 },
  input: { height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, fontSize: WebTypo.body, color: Colors.text, backgroundColor: '#FAFAFA' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: WebTypo.body },
});
