import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Plus, Trash2, X, Receipt, Tag, ChevronLeft, ChevronRight, Calendar } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { Expense, ExpenseCategory } from '@/types';
import { useAlert } from '@/providers/AlertProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@/utils/format';
import DatePickerModal from '@/components/DatePickerModal';

export default function ExpensesScreen() {
  const {
    allExpenses,
    expenseCategories,
    addExpense,
    updateExpense,
    deleteExpense,
    addExpenseCategory,
    deleteExpenseCategory,
    reload,
  } = useData();
  const { showAlert, showConfirm } = useAlert();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  // Month navigation
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Category management
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Filter
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const monthLabel = useMemo(() => {
    const d = new Date(viewMonth.year, viewMonth.month);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [viewMonth]);

  const prevMonth = () => {
    setViewMonth(prev => {
      const m = prev.month - 1;
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
    });
  };

  const now = new Date();
  const isFutureBlocked = viewMonth.year > now.getFullYear() ||
    (viewMonth.year === now.getFullYear() && viewMonth.month >= now.getMonth());

  const nextMonth = () => {
    if (isFutureBlocked) return;
    setViewMonth(prev => {
      const m = prev.month + 1;
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
    });
  };

  // Filter expenses by selected month
  const monthExpenses = useMemo(() => {
    return allExpenses.filter((e: Expense) => {
      const d = new Date(e.expenseDate);
      return d.getMonth() === viewMonth.month && d.getFullYear() === viewMonth.year;
    });
  }, [allExpenses, viewMonth]);

  // Further filter by category
  const filteredExpenses = useMemo(() => {
    if (!filterCategory) return monthExpenses;
    return monthExpenses.filter((e: Expense) => e.categoryId === filterCategory);
  }, [monthExpenses, filterCategory]);

  // Monthly totals
  const monthTotal = useMemo(() => {
    return monthExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
  }, [monthExpenses]);

  const categoryTotals = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {};
    monthExpenses.forEach((e: Expense) => {
      const key = e.categoryId || e.categoryName;
      if (!map[key]) map[key] = { name: e.categoryName, total: 0 };
      map[key].total += e.amount;
    });
    return Object.entries(map)
      .map(([id, val]) => ({ id, ...val }))
      .sort((a, b) => b.total - a.total);
  }, [monthExpenses]);

  // ── Form helpers ──

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setSelectedCategoryId(expenseCategories[0]?.id ?? '');
    setExpenseDate(new Date());
    setEditingExpense(null);
  };

  const openAddForm = () => {
    if (expenseCategories.length === 0) {
      showAlert('No Categories', 'Please add at least one expense category first.');
      return;
    }
    resetForm();
    setShowExpenseForm(true);
  };

  const openEditForm = (expense: Expense) => {
    setEditingExpense(expense);
    setAmount(expense.amount.toString());
    setDescription(expense.description);
    setSelectedCategoryId(expense.categoryId || '');
    setExpenseDate(new Date(expense.expenseDate));
    setShowExpenseForm(true);
  };

  const handleSaveExpense = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    if (!selectedCategoryId) {
      showAlert('No Category', 'Please select a category.');
      return;
    }
    const cat = expenseCategories.find((c: ExpenseCategory) => c.id === selectedCategoryId);
    if (!cat) {
      showAlert('Invalid Category', 'Selected category not found.');
      return;
    }

    const y = expenseDate.getFullYear();
    const m = String(expenseDate.getMonth() + 1).padStart(2, '0');
    const d = String(expenseDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    try {
      if (editingExpense) {
        await updateExpense({
          id: editingExpense.id,
          categoryId: selectedCategoryId,
          categoryName: cat.name,
          amount: parsedAmount,
          description: description.trim(),
          expenseDate: dateStr,
        });
      } else {
        await addExpense({
          categoryId: selectedCategoryId,
          categoryName: cat.name,
          amount: parsedAmount,
          description: description.trim(),
          expenseDate: dateStr,
        });
      }
      setShowExpenseForm(false);
      resetForm();
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save expense');
    }
  };

  const handleDeleteExpense = (expense: Expense) => {
    showConfirm(
      'Delete Expense',
      `Remove ${formatCurrency(expense.amount)} (${expense.categoryName})?`,
      () => deleteExpense(expense.id),
      'Delete',
    );
  };

  // ── Category management ──

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      showAlert('Error', 'Category name is required.');
      return;
    }
    if (expenseCategories.some((c: ExpenseCategory) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      showAlert('Duplicate', 'Category already exists.');
      return;
    }
    try {
      await addExpenseCategory(trimmed);
      setNewCategoryName('');
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to add category');
    }
  };

  const handleDeleteCategory = (cat: ExpenseCategory) => {
    showConfirm(
      'Delete Category',
      `Delete "${cat.name}"? Existing expenses will keep the category name.`,
      () => deleteExpenseCategory(cat.id),
      'Delete',
    );
  };

  const formatExpenseDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // ── Render ──

  const renderExpenseItem = ({ item }: { item: Expense }) => (
    <TouchableOpacity style={styles.expenseCard} activeOpacity={0.7} onPress={() => openEditForm(item)}>
      <View style={styles.expenseLeft}>
        <View style={styles.expenseCatDot}>
          <Tag size={12} color={Colors.primary} />
        </View>
        <View style={styles.expenseInfo}>
          <Text style={styles.expenseCatName}>{item.categoryName}</Text>
          {item.description ? <Text style={styles.expenseDesc} numberOfLines={1}>{item.description}</Text> : null}
          <Text style={styles.expenseDate}>{formatExpenseDate(item.expenseDate)}</Text>
        </View>
      </View>
      <View style={styles.expenseRight}>
        <Text style={styles.expenseAmount}>{formatCurrency(item.amount)}</Text>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteExpense(item)}>
          <Trash2 size={14} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Month Navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.monthArrow}>
          <ChevronLeft size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.monthCenter}>
          <Calendar size={14} color={Colors.primary} />
          <Text style={styles.monthLabel}>{monthLabel}</Text>
        </View>
        <TouchableOpacity onPress={nextMonth} style={[styles.monthArrow, isFutureBlocked && { opacity: 0.3 }]} disabled={isFutureBlocked}>
          <ChevronRight size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Month Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Total Expenses</Text>
        <Text style={styles.summaryAmount}>{formatCurrency(monthTotal)}</Text>
        {categoryTotals.length > 0 && (
          <View style={styles.categoryBreakdown}>
            {categoryTotals.map(ct => (
              <TouchableOpacity
                key={ct.id}
                style={[
                  styles.categoryPill,
                  filterCategory === ct.id && styles.categoryPillActive,
                ]}
                onPress={() => setFilterCategory(filterCategory === ct.id ? null : ct.id)}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    filterCategory === ct.id && styles.categoryPillTextActive,
                  ]}
                >
                  {ct.name}: {formatCurrency(ct.total)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Expense List */}
      <FlatList
        data={filteredExpenses}
        keyExtractor={item => item.id}
        renderItem={renderExpenseItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Receipt size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No expenses</Text>
            <Text style={styles.emptySubtitle}>Tap + to add an expense</Text>
          </View>
        }
      />

      {/* FAB row */}
      <View style={[styles.fabRow, { bottom: 24 + insets.bottom }]}>
        <TouchableOpacity style={styles.fabSecondary} onPress={() => setShowCategoryModal(true)}>
          <Tag size={18} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={openAddForm}>
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Add/Edit Expense Modal ── */}
      <Modal visible={showExpenseForm} animationType="slide" transparent>
        <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -200} style={styles.modalOverlay}>
          <View style={styles.modalKav}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingExpense ? 'Edit Expense' : 'Add Expense'}</Text>
                <TouchableOpacity onPress={() => setShowExpenseForm(false)}>
                  <X size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Amount *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="₹ 0.00"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />

                <Text style={styles.label}>Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScrollRow}>
                  {expenseCategories.map((cat: ExpenseCategory) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catChip, selectedCategoryId === cat.id && styles.catChipActive]}
                      onPress={() => setSelectedCategoryId(cat.id)}
                    >
                      <Text style={[styles.catChipText, selectedCategoryId === cat.id && styles.catChipTextActive]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.label}>Date</Text>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                  <Calendar size={14} color={Colors.textSecondary} />
                  <Text style={styles.dateBtnText}>
                    {expenseDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Optional note..."
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  value={description}
                  onChangeText={setDescription}
                />

                <TouchableOpacity style={[styles.saveBtn, { marginBottom: insets.bottom + 12 }]} onPress={handleSaveExpense}>
                  <Text style={styles.saveBtnText}>{editingExpense ? 'Update' : 'Add Expense'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Category Management Modal ── */}
      <Modal visible={showCategoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Expense Categories</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <X size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.addCatRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="New category name"
                placeholderTextColor={Colors.textTertiary}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
              />
              <TouchableOpacity style={styles.addCatBtn} onPress={handleAddCategory}>
                <Plus size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={expenseCategories}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.catListItem}>
                  <Tag size={14} color={Colors.primary} />
                  <Text style={styles.catListName}>{item.name}</Text>
                  <TouchableOpacity onPress={() => handleDeleteCategory(item)}>
                    <Trash2 size={14} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.catEmptyText}>No categories yet. Add one above.</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      <DatePickerModal
        visible={showDatePicker}
        value={expenseDate}
        maxDate={new Date()}
        onSelect={(d: Date | null) => { if (d) setExpenseDate(d); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Month navigator
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.card,
    paddingVertical: Spacing.md,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  monthCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthLabel: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.text,
  },
  // Summary
  summaryCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.card,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: FontSize.hero,
    fontWeight: '700',
    color: Colors.danger,
    marginTop: 2,
  },
  categoryBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.md,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.borderLight,
  },
  categoryPillActive: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  categoryPillText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryPillTextActive: {
    color: Colors.primary,
  },
  // List
  listContent: {
    paddingHorizontal: Spacing.card,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  expenseCatDot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseCatName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  expenseDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  expenseDate: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  expenseAmount: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.danger,
  },
  deleteBtn: {
    padding: 4,
  },
  // FAB
  fabRow: {
    position: 'absolute',
    bottom: 24,
    right: Spacing.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabSecondary: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    elevation: 3,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  // Empty
  empty: {
    alignItems: 'center',
    paddingTop: 60,
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalKav: {
    maxHeight: '70%',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    padding: Spacing.modal,
    paddingBottom: Spacing.modalBottom,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: FontSize.heading,
    fontWeight: '600',
    color: Colors.text,
  },
  label: {
    fontSize: FontSize.body,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.lg,
    height: 44,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  catScrollRow: {
    marginBottom: 4,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    marginRight: 8,
  },
  catChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  catChipText: {
    fontSize: FontSize.body,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  catChipTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.lg,
    height: 44,
  },
  dateBtnText: {
    fontSize: FontSize.body,
    color: Colors.text,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.surface,
  },
  // Category modal
  addCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  addCatBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  catListName: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
  },
  catEmptyText: {
    fontSize: FontSize.body,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
