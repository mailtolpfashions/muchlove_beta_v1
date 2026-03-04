import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { useAlert } from '@/providers/AlertProvider';
import type { LeaveRequest, PermissionRequest, RequestStatus } from '@/types';

type CombinedRequest = (
  | (LeaveRequest & { reqType: 'leave' })
  | (PermissionRequest & { reqType: 'permission' })
) & { employeeName: string };

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#D97706' },
  approved: { bg: '#D1FAE5', text: '#059669' },
  rejected: { bg: '#FEE2E2', text: '#DC2626' },
};

export default function LeaveApprovalsScreen() {
  const { user } = useAuth();
  const { leaveRequests, permissionRequests, users, updateLeaveRequest, updatePermissionRequest, reload } = useData();
  const { showAlert } = useAlert();
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'pending' | 'processed'>('all');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((p: any) => map.set(p.id, p.name));
    return map;
  }, [users]);

  // Combine all requests
  const allRequests: CombinedRequest[] = useMemo(() => {
    const leaves: CombinedRequest[] = leaveRequests.map(lr => ({
      ...lr,
      reqType: 'leave' as const,
      employeeName: profileMap.get(lr.employeeId) ?? 'Unknown',
    }));
    const perms: CombinedRequest[] = permissionRequests.map(pr => ({
      ...pr,
      reqType: 'permission' as const,
      employeeName: profileMap.get(pr.employeeId) ?? 'Unknown',
    }));
    // Sort: pending first, then by date desc
    return [...leaves, ...perms].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [leaveRequests, permissionRequests, profileMap]);

  const filteredRequests = useMemo(() => {
    if (tab === 'pending') return allRequests.filter(r => r.status === 'pending');
    if (tab === 'processed') return allRequests.filter(r => r.status !== 'pending');
    return allRequests;
  }, [allRequests, tab]);

  const handleAction = async (req: CombinedRequest, action: 'approved' | 'rejected') => {
    if (!user) return;
    setProcessingId(req.id);
    try {
      const update = {
        status: action as RequestStatus,
        reviewedBy: user.id,
        reviewedAt: new Date().toISOString(),
      };
      if (req.reqType === 'leave') {
        await updateLeaveRequest({ id: req.id, ...update });
      } else {
        await updatePermissionRequest({ id: req.id, ...update });
      }
      showAlert('Success', `Request ${action}`);
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to update');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderRequest = ({ item }: { item: CombinedRequest }) => {
    const colors = STATUS_COLORS[item.status] ?? STATUS_COLORS.pending;
    const isLeave = item.reqType === 'leave';
    const leaveItem = item as LeaveRequest & { reqType: string; employeeName: string };
    const permItem = item as PermissionRequest & { reqType: string; employeeName: string };
    const isPending = item.status === 'pending';
    const isProcessing = processingId === item.id;

    return (
      <View style={styles.requestCard}>
        {/* Header */}
        <View style={styles.requestHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.empName}>{item.employeeName}</Text>
            <Text style={styles.reqDate}>
              Requested {formatDate(item.createdAt)}
            </Text>
          </View>
          <View style={[styles.typeBadge, { backgroundColor: isLeave ? (leaveItem.type === 'earned' ? '#D1FAE5' : leaveItem.type === 'compensation' ? '#EDE9FE' : '#FFEDD5') : '#FEF3C7' }]}>
            <Text style={[styles.typeText, { color: isLeave ? (leaveItem.type === 'earned' ? '#059669' : leaveItem.type === 'compensation' ? '#7C3AED' : '#EA580C') : '#D97706' }]}>
              {isLeave ? (leaveItem.type === 'compensation' ? 'COMP LEAVE' : leaveItem.type === 'earned' ? 'EARNED LEAVE' : 'LEAVE') : 'PERMISSION'}
            </Text>
          </View>
        </View>

        {/* Detail */}
        <View style={styles.detailRow}>
          {isLeave ? (
            <Text style={styles.detailText}>
              {formatDate(leaveItem.startDate)} → {formatDate(leaveItem.endDate)}
            </Text>
          ) : (
            <Text style={styles.detailText}>
              {formatDate(permItem.date)} | {permItem.fromTime} → {permItem.toTime}
            </Text>
          )}
        </View>

        {(isLeave ? leaveItem.reason : permItem.reason) && (
          <Text style={styles.reason} numberOfLines={2}>
            {isLeave ? leaveItem.reason : permItem.reason}
          </Text>
        )}

        {/* Status / Actions */}
        {isPending ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleAction(item, 'rejected')}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <>
                  <X size={16} color="#DC2626" />
                  <Text style={[styles.actionText, { color: '#DC2626' }]}>Reject</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleAction(item, 'approved')}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Check size={16} color="#fff" />
                  <Text style={[styles.actionText, { color: '#fff' }]}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.statusRow, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusLabel, { color: colors.text }]}>
              {item.status.toUpperCase()}
            </Text>
            {(item as any).reviewedAt && (
              <Text style={[styles.reviewedAt, { color: colors.text }]}>
                on {formatDate((item as any).reviewedAt)}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const pendingCount = allRequests.filter(r => r.status === 'pending').length;

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.tabRow}>
        {(['all', 'pending', 'processed'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'all' ? 'All' : t === 'pending' ? `Pending (${pendingCount})` : 'Processed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredRequests}
        keyExtractor={item => item.id}
        renderItem={renderRequest}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {tab === 'pending' ? 'No pending requests' : 'No requests found'}
            </Text>
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
  tabRow: {
    flexDirection: 'row',
    padding: Spacing.screen,
    paddingBottom: 0,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: Spacing.screen,
    paddingBottom: 100,
  },
  requestCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  empName: {
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.text,
  },
  reqDate: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  typeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  detailRow: {
    marginBottom: 4,
  },
  detailText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  reason: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  rejectBtn: {
    backgroundColor: '#FEE2E2',
  },
  approveBtn: {
    backgroundColor: '#059669',
  },
  actionText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  statusLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  reviewedAt: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: FontSize.body,
    color: Colors.textTertiary,
  },
});
