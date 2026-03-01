
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
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Plus, Trash2, X, Search, Package } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { Service } from '@/types';
import { formatCurrency, capitalizeWords, isValidName } from '@/utils/format';
import { useAlert } from '@/providers/AlertProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SortPills, { SortOption } from '@/components/SortPills';

const FILTERS = ['All', 'Services', 'Products'];

export default function InventoryScreen() {
  const { services, addService, updateService, deleteService, reload } = useData();
  const { showAlert, showConfirm } = useAlert();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('a-z');

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [kind, setKind] = useState<'service' | 'product'>('service');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setCode('');
    setPrice('');
    setMrp('');
    setKind('service');
    setIsEditing(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    const priceNum = parseFloat(price);
    const mrpNum = mrp ? parseFloat(mrp) : undefined;

    if (!name.trim() || !code.trim() || isNaN(priceNum)) {
      showAlert('Error', 'Name, code, and a valid price are required');
      return;
    }
    if (!isValidName(name.trim())) {
      showAlert('Error', 'Name must be at least 4 letters and contain only letters and spaces.');
      return;
    }

    setLoading(true);
    try {
      const serviceData = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        price: priceNum,
        mrp: mrpNum,
        kind,
      };

      if (isEditing && editingId) {
        const serviceToUpdate = services.find((s: Service) => s.id === editingId);
        if (serviceToUpdate) {
          await updateService({ ...serviceToUpdate, ...serviceData });
        }
      } else {
        await addService(serviceData);
      }
      setShowForm(false);
      resetForm();
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteItem = (item: Service) => {
    showConfirm(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      () => deleteService(item.id),
      'Delete',
    );
  };

  const filteredItems = useMemo(() => {
    let filtered = [...services];
    if (activeFilter !== 'All') {
      const filterKind = activeFilter === 'Services' ? 'service' : 'product';
      filtered = filtered.filter((s: Service) => s.kind === filterKind);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s: Service) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case 'a-z':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'z-a':
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'recent':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }
    return filtered;
  }, [services, searchQuery, activeFilter, sortBy]);

  const renderItem = ({ item }: { item: Service }) => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardContent}
        activeOpacity={0.7}
        onPress={() => {
          setIsEditing(true);
          setEditingId(item.id);
          setName(item.name);
          setCode(item.code);
          setPrice(String(item.price));
          setMrp(item.mrp ? String(item.mrp) : '');
          setKind(item.kind);
          setShowForm(true);
        }}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.itemName}>{capitalizeWords(item.name)}</Text>
          <View
            style={[
              styles.typeBadge,
              item.kind === 'service' ? styles.serviceBadge : styles.productBadge,
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                item.kind === 'service' ? styles.serviceBadgeText : styles.productBadgeText,
              ]}
            >
              {capitalizeWords(item.kind)}
            </Text>
          </View>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
          {item.mrp && item.mrp > item.price && (
            <Text style={styles.mrpPrice}>{formatCurrency(item.mrp)}</Text>
          )}
        </View>
        <Text style={styles.itemCode}>Code: {item.code}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDeleteItem(item)}>
        <Trash2 size={16} color={Colors.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or code..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setShowForm(true); }}>
          <Plus size={18} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.filtersContainer}>
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterChip,
              activeFilter === filter && styles.activeFilterChip,
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === filter && styles.activeFilterChipText,
              ]}
            >
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sortRow}>
        <SortPills value={sortBy} onChange={setSortBy} />
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Package size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Items</Text>
            <Text style={styles.emptySubtitle}>Add services or products to your inventory</Text>
          </View>
        }
      />

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKav}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isEditing ? 'Edit Item' : 'Add Item'}</Text>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <X size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Haircut, Shampoo"
                  placeholderTextColor={Colors.textTertiary}
                  value={name}
                  onChangeText={setName}
                />
                <Text style={styles.label}>Code *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Unique code (e.g., HC01)"
                  placeholderTextColor={Colors.textTertiary}
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                />
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.label}>Price *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Selling price"
                      placeholderTextColor={Colors.textTertiary}
                      value={price}
                      onChangeText={setPrice}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.label}>MRP (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Max retail price"
                      placeholderTextColor={Colors.textTertiary}
                      value={mrp}
                      onChangeText={setMrp}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={styles.label}>Type *</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.flex, styles.typeButton, kind === 'service' && styles.typeButtonActive]}
                    onPress={() => setKind('service')}
                  >
                    <Text style={[styles.typeButtonText, kind === 'service' && styles.typeButtonTextActive]}>Service</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.flex, styles.typeButton, kind === 'product' && styles.typeButtonActive]}
                    onPress={() => setKind('product')}
                  >
                    <Text style={[styles.typeButtonText, kind === 'product' && styles.typeButtonTextActive]}>Product</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
              <TouchableOpacity style={[styles.saveBtn, { marginBottom: insets.bottom }]} onPress={handleSave} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={Colors.surface} />
                ) : (
                  <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Add Item'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
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
    padding: Spacing.card,
    gap: Spacing.md,
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
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.card,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  activeFilterChip: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  activeFilterChipText: {
    color: Colors.surface,
  },
  sortRow: {
    paddingHorizontal: Spacing.card,
    paddingBottom: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.card,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
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
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  serviceBadge: {
    backgroundColor: Colors.primaryLight,
  },
  productBadge: {
    backgroundColor: Colors.infoLight,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  serviceBadgeText: {
    color: Colors.primary,
  },
  productBadgeText: {
    color: Colors.info,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  itemPrice: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  mrpPrice: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  itemCode: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
    marginLeft: 10,
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
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  flex: {
    flex: 1,
  },
  typeButton: {
    borderRadius: BorderRadius.md,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
  },
  typeButtonText: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  }
});
