/**
 * OfflineBadge — small badge shown on entity cards/rows when
 * the entity has a pending offline mutation (add/update/delete).
 *
 * Usage:
 *   <OfflineBadge entity="customers" entityId={customer.id} />
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CloudOff, Upload, Trash2, Pencil } from 'lucide-react-native';
import { useData } from '@/providers/DataProvider';
import { MutationOperation } from '@/utils/offlineMutationQueue';

interface OfflineBadgeProps {
  entity: string;
  entityId: string;
  /** Compact mode — icon only, no text */
  compact?: boolean;
}

const OP_CONFIG: Record<
  MutationOperation,
  { label: string; color: string; icon: typeof CloudOff }
> = {
  add: { label: 'Pending upload', color: '#2563EB', icon: Upload },
  update: { label: 'Pending update', color: '#D97706', icon: Pencil },
  delete: { label: 'Pending delete', color: '#DC2626', icon: Trash2 },
};

export default function OfflineBadge({ entity, entityId, compact }: OfflineBadgeProps) {
  const { isPendingSync } = useData();

  const operation = isPendingSync(entity as any, entityId);
  if (!operation) return null;

  const config = OP_CONFIG[operation];
  const Icon = config.icon;

  if (compact) {
    return (
      <View style={[styles.compactBadge, { backgroundColor: config.color }]}>
        <Icon size={10} color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: config.color + '15', borderColor: config.color + '40' }]}>
      <Icon size={12} color={config.color} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  compactBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
