/**
 * Admin customer management — CRUD with search, sort, and CSV export.
 */

import React, { useState, useMemo, useCallback } from 'react';
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
  Users,
  UserPlus,
  GraduationCap,
  PhoneCall,
  X,
} from 'lucide-react-native';
import { useData } from '@/providers/DataProvider';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors } from '@/constants/web';
import { AnimatedPage } from '@/components/web/AnimatedPage';
import { DataTable, Column } from '@/components/web/DataTable';
import { StatCard } from '@/components/web/StatCard';
import { useAlert } from '@/providers/AlertProvider';
import type { Customer } from '@/types';

export default function AdminCustomers() {
  const {
    customers, addCustomer, updateCustomer, dataLoading,
  } = useData();
  const { showAlert, showConfirm } = useAlert();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [altNumber, setAltNumber] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [isStudent, setIsStudent] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.mobile.includes(q) ||
      (c.location ?? '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  // Stats
  const totalCustomers = customers.length;
  const studentCount = customers.filter(c => c.isStudent).length;

  const resetForm = (c?: Customer) => {
    setName(c?.name ?? '');
    setMobile(c?.mobile ?? '');
    setAltNumber(c?.altNumber ?? '');
    setAge(c?.age ?? '');
    setLocation(c?.location ?? '');
    setIsStudent(c?.isStudent ?? false);
  };

  const openAdd = () => { setEditing(null); resetForm(); setShowModal(true); };
  const openEdit = (c: Customer) => { setEditing(c); resetForm(c); setShowModal(true); };

  const handleSave = async () => {
    if (!name.trim()) { showAlert('Error', 'Customer name is required'); return; }
    if (!mobile.trim() || mobile.trim().length < 10) { showAlert('Error', 'Valid mobile number is required'); return; }
    try {
      if (editing) {
        await updateCustomer({
          ...editing,
          name: name.trim(),
          mobile: mobile.trim(),
          altNumber: altNumber.trim(),
          age: age.trim(),
          location: location.trim(),
          isStudent,
        });
        showAlert('Updated', `${name.trim()} updated successfully`);
      } else {
        await addCustomer({
          name: name.trim(),
          mobile: mobile.trim(),
          altNumber: altNumber.trim(),
          age: age.trim(),
          location: location.trim(),
          isStudent,
        });
        showAlert('Added', `${name.trim()} added successfully`);
      }
      setShowModal(false);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save customer');
    }
  };

  const exportCSV = () => {
    const header = 'Name,Mobile,Alt Number,Age,Location,Student,Visits,Created';
    const rows = filtered.map(c =>
      `"${c.name}","${c.mobile}","${c.altNumber}","${c.age}","${c.location}",${c.isStudent ? 'Yes' : 'No'},${c.visitCount},"${c.createdAt}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'customers.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<Customer>[] = [
    { key: 'name', title: 'Name', sortable: true, width: '20%',
      render: (c) => <Text style={s.cellBold}>{c.name}</Text> },
    { key: 'mobile', title: 'Mobile', width: '15%',
      render: (c) => <Text style={s.cell}>{c.mobile}</Text> },
    { key: 'age', title: 'Age', width: '8%', sortable: true,
      render: (c) => <Text style={s.cell}>{c.age || '—'}</Text> },
    { key: 'location', title: 'Location', width: '15%',
      render: (c) => <Text style={s.cell}>{c.location || '—'}</Text> },
    { key: 'isStudent', title: 'Student', width: '8%',
      render: (c) => (
        <View style={[s.badge, c.isStudent ? s.badgeYes : s.badgeNo]}>
          <Text style={[s.badgeText, c.isStudent ? s.badgeYesText : s.badgeNoText]}>
            {c.isStudent ? 'Yes' : 'No'}
          </Text>
        </View>
      ) },
    { key: 'visitCount', title: 'Visits', width: '8%', sortable: true,
      render: (c) => <Text style={s.cell}>{c.visitCount}</Text> },
    { key: 'createdAt', title: 'Joined', width: '12%', sortable: true,
      render: (c) => <Text style={s.cellSmall}>{new Date(c.createdAt).toLocaleDateString('en-IN')}</Text> },
    { key: 'actions', title: '', width: '10%',
      render: (c) => (
        <View style={s.actions}>
          <Pressable style={s.actionBtn} onPress={() => openEdit(c)}>
            <Pencil size={15} color={Colors.primary} />
          </Pressable>
        </View>
      ) },
  ];

  return (
    <AnimatedPage>
      {/* Stat cards */}
      <View style={s.statsRow}>
        <StatCard icon={<Users size={22} color="#E91E63" />} label="Total Customers" value={totalCustomers} gradient={WebColors.gradientRevenue} />
        <StatCard icon={<GraduationCap size={22} color="#8B5CF6" />} label="Students" value={studentCount} gradient={WebColors.gradientSales} />
      </View>

      {/* Toolbar */}
      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput
            style={s.searchInput}
            placeholder="Search customers..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={Colors.textTertiary}
          />
          {search ? <Pressable onPress={() => setSearch('')}><X size={16} color={Colors.textTertiary} /></Pressable> : null}
        </View>
        <View style={s.toolbarRight}>
          <Pressable style={s.exportBtn} onPress={exportCSV}>
            <Download size={16} color={Colors.textSecondary} />
            <Text style={s.exportText}>Export</Text>
          </Pressable>
          <Pressable style={s.addBtn} onPress={openAdd}>
            <Plus size={16} color="#FFF" />
            <Text style={s.addBtnText}>Add Customer</Text>
          </Pressable>
        </View>
      </View>

      {/* Table */}
      <View style={s.tableCard}>
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={c => c.id}
          loading={dataLoading}
          emptyTitle="No customers found"
          emptySubtitle="Add your first customer to get started"
        />
      </View>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <Pressable style={s.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={s.modal} onPress={e => e.stopPropagation()}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editing ? 'Edit Customer' : 'Add Customer'}</Text>
              <Pressable onPress={() => setShowModal(false)}><X size={20} color={Colors.textSecondary} /></Pressable>
            </View>

            <View style={s.formRow}>
              <View style={s.formField}>
                <Text style={s.label}>Name *</Text>
                <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Customer name" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={s.formField}>
                <Text style={s.label}>Mobile *</Text>
                <TextInput style={s.input} value={mobile} onChangeText={setMobile} placeholder="10-digit mobile" keyboardType="phone-pad" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            <View style={s.formRow}>
              <View style={s.formField}>
                <Text style={s.label}>Age</Text>
                <TextInput style={s.input} value={age} onChangeText={setAge} placeholder="Age" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={s.formField}>
                <Text style={s.label}>Location</Text>
                <TextInput style={s.input} value={location} onChangeText={setLocation} placeholder="Location" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            <View style={s.formRow}>
              <View style={s.formField}>
                <Text style={s.label}>Alt Number</Text>
                <TextInput style={s.input} value={altNumber} onChangeText={setAltNumber} placeholder="Alternate number" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={s.formField}>
                <Text style={s.label}>Student</Text>
                <View style={s.switchRow}>
                  <Switch value={isStudent} onValueChange={setIsStudent} trackColor={{ false: '#E5E7EB', true: Colors.primaryLight }} thumbColor={isStudent ? Colors.primary : '#FFF'} />
                  <Text style={s.switchLabel}>{isStudent ? 'Yes' : 'No'}</Text>
                </View>
              </View>
            </View>

            <View style={s.modalFooter}>
              <Pressable style={s.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.saveBtn} onPress={handleSave}>
                <Text style={s.saveText}>{editing ? 'Update' : 'Add Customer'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AnimatedPage>
  );
}

// ── Styles ────────────────────────────────────────────────────

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
  cellSmall: { fontSize: WebTypo.tiny, color: Colors.textSecondary },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 6, borderRadius: 8, backgroundColor: Colors.primaryLight },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeYes: { backgroundColor: '#EDE9FE' },
  badgeNo: { backgroundColor: '#F3F4F6' },
  badgeText: { fontSize: WebTypo.tiny, fontWeight: '600' },
  badgeYesText: { color: '#7C3AED' },
  badgeNoText: { color: '#6B7280' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#FFF', borderRadius: 16, padding: 28, width: '90%', maxWidth: 560, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: WebTypo.h2, fontWeight: '700', color: Colors.text },
  formRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  formField: { flex: 1 },
  label: { fontSize: WebTypo.label, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: WebTypo.body, color: Colors.text, backgroundColor: '#FAFAFA', outlineStyle: 'none' as any },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  switchLabel: { fontSize: WebTypo.body, color: Colors.text },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  cancelText: { fontSize: WebTypo.button, color: Colors.textSecondary, fontWeight: '500' },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.primary },
  saveText: { fontSize: WebTypo.button, color: '#FFF', fontWeight: '600' },
});
