import React, { useState } from 'react';
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
import { Plus, Trash2, X, CreditCard } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { SubscriptionPlan } from '@/types';
import { formatCurrency, capitalizeWords } from '@/utils/format';
import { useAlert } from '@/providers/AlertProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SubscriptionPlansScreen() {
  const { subscriptions, addSubscription, updateSubscription, deleteSubscription, reload } = useData();
  const { showAlert, showConfirm } = useAlert();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const [showPlanForm, setshowPlanForm] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSavePlan = async () => {
    if (!name.trim() || !duration.trim()) {
      showAlert('Error', 'Name and duration are required');
      return;
    }
    const durationNum = parseInt(duration);
    const priceNum = parseFloat(price || '0');
    if (isNaN(durationNum) || durationNum <= 0) {
      showAlert('Error', 'Please enter a valid duration');
      return;
    }
    try {
      const subscriptionData = {
        name: name.trim(),
        durationMonths: durationNum,
        price: priceNum,
      };

      if (isEditing && editingId) {
        const planToUpdate = subscriptions.find((s: SubscriptionPlan) => s.id === editingId);
        if (planToUpdate) {
            await updateSubscription({...planToUpdate, ...subscriptionData});
        }
      } else {
        await addSubscription(subscriptionData);
      }
      setshowPlanForm(false);
      setIsEditing(false);
      setEditingId(null);
      setName('');
      setDuration('');
      setPrice('');
    } catch (e) {
      console.error(e);
      showAlert('Error', 'Failed to save plan');
    }
  };

  const handleDeletePlan = (plan: SubscriptionPlan) => {
    showConfirm(
      'Remove Plan',
      `Delete "${plan.name}"?`,
      () => deleteSubscription(plan.id),
      'Delete',
    );
  };

  const renderPlanItem = ({ item }: { item: SubscriptionPlan }) => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardContent}
        activeOpacity={0.7}
        onPress={() => {
          setIsEditing(true);
          setEditingId(item.id);
          setName(item.name);
          setDuration(String(item.durationMonths));
          setPrice(String(item.price));
          setshowPlanForm(true);
        }}
      >
        <Text style={styles.planName}>{capitalizeWords(item.name)}</Text>
        <View style={styles.planDetails}>
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{item.durationMonths} month{item.durationMonths > 1 ? 's' : ''}</Text>
          </View>
          <Text style={styles.planPrice}>
            {item.price === 0 ? 'FREE' : formatCurrency(item.price)}
          </Text>
        </View>
        <Text style={styles.discountHint}>
          Student: 30% off • {item.price < 2000 ? 'Under ₹2000: 30% off' : 'Over ₹2000: 20% off'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeletePlan(item)}>
        <Trash2 size={16} color={Colors.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={subscriptions}
        keyExtractor={item => item.id}
        renderItem={renderPlanItem}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <CreditCard size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No plans</Text>
            <Text style={styles.emptySubtitle}>Add subscription plans</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        onPress={() => {
          setIsEditing(false);
          setEditingId(null);
          setName('');
          setDuration('');
          setPrice('');
          setshowPlanForm(true);
        }}
      >
        <Plus size={24} color={Colors.surface} />
      </TouchableOpacity>

      <Modal visible={showPlanForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKav}
          >
            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isEditing ? 'Edit Plan' : 'Add Plan'}</Text>
                <TouchableOpacity onPress={() => setshowPlanForm(false)}>
                  <X size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Plan Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Premium Plan"
                placeholderTextColor={Colors.textTertiary}
                value={name}
                onChangeText={setName}
              />
              <Text style={styles.label}>Duration (months)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 6"
                placeholderTextColor={Colors.textTertiary}
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric" />
              <Text style={styles.label}>Price (₹) — 0 for free</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 600"
                placeholderTextColor={Colors.textTertiary}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />
              <TouchableOpacity style={[styles.saveBtn, { marginBottom: insets.bottom }]} onPress={handleSavePlan}>
                <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Add Plan'}</Text>
              </TouchableOpacity>
            </ScrollView>
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
  listContent: {
    padding: Spacing.card,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.card,
    marginBottom: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
  },
  planName: {
    fontSize: FontSize.title,
    fontWeight: '600',
    color: Colors.text,
  },
  planDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  durationBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  durationText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.accent,
  },
  planPrice: {
    fontSize: FontSize.title,
    fontWeight: '700',
    color: Colors.primary,
  },
  discountHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 6,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
    maxHeight: '80%',
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
    marginBottom: 20,
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
    marginTop: 14,
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
    marginTop: 24,
  },
  saveBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.surface,
  },
});