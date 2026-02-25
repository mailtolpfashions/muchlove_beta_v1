import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Users, Search, Play, Pause, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { CustomerSubscription } from '@/types';
import { formatDate, capitalizeWords } from '@/utils/format';

export default function CustomerSubscriptionsScreen() {
  const { customerSubscriptions, updateCustomerSubscription, removeCustomerSubscription, reload } = useData();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');

  const filtered = useMemo(() => {
    let list = [...customerSubscriptions];
    if (filter !== 'all') {
      list = list.filter((s: CustomerSubscription) => s.status === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s: CustomerSubscription) => s.customerName.toLowerCase().includes(q) || s.planName.toLowerCase().includes(q));
    }
    return list.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [customerSubscriptions, search, filter]);

  const handleToggleStatus = (sub: CustomerSubscription) => {
    const newStatus = sub.status === 'active' ? 'paused' : 'active';
    Alert.alert(
      `Confirm ${capitalizeWords(newStatus)}`,
      `Are you sure you want to change status of "${sub.planName}" for ${sub.customerName} to ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Set to ${newStatus}`,
          onPress: () => updateCustomerSubscription({ ...sub, status: newStatus }),
        },
      ]
    );
  };

  const handleRemove = (sub: CustomerSubscription) => {
    Alert.alert(
      'Remove Subscription',
      `Are you sure you want to remove "${sub.planName}" from ${sub.customerName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeCustomerSubscription(sub.id),
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: CustomerSubscription }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.name}>{capitalizeWords(item.customerName)}</Text>
        <Text style={styles.meta}>{item.planName}</Text>
        <Text style={styles.meta}>Start: {formatDate(item.startDate)} • Billed by: {item.assignedByName}</Text>
      </View>
      <View style={styles.statusBadgeContainer}>
        <View style={[styles.statusBadge, item.status === 'active' ? styles.activeBadge : styles.pausedBadge]}>
          <Text style={[styles.statusText, item.status === 'active' ? styles.activeText : styles.pausedText]}>
            {capitalizeWords(item.status)}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleToggleStatus(item)}>
          {item.status === 'active' ? <Pause size={16} color={Colors.warning} /> : <Play size={16} color={Colors.success} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleRemove(item)}>
          <Trash2 size={16} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer or plan..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>All ({customerSubscriptions.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'active' && styles.filterChipActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterChipText, filter === 'active' && styles.filterChipTextActive]}>Active ({customerSubscriptions.filter((s: CustomerSubscription) => s.status === 'active').length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'paused' && styles.filterChipActive]}
          onPress={() => setFilter('paused')}
        >
          <Text style={[styles.filterChipText, filter === 'paused' && styles.filterChipTextActive]}>Paused ({customerSubscriptions.filter((s: CustomerSubscription) => s.status === 'paused').length})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Users size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No subscriptions</Text>
            <Text style={styles.emptySubtitle}>Customer subscriptions will appear here</Text>
          </View>
        }
      />
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
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.card,
    paddingBottom: Spacing.md,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.primary,
  },
  listContent: {
    paddingHorizontal: Spacing.card,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardInfo: {
    flex: 1,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  meta: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadgeContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeBadge: {
    backgroundColor: Colors.successLight,
  },
  pausedBadge: {
    backgroundColor: Colors.warningLight,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  activeText: {
    color: Colors.success,
  },
  pausedText: {
    color: Colors.warning,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
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
});
