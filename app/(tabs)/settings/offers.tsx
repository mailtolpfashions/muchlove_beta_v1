import React, { useState, useMemo } from 'react';
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
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Plus, Trash2, X, Search, Tag, CalendarDays, GraduationCap } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { Offer } from '@/types';
import { useAlert } from '@/providers/AlertProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { capitalizeWords, formatDateDDMMYYYY, parseDDMMYYYY } from '@/utils/format';
import DatePickerModal from '@/components/DatePickerModal';

/** Convert any stored date string (YYYY-MM-DD or DD-MM-YYYY) to DD-MM-YYYY */
function toDisplayDate(str: string): string {
  if (!str) return '';
  const parsed = parseDDMMYYYY(str);
  if (parsed) return str; // already DD-MM-YYYY
  // Try ISO / YYYY-MM-DD
  const d = new Date(str);
  if (!isNaN(d.getTime())) return formatDateDDMMYYYY(d);
  return str;
}

export default function OffersScreen() {
  const { offers, addOffer, updateOffer, deleteOffer, reload } = useData();
  const { showAlert, showConfirm } = useAlert();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'promo' | 'visit' | 'student'>('all');

  // Form state
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<'promo' | 'visit' | 'student'>('promo');
  const [visitThreshold, setVisitThreshold] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  const [promoCode, setPromoCode] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [appliesTo, setAppliesTo] = useState<'services' | 'subscriptions' | 'both'>('both');

  const resetForm = () => {
    setName('');
    setType('promo');
    setVisitThreshold('');
    setDiscount('');
    setPromoCode('');
    setStartDate('');
    setEndDate('');
    setIsEditing(false);
    setEditingId(null);
    setAppliesTo('both');
  };

  const handleAdd = async () => {
    if (!name.trim() || !discount.trim()) {
      showAlert('Error', 'Name and discount are required');
      return;
    }
    if (type === 'visit' && !visitThreshold.trim()) {
      showAlert('Error', 'Visit threshold is required for visit-based offers');
      return;
    }
    if (type === 'promo' && !promoCode.trim()) {
      showAlert('Error', 'Promo code is required for promo offers');
      return;
    }

    try {
      let offerData: Partial<Offer> = {
        name: name.trim(),
        percent: parseFloat(discount),
        appliesTo: type === 'student' ? appliesTo : 'both',
        studentOnly: type === 'student',
      };

      if (type === 'promo') {
        offerData = {
          ...offerData,
          name: promoCode.trim().toUpperCase(),
          visitCount: undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        };
      } else if (type === 'visit') {
        offerData = {
          ...offerData,
          visitCount: parseInt(visitThreshold, 10),
        };
      } else if (type === 'student') {
        offerData = {
          ...offerData,
          visitCount: -1, // Using -1 as a flag for student offers
          studentOnly: true, // Student offers always apply to students only
        };
      }

      if (isEditing && editingId) {
        const offerToUpdate = offers.find((o: Offer) => o.id === editingId);
        if (offerToUpdate) {
          await updateOffer({ ...offerToUpdate, ...offerData });
        }
      } else {
        await addOffer(offerData as Omit<Offer, 'id' | 'createdAt'>);
      }
      setShowAdd(false);
      resetForm();
    } catch (e) {
      console.error(e);
      showAlert('Error', 'Failed to save offer');
    }
  };

  const handleRemove = (offer: Offer) => {
    showConfirm(
      'Remove Offer',
      `Delete "${offer.name}"?`,
      () => deleteOffer(offer.id),
      'Delete',
    );
  };

  const filteredOffers = useMemo(() => {
    let list = offers;
    if (filter !== 'all') {
      list = list.filter((o: Offer) => {
        if (filter === 'visit') return o.visitCount != null && o.visitCount >= 0;
        if (filter === 'student') return o.visitCount === -1;
        if (filter === 'promo') return o.visitCount == null;
        return false;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o: Offer) => o.name.toLowerCase().includes(q));
    }
    return list;
  }, [offers, search, filter]);

  const renderItem = ({ item }: { item: Offer }) => {
    const isVisit = item.visitCount != null && item.visitCount >= 0;
    const isStudent = item.visitCount === -1;
    const isPromo = !isVisit && !isStudent;

    let typeText = 'Promo Code';
    if (isVisit) typeText = 'Visit Offer';
    if (isStudent) typeText = 'Student Offer';

    let typeBg = Colors.successLight;
    if (isVisit) typeBg = Colors.infoLight;
    if (isStudent) typeBg = Colors.warningLight;

    let typeColor = Colors.success;
    if (isVisit) typeColor = Colors.info;
    if (isStudent) typeColor = Colors.warning;

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardContent}
          activeOpacity={0.7}
          onPress={() => {
            setIsEditing(true);
            setEditingId(item.id);
            setName(item.name);
            setDiscount(String(item.percent));
            setAppliesTo(item.appliesTo || 'both');
            if (isVisit) {
              setType('visit');
              setVisitThreshold(String(item.visitCount));
            } else if (isStudent) {
              setType('student');
            } else {
              setType('promo');
              setPromoCode(item.name);
              // Convert stored dates to DD-MM-YYYY display format
              setStartDate(item.startDate ? toDisplayDate(item.startDate) : '');
              setEndDate(item.endDate ? toDisplayDate(item.endDate) : '');
            }
            setShowAdd(true);
          }}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.offerName}>{capitalizeWords(item.name)}</Text>
            <View style={[styles.typeBadge, { backgroundColor: typeBg }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>{typeText}</Text>
            </View>
          </View>
          <Text style={styles.offerDiscount}>{item.percent}% OFF</Text>
          {isVisit && <Text style={styles.offerDetail}>After {item.visitCount} visits</Text>}
          {isPromo && item.name && <Text style={styles.offerDetail}>Code: {capitalizeWords(item.name)}</Text>}
          {(isPromo && (item.startDate || item.endDate)) && (
            <Text style={styles.offerDetail}>
              Active: {item.startDate ? formatDateDDMMYYYY(parseDDMMYYYY(item.startDate) || item.startDate) : '...'} to {item.endDate ? formatDateDDMMYYYY(parseDDMMYYYY(item.endDate) || item.endDate) : '...'}
            </Text>
          )}
          <View style={styles.offerTagsRow}>
            <View style={[styles.miniTag, { backgroundColor: Colors.primaryLight }]}>
              <Text style={[styles.miniTagText, { color: Colors.primary }]}>
                {item.appliesTo === 'services' ? 'Services Only' : item.appliesTo === 'subscriptions' ? 'Subscriptions Only' : 'Services & Subs'}
              </Text>
            </View>
            {item.studentOnly && (
              <View style={[styles.miniTag, { backgroundColor: Colors.warningLight }]}>
                <GraduationCap size={10} color={Colors.warning} />
                <Text style={[styles.miniTagText, { color: Colors.warning }]}>Students Only</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleRemove(item)}>
          <Trash2 size={16} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or code..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setShowAdd(true); }}>
          <Plus size={18} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}>
          <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'promo' && styles.filterChipActive]}
          onPress={() => setFilter('promo')}> 
          <Text style={[styles.filterChipText, filter === 'promo' && styles.filterChipTextActive]}>Promo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'visit' && styles.filterChipActive]}
          onPress={() => setFilter('visit')}>
          <Text style={[styles.filterChipText, filter === 'visit' && styles.filterChipTextActive]}>Visit-Based</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'student' && styles.filterChipActive]}
          onPress={() => setFilter('student')}>
          <Text style={[styles.filterChipText, filter === 'student' && styles.filterChipTextActive]}>Student</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredOffers}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Tag size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No offers yet</Text>
            <Text style={styles.emptySubtitle}>Create visit-based, promo, or student offers</Text>
          </View>
        }
      />

      <DatePickerModal
        visible={showStartPicker}
        title="Start Date"
        value={parseDDMMYYYY(startDate)}
        minDate={new Date()}
        onSelect={(d) => setStartDate(d ? formatDateDDMMYYYY(d) : '')}
        onClose={() => setShowStartPicker(false)}
      />
      <DatePickerModal
        visible={showEndPicker}
        title="End Date"
        value={parseDDMMYYYY(endDate)}
        minDate={parseDDMMYYYY(startDate) || new Date()}
        onSelect={(d) => setEndDate(d ? formatDateDDMMYYYY(d) : '')}
        onClose={() => setShowEndPicker(false)}
      />

      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKav}>
            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isEditing ? 'Edit Offer' : 'Add Offer'}</Text>
                <TouchableOpacity onPress={() => setShowAdd(false)}>
                  <X size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Offer Type</Text>
                  <View style={styles.switchContainer}>
                    <TouchableOpacity style={[styles.switchButton, type === 'promo' && styles.switchButtonActive]} onPress={() => setType('promo')}> 
                      <Text style={[styles.switchButtonText, type === 'promo' && styles.switchButtonTextActive]}>Promo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.switchButton, type === 'visit' && styles.switchButtonActive]} onPress={() => setType('visit')}>
                      <Text style={[styles.switchButtonText, type === 'visit' && styles.switchButtonTextActive]}>Visit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.switchButton, type === 'student' && styles.switchButtonActive]} onPress={() => setType('student')}>
                      <Text style={[styles.switchButtonText, type === 'student' && styles.switchButtonTextActive]}>Student</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <Text style={styles.label}>Offer Name *</Text>
                <TextInput style={styles.input} placeholder="e.g. Diwali Discount, Student Offer" placeholderTextColor={Colors.textTertiary} value={name} onChangeText={setName} />

                {type === 'promo' && (
                  <>
                    <Text style={styles.label}>Promo Code *</Text>
                    <TextInput style={styles.input} placeholder="e.g. DIWALI20" placeholderTextColor={Colors.textTertiary} value={promoCode} onChangeText={setPromoCode} autoCapitalize="characters" />
                    <Text style={styles.label}>Start Date (Optional)</Text>
                    <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
                      <CalendarDays size={16} color={startDate ? Colors.primary : Colors.textTertiary} />
                      <Text style={[styles.dateBtnText, !startDate && styles.dateBtnPlaceholder]}>
                        {startDate ? formatDateDDMMYYYY(parseDDMMYYYY(startDate) || startDate) : 'DD-MM-YYYY'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.label}>End Date (Optional)</Text>
                    <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
                      <CalendarDays size={16} color={endDate ? Colors.primary : Colors.textTertiary} />
                      <Text style={[styles.dateBtnText, !endDate && styles.dateBtnPlaceholder]}>
                        {endDate ? formatDateDDMMYYYY(parseDDMMYYYY(endDate) || endDate) : 'DD-MM-YYYY'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
                
                {type === 'visit' && (
                  <>
                    <Text style={styles.label}>Visit Threshold *</Text>
                    <TextInput style={styles.input} placeholder="e.g. 0 for new customers, 10 for regulars" placeholderTextColor={Colors.textTertiary} value={visitThreshold} onChangeText={setVisitThreshold} keyboardType="numeric" />
                  </>
                )}
                
                <Text style={styles.label}>Discount (%) *</Text>
                <TextInput style={styles.input} placeholder="e.g. 20 for 20%" placeholderTextColor={Colors.textTertiary} value={discount} onChangeText={setDiscount} keyboardType="numeric" />

                {type === 'student' && (
                  <>
                    <Text style={styles.label}>Applies To</Text>
                    <View style={styles.switchContainer}>
                      <TouchableOpacity style={[styles.switchButton, appliesTo === 'services' && styles.switchButtonActive]} onPress={() => setAppliesTo('services')}>
                        <Text style={[styles.switchButtonText, appliesTo === 'services' && styles.switchButtonTextActive]}>Services</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.switchButton, appliesTo === 'subscriptions' && styles.switchButtonActive]} onPress={() => setAppliesTo('subscriptions')}>
                        <Text style={[styles.switchButtonText, appliesTo === 'subscriptions' && styles.switchButtonTextActive]}>Subs</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.switchButton, appliesTo === 'both' && styles.switchButtonActive]} onPress={() => setAppliesTo('both')}>
                        <Text style={[styles.switchButtonText, appliesTo === 'both' && styles.switchButtonTextActive]}>Both</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              
              </View>
              <TouchableOpacity style={[styles.saveBtn, { marginBottom: insets.bottom }]} onPress={handleAdd}>
                <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Add Offer'}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.card,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
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
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: Colors.background,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.surface,
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
    padding: Spacing.md,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  offerName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  offerDiscount: {
    fontSize: FontSize.title,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 2,
  },
  offerDetail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  offerTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  miniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  miniTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  deleteBtn: {
    marginLeft: 10,
    padding: 8,
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
    maxHeight: '85%',
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
    fontWeight: '600',
    color: Colors.text,
  },
  label: {
    fontSize: FontSize.body,
    fontWeight: '500',
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
  switchRow: {
    marginBottom: 12,
  },
  switchContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  switchButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  switchButtonActive: {
    backgroundColor: Colors.surface,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  switchButtonText: {
    fontSize: FontSize.body,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  switchButtonTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  saveBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.surface,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.lg,
    height: 44,
  },
  dateBtnText: {
    fontSize: FontSize.body,
    color: Colors.text,
    fontWeight: '500',
  },
  dateBtnPlaceholder: {
    color: Colors.textTertiary,
    fontWeight: '400',
  },
});
