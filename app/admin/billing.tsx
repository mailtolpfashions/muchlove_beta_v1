/**
 * Admin billing management — services, products, subscription plans, combos.
 * Full CRUD with search, filters, and CSV export.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import {
  Search,
  Download,
  Filter,
  X,
  Plus,
  Pencil,
  Trash2,
  Scissors,
  ShoppingBag,
  CreditCard,
  Package,
  IndianRupee,
  Tag,
  Layers,
} from 'lucide-react-native';
import { useData } from '@/providers/DataProvider';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors } from '@/constants/web';
import { AnimatedPage } from '@/components/web/AnimatedPage';
import { DataTable, Column } from '@/components/web/DataTable';
import { StatCard } from '@/components/web/StatCard';
import { formatCurrency, toLocalDateString } from '@/utils/format';
import { useAlert } from '@/providers/AlertProvider';
import type { Service, SubscriptionPlan, Combo, ComboItem, ServiceKind } from '@/types';

// ── Types ────────────────────────────────────────────────────

type ActiveTab = 'services' | 'subscriptions' | 'combos';
type KindFilter = 'all' | 'service' | 'product';

// ── Component ────────────────────────────────────────────────

export default function AdminBilling() {
  const {
    services, subscriptions, combos,
    addService, updateService, deleteService,
    addSubscription, updateSubscription, deleteSubscription,
    addCombo, updateCombo, deleteCombo,
    dataLoading,
  } = useData();
  const { showAlert, showConfirm } = useAlert();

  const [activeTab, setActiveTab] = useState<ActiveTab>('services');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  // ── Modal state ──────────────────────────────────────────────
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState<SubscriptionPlan | null>(null);
  const [showComboModal, setShowComboModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);

  // ── Service form ─────────────────────────────────────────────
  const [svcName, setSvcName] = useState('');
  const [svcCode, setSvcCode] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcMrp, setSvcMrp] = useState('');
  const [svcOfferPrice, setSvcOfferPrice] = useState('');
  const [svcKind, setSvcKind] = useState<ServiceKind>('service');

  // ── Subscription form ────────────────────────────────────────
  const [subName, setSubName] = useState('');
  const [subDuration, setSubDuration] = useState('');
  const [subPrice, setSubPrice] = useState('');
  const [subDiscount, setSubDiscount] = useState('');
  const [subMaxCart, setSubMaxCart] = useState('');

  // ── Combo form ───────────────────────────────────────────────
  const [comboName, setComboName] = useState('');
  const [comboPrice, setComboPrice] = useState('');

  // ── Helpers ──────────────────────────────────────────────────

  const resetServiceForm = (svc?: Service) => {
    setSvcName(svc?.name ?? '');
    setSvcCode(svc?.code ?? '');
    setSvcPrice(svc?.price?.toString() ?? '');
    setSvcMrp(svc?.mrp?.toString() ?? '');
    setSvcOfferPrice(svc?.offerPrice?.toString() ?? '');
    setSvcKind(svc?.kind ?? 'service');
  };

  const resetSubForm = (sub?: SubscriptionPlan) => {
    setSubName(sub?.name ?? '');
    setSubDuration(sub?.durationMonths?.toString() ?? '');
    setSubPrice(sub?.price?.toString() ?? '');
    setSubDiscount(sub?.discountPercent?.toString() ?? '');
    setSubMaxCart(sub?.maxCartValue?.toString() ?? '');
  };

  const resetComboForm = (combo?: Combo) => {
    setComboName(combo?.name ?? '');
    setComboPrice(combo?.comboPrice?.toString() ?? '');
  };

  const openAddService = () => { resetServiceForm(); setEditingService(null); setShowServiceModal(true); };
  const openEditService = (svc: Service) => { resetServiceForm(svc); setEditingService(svc); setShowServiceModal(true); };

  const openAddSub = () => { resetSubForm(); setEditingSub(null); setShowSubModal(true); };
  const openEditSub = (sub: SubscriptionPlan) => { resetSubForm(sub); setEditingSub(sub); setShowSubModal(true); };

  const openAddCombo = () => { resetComboForm(); setEditingCombo(null); setShowComboModal(true); };
  const openEditCombo = (combo: Combo) => { resetComboForm(combo); setEditingCombo(combo); setShowComboModal(true); };

  // ── Save handlers ────────────────────────────────────────────

  const handleSaveService = async () => {
    const name = svcName.trim();
    const code = svcCode.trim();
    const price = parseFloat(svcPrice);
    if (!name || !code || isNaN(price) || price <= 0) {
      showAlert('Validation', 'Name, code, and a valid price are required.');
      return;
    }
    try {
      const payload: any = { name, code, price, kind: svcKind };
      if (svcMrp) payload.mrp = parseFloat(svcMrp);
      if (svcOfferPrice) payload.offerPrice = parseFloat(svcOfferPrice);

      if (editingService) {
        await updateService({ ...payload, id: editingService.id });
      } else {
        await addService(payload);
      }
      setShowServiceModal(false);
    } catch {
      showAlert('Error', 'Failed to save service.');
    }
  };

  const handleSaveSub = async () => {
    const name = subName.trim();
    const duration = parseInt(subDuration, 10);
    const price = parseFloat(subPrice);
    const discount = parseFloat(subDiscount) || 0;
    const maxCart = parseFloat(subMaxCart) || 0;
    if (!name || isNaN(duration) || duration <= 0 || isNaN(price) || price <= 0) {
      showAlert('Validation', 'Name, duration, and a valid price are required.');
      return;
    }
    try {
      const payload: any = { name, durationMonths: duration, price, discountPercent: discount, maxCartValue: maxCart };
      if (editingSub) {
        await updateSubscription({ ...payload, id: editingSub.id });
      } else {
        await addSubscription(payload);
      }
      setShowSubModal(false);
    } catch {
      showAlert('Error', 'Failed to save subscription plan.');
    }
  };

  const handleSaveCombo = async () => {
    const name = comboName.trim();
    const price = parseFloat(comboPrice);
    if (!name || isNaN(price) || price <= 0) {
      showAlert('Validation', 'Name and a valid price are required.');
      return;
    }
    try {
      if (editingCombo) {
        await updateCombo({ ...editingCombo, name, comboPrice: price });
      } else {
        await addCombo({ name, comboPrice: price, items: [] });
      }
      setShowComboModal(false);
    } catch {
      showAlert('Error', 'Failed to save combo.');
    }
  };

  // ── Delete handlers ──────────────────────────────────────────

  const handleDeleteService = (svc: Service) => {
    showConfirm('Delete Service', `Delete "${svc.name}"?`, async () => {
      try { await deleteService(svc.id); } catch { showAlert('Error', 'Failed to delete.'); }
    }, 'Delete');
  };

  const handleDeleteSub = (sub: SubscriptionPlan) => {
    showConfirm('Delete Plan', `Delete "${sub.name}"?`, async () => {
      try { await deleteSubscription(sub.id); } catch { showAlert('Error', 'Failed to delete.'); }
    }, 'Delete');
  };

  const handleDeleteCombo = (combo: Combo) => {
    showConfirm('Delete Combo', `Delete "${combo.name}"?`, async () => {
      try { await deleteCombo(combo.id); } catch { showAlert('Error', 'Failed to delete.'); }
    }, 'Delete');
  };

  // ── Filtered data ────────────────────────────────────────────

  const filteredServices = useMemo(() => {
    let result = [...services];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
      );
    }
    if (kindFilter !== 'all') {
      result = result.filter(s => s.kind === kindFilter);
    }
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [services, search, kindFilter]);

  const filteredSubs = useMemo(() => {
    let result = [...subscriptions];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q));
    }
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [subscriptions, search]);

  const filteredCombos = useMemo(() => {
    let result = [...combos];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q));
    }
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [combos, search]);

  // ── Stats ────────────────────────────────────────────────────

  const serviceCount = services.filter(s => s.kind === 'service').length;
  const productCount = services.filter(s => s.kind === 'product').length;
  const totalComboItems = combos.reduce((sum, c) => sum + c.items.length, 0);

  // ── CSV export ───────────────────────────────────────────────

  const handleExportCSV = useCallback(() => {
    if (Platform.OS !== 'web') return;

    let csv = '';
    if (activeTab === 'services') {
      const headers = ['Name', 'Code', 'Kind', 'Price', 'MRP', 'Offer Price'];
      const rows = filteredServices.map(s => [
        s.name, s.code, s.kind, s.price.toFixed(2),
        s.mrp?.toFixed(2) ?? '', s.offerPrice?.toFixed(2) ?? '',
      ]);
      csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    } else if (activeTab === 'subscriptions') {
      const headers = ['Name', 'Duration (months)', 'Price', 'Discount %', 'Max Cart Value'];
      const rows = filteredSubs.map(s => [
        s.name, s.durationMonths.toString(), s.price.toFixed(2),
        s.discountPercent.toString(), s.maxCartValue.toFixed(2),
      ]);
      csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    } else {
      const headers = ['Combo Name', 'Price', 'Items'];
      const rows = filteredCombos.map(c => [
        c.name, c.comboPrice.toFixed(2),
        c.items.map(i => i.serviceName).join('; '),
      ]);
      csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-${activeTab}-${toLocalDateString(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeTab, filteredServices, filteredSubs, filteredCombos]);

  // ── Table columns — Services ─────────────────────────────────

  const serviceColumns: Column<Service>[] = useMemo(() => [
    {
      key: 'name',
      title: 'Name',
      sortable: true,
      render: (item) => (
        <Text style={[styles.cellText, styles.cellBold]} numberOfLines={1}>{item.name}</Text>
      ),
    },
    {
      key: 'code',
      title: 'Code',
      width: 100,
      sortable: true,
      render: (item) => (
        <Text style={[styles.cellText, styles.cellMuted]}>{item.code}</Text>
      ),
    },
    {
      key: 'kind',
      title: 'Type',
      width: 100,
      render: (item) => {
        const isService = item.kind === 'service';
        return (
          <View style={[styles.typeBadge, { backgroundColor: isService ? '#EDE9FE' : '#DBEAFE' }]}>
            <Text style={[styles.typeBadgeText, { color: isService ? '#7C3AED' : '#2563EB' }]}>
              {isService ? 'Service' : 'Product'}
            </Text>
          </View>
        );
      },
    },
    {
      key: 'price',
      title: 'Price',
      width: 100,
      sortable: true,
      render: (item) => (
        <Text style={[styles.cellText, styles.cellBold]}>{formatCurrency(item.price)}</Text>
      ),
    },
    {
      key: 'mrp',
      title: 'MRP',
      width: 100,
      render: (item) => (
        <Text style={[styles.cellText, styles.cellMuted]}>
          {item.mrp ? formatCurrency(item.mrp) : '—'}
        </Text>
      ),
    },
    {
      key: 'offerPrice',
      title: 'Offer Price',
      width: 110,
      render: (item) => (
        <Text style={[styles.cellText, item.offerPrice ? styles.cellGreen : styles.cellMuted]}>
          {item.offerPrice ? formatCurrency(item.offerPrice) : '—'}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '',
      width: 80,
      render: (item) => (
        <View style={styles.actionRow}>
          <Pressable onPress={() => openEditService(item)} style={styles.actionBtn}>
            <Pencil size={14} color={Colors.primary} />
          </Pressable>
          <Pressable onPress={() => handleDeleteService(item)} style={styles.actionBtn}>
            <Trash2 size={14} color={Colors.danger} />
          </Pressable>
        </View>
      ),
    },
  ], []);

  // ── Table columns — Subscriptions ────────────────────────────

  const subColumns: Column<SubscriptionPlan>[] = useMemo(() => [
    {
      key: 'name',
      title: 'Plan Name',
      sortable: true,
      render: (item) => (
        <Text style={[styles.cellText, styles.cellBold]} numberOfLines={1}>{item.name}</Text>
      ),
    },
    {
      key: 'durationMonths',
      title: 'Duration',
      width: 110,
      sortable: true,
      render: (item) => (
        <Text style={styles.cellText}>
          {item.durationMonths} {item.durationMonths === 1 ? 'month' : 'months'}
        </Text>
      ),
    },
    {
      key: 'price',
      title: 'Price',
      width: 110,
      sortable: true,
      render: (item) => (
        <Text style={[styles.cellText, styles.cellBold]}>{formatCurrency(item.price)}</Text>
      ),
    },
    {
      key: 'discountPercent',
      title: 'Discount',
      width: 100,
      render: (item) => (
        <View style={[styles.discBadge, item.discountPercent > 0 && styles.discBadgeActive]}>
          <Text style={[styles.discBadgeText, item.discountPercent > 0 && styles.discBadgeTextActive]}>
            {item.discountPercent}%
          </Text>
        </View>
      ),
    },
    {
      key: 'maxCartValue',
      title: 'Max Cart',
      width: 110,
      render: (item) => (
        <Text style={styles.cellText}>
          {item.maxCartValue > 0 ? formatCurrency(item.maxCartValue) : 'Unlimited'}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '',
      width: 80,
      render: (item) => (
        <View style={styles.actionRow}>
          <Pressable onPress={() => openEditSub(item)} style={styles.actionBtn}>
            <Pencil size={14} color={Colors.primary} />
          </Pressable>
          <Pressable onPress={() => handleDeleteSub(item)} style={styles.actionBtn}>
            <Trash2 size={14} color={Colors.danger} />
          </Pressable>
        </View>
      ),
    },
  ], []);

  // ── Table columns — Combos ───────────────────────────────────

  const comboColumns: Column<Combo>[] = useMemo(() => [
    {
      key: 'name',
      title: 'Combo Name',
      sortable: true,
      render: (item) => (
        <Text style={[styles.cellText, styles.cellBold]} numberOfLines={1}>{item.name}</Text>
      ),
    },
    {
      key: 'comboPrice',
      title: 'Price',
      width: 120,
      sortable: true,
      render: (item) => (
        <Text style={[styles.cellText, styles.cellBold]}>{formatCurrency(item.comboPrice)}</Text>
      ),
    },
    {
      key: 'items',
      title: 'Included Items',
      render: (item) => {
        const origTotal = item.items.reduce((s, ci) => s + ci.originalPrice, 0);
        const savings = origTotal - item.comboPrice;
        return (
          <View>
            <Text style={[styles.cellText, styles.cellMuted]} numberOfLines={2}>
              {item.items.map(i => i.serviceName).join(', ') || 'No items'}
            </Text>
            {savings > 0 && (
              <Text style={[styles.cellText, styles.cellGreen, { fontSize: 11, marginTop: 2 }]}>
                Save {formatCurrency(savings)}
              </Text>
            )}
          </View>
        );
      },
    },
    {
      key: 'itemCount',
      title: 'Items',
      width: 70,
      render: (item) => (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{item.items.length}</Text>
        </View>
      ),
    },
    {
      key: 'actions',
      title: '',
      width: 80,
      render: (item) => (
        <View style={styles.actionRow}>
          <Pressable onPress={() => openEditCombo(item)} style={styles.actionBtn}>
            <Pencil size={14} color={Colors.primary} />
          </Pressable>
          <Pressable onPress={() => handleDeleteCombo(item)} style={styles.actionBtn}>
            <Trash2 size={14} color={Colors.danger} />
          </Pressable>
        </View>
      ),
    },
  ], []);

  // ── Render ───────────────────────────────────────────────────

  const currentData = activeTab === 'services' ? filteredServices
    : activeTab === 'subscriptions' ? filteredSubs
    : filteredCombos;

  const hasFilters = search || kindFilter !== 'all';

  return (
    <AnimatedPage>
      {/* Stat cards */}
      <View style={styles.statsRow}>
        <StatCard
          icon={<Scissors size={20} color={WebColors.gradientRevenue[0]} />}
          label="Services"
          value={serviceCount}
          gradient={WebColors.gradientRevenue}
        />
        <StatCard
          icon={<ShoppingBag size={20} color={WebColors.gradientSales[0]} />}
          label="Products"
          value={productCount}
          gradient={WebColors.gradientSales}
        />
        <StatCard
          icon={<CreditCard size={20} color={WebColors.gradientStaff[0]} />}
          label="Plans"
          value={subscriptions.length}
          gradient={WebColors.gradientStaff}
        />
        <StatCard
          icon={<Layers size={20} color={WebColors.gradientRequests[0]} />}
          label="Combos"
          value={combos.length}
          gradient={WebColors.gradientRequests}
        />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['services', 'subscriptions', 'combos'] as ActiveTab[]).map(tab => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => { setActiveTab(tab); setSearch(''); setKindFilter('all'); }}
          >
            {tab === 'services' && <Scissors size={15} color={activeTab === tab ? Colors.primary : Colors.textSecondary} />}
            {tab === 'subscriptions' && <CreditCard size={15} color={activeTab === tab ? Colors.primary : Colors.textSecondary} />}
            {tab === 'combos' && <Package size={15} color={activeTab === tab ? Colors.primary : Colors.textSecondary} />}
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'services' ? `Services & Products (${services.length})`
                : tab === 'subscriptions' ? `Plans (${subscriptions.length})`
                : `Combos (${combos.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search + actions bar */}
      <View style={styles.filterBar}>
        <View style={styles.searchWrap}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={
              activeTab === 'services' ? 'Search by name or code…'
                : activeTab === 'subscriptions' ? 'Search plans…'
                : 'Search combos…'
            }
            placeholderTextColor={Colors.textTertiary}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <X size={14} color={Colors.textTertiary} />
            </Pressable>
          ) : null}
        </View>

        {activeTab === 'services' && (
          <Pressable
            style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
            onPress={() => setShowFilters(f => !f)}
          >
            <Filter size={16} color={showFilters ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.filterBtnText, showFilters && { color: Colors.primary }]}>Type</Text>
          </Pressable>
        )}

        <Pressable style={styles.exportBtn} onPress={handleExportCSV}>
          <Download size={16} color={Colors.primary} />
          <Text style={styles.exportText}>CSV</Text>
        </Pressable>

        <Pressable
          style={styles.addBtn}
          onPress={activeTab === 'services' ? openAddService : activeTab === 'subscriptions' ? openAddSub : openAddCombo}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>
            {activeTab === 'services' ? 'Add Service' : activeTab === 'subscriptions' ? 'Add Plan' : 'Add Combo'}
          </Text>
        </Pressable>
      </View>

      {/* Kind filter pills (services tab only) */}
      {activeTab === 'services' && showFilters && (
        <View style={styles.filterRow}>
          <View style={styles.filterSelect}>
            <Text style={styles.filterLabel}>Type</Text>
            <View style={styles.pillRow}>
              {(['all', 'service', 'product'] as KindFilter[]).map(k => (
                <Pressable
                  key={k}
                  style={[styles.pill, kindFilter === k && styles.pillActive]}
                  onPress={() => setKindFilter(k)}
                >
                  <Text style={[styles.pillText, kindFilter === k && styles.pillTextActive]}>
                    {k === 'all' ? 'All' : k === 'service' ? 'Services' : 'Products'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {hasFilters && (
            <Pressable style={styles.clearBtn} onPress={() => { setSearch(''); setKindFilter('all'); }}>
              <X size={14} color={Colors.danger} />
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Data tables */}
      {activeTab === 'services' && (
        <DataTable
          columns={serviceColumns}
          data={filteredServices}
          keyExtractor={(s) => s.id}
          loading={dataLoading}
          emptyTitle="No services found"
          emptySubtitle={hasFilters ? 'Try adjusting your filters' : 'Add your first service to get started'}
          pageSize={15}
        />
      )}
      {activeTab === 'subscriptions' && (
        <DataTable
          columns={subColumns}
          data={filteredSubs}
          keyExtractor={(s) => s.id}
          loading={dataLoading}
          emptyTitle="No subscription plans"
          emptySubtitle="Add your first subscription plan"
          pageSize={15}
        />
      )}
      {activeTab === 'combos' && (
        <DataTable
          columns={comboColumns}
          data={filteredCombos}
          keyExtractor={(c) => c.id}
          loading={dataLoading}
          emptyTitle="No combos found"
          emptySubtitle="Create a combo by bundling services together"
          pageSize={15}
        />
      )}

      {/* ─── Service/Product Modal ─────────────────────────────── */}
      <Modal visible={showServiceModal} transparent animationType="fade" onRequestClose={() => setShowServiceModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowServiceModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {editingService ? 'Edit Service / Product' : 'Add Service / Product'}
            </Text>

            <View style={styles.formRow}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Type</Text>
                <View style={styles.pillRow}>
                  {(['service', 'product'] as ServiceKind[]).map(k => (
                    <Pressable
                      key={k}
                      style={[styles.pill, svcKind === k && styles.pillActive]}
                      onPress={() => setSvcKind(k)}
                    >
                      <Text style={[styles.pillText, svcKind === k && styles.pillTextActive]}>
                        {k === 'service' ? 'Service' : 'Product'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 2 }]}>
                <Text style={styles.formLabel}>Name *</Text>
                <TextInput style={styles.formInput} value={svcName} onChangeText={setSvcName} placeholder="e.g. Haircut" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Code *</Text>
                <TextInput style={styles.formInput} value={svcCode} onChangeText={setSvcCode} placeholder="e.g. HC" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Price (₹) *</Text>
                <TextInput style={styles.formInput} value={svcPrice} onChangeText={setSvcPrice} placeholder="0" keyboardType="numeric" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>MRP (₹)</Text>
                <TextInput style={styles.formInput} value={svcMrp} onChangeText={setSvcMrp} placeholder="Optional" keyboardType="numeric" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Offer Price (₹)</Text>
                <TextInput style={styles.formInput} value={svcOfferPrice} onChangeText={setSvcOfferPrice} placeholder="Optional" keyboardType="numeric" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowServiceModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveService}>
                <Text style={styles.saveBtnText}>{editingService ? 'Update' : 'Create'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Subscription Plan Modal ───────────────────────────── */}
      <Modal visible={showSubModal} transparent animationType="fade" onRequestClose={() => setShowSubModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowSubModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {editingSub ? 'Edit Subscription Plan' : 'Add Subscription Plan'}
            </Text>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 2 }]}>
                <Text style={styles.formLabel}>Plan Name *</Text>
                <TextInput style={styles.formInput} value={subName} onChangeText={setSubName} placeholder="e.g. Gold Membership" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Duration (months) *</Text>
                <TextInput style={styles.formInput} value={subDuration} onChangeText={setSubDuration} placeholder="e.g. 6" keyboardType="numeric" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Price (₹) *</Text>
                <TextInput style={styles.formInput} value={subPrice} onChangeText={setSubPrice} placeholder="0" keyboardType="numeric" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Discount %</Text>
                <TextInput style={styles.formInput} value={subDiscount} onChangeText={setSubDiscount} placeholder="0" keyboardType="numeric" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Max Cart Value (₹)</Text>
                <TextInput style={styles.formInput} value={subMaxCart} onChangeText={setSubMaxCart} placeholder="0 = Unlimited" keyboardType="numeric" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowSubModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveSub}>
                <Text style={styles.saveBtnText}>{editingSub ? 'Update' : 'Create'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Combo Modal ───────────────────────────────────────── */}
      <Modal visible={showComboModal} transparent animationType="fade" onRequestClose={() => setShowComboModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowComboModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {editingCombo ? 'Edit Combo' : 'Add Combo'}
            </Text>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 2 }]}>
                <Text style={styles.formLabel}>Combo Name *</Text>
                <TextInput style={styles.formInput} value={comboName} onChangeText={setComboName} placeholder="e.g. Bridal Package" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Combo Price (₹) *</Text>
                <TextInput style={styles.formInput} value={comboPrice} onChangeText={setComboPrice} placeholder="0" keyboardType="numeric" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            {editingCombo && editingCombo.items.length > 0 && (
              <View style={styles.comboItemsList}>
                <Text style={[styles.formLabel, { marginBottom: 8 }]}>Included Items</Text>
                {editingCombo.items.map((item, i) => (
                  <View key={item.id || i} style={styles.comboItemRow}>
                    <Text style={styles.comboItemName}>{item.serviceName}</Text>
                    <Text style={styles.comboItemPrice}>{formatCurrency(item.originalPrice)}</Text>
                  </View>
                ))}
                <View style={[styles.comboItemRow, styles.comboItemTotal]}>
                  <Text style={[styles.comboItemName, { fontWeight: '700' }]}>Original Total</Text>
                  <Text style={[styles.comboItemPrice, { fontWeight: '700' }]}>
                    {formatCurrency(editingCombo.items.reduce((s, i) => s + i.originalPrice, 0))}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowComboModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveCombo}>
                <Text style={styles.saveBtnText}>{editingCombo ? 'Update' : 'Create'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AnimatedPage>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 20,
    flexWrap: 'wrap',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.primaryLight,
  },
  tabText: {
    fontSize: WebTypo.small,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },

  // Filter bar
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: WebTypo.body,
    color: Colors.text,
    outlineStyle: 'none' as any,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
  },
  filterBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  filterBtnText: {
    fontSize: WebTypo.small,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  exportText: {
    fontSize: WebTypo.small,
    fontWeight: '600',
    color: Colors.primary,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  addBtnText: {
    fontSize: WebTypo.small,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Filter row
  filterRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  filterSelect: {
    minWidth: 100,
  },
  filterLabel: {
    fontSize: WebTypo.label,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  pillActive: {
    backgroundColor: Colors.primary,
  },
  pillText: {
    fontSize: WebTypo.tiny,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.dangerLight,
    alignSelf: 'flex-end',
  },
  clearText: {
    fontSize: WebTypo.tiny,
    fontWeight: '600',
    color: Colors.danger,
  },

  // Table cells
  cellText: {
    fontSize: WebTypo.table,
    color: Colors.text,
  },
  cellBold: {
    fontWeight: '600',
  },
  cellMuted: {
    color: Colors.textSecondary,
  },
  cellGreen: {
    color: '#059669',
    fontWeight: '600',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontSize: WebTypo.tiny,
    fontWeight: '600',
  },
  discBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
  },
  discBadgeActive: {
    backgroundColor: '#D1FAE5',
  },
  discBadgeText: {
    fontSize: WebTypo.tiny,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  discBadgeTextActive: {
    color: '#059669',
  },
  countBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: WebTypo.small,
    fontWeight: '700',
    color: Colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 560,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalTitle: {
    fontSize: WebTypo.h3,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  formGroup: {
    flex: 1,
  },
  formLabel: {
    fontSize: WebTypo.label,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formInput: {
    height: 42,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: WebTypo.body,
    color: Colors.text,
    backgroundColor: '#FAFAFA',
    outlineStyle: 'none' as any,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontSize: WebTypo.button,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  saveBtnText: {
    fontSize: WebTypo.button,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Combo items list in modal
  comboItemsList: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  comboItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  comboItemTotal: {
    borderBottomWidth: 0,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  comboItemName: {
    fontSize: WebTypo.body,
    color: Colors.text,
  },
  comboItemPrice: {
    fontSize: WebTypo.body,
    color: Colors.textSecondary,
  },
});
