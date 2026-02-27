
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Search, X, CheckCircle, Circle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, Spacing } from '@/constants/typography';
import { SubscriptionPlan } from '@/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { capitalizeWords } from '@/utils/format';
import { formatCurrency } from '@/utils/format';

interface SubscriptionPickerProps {
  visible: boolean;
  subscriptions: SubscriptionPlan[];
  onClose: () => void;
  onAdd: (subscriptions: SubscriptionPlan[]) => void;
  maxSelection?: number;
}

export default function SubscriptionPicker({
  visible,
  subscriptions,
  onClose,
  onAdd,
  maxSelection,
}: SubscriptionPickerProps) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubs, setSelectedSubs] = useState<SubscriptionPlan[]>([]);

  const filteredSubs = useMemo(() => {
    if (!searchQuery) {
      return subscriptions;
    }
    return subscriptions.filter(
      (s) => s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [subscriptions, searchQuery]);

  const toggleSubSelection = (sub: SubscriptionPlan) => {
    setSelectedSubs((prev) => {
      if (prev.find((s) => s.id === sub.id)) {
        return prev.filter((s) => s.id !== sub.id);
      } else {
        if (maxSelection && prev.length >= maxSelection) {
          return [sub]; // Replace previous selection
        }
        return [...prev, sub];
      }
    });
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedSubs([]);
    onClose();
  };

  const handleAdd = () => {
    onAdd(selectedSubs);
    handleClose();
  };

  const isSelected = (sub: SubscriptionPlan) => {
    return selectedSubs.some((s) => s.id === sub.id);
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
      <View style={[styles.modalContainer, { paddingBottom: Math.max(Spacing.xl, insets.bottom + Spacing.md) }]}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Select Subscriptions</Text>
          <TouchableOpacity onPress={handleClose}>
            <X size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <FlatList
          data={filteredSubs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.subItem}
              onPress={() => toggleSubSelection(item)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.subName}>{capitalizeWords(item.name)}</Text>
                <Text style={styles.subDuration}>{item.durationMonths} months</Text>
              </View>
              <Text style={styles.subPrice}>{formatCurrency(item.price)}</Text>
              {isSelected(item) ? (
                <CheckCircle size={22} color={Colors.primary} style={styles.selectionIcon} />
              ) : (
                <Circle size={22} color={Colors.border} style={styles.selectionIcon} />
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No subscriptions found.</Text>}
        />
        <TouchableOpacity
          style={[styles.addButton, selectedSubs.length === 0 && styles.addButtonDisabled]}
          onPress={handleAdd}
          disabled={selectedSubs.length === 0}
        >
          <Text style={styles.addButtonText}>Add ({selectedSubs.length})</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerText: {
    fontSize: FontSize.heading,
    fontWeight: '600',
    color: Colors.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    height: 44,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  subItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  subName: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  subDuration: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  subPrice: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginHorizontal: Spacing.md,
  },
  selectionIcon: {
    marginLeft: 'auto',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.lg,
    color: Colors.textSecondary,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    marginTop: Spacing.lg,
  },
  addButtonDisabled: {
    backgroundColor: Colors.primaryLight,
  },
  addButtonText: {
    fontSize: FontSize.md,
    color: Colors.surface,
    fontWeight: '600',
  },
});
