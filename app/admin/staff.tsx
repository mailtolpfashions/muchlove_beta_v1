/**
 * Admin staff management — view, edit roles, approve/unapprove, fraud logs.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import {
  Search,
  Users,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
} from 'lucide-react-native';
import { useData } from '@/providers/DataProvider';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors } from '@/constants/web';
import { AnimatedPage } from '@/components/web/AnimatedPage';
import { DataTable, Column } from '@/components/web/DataTable';
import { StatCard } from '@/components/web/StatCard';
import { useAlert } from '@/providers/AlertProvider';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

export default function AdminStaff() {
  const { users, updateUser, deleteUser, dataLoading } = useData();
  const { user: currentUser } = useAuth();
  const { showAlert, showConfirm } = useAlert();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  // Form
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'employee'>('employee');
  const [editApproved, setEditApproved] = useState(false);
  const [editMobile, setEditMobile] = useState('');

  // Fraud logs
  const [showFraudModal, setShowFraudModal] = useState(false);
  const [fraudLogs, setFraudLogs] = useState<any[]>([]);
  const [fraudLoading, setFraudLoading] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  // Stats
  const totalStaff = users.length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const approvedCount = users.filter(u => u.approved).length;
  const pendingCount = users.filter(u => !u.approved).length;

  const openEdit = (u: User) => {
    setEditing(u);
    setEditName(u.name);
    setEditRole(u.role);
    setEditApproved(u.approved);
    setEditMobile(u.mobile ?? '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!editing || !editName.trim()) return;
    try {
      await updateUser({
        id: editing.id,
        name: editName.trim(),
        role: editRole,
        approved: editApproved,
        mobile: editMobile.trim() || undefined,
      });
      showAlert('Updated', `${editName.trim()} updated`);
      setShowModal(false);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to update');
    }
  };

  const handleDelete = async (u: User) => {
    if (u.id === currentUser?.id) { showAlert('Error', 'Cannot delete yourself'); return; }
    showConfirm('Delete Staff', `Remove ${u.name}? This cannot be undone.`, async () => {
      try {
        await deleteUser(u.id);
        showAlert('Deleted', `${u.name} has been removed`);
      } catch (e: any) {
        showAlert('Error', e.message || 'Failed to delete');
      }
    });
  };

  const toggleApproval = async (u: User) => {
    try {
      await updateUser({ id: u.id, name: u.name, role: u.role, approved: !u.approved });
      showAlert('Updated', `${u.name} ${!u.approved ? 'approved' : 'unapproved'}`);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to update');
    }
  };

  const loadFraudLogs = async () => {
    setFraudLoading(true);
    setShowFraudModal(true);
    try {
      const { data, error } = await supabase.from('fraud_logs').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      setFraudLogs(data ?? []);
    } catch {
      setFraudLogs([]);
    } finally {
      setFraudLoading(false);
    }
  };

  const exportCSV = () => {
    const header = 'Name,Email,Mobile,Role,Approved,Joined';
    const rows = filtered.map(u =>
      `"${u.name}","${u.email}","${u.mobile ?? ''}","${u.role}",${u.approved ? 'Yes' : 'No'},"${u.joiningDate}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'staff.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<User>[] = [
    { key: 'name', title: 'Name', sortable: true, width: '20%',
      render: (u) => (
        <View>
          <Text style={s.cellBold}>{u.name}</Text>
          <Text style={s.cellSmall}>{u.email}</Text>
        </View>
      ) },
    { key: 'mobile', title: 'Mobile', width: '12%',
      render: (u) => <Text style={s.cell}>{u.mobile || '—'}</Text> },
    { key: 'role', title: 'Role', width: '10%', sortable: true,
      render: (u) => (
        <View style={[s.badge, u.role === 'admin' ? s.badgeAdmin : s.badgeEmployee]}>
          <Text style={[s.badgeText, u.role === 'admin' ? s.badgeAdminText : s.badgeEmployeeText]}>
            {u.role === 'admin' ? 'Admin' : 'Employee'}
          </Text>
        </View>
      ) },
    { key: 'approved', title: 'Status', width: '10%',
      render: (u) => (
        <Pressable onPress={() => toggleApproval(u)}>
          <View style={[s.badge, u.approved ? s.badgeApproved : s.badgePending]}>
            <Text style={[s.badgeText, u.approved ? s.badgeApprovedText : s.badgePendingText]}>
              {u.approved ? 'Approved' : 'Pending'}
            </Text>
          </View>
        </Pressable>
      ) },
    { key: 'joiningDate', title: 'Joined', width: '12%', sortable: true,
      render: (u) => <Text style={s.cellSmall}>{new Date(u.joiningDate).toLocaleDateString('en-IN')}</Text> },
    { key: 'actions', title: '', width: '12%',
      render: (u) => (
        <View style={s.actions}>
          <Pressable style={s.actionBtn} onPress={() => openEdit(u)}>
            <Pencil size={15} color={Colors.primary} />
          </Pressable>
          {u.id !== currentUser?.id && (
            <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={() => handleDelete(u)}>
              <Trash2 size={15} color="#DC2626" />
            </Pressable>
          )}
        </View>
      ) },
  ];

  return (
    <AnimatedPage>
      {/* Stats */}
      <View style={s.statsRow}>
        <StatCard icon={<Users size={22} color="#E91E63" />} label="Total Staff" value={totalStaff} gradient={WebColors.gradientRevenue} />
        <StatCard icon={<ShieldCheck size={22} color="#8B5CF6" />} label="Admins" value={adminCount} gradient={WebColors.gradientSales} />
        <StatCard icon={<UserCheck size={22} color="#0EA5E9" />} label="Approved" value={approvedCount} gradient={WebColors.gradientStaff} />
        <StatCard icon={<ShieldAlert size={22} color="#F59E0B" />} label="Pending" value={pendingCount} gradient={WebColors.gradientRequests} />
      </View>

      {/* Toolbar */}
      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput style={s.searchInput} placeholder="Search staff..." value={search} onChangeText={setSearch} placeholderTextColor={Colors.textTertiary} />
          {search ? <Pressable onPress={() => setSearch('')}><X size={16} color={Colors.textTertiary} /></Pressable> : null}
        </View>
        <View style={s.toolbarRight}>
          <Pressable style={s.fraudBtn} onPress={loadFraudLogs}>
            <AlertTriangle size={16} color="#DC2626" />
            <Text style={s.fraudBtnText}>Fraud Logs</Text>
          </Pressable>
          <Pressable style={s.exportBtn} onPress={exportCSV}>
            <Download size={16} color={Colors.textSecondary} />
            <Text style={s.exportText}>Export</Text>
          </Pressable>
        </View>
      </View>

      {/* Table */}
      <View style={s.tableCard}>
        <DataTable columns={columns} data={filtered} keyExtractor={u => u.id} loading={dataLoading} emptyTitle="No staff found" />
      </View>

      {/* Edit Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <Pressable style={s.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={s.modal} onPress={e => e.stopPropagation()}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Staff</Text>
              <Pressable onPress={() => setShowModal(false)}><X size={20} color={Colors.textSecondary} /></Pressable>
            </View>
            <View style={s.formRow}>
              <View style={s.formField}>
                <Text style={s.label}>Name</Text>
                <TextInput style={s.input} value={editName} onChangeText={setEditName} placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={s.formField}>
                <Text style={s.label}>Mobile</Text>
                <TextInput style={s.input} value={editMobile} onChangeText={setEditMobile} placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>
            <View style={s.formRow}>
              <View style={s.formField}>
                <Text style={s.label}>Role</Text>
                <View style={s.roleRow}>
                  {(['employee', 'admin'] as const).map(r => (
                    <Pressable key={r} style={[s.roleChip, editRole === r && s.roleChipActive]} onPress={() => setEditRole(r)}>
                      <Text style={[s.roleChipText, editRole === r && s.roleChipTextActive]}>{r === 'admin' ? 'Admin' : 'Employee'}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={s.formField}>
                <Text style={s.label}>Approved</Text>
                <View style={s.roleRow}>
                  <Pressable style={[s.roleChip, editApproved && s.roleChipActive]} onPress={() => setEditApproved(true)}>
                    <Text style={[s.roleChipText, editApproved && s.roleChipTextActive]}>Approved</Text>
                  </Pressable>
                  <Pressable style={[s.roleChip, !editApproved && s.roleChipActive]} onPress={() => setEditApproved(false)}>
                    <Text style={[s.roleChipText, !editApproved && s.roleChipTextActive]}>Pending</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <View style={s.modalFooter}>
              <Pressable style={s.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.saveBtn} onPress={handleSave}>
                <Text style={s.saveText}>Update</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Fraud Logs Modal */}
      <Modal visible={showFraudModal} transparent animationType="fade">
        <Pressable style={s.overlay} onPress={() => setShowFraudModal(false)}>
          <Pressable style={[s.modal, { maxWidth: 700, maxHeight: '80%' }]} onPress={e => e.stopPropagation()}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Fraud Logs</Text>
              <Pressable onPress={() => setShowFraudModal(false)}><X size={20} color={Colors.textSecondary} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 500 }}>
              {fraudLoading ? (
                <Text style={s.cell}>Loading...</Text>
              ) : fraudLogs.length === 0 ? (
                <Text style={[s.cell, { textAlign: 'center', paddingVertical: 40 }]}>No fraud logs found</Text>
              ) : (
                fraudLogs.map((log, i) => (
                  <View key={log.id || i} style={[s.fraudRow, i % 2 === 1 && { backgroundColor: '#FAFAFA' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cellBold}>{log.user_name ?? 'Unknown'}</Text>
                      <Text style={s.cellSmall}>{log.reason ?? log.type ?? 'Reinstall detected'}</Text>
                    </View>
                    <Text style={s.cellSmall}>{new Date(log.created_at).toLocaleDateString('en-IN')}</Text>
                    <View style={[s.badge, log.dismissed ? s.badgeApproved : s.badgePending, { marginLeft: 8 }]}>
                      <Text style={[s.badgeText, log.dismissed ? s.badgeApprovedText : s.badgePendingText]}>
                        {log.dismissed ? 'Dismissed' : 'Active'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </AnimatedPage>
  );
}

const s = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 24, flexWrap: 'wrap' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#F1F1F4', flex: 1, maxWidth: 400, gap: 8 },
  searchInput: { flex: 1, fontSize: WebTypo.body, color: Colors.text, outlineStyle: 'none' as any },
  toolbarRight: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#F1F1F4' },
  exportText: { fontSize: WebTypo.button, color: Colors.textSecondary, fontWeight: '500' },
  fraudBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEE2E2', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#FECACA' },
  fraudBtnText: { fontSize: WebTypo.button, color: '#DC2626', fontWeight: '600' },
  tableCard: { backgroundColor: '#FFF', borderRadius: 14, overflow: 'hidden', shadowColor: WebColors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },

  cell: { fontSize: WebTypo.table, color: Colors.text },
  cellBold: { fontSize: WebTypo.table, color: Colors.text, fontWeight: '600' },
  cellSmall: { fontSize: WebTypo.tiny, color: Colors.textSecondary },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 6, borderRadius: 8, backgroundColor: Colors.primaryLight },
  deleteBtn: { backgroundColor: '#FEE2E2' },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  badgeText: { fontSize: WebTypo.tiny, fontWeight: '600' },
  badgeAdmin: { backgroundColor: '#EDE9FE' },
  badgeAdminText: { color: '#7C3AED' },
  badgeEmployee: { backgroundColor: '#DBEAFE' },
  badgeEmployeeText: { color: '#2563EB' },
  badgeApproved: { backgroundColor: '#D1FAE5' },
  badgeApprovedText: { color: '#059669' },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgePendingText: { color: '#D97706' },

  fraudRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#FFF', borderRadius: 16, padding: 28, width: '90%', maxWidth: 560, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: WebTypo.h2, fontWeight: '700', color: Colors.text },
  formRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  formField: { flex: 1 },
  label: { fontSize: WebTypo.label, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: WebTypo.body, color: Colors.text, backgroundColor: '#FAFAFA', outlineStyle: 'none' as any },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' },
  roleChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  roleChipText: { fontSize: WebTypo.body, color: Colors.textSecondary, fontWeight: '500' },
  roleChipTextActive: { color: Colors.primary, fontWeight: '600' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  cancelText: { fontSize: WebTypo.button, color: Colors.textSecondary, fontWeight: '500' },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.primary },
  saveText: { fontSize: WebTypo.button, color: '#FFF', fontWeight: '600' },
});
