/**
 * Admin expenses — CRUD expenses + categories, month navigation, CSV export.
 */

import React, { useState, useMemo, useCallback } from 'react';
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
  Search,
  Download,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  Wallet,
  FolderOpen,
  Tag,
} from 'lucide-react-native';
import { useData } from '@/providers/DataProvider';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors } from '@/constants/web';
import { AnimatedPage } from '@/components/web/AnimatedPage';
import { DataTable, Column } from '@/components/web/DataTable';
import { StatCard } from '@/components/web/StatCard';
import { useAlert } from '@/providers/AlertProvider';
import { formatCurrency, toLocalDateString } from '@/utils/format';
import type { Expense, ExpenseCategory } from '@/types';

export default function AdminExpenses() {
  const {
    allExpenses, expenseCategories,
    addExpense, updateExpense, deleteExpense,
    addExpenseCategory, deleteExpenseCategory,
    dataLoading,
  } = useData();
  const { showAlert, showConfirm } = useAlert();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [monthOffset, setMonthOffset] = useState(0);

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Expense form
  const [expCategoryId, setExpCategoryId] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expDate, setExpDate] = useState(toLocalDateString(new Date()));

  // Category form
  const [catName, setCatName] = useState('');

  // Date helpers
  const { viewMonth, viewYear, viewMonthName } = useMemo(() => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1);
    return {
      viewMonth: d.getMonth(),
      viewYear: d.getFullYear(),
      viewMonthName: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    };
  }, [monthOffset]);

  // Filter expenses for selected month
  const monthExpenses = useMemo(() => {
    return allExpenses.filter(e => {
      const d = new Date(e.expenseDate);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    });
  }, [allExpenses, viewMonth, viewYear]);

  const filtered = useMemo(() => {
    let result = [...monthExpenses];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e => e.categoryName.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'all') {
      result = result.filter(e => e.categoryId === categoryFilter);
    }
    result.sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime());
    return result;
  }, [monthExpenses, search, categoryFilter]);

  // Stats
  const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const categoryCount = expenseCategories.length;

  const resetExpenseForm = (e?: Expense) => {
    setExpCategoryId(e?.categoryId ?? (expenseCategories[0]?.id ?? ''));
    setExpAmount(e?.amount?.toString() ?? '');
    setExpDescription(e?.description ?? '');
    setExpDate(e?.expenseDate ?? toLocalDateString(new Date()));
  };

  const openAddExpense = () => { setEditingExpense(null); resetExpenseForm(); setShowExpenseModal(true); };
  const openEditExpense = (e: Expense) => { setEditingExpense(e); resetExpenseForm(e); setShowExpenseModal(true); };

  const handleSaveExpense = async () => {
    const amt = parseFloat(expAmount);
    if (isNaN(amt) || amt <= 0) { showAlert('Error', 'Enter a valid amount'); return; }
    if (!expCategoryId) { showAlert('Error', 'Select a category'); return; }
    const catName = expenseCategories.find(c => c.id === expCategoryId)?.name ?? '';
    try {
      if (editingExpense) {
        await updateExpense({
          id: editingExpense.id,
          categoryId: expCategoryId,
          categoryName: catName,
          amount: amt,
          description: expDescription.trim(),
          expenseDate: expDate,
        });
        showAlert('Updated', 'Expense updated');
      } else {
        await addExpense({
          categoryId: expCategoryId,
          categoryName: catName,
          amount: amt,
          description: expDescription.trim(),
          expenseDate: expDate,
        });
        showAlert('Added', 'Expense recorded');
      }
      setShowExpenseModal(false);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save');
    }
  };

  const handleDeleteExpense = (e: Expense) => {
    showConfirm('Delete Expense', `Remove ₹${e.amount} expense?`, async () => {
      try { await deleteExpense(e.id); } catch (err: any) { showAlert('Error', err.message); }
    });
  };

  const handleAddCategory = async () => {
    if (!catName.trim()) { showAlert('Error', 'Category name required'); return; }
    try {
      await addExpenseCategory(catName.trim());
      setCatName('');
      showAlert('Added', `Category "${catName.trim()}" added`);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to add category');
    }
  };

  const handleDeleteCategory = (cat: ExpenseCategory) => {
    showConfirm('Delete Category', `Remove "${cat.name}"?`, async () => {
      try { await deleteExpenseCategory(cat.id); } catch (e: any) { showAlert('Error', e.message); }
    });
  };

  const exportCSV = () => {
    const header = 'Date,Category,Amount,Description,Created By';
    const rows = filtered.map(e =>
      `"${e.expenseDate}","${e.categoryName}",${e.amount},"${e.description}","${e.createdByName}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `expenses-${viewMonthName}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<Expense>[] = [
    { key: 'expenseDate', title: 'Date', sortable: true, width: '14%',
      render: (e) => <Text style={s.cell}>{new Date(e.expenseDate).toLocaleDateString('en-IN')}</Text> },
    { key: 'categoryName', title: 'Category', sortable: true, width: '18%',
      render: (e) => (
        <View style={[s.badge, s.badgeCat]}>
          <Text style={s.badgeCatText}>{e.categoryName}</Text>
        </View>
      ) },
    { key: 'amount', title: 'Amount', sortable: true, width: '14%',
      render: (e) => <Text style={[s.cellBold, { color: '#DC2626' }]}>₹{formatCurrency(e.amount)}</Text> },
    { key: 'description', title: 'Description', width: '24%',
      render: (e) => <Text style={s.cell} numberOfLines={1}>{e.description || '—'}</Text> },
    { key: 'createdByName', title: 'By', width: '12%',
      render: (e) => <Text style={s.cellSmall}>{e.createdByName}</Text> },
    { key: 'actions', title: '', width: '10%',
      render: (e) => (
        <View style={s.actions}>
          <Pressable style={s.actionBtn} onPress={() => openEditExpense(e)}><Pencil size={15} color={Colors.primary} /></Pressable>
          <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={() => handleDeleteExpense(e)}><Trash2 size={15} color="#DC2626" /></Pressable>
        </View>
      ) },
  ];

  return (
    <AnimatedPage>
      {/* Stats */}
      <View style={s.statsRow}>
        <StatCard icon={<Wallet size={22} color="#E91E63" />} label="Month Total" value={monthTotal} prefix="₹" gradient={WebColors.gradientRevenue} />
        <StatCard icon={<FolderOpen size={22} color="#0EA5E9" />} label="Categories" value={categoryCount} gradient={WebColors.gradientStaff} />
        <StatCard icon={<IndianRupee size={22} color="#8B5CF6" />} label="Month Entries" value={monthExpenses.length} gradient={WebColors.gradientSales} />
      </View>

      {/* Month navigation */}
      <View style={s.monthNav}>
        <Pressable style={s.monthBtn} onPress={() => setMonthOffset(o => o - 1)}>
          <ChevronLeft size={20} color={Colors.text} />
        </Pressable>
        <Text style={s.monthText}>{viewMonthName}</Text>
        <Pressable style={s.monthBtn} onPress={() => setMonthOffset(o => o + 1)}>
          <ChevronRight size={20} color={Colors.text} />
        </Pressable>
      </View>

      {/* Toolbar */}
      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput style={s.searchInput} placeholder="Search expenses..." value={search} onChangeText={setSearch} placeholderTextColor={Colors.textTertiary} />
          {search ? <Pressable onPress={() => setSearch('')}><X size={16} color={Colors.textTertiary} /></Pressable> : null}
        </View>
        <View style={s.toolbarRight}>
          {expenseCategories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: 300 }} contentContainerStyle={{ gap: 4 }}>
              <Pressable style={[s.filterChip, categoryFilter === 'all' && s.filterChipActive]} onPress={() => setCategoryFilter('all')}>
                <Text style={[s.filterText, categoryFilter === 'all' && s.filterTextActive]}>All</Text>
              </Pressable>
              {expenseCategories.map(c => (
                <Pressable key={c.id} style={[s.filterChip, categoryFilter === c.id && s.filterChipActive]} onPress={() => setCategoryFilter(c.id)}>
                  <Text style={[s.filterText, categoryFilter === c.id && s.filterTextActive]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <Pressable style={s.catBtn} onPress={() => setShowCategoryModal(true)}>
            <FolderOpen size={16} color={Colors.primary} />
            <Text style={s.catBtnText}>Categories</Text>
          </Pressable>
          <Pressable style={s.exportBtn} onPress={exportCSV}>
            <Download size={16} color={Colors.textSecondary} />
            <Text style={s.exportText}>Export</Text>
          </Pressable>
          <Pressable style={s.addBtn} onPress={openAddExpense}>
            <Plus size={16} color="#FFF" />
            <Text style={s.addBtnText}>Add Expense</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.tableCard}>
        <DataTable columns={columns} data={filtered} keyExtractor={e => e.id} loading={dataLoading} emptyTitle="No expenses this month" />
      </View>

      {/* Expense Modal */}
      <Modal visible={showExpenseModal} transparent animationType="fade">
        <Pressable style={s.overlay} onPress={() => setShowExpenseModal(false)}>
          <Pressable style={s.modal} onPress={e => e.stopPropagation()}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editingExpense ? 'Edit Expense' : 'Add Expense'}</Text>
              <Pressable onPress={() => setShowExpenseModal(false)}><X size={20} color={Colors.textSecondary} /></Pressable>
            </View>
            <View style={s.formRow}>
              <View style={s.formField}>
                <Text style={s.label}>Category *</Text>
                <ScrollView horizontal style={s.catPickerRow} contentContainerStyle={{ gap: 6 }}>
                  {expenseCategories.map(c => (
                    <Pressable key={c.id} style={[s.roleChip, expCategoryId === c.id && s.roleChipActive]} onPress={() => setExpCategoryId(c.id)}>
                      <Text style={[s.roleChipText, expCategoryId === c.id && s.roleChipTextActive]}>{c.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={s.formRow}>
              <View style={s.formField}>
                <Text style={s.label}>Amount (₹) *</Text>
                <TextInput style={s.input} value={expAmount} onChangeText={setExpAmount} placeholder="e.g. 500" keyboardType="numeric" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={s.formField}>
                <Text style={s.label}>Date *</Text>
                <TextInput style={s.input} value={expDate} onChangeText={setExpDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>
            <View style={s.formRow}>
              <View style={s.formField}>
                <Text style={s.label}>Description</Text>
                <TextInput style={[s.input, { minHeight: 60 }]} value={expDescription} onChangeText={setExpDescription} placeholder="Details..." multiline placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>
            <View style={s.modalFooter}>
              <Pressable style={s.cancelBtn} onPress={() => setShowExpenseModal(false)}><Text style={s.cancelText}>Cancel</Text></Pressable>
              <Pressable style={s.saveBtn} onPress={handleSaveExpense}><Text style={s.saveText}>{editingExpense ? 'Update' : 'Add'}</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} transparent animationType="fade">
        <Pressable style={s.overlay} onPress={() => setShowCategoryModal(false)}>
          <Pressable style={[s.modal, { maxWidth: 440 }]} onPress={e => e.stopPropagation()}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Expense Categories</Text>
              <Pressable onPress={() => setShowCategoryModal(false)}><X size={20} color={Colors.textSecondary} /></Pressable>
            </View>
            <View style={[s.formRow, { marginBottom: 20 }]}>
              <View style={[s.formField, { flex: 3 }]}>
                <TextInput style={s.input} value={catName} onChangeText={setCatName} placeholder="New category name" placeholderTextColor={Colors.textTertiary} />
              </View>
              <Pressable style={[s.addBtn, { alignSelf: 'flex-end' }]} onPress={handleAddCategory}>
                <Plus size={16} color="#FFF" />
                <Text style={s.addBtnText}>Add</Text>
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {expenseCategories.length === 0 ? (
                <Text style={[s.cell, { textAlign: 'center', paddingVertical: 30 }]}>No categories yet</Text>
              ) : (
                expenseCategories.map(c => (
                  <View key={c.id} style={s.catRow}>
                    <Text style={s.cellBold}>{c.name}</Text>
                    <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={() => handleDeleteCategory(c)}>
                      <Trash2 size={14} color="#DC2626" />
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </AnimatedPage>
  );
}

const s = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 24, flexWrap: 'wrap' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 },
  monthBtn: { padding: 8, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB' },
  monthText: { fontSize: WebTypo.h3, fontWeight: '700', color: Colors.text },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#F1F1F4', flex: 1, maxWidth: 320, gap: 8 },
  searchInput: { flex: 1, fontSize: WebTypo.body, color: Colors.text, outlineStyle: 'none' as any },
  toolbarRight: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterText: { fontSize: WebTypo.tiny, color: Colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: Colors.primary, fontWeight: '600' },
  catBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  catBtnText: { fontSize: WebTypo.button, color: Colors.primary, fontWeight: '600' },
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
  badgeCat: { backgroundColor: '#EDE9FE' },
  badgeCatText: { fontSize: WebTypo.tiny, fontWeight: '600', color: '#7C3AED' },

  catRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  catPickerRow: { flexDirection: 'row', maxHeight: 44 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#FFF', borderRadius: 16, padding: 28, width: '90%', maxWidth: 560, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: WebTypo.h2, fontWeight: '700', color: Colors.text },
  formRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  formField: { flex: 1 },
  label: { fontSize: WebTypo.label, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: WebTypo.body, color: Colors.text, backgroundColor: '#FAFAFA', outlineStyle: 'none' as any },
  roleChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' },
  roleChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  roleChipText: { fontSize: WebTypo.small, color: Colors.textSecondary, fontWeight: '500' },
  roleChipTextActive: { color: Colors.primary, fontWeight: '600' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  cancelText: { fontSize: WebTypo.button, color: Colors.textSecondary, fontWeight: '500' },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.primary },
  saveText: { fontSize: WebTypo.button, color: '#FFF', fontWeight: '600' },
});
