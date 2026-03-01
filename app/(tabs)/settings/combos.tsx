import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Plus, Trash2, X, Search, Package, Scissors, ShoppingBag } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { Combo, ComboItem, Service } from '@/types';
import { useAlert } from '@/providers/AlertProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { capitalizeWords } from '@/utils/format';
import { generateId } from '@/utils/hash';
import BottomSheetModal from '@/components/BottomSheetModal';

export default function CombosScreen() {
  const { combos, services, addCombo, updateCombo, deleteCombo, reload } = useData();
  const { showAlert, showConfirm } = useAlert();
  const { isAdmin } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [comboPrice, setComboPrice] = useState('');
  const [selectedItems, setSelectedItems] = useState<ComboItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'service' | 'product'>('all');

  const resetForm = () => {
    setName('');
    setComboPrice('');
    setSelectedItems([]);
    setIsEditing(false);
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      showAlert('Error', 'Combo name is required');
      return;
    }
    if (!comboPrice.trim() || isNaN(Number(comboPrice)) || Number(comboPrice) <= 0) {
      showAlert('Error', 'Enter a valid combo price');
      return;
    }
    if (selectedItems.length < 2) {
      showAlert('Error', 'Add at least 2 items to a combo');
      return;
    }
    const origTotal = selectedItems.reduce((sum, item) => sum + item.originalPrice, 0);
    if (Number(comboPrice) >= origTotal) {
      showAlert('Error', `Combo price must be less than the original total (₹${origTotal})`);
      return;
    }

    try {
      const comboData = {
        name: capitalizeWords(name.trim()),
        comboPrice: Number(comboPrice),
        items: selectedItems,
      };

      if (isEditing && editingId) {
        await updateCombo({ id: editingId, ...comboData, createdAt: '' });
      } else {
        await addCombo(comboData);
      }
      setShowAdd(false);
      resetForm();
    } catch (e) {
      console.error(e);
      showAlert('Error', 'Failed to save combo');
    }
  };

  const handleRemove = (combo: Combo) => {
    showConfirm(
      'Remove Combo',
      `Delete "${combo.name}"?`,
      () => deleteCombo(combo.id),
      'Delete',
    );
  };

  const handleAddServiceToCombo = (service: Service) => {
    const exists = selectedItems.find(si => si.serviceId === service.id);
    if (exists) {
      showAlert('Already Added', `${service.name} is already in this combo`);
      return;
    }
    const item: ComboItem = {
      id: generateId(),
      serviceId: service.id,
      serviceName: service.name,
      serviceKind: service.kind,
      originalPrice: service.price,
    };
    setSelectedItems(prev => [...prev, item]);
  };

  const handleRemoveServiceFromCombo = (serviceId: string) => {
    setSelectedItems(prev => prev.filter(si => si.serviceId !== serviceId));
  };

  const filteredCombos = useMemo(() => {
    if (!search.trim()) return combos;
    const q = search.toLowerCase();
    return combos.filter((c: Combo) =>
      c.name.toLowerCase().includes(q) ||
      c.items.some(i => i.serviceName.toLowerCase().includes(q))
    );
  }, [combos, search]);

  const filteredServices = useMemo(() => {
    let list = services;
    if (serviceFilter !== 'all') {
      list = list.filter((s: Service) => s.kind === serviceFilter);
    }
    if (serviceSearch.trim()) {
      const q = serviceSearch.toLowerCase();
      list = list.filter((s: Service) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
    }
    return list;
  }, [services, serviceSearch, serviceFilter]);

  const totalOriginalPrice = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.originalPrice, 0),
    [selectedItems]
  );

  const savings = totalOriginalPrice - Number(comboPrice || 0);

  const openEdit = (combo: Combo) => {
    setIsEditing(true);
    setEditingId(combo.id);
    setName(combo.name);
    setComboPrice(String(combo.comboPrice));
    setSelectedItems(combo.items.map(i => ({ ...i })));
    setShowAdd(true);
  };

  const renderComboCard = ({ item }: { item: Combo }) => {
    const origTotal = item.items.reduce((s, i) => s + i.originalPrice, 0);
    const savedAmount = origTotal - item.comboPrice;
    const savedPercent = origTotal > 0 ? Math.round((savedAmount / origTotal) * 100) : 0;

    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardContent} activeOpacity={isAdmin ? 0.7 : 1} onPress={() => { if (isAdmin) openEdit(item); }}>
          <View style={styles.cardHeader}>
            <Text style={styles.comboName}>{capitalizeWords(item.name)}</Text>
            <View style={[styles.typeBadge, { backgroundColor: Colors.successLight }]}>
              <Text style={[styles.typeBadgeText, { color: Colors.success }]}>{savedPercent}% OFF</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.comboPrice}>₹{item.comboPrice}</Text>
            {origTotal > item.comboPrice && (
              <Text style={styles.originalPrice}>₹{origTotal}</Text>
            )}
          </View>

          <View style={styles.itemsWrap}>
            {item.items.map((ci, idx) => (
              <View key={ci.id || idx} style={styles.itemChip}>
                {ci.serviceKind === 'product' ? (
                  <ShoppingBag size={10} color={Colors.info} />
                ) : (
                  <Scissors size={10} color={Colors.primary} />
                )}
                <Text style={styles.itemChipText}>{capitalizeWords(ci.serviceName)}</Text>
                <Text style={styles.itemChipPrice}>₹{ci.originalPrice}</Text>
              </View>
            ))}
          </View>

          {savedAmount > 0 && (
            <View style={[styles.savingsBadge]}>
              <Text style={styles.savingsText}>Save ₹{savedAmount}</Text>
            </View>
          )}
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleRemove(item)}>
            <Trash2 size={16} color={Colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search combos..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        {isAdmin && (
          <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setShowAdd(true); }}>
            <Plus size={18} color={Colors.surface} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredCombos}
        keyExtractor={item => item.id}
        renderItem={renderComboCard}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Package size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No combos yet</Text>
            <Text style={styles.emptySubtitle}>Bundle services & products at a fixed price</Text>
          </View>
        }
      />

      {/* Add / Edit Combo Modal */}
      <BottomSheetModal visible={showAdd} onRequestClose={() => { setShowAdd(false); resetForm(); }} maxHeight="80%">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isEditing ? 'Edit Combo' : 'New Combo'}</Text>
                <TouchableOpacity onPress={() => { setShowAdd(false); resetForm(); }}>
                  <X size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Combo Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Haircut + Color Combo"
                  placeholderTextColor={Colors.textTertiary}
                  value={name}
                  onChangeText={setName}
                />

                <Text style={styles.label}>Combo Price (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 1500"
                  placeholderTextColor={Colors.textTertiary}
                  value={comboPrice}
                  onChangeText={setComboPrice}
                  keyboardType="numeric"
                />

                {/* Selected items */}
                <View style={styles.selectedSection}>
                  <View style={styles.selectedHeader}>
                    <Text style={styles.label}>Items in Combo ({selectedItems.length})</Text>
                    <TouchableOpacity
                      style={styles.addItemBtn}
                      onPress={() => { setServiceSearch(''); setServiceFilter('all'); setShowServicePicker(true); }}
                    >
                      <Plus size={14} color={Colors.surface} />
                      <Text style={styles.addItemBtnText}>Add Item</Text>
                    </TouchableOpacity>
                  </View>

                  {selectedItems.length === 0 ? (
                    <View style={styles.noItemsBox}>
                      <Text style={styles.noItemsText}>No items added yet. Tap "Add Item" to pick services or products.</Text>
                    </View>
                  ) : (
                    selectedItems.map((item, idx) => (
                      <View key={item.id || idx} style={styles.selectedItemRow}>
                        <View style={styles.selectedItemInfo}>
                          {item.serviceKind === 'product' ? (
                            <ShoppingBag size={14} color={Colors.info} />
                          ) : (
                            <Scissors size={14} color={Colors.primary} />
                          )}
                          <Text style={styles.selectedItemName}>{capitalizeWords(item.serviceName)}</Text>
                        </View>
                        <Text style={styles.selectedItemPrice}>₹{item.originalPrice}</Text>
                        <TouchableOpacity onPress={() => handleRemoveServiceFromCombo(item.serviceId)} style={styles.removeItemBtn}>
                          <X size={14} color={Colors.danger} />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}

                  {selectedItems.length > 0 && (
                    <View style={styles.summaryBox}>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Original Total</Text>
                        <Text style={styles.summaryValue}>₹{totalOriginalPrice}</Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Combo Price</Text>
                        <Text style={[styles.summaryValue, { color: Colors.primary, fontWeight: '700' }]}>
                          ₹{comboPrice || '0'}
                        </Text>
                      </View>
                      {savings > 0 && (
                        <View style={styles.summaryRow}>
                          <Text style={[styles.summaryLabel, { color: Colors.success }]}>Customer Saves</Text>
                          <Text style={[styles.summaryValue, { color: Colors.success, fontWeight: '700' }]}>₹{savings}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <TouchableOpacity style={[styles.saveBtn, { marginBottom: insets.bottom }]} onPress={handleAdd}>
                  <Text style={styles.saveBtnText}>{isEditing ? 'Update Combo' : 'Create Combo'}</Text>
                </TouchableOpacity>
              </ScrollView>
      </BottomSheetModal>
      <Modal visible={showServicePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Item</Text>
              <TouchableOpacity onPress={() => setShowServicePicker(false)}>
                <X size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerSearchBar}>
              <Search size={16} color={Colors.textTertiary} />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Search services or products..."
                placeholderTextColor={Colors.textTertiary}
                value={serviceSearch}
                onChangeText={setServiceSearch}
              />
            </View>

            <View style={styles.filterBar}>
              {(['all', 'service', 'product'] as const).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, serviceFilter === f && styles.filterChipActive]}
                  onPress={() => setServiceFilter(f)}
                >
                  <Text style={[styles.filterChipText, serviceFilter === f && styles.filterChipTextActive]}>
                    {f === 'all' ? 'All' : f === 'service' ? 'Services' : 'Products'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <FlatList
              data={filteredServices}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item: svc }) => {
                const already = selectedItems.some(si => si.serviceId === svc.id);
                return (
                  <TouchableOpacity
                    style={[styles.serviceRow, already && styles.serviceRowSelected]}
                    onPress={() => handleAddServiceToCombo(svc)}
                    disabled={already}
                    activeOpacity={0.6}
                  >
                    <View style={styles.serviceRowLeft}>
                      {svc.kind === 'product' ? (
                        <ShoppingBag size={16} color={already ? Colors.textTertiary : Colors.info} />
                      ) : (
                        <Scissors size={16} color={already ? Colors.textTertiary : Colors.primary} />
                      )}
                      <View>
                        <Text style={[styles.serviceRowName, already && { color: Colors.textTertiary }]}>
                          {capitalizeWords(svc.name)}
                        </Text>
                        <Text style={styles.serviceRowCode}>{svc.code}</Text>
                      </View>
                    </View>
                    <View style={styles.serviceRowRight}>
                      <Text style={[styles.serviceRowPrice, already && { color: Colors.textTertiary }]}>₹{svc.price}</Text>
                      {already && <Text style={styles.addedLabel}>Added</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptySubtitle}>No matching items</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
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
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 42,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.text,
    paddingVertical: 0,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardContent: {
    flex: 1,
    marginBottom: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  comboName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  comboPrice: {
    fontSize: FontSize.title,
    fontWeight: '700',
    color: Colors.primary,
  },
  originalPrice: {
    fontSize: FontSize.body,
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  itemsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  itemChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text,
  },
  itemChipPrice: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  savingsBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: Colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.success,
  },
  deleteBtn: {
    marginLeft: 10,
    padding: 8,
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    padding: Spacing.modal,
    paddingBottom: Spacing.modalBottom,
    maxHeight: '80%',
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
  // Selected items section
  selectedSection: {
    marginTop: 16,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  addItemBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.surface,
  },
  noItemsBox: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: 8,
  },
  noItemsText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  selectedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    padding: 10,
    marginTop: 6,
  },
  selectedItemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedItemName: {
    fontSize: FontSize.body,
    fontWeight: '500',
    color: Colors.text,
  },
  selectedItemPrice: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginRight: 8,
  },
  removeItemBtn: {
    padding: 4,
  },
  summaryBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    padding: 12,
    marginTop: 12,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.text,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  saveBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.surface,
  },
  // Service picker search
  pickerSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: 10,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.text,
    paddingVertical: 0,
  },
  // Filter bar
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
  // Service picker
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  serviceRowSelected: {
    opacity: 0.5,
  },
  serviceRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  serviceRowName: {
    fontSize: FontSize.body,
    fontWeight: '500',
    color: Colors.text,
  },
  serviceRowCode: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  serviceRowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  serviceRowPrice: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.primary,
  },
  addedLabel: {
    fontSize: 10,
    color: Colors.success,
    fontWeight: '600',
  },
});
