import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { X, Search, User, PlusCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { Customer } from '@/types';
import { useData } from '@/providers/DataProvider';
import { capitalizeWords, isValidMobile } from '@/utils/format';

interface CustomerPickerProps {
  visible: boolean;
  customers: Customer[];
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  selectedCustomer: Customer | null;
  showAddFormInitially?: boolean;
  addOnly?: boolean;
}

export default function CustomerPicker({
  visible,
  customers,
  selectedCustomer,
  onClose,
  onSelect,
  showAddFormInitially = false,
  addOnly = false,
}: CustomerPickerProps) {
  const { addCustomer } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(showAddFormInitially || addOnly);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerMobile, setNewCustomerMobile] = useState('');
  const [newCustomerIsStudent, setNewCustomerIsStudent] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowAddForm(showAddFormInitially || addOnly);
    } else {
      setSearchQuery('');
      setNewCustomerName('');
      setNewCustomerMobile('');
      setNewCustomerIsStudent(false);
    }
  }, [visible, showAddFormInitially, addOnly]);

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerMobile.trim()) {
      Alert.alert('Error', 'Name and mobile are required.');
      return;
    }
    if (!isValidMobile(newCustomerMobile.trim())) {
      Alert.alert('Error', 'Invalid mobile number.');
      return;
    }
    if (customers.some(c => c.mobile.trim() === newCustomerMobile.trim())) {
      Alert.alert('Error', 'A customer with this mobile already exists.');
      return;
    }
    try {
      const newCustomer = await addCustomer({
        name: capitalizeWords(newCustomerName.trim()),
        mobile: newCustomerMobile.trim(),
        isStudent: newCustomerIsStudent,
      });
      if (newCustomer) {
        onSelect(newCustomer);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      c => c.name.toLowerCase().includes(q) || c.mobile.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{showAddForm || addOnly ? 'Add Customer' : 'Select Customer'}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {showAddForm ? (
            <View style={{ flex: 1 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. John Doe"
                  placeholderTextColor={Colors.textTertiary}
                  value={newCustomerName}
                  onChangeText={setNewCustomerName}
                />

                <Text style={styles.label}>Mobile Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={Colors.textTertiary}
                  value={newCustomerMobile}
                  onChangeText={setNewCustomerMobile}
                  keyboardType="phone-pad"
                  maxLength={10}
                />

                <View style={styles.switchRow}>
                  <Text style={styles.label}>Student?</Text>
                  <Switch
                    value={newCustomerIsStudent}
                    onValueChange={setNewCustomerIsStudent}
                    trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                    thumbColor={newCustomerIsStudent ? Colors.primary : Colors.textTertiary}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.addButton} onPress={handleAddCustomer}>
                <Text style={styles.addButtonText}>Add Customer</Text>
              </TouchableOpacity>

              {!addOnly && (
                <TouchableOpacity style={styles.linkButton} onPress={() => setShowAddForm(false)}>
                  <Text style={styles.linkButtonText}>Or Select an Existing Customer</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <View style={styles.searchBar}>
                <Search size={16} color={Colors.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name or mobile..."
                  placeholderTextColor={Colors.textTertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <FlatList
                data={filteredCustomers}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.customerItem,
                      selectedCustomer?.id === item.id && styles.selectedItem,
                    ]}
                    onPress={() => onSelect(item)}
                  >
                    <User size={18} color={selectedCustomer?.id === item.id ? Colors.primary : Colors.textSecondary} />
                    <View>
                      <Text style={styles.customerName}>{item.name}</Text>
                      <Text style={styles.customerMobile}>{item.mobile}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListHeaderComponent={
                  !addOnly ? (
                    <TouchableOpacity style={styles.linkButton} onPress={() => setShowAddForm(true)}>
                      <PlusCircle size={16} color={Colors.primary} />
                      <Text style={styles.linkButtonText}>Add New Customer</Text>
                    </TouchableOpacity>
                  ) : null
                }
                ListEmptyComponent={
                  <View style={styles.emptyList}>
                    <Text style={styles.emptyText}>No customers found.</Text>
                  </View>
                }
                contentContainerStyle={styles.listContent}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    height: '85%',
    padding: Spacing.modal,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.heading,
    fontWeight: '600',
    color: Colors.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.text,
    height: 44,
  },
  listContent: {
    paddingBottom: Spacing.lg,
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: Spacing.sm,
  },
  selectedItem: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  customerName: {
    fontSize: FontSize.body,
    fontWeight: '500',
    color: Colors.text,
  },
  customerMobile: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyList: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    color: Colors.textSecondary,
  },
  input: {
    backgroundColor: Colors.inputBg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    fontSize: FontSize.body,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  addButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  addButtonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  linkButton: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  linkButtonText: {
    color: Colors.primary,
    fontSize: FontSize.body,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: FontSize.body,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
});
