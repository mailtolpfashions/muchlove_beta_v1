import React, { useState, useCallback } from 'react';
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
import { Plus, Trash2, X, Wallet } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { usePayment } from '@/providers/PaymentProvider';
import { UpiData } from '@/types';
import { useAlert } from '@/providers/AlertProvider';

export default function PaymentsScreen() {
  const { upiList, addUpi, updateUpi, removeUpi, reloadUpi, upiLoading } = usePayment();
  const { showAlert, showConfirm } = useAlert();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reloadUpi();
    setRefreshing(false);
  }, [reloadUpi]);

  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [upiId, setUpiId] = useState<string>('');
  const [payeeName, setPayeeName] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!upiId.trim() || !payeeName.trim()) {
      showAlert('Error', 'Both UPI ID and Payee Name are required');
      return;
    }
    try {
      if (isEditing && editingId) {
        await updateUpi({ id: editingId, upiId: upiId.trim(), payeeName: payeeName.trim() });
      } else {
        await addUpi({ upiId: upiId.trim(), payeeName: payeeName.trim() });
      }
      setShowAdd(false);
      resetForm();
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save UPI details');
    }
  };

  const handleRemove = (item: UpiData) => {
    showConfirm(
      'Delete UPI',
      `Delete "${item.payeeName}"?`,
      () => removeUpi(item.id),
      'Delete',
    );
  };

  const resetForm = () => {
    setUpiId('');
    setPayeeName('');
    setIsEditing(false);
    setEditingId(null);
  };

  const renderItem = ({ item }: { item: UpiData }) => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardContent}
        activeOpacity={0.7}
        onPress={() => {
          setIsEditing(true);
          setEditingId(item.id);
          setUpiId(item.upiId);
          setPayeeName(item.payeeName);
          setShowAdd(true);
        }}
      >
        <Text style={styles.payeeName}>{item.payeeName}</Text>
        <Text style={styles.upiId}>{item.upiId}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleRemove(item)}>
        <Trash2 size={16} color={Colors.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>UPI Payments</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setShowAdd(true); }}>
          <Plus size={18} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={upiList}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Wallet size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No UPIs Added</Text>
            <Text style={styles.emptySubtitle}>Accept payments through any UPI app</Text>
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
                <Text style={styles.modalTitle}>{isEditing ? 'Edit UPI' : 'Add UPI'}</Text>
                <TouchableOpacity onPress={() => setShowAdd(false)}>
                  <X size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Payee Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="eg. Your Name"
                placeholderTextColor={Colors.textTertiary}
                value={payeeName}
                onChangeText={setPayeeName}
              />
              <Text style={styles.label}>UPI ID *</Text>
              <TextInput
                style={styles.input}
                placeholder="eg. yourname@okaxis"
                placeholderTextColor={Colors.textTertiary}
                value={upiId}
                onChangeText={setUpiId}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
                <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Add UPI'}</Text>
              </TouchableOpacity>
              </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.card,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
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
  payeeName: {
    fontSize: FontSize.md,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  upiId: {
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
    fontWeight: '600' as const,
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
    fontWeight: '600' as const,
    color: Colors.text,
  },
  label: {
    fontSize: FontSize.body,
    fontWeight: '500' as const,
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
    fontWeight: '600' as const,
    color: Colors.surface,
  },
});
