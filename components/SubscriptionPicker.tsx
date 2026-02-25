
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Search, X, CheckCircle, Circle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, Spacing } from '@/constants/typography';
import { SubscriptionPlan } from '@/types';
import { formatCurrency } from '@/utils/format';

interface SubscriptionPickerProps {
  visible: boolean;
  subscriptions: SubscriptionPlan[];
  onClose: () => void;
  onAdd: (subscriptions: SubscriptionPlan[]) => void;
}

export default function SubscriptionPicker({
  visible,
  subscriptions,
  onClose,
  onAdd,
}: SubscriptionPickerProps) {
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
      transparent={false}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
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
                <Text style={styles.subName}>{item.name}</Text>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
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
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    height: 44,
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
