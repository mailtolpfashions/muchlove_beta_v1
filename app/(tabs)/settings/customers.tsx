import React, { useState, useMemo } from 'react';
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
  Switch,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Plus, X, Search, Users } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { Customer } from '@/types';
import { capitalizeWords, isValidMobile, isValidName } from '@/utils/format';
import { useAlert } from '@/providers/AlertProvider';
import SortPills, { SortOption } from '@/components/SortPills';

export default function CustomersScreen() {
  const { customers, addCustomer, updateCustomer, reload } = useData();
  const { showAlert } = useAlert();
  const [refreshing, setRefreshing] = React.useState(false);
  const [loading, setLoading] = useState<boolean>(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('a-z');

  // Form state
  const [name, setName] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [isStudent, setIsStudent] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setMobile('');
    setIsStudent(false);
    setIsEditing(false);
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!name.trim() || !mobile.trim()) {
      showAlert('Error', 'Name and mobile are required');
      return;
    }
    if (!isValidName(name.trim())) {
      showAlert('Error', 'Name must be at least 4 letters and contain only letters and spaces.');
      return;
    }
    if (!isValidMobile(mobile.trim())) {
      showAlert('Error', 'Invalid mobile number');
      return;
    }
    if (
      !isEditing &&
      customers.some(c => c.mobile.trim() === mobile.trim())
    ) {
      showAlert('Error', 'A customer with this mobile already exists');
      return;
    }

    setLoading(true);
    try {
      const customerData = {
        name: capitalizeWords(name.trim()),
        mobile: mobile.trim(),
        isStudent,
      };

      if (isEditing && editingId) {
        const customerToUpdate = customers.find((c: Customer) => c.id === editingId);
        if (customerToUpdate) {
          await updateCustomer({ ...customerToUpdate, ...customerData });
        }
      } else {
        await addCustomer(customerData);
      }
      setShowAdd(false);
      resetForm();
    } catch (e) {
      showAlert('Error', 'Failed to save customer');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    let list = [...customers];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c: Customer) => c.name.toLowerCase().includes(q) || c.mobile.toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case 'a-z':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'z-a':
        list.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'recent':
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }
    return list;
  }, [customers, search, sortBy]);

  const renderItem = ({ item }: { item: Customer }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => {
        setIsEditing(true);
        setEditingId(item.id);
        setName(item.name);
        setMobile(item.mobile);
        setIsStudent(item.isStudent);
        setShowAdd(true);
      }}
    >
      <View style={styles.cardContent}>
        <Text style={styles.customerName}>{capitalizeWords(item.name)}</Text>
        <Text style={styles.customerMobile}>{item.mobile}</Text>
      </View>
      <View style={styles.tags}>
        {item.isStudent && <Text style={styles.studentTag}>Student</Text>}
        <Text style={styles.visitTag}>Visits: {item.visitCount}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or mobile..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setShowAdd(true); }}>
          <Plus size={18} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.sortRow}>
        <SortPills value={sortBy} onChange={setSortBy} />
      </View>

      <FlatList
        data={filteredCustomers}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Users size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No customers</Text>
            <Text style={styles.emptySubtitle}>Add new customer records</Text>
          </View>
        }
      />

      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKav}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isEditing ? 'Edit Customer' : 'Add Customer'}</Text>
                <TouchableOpacity onPress={() => setShowAdd(false)}>
                  <X size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. John Doe"
                  placeholderTextColor={Colors.textTertiary}
                  value={name}
                  onChangeText={setName}
                />
                <Text style={styles.label}>Mobile Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={Colors.textTertiary}
                  value={mobile}
                  onChangeText={setMobile}
                  keyboardType="numeric"
                  maxLength={10}
                />
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Student?</Text>
                  <Switch
                    value={isStudent}
                    onValueChange={setIsStudent}
                    trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                    thumbColor={isStudent ? Colors.primary : Colors.textTertiary}
                  />
                </View>
              </ScrollView>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={Colors.surface} />
                ) : (
                  <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Add Customer'}</Text>
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
  sortRow: {
    paddingHorizontal: Spacing.screen,
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
  customerName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  customerMobile: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  tags: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  studentTag: {
    backgroundColor: Colors.accentLight,
    color: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: FontSize.xs,
    fontWeight: '600',
    overflow: 'hidden',
  },
  visitTag: {
    backgroundColor: Colors.infoLight,
    color: Colors.info,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: FontSize.xs,
    fontWeight: '600',
    overflow: 'hidden',
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
    maxHeight: '60%',
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
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
});