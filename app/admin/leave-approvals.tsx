/**
 * Admin leave & permission approvals — filterable list with approve / reject actions.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import {
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  Filter,
  X,
  CalendarDays,
  Timer,
} from 'lucide-react-native';
import { useData } from '@/providers/DataProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors } from '@/constants/web';
import { AnimatedPage } from '@/components/web/AnimatedPage';
import { DataTable, Column } from '@/components/web/DataTable';
import { EmptyState } from '@/components/web/EmptyState';
import type { LeaveRequest, PermissionRequest, RequestStatus, LeaveType } from '@/types';

// ── Unified row type ────────────────────────────────────────

type RequestKind = 'leave' | 'permission';

interface UnifiedRow {
  id: string;
  kind: RequestKind;
  employeeId: string;
  employeeName: string;
  type: string;
  date: string;
  detail: string;
  reason: string | null;
  status: RequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  raw: LeaveRequest | PermissionRequest;
}

// ── Tabs ─────────────────────────────────────────────────────

const STATUS_TABS: { value: 'all' | RequestStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  leave: { label: 'Leave', color: '#7C3AED', bg: '#EDE9FE' },
  compensation: { label: 'Comp Off', color: '#0891B2', bg: '#CFFAFE' },
  earned: { label: 'Earned', color: '#B45309', bg: '#FEF3C7' },
  permission: { label: 'Permission', color: '#0369A1', bg: '#E0F2FE' },
};

const STATUS_BADGES: Record<RequestStatus, { icon: React.ElementType; color: string; bg: string }> = {
  pending: { icon: Clock, color: Colors.warning, bg: '#FFF7ED' },
  approved: { icon: CheckCircle, color: Colors.success, bg: '#F0FDF4' },
  rejected: { icon: XCircle, color: Colors.danger, bg: Colors.dangerLight },
};

// ── Component ────────────────────────────────────────────────

export default function LeaveApprovals() {
  const { user } = useAuth();
  const { leaveRequests, permissionRequests, users, updateLeaveRequest, updatePermissionRequest } = useData();

  const [tab, setTab] = useState<'all' | RequestStatus>('all');
  const [kindFilter, setKindFilter] = useState<'all' | RequestKind>('all');
  const [search, setSearch] = useState('');
  const [actionModal, setActionModal] = useState<{
    row: UnifiedRow;
    action: 'approve' | 'reject' | 'revoke';
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Build unified rows
  const allRows: UnifiedRow[] = useMemo(() => {
    const rows: UnifiedRow[] = [];

    leaveRequests.forEach(lr => {
      rows.push({
        id: lr.id,
        kind: 'leave',
        employeeId: lr.employeeId,
        employeeName: lr.employeeName,
        type: lr.type,
        date: lr.startDate,
        detail: lr.startDate === lr.endDate ? lr.startDate : `${lr.startDate} → ${lr.endDate}`,
        reason: lr.reason,
        status: lr.status,
        reviewedBy: lr.reviewedBy,
        reviewedAt: lr.reviewedAt,
        createdAt: lr.createdAt,
        raw: lr,
      });
    });

    permissionRequests.forEach(pr => {
      rows.push({
        id: pr.id,
        kind: 'permission',
        employeeId: pr.employeeId,
        employeeName: pr.employeeName,
        type: 'permission',
        date: pr.date,
        detail: `${pr.fromTime} – ${pr.toTime}`,
        reason: pr.reason,
        status: pr.status,
        reviewedBy: pr.reviewedBy,
        reviewedAt: pr.reviewedAt,
        createdAt: pr.createdAt,
        raw: pr,
      });
    });

    return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [leaveRequests, permissionRequests]);

  // Filter
  const filtered = useMemo(() => {
    let rows = allRows;
    if (tab !== 'all') rows = rows.filter(r => r.status === tab);
    if (kindFilter !== 'all') rows = rows.filter(r => r.kind === kindFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        r => r.employeeName.toLowerCase().includes(q) || r.reason?.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [allRows, tab, kindFilter, search]);

  // Counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allRows.length };
    allRows.forEach(r => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [allRows]);

  // Reviewer name lookup
  const reviewerName = (id: string | null) => {
    if (!id) return '—';
    return users.find(u => u.id === id)?.name || 'Admin';
  };

  // Action handler
  const handleAction = async () => {
    if (!actionModal || !user) return;
    setSaving(true);
    try {
      const { row, action } = actionModal;
      const newStatus: RequestStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';

      const reviewedBy = action === 'revoke' ? undefined : user.id;
      const reviewedAt = action === 'revoke' ? undefined : new Date().toISOString();

      if (row.kind === 'leave') {
        await updateLeaveRequest({
          id: row.id,
          status: newStatus,
          reviewedBy,
          reviewedAt,
        });
      } else {
        await updatePermissionRequest({
          id: row.id,
          status: newStatus,
          reviewedBy,
          reviewedAt,
        });
      }

      setActionModal(null);
    } catch {
      // handled by provider
    } finally {
      setSaving(false);
    }
  };

  // Column definitions
  const columns: Column<UnifiedRow>[] = [
    {
      key: 'employeeName',
      title: 'Employee',
      sortable: true,
      render: row => <Text style={styles.nameText}>{row.employeeName}</Text>,
    },
    {
      key: 'type',
      title: 'Type',
      sortable: true,
      render: row => {
        const t = TYPE_LABELS[row.type] || TYPE_LABELS.leave;
        return (
          <View style={[styles.typeBadge, { backgroundColor: t.bg }]}>
            {row.kind === 'permission' ? (
              <Timer size={12} color={t.color} />
            ) : (
              <CalendarDays size={12} color={t.color} />
            )}
            <Text style={[styles.typeBadgeText, { color: t.color }]}>{t.label}</Text>
          </View>
        );
      },
    },
    {
      key: 'detail',
      title: 'Details',
      render: row => (
        <View>
          <Text style={styles.detailText}>{row.detail}</Text>
          {row.reason ? (
            <Text style={styles.reasonText} numberOfLines={1}>
              {row.reason}
            </Text>
          ) : null}
        </View>
      ),
    },
    {
      key: 'createdAt',
      title: 'Requested',
      sortable: true,
      render: row => (
        <Text style={styles.dateText}>
          {new Date(row.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: '2-digit',
          })}
        </Text>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      render: row => {
        const badge = STATUS_BADGES[row.status];
        const Icon = badge.icon;
        return (
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Icon size={13} color={badge.color} />
            <Text style={[styles.statusBadgeText, { color: badge.color }]}>
              {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
            </Text>
          </View>
        );
      },
    },
    {
      key: 'actions' as any,
      title: 'Actions',
      render: row => (
        <View style={styles.actionBtns}>
          {row.status === 'pending' && (
            <>
              <Pressable
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => setActionModal({ row, action: 'approve' })}
              >
                <CheckCircle size={14} color={Colors.success} />
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => setActionModal({ row, action: 'reject' })}
              >
                <XCircle size={14} color={Colors.danger} />
              </Pressable>
            </>
          )}
          {row.status !== 'pending' && (
            <Pressable
              style={[styles.actionBtn, styles.revokeBtn]}
              onPress={() => setActionModal({ row, action: 'revoke' })}
            >
              <RotateCcw size={14} color={Colors.warning} />
            </Pressable>
          )}
        </View>
      ),
    },
  ];

  return (
    <AnimatedPage>
      {/* Filters bar */}
      <View style={styles.filtersRow}>
        {/* Status tabs */}
        <View style={styles.tabs}>
          {STATUS_TABS.map(t => (
            <Pressable
              key={t.value}
              style={[styles.tab, tab === t.value && styles.tabActive]}
              onPress={() => setTab(t.value)}
            >
              <Text style={[styles.tabText, tab === t.value && styles.tabTextActive]}>
                {t.label} {counts[t.value] ? `(${counts[t.value]})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Kind filter */}
        <View style={styles.kindPills}>
          {(['all', 'leave', 'permission'] as const).map(k => (
            <Pressable
              key={k}
              style={[styles.kindPill, kindFilter === k && styles.kindPillActive]}
              onPress={() => setKindFilter(k)}
            >
              <Text style={[styles.kindPillText, kindFilter === k && styles.kindPillTextActive]}>
                {k === 'all' ? 'All Types' : k === 'leave' ? 'Leave' : 'Permission'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Filter size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or reason..."
            placeholderTextColor={Colors.textTertiary}
          />
        </View>
      </View>

      {/* Data table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={48} color={Colors.textTertiary} />}
          title="No requests found"
          subtitle="There are no requests matching the selected filters."
        />
      ) : (
        <DataTable columns={columns} data={filtered} pageSize={12} keyExtractor={r => r.id} />
      )}

      {/* Confirm modal */}
      {actionModal && (
        <Modal transparent animationType="fade" visible>
          <Pressable style={styles.modalOverlay} onPress={() => setActionModal(null)}>
            <Pressable style={styles.modalCard} onPress={e => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {actionModal.action === 'approve'
                    ? 'Approve Request'
                    : actionModal.action === 'reject'
                    ? 'Reject Request'
                    : 'Revoke Decision'}
                </Text>
                <Pressable onPress={() => setActionModal(null)}>
                  <X size={20} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.modalBody}>
                <Text style={styles.modalInfo}>
                  <Text style={{ fontWeight: '700' }}>{actionModal.row.employeeName}</Text>
                  {' requested '}
                  <Text style={{ fontWeight: '700' }}>
                    {TYPE_LABELS[actionModal.row.type]?.label || actionModal.row.type}
                  </Text>
                </Text>
                <Text style={styles.modalDetail}>{actionModal.row.detail}</Text>
                {actionModal.row.reason && (
                  <Text style={styles.modalReason}>Reason: {actionModal.row.reason}</Text>
                )}
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setActionModal(null)} disabled={saving}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.confirmBtn,
                    actionModal.action === 'approve' && styles.confirmApprove,
                    actionModal.action === 'reject' && styles.confirmReject,
                    actionModal.action === 'revoke' && styles.confirmRevoke,
                  ]}
                  onPress={handleAction}
                  disabled={saving}
                >
                  <Text style={styles.confirmBtnText}>
                    {saving
                      ? 'Processing...'
                      : actionModal.action === 'approve'
                      ? 'Approve'
                      : actionModal.action === 'reject'
                      ? 'Reject'
                      : 'Revoke'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </AnimatedPage>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    // @ts-ignore
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  tabText: {
    fontSize: WebTypo.small,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.text,
  },
  kindPills: {
    flexDirection: 'row',
    gap: 6,
  },
  kindPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  kindPillActive: {
    backgroundColor: Colors.primary,
  },
  kindPillText: {
    fontSize: WebTypo.small,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  kindPillTextActive: {
    color: '#FFFFFF',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 200,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: WebTypo.body,
    color: Colors.text,
    outlineStyle: 'none' as any,
  },
  // Table cells
  nameText: {
    fontSize: WebTypo.body,
    fontWeight: '600',
    color: Colors.text,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontSize: WebTypo.small,
    fontWeight: '600',
  },
  detailText: {
    fontSize: WebTypo.body,
    fontWeight: '500',
    color: Colors.text,
  },
  reasonText: {
    fontSize: WebTypo.small,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dateText: {
    fontSize: WebTypo.small,
    color: Colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: WebTypo.small,
    fontWeight: '600',
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    // @ts-ignore
    cursor: 'pointer',
  },
  approveBtn: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  rejectBtn: {
    backgroundColor: Colors.dangerLight,
    borderColor: '#FECACA',
  },
  revokeBtn: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    width: '90%',
    maxWidth: 440,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: WebTypo.h3,
    fontWeight: '700',
    color: Colors.text,
  },
  modalBody: {
    gap: 8,
    marginBottom: 24,
  },
  modalInfo: {
    fontSize: WebTypo.body,
    color: Colors.text,
    lineHeight: 22,
  },
  modalDetail: {
    fontSize: WebTypo.small,
    color: Colors.textSecondary,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
  },
  modalReason: {
    fontSize: WebTypo.small,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontSize: WebTypo.small,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  confirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
  },
  confirmApprove: {
    backgroundColor: Colors.success,
  },
  confirmReject: {
    backgroundColor: Colors.danger,
  },
  confirmRevoke: {
    backgroundColor: Colors.warning,
  },
  confirmBtnText: {
    fontSize: WebTypo.small,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
