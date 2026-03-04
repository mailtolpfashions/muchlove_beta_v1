/**
 * Admin sales history — filterable, sortable data table with CSV export.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { Search, Download, Filter, X } from 'lucide-react-native';
import { useData } from '@/providers/DataProvider';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors } from '@/constants/web';
import { AnimatedPage } from '@/components/web/AnimatedPage';
import { DataTable, Column } from '@/components/web/DataTable';
import { WebDatePicker } from '@/components/web/WebDatePicker';
import { StatCard } from '@/components/web/StatCard';
import { formatCurrency, formatDateTime, toLocalDateString, isInDateRange, isToday, isThisMonth } from '@/utils/format';
import { IndianRupee, ShoppingBag, TrendingUp } from 'lucide-react-native';
import type { Sale } from '@/types';

// ── Types ────────────────────────────────────────────────────

type PaymentFilter = 'all' | 'cash' | 'gpay';

// ── Component ────────────────────────────────────────────────

export default function AdminSales() {
  const { sales, users, dataLoading } = useData();

  // Filters
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filter logic
  const filtered = useMemo(() => {
    let result = [...sales];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.customerName.toLowerCase().includes(q) ||
        s.employeeName.toLowerCase().includes(q) ||
        s.items.some(i => i.itemName.toLowerCase().includes(q))
      );
    }

    // Date range
    if (startDate && endDate) {
      result = result.filter(s => isInDateRange(s.createdAt, new Date(startDate), new Date(endDate)));
    } else if (startDate) {
      result = result.filter(s => new Date(s.createdAt) >= new Date(startDate));
    } else if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter(s => new Date(s.createdAt) <= end);
    }

    // Payment
    if (paymentFilter !== 'all') {
      result = result.filter(s => s.paymentMethod === paymentFilter);
    }

    // Employee
    if (employeeFilter !== 'all') {
      result = result.filter(s => s.employeeId === employeeFilter);
    }

    // Sort newest first
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return result;
  }, [sales, search, startDate, endDate, paymentFilter, employeeFilter]);

  // Summary stats
  const totalRevenue = filtered.reduce((sum, s) => sum + s.total, 0);
  const avgSale = filtered.length > 0 ? totalRevenue / filtered.length : 0;

  // Employees for dropdown
  const employees = useMemo(() =>
    users.filter(u => u.approved).sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  const hasFilters = search || startDate || endDate || paymentFilter !== 'all' || employeeFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setPaymentFilter('all');
    setEmployeeFilter('all');
  };

  // CSV export
  const handleExportCSV = useCallback(() => {
    if (Platform.OS !== 'web' || filtered.length === 0) return;
    const headers = ['Date', 'Customer', 'Employee', 'Items', 'Total', 'Payment'];
    const rows = filtered.map(s => [
      formatDateTime(s.createdAt),
      s.customerName,
      s.employeeName,
      s.items.map(i => `${i.itemName} x${i.quantity}`).join('; '),
      s.total.toFixed(2),
      s.paymentMethod || '-',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-${toLocalDateString(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  // Table columns
  const columns: Column<Sale>[] = useMemo(() => [
    {
      key: 'createdAt',
      title: 'Date & Time',
      width: 170,
      sortable: true,
      render: (item) => (
        <Text style={styles.cellText}>{formatDateTime(item.createdAt)}</Text>
      ),
    },
    {
      key: 'customerName',
      title: 'Customer',
      sortable: true,
      render: (item) => (
        <Text style={[styles.cellText, styles.cellBold]} numberOfLines={1}>{item.customerName}</Text>
      ),
    },
    {
      key: 'employeeName',
      title: 'Employee',
      sortable: true,
      render: (item) => (
        <Text style={styles.cellText} numberOfLines={1}>{item.employeeName}</Text>
      ),
    },
    {
      key: 'items',
      title: 'Items',
      render: (item) => (
        <Text style={[styles.cellText, styles.cellMuted]} numberOfLines={1}>
          {item.items.map(i => i.itemName).join(', ') || '—'}
        </Text>
      ),
    },
    {
      key: 'total',
      title: 'Amount',
      width: 110,
      sortable: true,
      render: (item) => (
        <Text style={[styles.cellText, styles.cellBold]}>{formatCurrency(item.total)}</Text>
      ),
    },
    {
      key: 'paymentMethod',
      title: 'Payment',
      width: 100,
      render: (item) => {
        const method = item.paymentMethod || '-';
        const bg = method === 'cash' ? '#FEF3C7' : method === 'gpay' ? '#DBEAFE' : '#F3F4F6';
        const color = method === 'cash' ? '#D97706' : method === 'gpay' ? '#2563EB' : '#9CA3AF';
        return (
          <View style={[styles.payBadge, { backgroundColor: bg }]}>
            <Text style={[styles.payBadgeText, { color }]}>
              {method === 'gpay' ? 'GPay' : method === 'cash' ? 'Cash' : method}
            </Text>
          </View>
        );
      },
    },
  ], []);

  return (
    <AnimatedPage>
      {/* Summary stat cards */}
      <View style={styles.statsRow}>
        <StatCard
          icon={<IndianRupee size={20} color={WebColors.gradientRevenue[0]} />}
          label="Total Revenue"
          value={totalRevenue}
          prefix="₹"
          gradient={WebColors.gradientRevenue}
        />
        <StatCard
          icon={<ShoppingBag size={20} color={WebColors.gradientSales[0]} />}
          label="Total Sales"
          value={filtered.length}
          gradient={WebColors.gradientSales}
        />
        <StatCard
          icon={<TrendingUp size={20} color={WebColors.gradientStaff[0]} />}
          label="Avg Sale Value"
          value={Math.round(avgSale)}
          prefix="₹"
          gradient={WebColors.gradientStaff}
        />
      </View>

      {/* Search + Filter bar */}
      <View style={styles.filterBar}>
        <View style={styles.searchWrap}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search customer, employee, or service..."
            placeholderTextColor={Colors.textTertiary}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <X size={14} color={Colors.textTertiary} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
          onPress={() => setShowFilters(f => !f)}
        >
          <Filter size={16} color={showFilters ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.filterBtnText, showFilters && { color: Colors.primary }]}>Filters</Text>
        </Pressable>

        <Pressable style={styles.exportBtn} onPress={handleExportCSV}>
          <Download size={16} color={Colors.primary} />
          <Text style={styles.exportText}>CSV</Text>
        </Pressable>
      </View>

      {/* Expanded filters */}
      {showFilters && (
        <View style={styles.filterRow}>
          <WebDatePicker label="From" value={startDate} onChange={setStartDate} />
          <WebDatePicker label="To" value={endDate} onChange={setEndDate} />

          <View style={styles.filterSelect}>
            <Text style={styles.filterLabel}>Payment</Text>
            <View style={styles.pillRow}>
              {(['all', 'cash', 'gpay'] as PaymentFilter[]).map(p => (
                <Pressable
                  key={p}
                  style={[styles.pill, paymentFilter === p && styles.pillActive]}
                  onPress={() => setPaymentFilter(p)}
                >
                  <Text style={[styles.pillText, paymentFilter === p && styles.pillTextActive]}>
                    {p === 'all' ? 'All' : p === 'gpay' ? 'GPay' : 'Cash'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filterSelect}>
            <Text style={styles.filterLabel}>Employee</Text>
            <View style={styles.pillRow}>
              <Pressable
                style={[styles.pill, employeeFilter === 'all' && styles.pillActive]}
                onPress={() => setEmployeeFilter('all')}
              >
                <Text style={[styles.pillText, employeeFilter === 'all' && styles.pillTextActive]}>All</Text>
              </Pressable>
              {employees.map(emp => (
                <Pressable
                  key={emp.id}
                  style={[styles.pill, employeeFilter === emp.id && styles.pillActive]}
                  onPress={() => setEmployeeFilter(emp.id)}
                >
                  <Text style={[styles.pillText, employeeFilter === emp.id && styles.pillTextActive]}>
                    {emp.name.split(' ')[0]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {hasFilters && (
            <Pressable style={styles.clearBtn} onPress={clearFilters}>
              <X size={14} color={Colors.danger} />
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Data table */}
      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(s) => s.id}
        loading={dataLoading}
        emptyTitle="No sales found"
        emptySubtitle={hasFilters ? 'Try adjusting your filters' : undefined}
        pageSize={15}
      />
    </AnimatedPage>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
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
  // Cell styles
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
  payBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  payBadgeText: {
    fontSize: WebTypo.tiny,
    fontWeight: '600',
  },
});
