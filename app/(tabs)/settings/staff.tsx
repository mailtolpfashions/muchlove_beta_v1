import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Trash2, X, Search, Users, Shield, UserCheck, Lock, AlertTriangle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { User } from '@/types';
import { useAlert } from '@/providers/AlertProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { capitalizeWords, isValidName } from '@/utils/format';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import BottomSheetModal from '@/components/BottomSheetModal';

export default function StaffScreen() {
  const { users, updateUser, deleteUser, reload } = useData();
  const { user: currentUser, isAdmin } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const [showStaffForm, setshowStaffForm] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');

  // Form state
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<User['role']>('employee');
  const [approved, setApproved] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fraudLogs, setFraudLogs] = useState<any[]>([]);
  const [loadingFraudLogs, setLoadingFraudLogs] = useState(false);

  const resetForm = () => {
    setName('');
    setRole('employee');
    setApproved(true);
    setIsEditing(false);
    setEditingId(null);
    setFraudLogs([]);
  };

  /** Load fraud logs for a specific user when editing */
  const loadFraudLogs = async (userId: string) => {
    setLoadingFraudLogs(true);
    try {
      const { data } = await supabase
        .from('fraud_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      setFraudLogs(data ?? []);
    } catch {
      setFraudLogs([]);
    } finally {
      setLoadingFraudLogs(false);
    }
  };

  const handleSaveStaff = async () => {
    if (!name.trim()) {
      showAlert('Error', 'Name is required');
      return;
    }
    if (!isValidName(name.trim())) {
      showAlert('Error', 'Name must be at least 4 letters and contain only letters and spaces.');
      return;
    }
    try {
      if (isEditing && editingId) {
        await updateUser({
          id: editingId,
          name: capitalizeWords(name.trim()),
          role,
          approved,
        });
      }
      setshowStaffForm(false);
      resetForm();
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save employee');
    }
  };

  const handleDeleteStaff = (user: User) => {
    if (user.id === currentUser?.id) {
      showAlert('Error', 'You cannot remove yourself');
      return;
    }
    showConfirm(
      'Remove Employee',
      `Delete "${user.name}"? This only removes their profile, not their auth account.`,
      () => deleteUser(user.id),
      'Delete',
    );
  };

  const filteredStaff = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u: User) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const renderStaffItem = ({ item }: { item: User }) => (
    <View style={[styles.card, !item.approved && styles.cardLocked]}>
      <TouchableOpacity
        style={styles.cardContent}
        activeOpacity={0.7}
        onPress={() => {
          if (!isAdmin) return;
          setIsEditing(true);
          setEditingId(item.id);
          setName(item.name);
          setRole(item.role);
          setApproved(item.approved ?? true);
          setshowStaffForm(true);
          loadFraudLogs(item.id);
        }}
      >
        <View style={styles.nameRow}>
          {!item.approved && <Lock size={14} color={Colors.danger} />}
          <Text style={[styles.staffName, !item.approved && { color: Colors.danger }]}>{capitalizeWords(item.name)}</Text>
          {item.role === 'admin' && (
            <View style={styles.adminBadge}>
              <Shield size={10} color={Colors.primary} />
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
          {!item.approved && (
            <View style={styles.lockedBadge}>
              <Text style={styles.lockedBadgeText}>Locked</Text>
            </View>
          )}
        </View>
        <Text style={styles.staffEmail}>{item.email}</Text>
      </TouchableOpacity>
      {isAdmin && item.id !== currentUser?.id && (
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteStaff(item)}>
          <Trash2 size={16} color={Colors.danger} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or email..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <UserCheck size={14} color={Colors.textSecondary} />
        <Text style={styles.infoText}>Staff members sign up from the login screen. Admin can edit roles here.</Text>
      </View>

      <FlatList
        data={filteredStaff}
        keyExtractor={item => item.id}
        renderItem={renderStaffItem}
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
            <Users size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No employees</Text>
            <Text style={styles.emptySubtitle}>Staff will appear here after they sign up</Text>
          </View>
        }
      />

      <BottomSheetModal visible={showStaffForm} onRequestClose={() => setshowStaffForm(false)}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Employee</Text>
                <TouchableOpacity onPress={() => setshowStaffForm(false)}>
                  <X size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={Colors.textTertiary}
                value={name}
                onChangeText={setName}
              />
              <Text style={styles.label}>Role</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'employee' && styles.roleBtnActive]}
                  onPress={() => setRole('employee')}
                >
                  <Text style={[styles.roleBtnText, role === 'employee' && styles.roleBtnTextActive]}>Employee</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'admin' && styles.roleBtnActive]}
                  onPress={() => setRole('admin')}
                >
                  <Text style={[styles.roleBtnText, role === 'admin' && styles.roleBtnTextActive]}>Admin</Text>
                </TouchableOpacity>
              </View>

              {/* Account Active Toggle */}
              <Text style={styles.label}>Account Status</Text>
              <View style={styles.toggleRow}>
                <Text style={[styles.toggleLabel, !approved && { color: Colors.danger }]}>
                  {approved ? 'Active' : 'Locked'}
                </Text>
                <Switch
                  value={approved}
                  onValueChange={setApproved}
                  trackColor={{ false: Colors.danger, true: Colors.success ?? '#4CAF50' }}
                  thumbColor={Colors.surface}
                />
              </View>
              {!approved && (
                <Text style={styles.lockedNote}>
                  Locked accounts cannot log in or make sales.
                </Text>
              )}

              {/* Fraud Logs Section */}
              {loadingFraudLogs && (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 12 }} />
              )}
              {!loadingFraudLogs && fraudLogs.length > 0 && (
                <View style={styles.fraudSection}>
                  <View style={styles.fraudHeader}>
                    <AlertTriangle size={16} color={Colors.danger} />
                    <Text style={styles.fraudTitle}>Fraud Alerts</Text>
                  </View>
                  {fraudLogs.map((log, idx) => (
                    <View key={log.id || idx} style={styles.fraudItem}>
                      <Text style={styles.fraudReason}>
                        {log.reason === 'reinstall_unsynced_sales'
                          ? 'App reinstalled with unsynced sales'
                          : log.reason === 'shadow_mismatch'
                          ? 'Sale shadow mismatch detected'
                          : log.reason ?? 'Unknown'}
                      </Text>
                      <Text style={styles.fraudDetail}>
                        {log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : ''}
                      </Text>
                      <Text style={styles.fraudTime}>
                        {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity style={[styles.saveBtn, { marginBottom: insets.bottom }]} onPress={handleSaveStaff}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
              </ScrollView>
      </BottomSheetModal>
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
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.text,
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
  staffName: {
    fontSize: FontSize.md,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  nameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  adminBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  staffEmail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginHorizontal: Spacing.card,
    marginBottom: Spacing.md,
    padding: 12,
    backgroundColor: Colors.primaryLight ?? '#FFF0F5',
    borderRadius: BorderRadius.md,
  },
  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  roleRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginTop: 4,
  },
  roleBtn: {
    flex: 1,
    height: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBg,
  },
  roleBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight ?? '#FFF0F5',
  },
  roleBtnText: {
    fontSize: FontSize.body,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  roleBtnTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
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
  cardLocked: {
    borderWidth: 1.5,
    borderColor: Colors.danger,
    opacity: 0.85,
  },
  lockedBadge: {
    backgroundColor: '#FDECEA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 4,
    paddingVertical: 4,
  },
  toggleLabel: {
    fontSize: FontSize.body,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  lockedNote: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  fraudSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF3F0',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  fraudHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 8,
  },
  fraudTitle: {
    fontSize: FontSize.md,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
  fraudItem: {
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#FECACA',
  },
  fraudReason: {
    fontSize: FontSize.sm,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  fraudDetail: {
    fontSize: FontSize.xs ?? 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  fraudTime: {
    fontSize: FontSize.xs ?? 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});