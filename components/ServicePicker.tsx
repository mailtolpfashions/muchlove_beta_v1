
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
import { Service } from '@/types';
import { formatCurrency } from '@/utils/format';

interface ServicePickerProps {
  visible: boolean;
  services: Service[];
  onClose: () => void;
  onAdd: (services: Service[]) => void;
}

export default function ServicePicker({
  visible,
  services,
  onClose,
  onAdd,
}: ServicePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);

  const filteredServices = useMemo(() => {
    const allServices = services.filter((s) => s.kind === 'service' || s.kind === 'product');
    if (!searchQuery) {
      return allServices;
    }
    return allServices.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [services, searchQuery]);

  const toggleServiceSelection = (service: Service) => {
    setSelectedServices((prev) => {
      if (prev.find((s) => s.id === service.id)) {
        return prev.filter((s) => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedServices([]);
    onClose();
  };

  const handleAdd = () => {
    onAdd(selectedServices);
    handleClose();
  };

  const isSelected = (service: Service) => {
    return selectedServices.some((s) => s.id === service.id);
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
          <Text style={styles.headerText}>Select Services</Text>
          <TouchableOpacity onPress={handleClose}>
            <X size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or code..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <FlatList
          data={filteredServices}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.serviceItem}
              onPress={() => toggleServiceSelection(item)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{item.name}</Text>
                <Text style={styles.serviceCode}>Code: {item.code}</Text>
              </View>
              <Text style={styles.servicePrice}>{formatCurrency(item.price)}</Text>
              {isSelected(item) ? (
                <CheckCircle size={22} color={Colors.primary} style={styles.selectionIcon} />
              ) : (
                <Circle size={22} color={Colors.border} style={styles.selectionIcon} />
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No services found.</Text>}
        />
        <TouchableOpacity
          style={[styles.addButton, selectedServices.length === 0 && styles.addButtonDisabled]}
          onPress={handleAdd}
          disabled={selectedServices.length === 0}
        >
          <Text style={styles.addButtonText}>Add ({selectedServices.length})</Text>
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
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  serviceName: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  serviceCode: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  servicePrice: {
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
