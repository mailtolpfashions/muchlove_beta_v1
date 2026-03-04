/**
 * Admin offers management — CRUD promotions, visit-threshold, student offers.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  Switch,
} from 'react-native';
import {
  Search,
  Download,
  Plus,
  Pencil,
  Trash2,
  Tag,
  Percent,
  X,
} from 'lucide-react-native';
import { useData } from '@/providers/DataProvider';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors } from '@/constants/web';
import { AnimatedPage } from '@/components/web/AnimatedPage';
import { DataTable, Column } from '@/components/web/DataTable';
import { StatCard } from '@/components/web/StatCard';
import { useAlert } from '@/providers/AlertProvider';
import type { Offer } from '@/types';

type AppliesToFilter = 'all' | 'services' | 'subscriptions' | 'both';

export default function AdminOffers() {
  const { offers, addOffer, updateOffer, deleteOffer, dataLoading } = useData();
  const { showAlert, showConfirm } = useAlert();

  const [search, setSearch] = useState('');
  const [appliesToFilter, setAppliesToFilter] = useState<AppliesToFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);

  // Form
  const [name, setName] = useState('');
  const [percent, setPercent] = useState('');
  const [visitCount, setVisitCount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliesTo, setAppliesTo] = useState<'services' | 'subscriptions' | 'both'>('both');
  const [studentOnly, setStudentOnly] = useState(false);

  const filtered = useMemo(() => {
    let result = [...offers];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(o => o.name.toLowerCase().includes(q));
    }
    if (appliesToFilter !== 'all') {
      result = result.filter(o => o.appliesTo === appliesToFilter);
    }
    return result;
  }, [offers, search, appliesToFilter]);

  const resetForm = (o?: Offer) => {
    setName(o?.name ?? '');
    setPercent(o?.percent?.toString() ?? '');
    setVisitCount(o?.visitCount?.toString() ?? '');
    setStartDate(o?.startDate ?? '');
    setEndDate(o?.endDate ?? '');
    setAppliesTo(o?.appliesTo ?? 'both');
    setStudentOnly(o?.studentOnly ?? false);
  };

  const openAdd = () => { setEditing(null); resetForm(); setShowModal(true); };
  const openEdit = (o: Offer) => { setEditing(o); resetForm(o); setShowModal(true); };

  const handleSave = async () => {
    if (!name.trim()) { showAlert('Error', 'Offer name is required'); return; }
    const pct = parseInt(percent, 10);
    if (isNaN(pct) || pct <= 0 || pct > 100) { showAlert('Error', 'Discount % must be 1–100'); return; }
    try {
      const payload = {
        name: name.trim(),
        percent: pct,
        visitCount: visitCount ? parseInt(visitCount, 10) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        appliesTo,
        studentOnly,
      };
      if (editing) {
        await updateOffer({ ...payload, id: editing.id, createdAt: editing.createdAt });
        showAlert('Updated', `${name.trim()} updated`);
      } else {
        await addOffer(payload);
        showAlert('Added', `${name.trim()} created`);
      }
      setShowModal(false);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save offer');
    }
  };

  const handleDelete = (o: Offer) => {
    showConfirm('Delete Offer', `Remove "${o.name}"?`, async () => {
      try {
        await deleteOffer(o.id);
        showAlert('Deleted', `${o.name} removed`);
      } catch (e: any) { showAlert('Error', e.message); }
    });
  };

  const exportCSV = () => {
    const header = 'Name,Discount %,Visit Threshold,Applies To,Student Only,Start,End';
    const rows = filtered.map(o =>
      `"${o.name}",${o.percent},${o.visitCount ?? ''},${o.appliesTo},${o.studentOnly ? 'Yes' : 'No'},"${o.startDate ?? ''}","${o.endDate ?? ''}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'offers.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<Offer>[] = [
    { key: 'name', title: 'Offer Name', sortable: true, width: '22%',
      render: (o) => <Text style={s.cellBold}>{o.name}</Text> },
    { key: 'percent', title: 'Discount', width: '10%', sortable: true,
      render: (o) => <Text style={[s.cell, { color: Colors.primary, fontWeight: '700' }]}>{o.percent}%</Text> },
    { key: 'visitCount', title: 'Min Visits', width: '10%',
      render: (o) => <Text style={s.cell}>{o.visitCount ?? '—'}</Text> },
    { key: 'appliesTo', title: 'Applies To', width: '12%',
      render: (o) => (
        <View style={[s.badge, s.badgeType]}>
          <Text style={s.badgeTypeText}>{o.appliesTo === 'both' ? 'All' : o.appliesTo === 'services' ? 'Services' : 'Subs'}</Text>
        </View>
      ) },
    { key: 'studentOnly', title: 'Student', width: '8%',
      render: (o) => <Text style={s.cell}>{o.studentOnly ? 'Yes' : 'No'}</Text> },
    { key: 'startDate', title: 'Period', width: '18%',
      render: (o) => <Text style={s.cellSmall}>{o.startDate && o.endDate ? `${o.startDate} — ${o.endDate}` : 'Always'}</Text> },
    { key: 'actions', title: '', width: '10%',
      render: (o) => (
        <View style={s.actions}>
          <Pressable style={s.actionBtn} onPress={() => openEdit(o)}><Pencil size={15} color={Colors.primary} /></Pressable>
          <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={() => handleDelete(o)}><Trash2 size={15} color="#DC2626" /></Pressable>
        </View>
      ) },
  ];

  return (
    <AnimatedPage>
      <View style={s.statsRow}>
        <StatCard icon={<Tag size={22} color="#E91E63" />} label="Total Offers" value={offers.length} gradient={WebColors.gradientRevenue} />
        <StatCard icon={<Percent size={22} color="#8B5CF6" />} label="Avg Discount" value={offers.length > 0 ? Math.round(offers.reduce((s, o) => s + o.percent, 0) / offers.length) : 0} suffix="%" gradient={WebColors.gradientSales} />
      </View>

      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput style={s.searchInput} placeholder="Search offers..." value={search} onChangeText={setSearch} placeholderTextColor={Colors.textTertiary} />
          {search ? <Pressable onPress={() => setSearch('')}><X size={16} color={Colors.textTertiary} /></Pressable> : null}
        </View>
        <View style={s.toolbarRight}>
          <View style={s.filterRow}>
            {(['all', 'services', 'subscriptions', 'both'] as const).map(f => (
              <Pressable key={f} style={[s.filterChip, appliesToFilter === f && s.filterChipActive]} onPress={() => setAppliesToFilter(f)}>
                <Text style={[s.filterText, appliesToFilter === f && s.filterTextActive]}>{f === 'all' ? 'All' : f === 'both' ? 'Both' : f === 'services' ? 'Services' : 'Subs'}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={s.exportBtn} onPress={exportCSV}>
            <Download size={16} color={Colors.textSecondary} />
            <Text style={s.exportText}>Export</Text>
          </Pressable>
          <Pressable style={s.addBtn} onPress={openAdd}>
            <Plus size={16} color="#FFF" />
            <Text style={s.addBtnText}>Add Offer</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.tableCard}>
        <DataTable columns={columns} data={filtered} keyExtractor={o => o.id} loading={dataLoading} emptyTitle="No offers found" emptySubtitle="Create your first offer" />
      </View>

      {/* Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <Pressable style={s.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={s.modal} onPress={e => e.stopPropagation()}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editing ? 'Edit Offer' : 'Add Offer'}</Text>
              <Pressable onPress={() => setShowModal(false)}><X size={20} color={Colors.textSecondary} /></Pressable>
            </View>

            <View style={s.formRow}>
              <View style={s.formField}>
                <Text style={s.label}>Name *</Text>
                <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Offer name" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={s.formField}>
                <Text style={s.label}>Discount % *</Text>
                <TextInput style={s.input} value={percent} onChangeText={setPercent} placeholder="e.g. 20" keyboardType="numeric" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            <View style={s.formRow}>
              <View style={s.formField}>
                <Text style={s.label}>Min Visits (optional)</Text>
                <TextInput style={s.input} value={visitCount} onChangeText={setVisitCount} placeholder="e.g. 5" keyboardType="numeric" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={s.formField}>
                <Text style={s.label}>Applies To</Text>
                <View style={s.roleRow}>
                  {(['both', 'services', 'subscriptions'] as const).map(v => (
                    <Pressable key={v} style={[s.roleChip, appliesTo === v && s.roleChipActive]} onPress={() => setAppliesTo(v)}>
                      <Text style={[s.roleChipText, appliesTo === v && s.roleChipTextActive]}>{v === 'both' ? 'Both' : v === 'services' ? 'Services' : 'Subs'}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={s.formRow}>
              <View style={s.formField}>
                <Text style={s.label}>Start Date</Text>
                <TextInput style={s.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={s.formField}>
                <Text style={s.label}>End Date</Text>
                <TextInput style={s.input} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            <View style={[s.formRow, { alignItems: 'center' }]}>
              <View style={s.formField}>
                <Text style={s.label}>Student Only</Text>
                <View style={s.switchRow}>
                  <Switch value={studentOnly} onValueChange={setStudentOnly} trackColor={{ false: '#E5E7EB', true: Colors.primaryLight }} thumbColor={studentOnly ? Colors.primary : '#FFF'} />
                  <Text style={s.switchLabel}>{studentOnly ? 'Yes' : 'No'}</Text>
                </View>
              </View>
            </View>

            <View style={s.modalFooter}>
              <Pressable style={s.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.saveBtn} onPress={handleSave}>
                <Text style={s.saveText}>{editing ? 'Update' : 'Add Offer'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AnimatedPage>
  );
}

const s = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 24, flexWrap: 'wrap' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#F1F1F4', flex: 1, maxWidth: 320, gap: 8 },
  searchInput: { flex: 1, fontSize: WebTypo.body, color: Colors.text, outlineStyle: 'none' as any },
  toolbarRight: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  filterRow: { flexDirection: 'row', gap: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterText: { fontSize: WebTypo.tiny, color: Colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: Colors.primary, fontWeight: '600' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#F1F1F4' },
  exportText: { fontSize: WebTypo.button, color: Colors.textSecondary, fontWeight: '500' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  addBtnText: { fontSize: WebTypo.button, color: '#FFF', fontWeight: '600' },
  tableCard: { backgroundColor: '#FFF', borderRadius: 14, overflow: 'hidden', shadowColor: WebColors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },

  cell: { fontSize: WebTypo.table, color: Colors.text },
  cellBold: { fontSize: WebTypo.table, color: Colors.text, fontWeight: '600' },
  cellSmall: { fontSize: WebTypo.tiny, color: Colors.textSecondary },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 6, borderRadius: 8, backgroundColor: Colors.primaryLight },
  deleteBtn: { backgroundColor: '#FEE2E2' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  badgeText: { fontSize: WebTypo.tiny, fontWeight: '600' },
  badgeType: { backgroundColor: '#DBEAFE' },
  badgeTypeText: { fontSize: WebTypo.tiny, fontWeight: '600', color: '#2563EB' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#FFF', borderRadius: 16, padding: 28, width: '90%', maxWidth: 560, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: WebTypo.h2, fontWeight: '700', color: Colors.text },
  formRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  formField: { flex: 1 },
  label: { fontSize: WebTypo.label, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: WebTypo.body, color: Colors.text, backgroundColor: '#FAFAFA', outlineStyle: 'none' as any },
  roleRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  roleChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' },
  roleChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  roleChipText: { fontSize: WebTypo.small, color: Colors.textSecondary, fontWeight: '500' },
  roleChipTextActive: { color: Colors.primary, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  switchLabel: { fontSize: WebTypo.body, color: Colors.text },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  cancelText: { fontSize: WebTypo.button, color: Colors.textSecondary, fontWeight: '500' },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.primary },
  saveText: { fontSize: WebTypo.button, color: '#FFF', fontWeight: '600' },
});
