import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { Plus, Trash2, X, Search, Users } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { User } from '@/types';

export default function StaffScreen() {
  const { users, addUser, updateUser, deleteUser, reload } = useData();
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
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setUsername('');
    setPassword('');
    setIsEditing(false);
    setEditingId(null);
  };

  const handleSaveStaff = async () => {
    if (!name.trim() || !username.trim()) {
      Alert.alert('Error', 'Name and username are required');
      return;
    }
    if (!isEditing && !password.trim()) {
      Alert.alert('Error', 'Password is required for new employees');
      return;
    }
    try {
      if (isEditing && editingId) {
        const userToUpdate = users.find((u: User) => u.id === editingId);
        if (userToUpdate) {
          const updatedUser: User & { password?: string } = {
            ...userToUpdate,
            name: name.trim(),
            username: username.trim(),
          };
          const newPassword = password.trim();
          if (newPassword) {
            updatedUser.password = newPassword;
          }
          await updateUser(updatedUser);
        }
      } else {
        await addUser({
          username: username.trim(),
          name: name.trim(),
          role: 'employee',
          password: password.trim(),
        });
      }
      setshowStaffForm(false);
      resetForm();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save employee');
    }
  };

  const handleDeleteStaff = (user: User) => {
    Alert.alert('Remove Employee', `Delete "${user.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteUser(user.id),
      },
    ]);
  };

  const filteredStaff = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u: User) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    );
  }, [users, search]);

  const renderStaffItem = ({ item }: { item: User }) => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardContent}
        activeOpacity={0.7}
        onPress={() => {
          setIsEditing(true);
          setEditingId(item.id);
          setName(item.name);
          setUsername(item.username);
          setPassword('');
          setshowStaffForm(true);
        }}
      >
        <Text style={styles.staffName}>{item.name}</Text>
        <Text style={styles.staffUsername}>@{item.username}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteStaff(item)}>
        <Trash2 size={16} color={Colors.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or username..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setshowStaffForm(true); }}>
          <Plus size={18} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredStaff}
        keyExtractor={item => item.id}
        renderItem={renderStaffItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Users size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No employees</Text>
            <Text style={styles.emptySubtitle}>Add new employee records</Text>
          </View>
        }
      />

      <Modal visible={showStaffForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKav}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isEditing ? 'Edit Employee' : 'Add Employee'}</Text>
                <TouchableOpacity onPress={() => setshowStaffForm(false)}>
                  <X size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={Colors.textTertiary}
                value={name}
                onChangeText={setName}
              />
              <Text style={styles.label}>Username *</Text>
              <TextInput
                style={styles.input}
                placeholder="Login username"
                placeholderTextColor={Colors.textTertiary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
              <Text style={styles.label}>{isEditing ? 'New Password (optional)' : 'Password *'}</Text>
              <TextInput
                style={styles.input}
                placeholder="Min. 6 characters"
                placeholderTextColor={Colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveStaff}>
                <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Add Employee'}</Text>
              </TouchableOpacity>
            </View>
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
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
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
  cardContent: {
    flex: 1,
  },
  staffName: {
    fontSize: FontSize.md,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  staffUsername: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalKav: {
    maxHeight: '60%',
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
});