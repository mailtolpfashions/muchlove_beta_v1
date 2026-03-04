/**
 * Reusable sortable, paginated data table for the admin panel.
 * Handles: header sort, alternating rows, hover, pagination, loading skeleton, empty state.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors } from '@/constants/web';
import { EmptyState } from './EmptyState';

// ── Types ────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  title: string;
  width?: number | string;
  sortable?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  pageSize?: number;
  onRowPress?: (item: T) => void;
}

type SortDir = 'asc' | 'desc' | null;

// ── Component ────────────────────────────────────────────────

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyTitle = 'No data found',
  emptySubtitle,
  pageSize = 15,
  onRowPress,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(0);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const sa = String(av).toLowerCase();
      const sb = String(bv).toLowerCase();
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [data, sortKey, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageData = sorted.slice(page * pageSize, (page + 1) * pageSize);

  // Reset page when data changes
  React.useEffect(() => { setPage(0); }, [data.length, sortKey, sortDir]);

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey, sortDir]);

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ChevronsUpDown size={13} color={Colors.textTertiary} />;
    if (sortDir === 'asc') return <ChevronUp size={13} color={Colors.primary} />;
    return <ChevronDown size={13} color={Colors.primary} />;
  };

  // ── Loading skeleton ───────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.headerRow}>
          {columns.map(col => (
            <View key={col.key} style={[styles.headerCell, col.width ? { width: col.width as any, flex: undefined } : { flex: 1 }]}>
              <View style={styles.skeletonHeader} />
            </View>
          ))}
        </View>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
            {columns.map(col => (
              <View key={col.key} style={[styles.cell, col.width ? { width: col.width as any, flex: undefined } : { flex: 1 }]}>
                <View style={[styles.skeletonCell, { width: `${50 + Math.random() * 40}%` as any }]} />
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  // ── Empty state ────────────────────────────────────────────

  if (data.length === 0) {
    return (
      <View style={styles.wrapper}>
        <EmptyState
          icon={<Inbox size={40} color={Colors.textTertiary} />}
          title={emptyTitle}
          subtitle={emptySubtitle}
        />
      </View>
    );
  }

  // ── Table ──────────────────────────────────────────────────

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.headerRow}>
        {columns.map(col => (
          <Pressable
            key={col.key}
            style={[styles.headerCell, col.width ? { width: col.width as any, flex: undefined } : { flex: 1 }]}
            onPress={col.sortable ? () => handleSort(col.key) : undefined}
            disabled={!col.sortable}
          >
            <Text style={styles.headerText}>{col.title}</Text>
            {col.sortable && <SortIcon colKey={col.key} />}
          </Pressable>
        ))}
      </View>

      {/* Rows */}
      {pageData.map((item, idx) => {
        const key = keyExtractor(item);
        const isHovered = hoveredRow === key;
        return (
          <Pressable
            key={key}
            style={[
              styles.row,
              idx % 2 === 1 && styles.rowAlt,
              isHovered && styles.rowHover,
              onRowPress && styles.rowClickable,
            ]}
            onPress={onRowPress ? () => onRowPress(item) : undefined}
            onHoverIn={() => setHoveredRow(key)}
            onHoverOut={() => setHoveredRow(null)}
          >
            {columns.map(col => (
              <View key={col.key} style={[styles.cell, col.width ? { width: col.width as any, flex: undefined } : { flex: 1 }]}>
                {col.render ? (
                  col.render(item, page * pageSize + idx)
                ) : (
                  <Text style={styles.cellText} numberOfLines={1}>
                    {item[col.key] != null ? String(item[col.key]) : '—'}
                  </Text>
                )}
              </View>
            ))}
          </Pressable>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <Text style={styles.pageInfo}>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </Text>
          <View style={styles.pageButtons}>
            <Pressable
              style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
              onPress={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <Text style={[styles.pageBtnText, page === 0 && styles.pageBtnTextDisabled]}>Previous</Text>
            </Pressable>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i;
              } else if (page < 3) {
                pageNum = i;
              } else if (page > totalPages - 4) {
                pageNum = totalPages - 5 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <Pressable
                  key={pageNum}
                  style={[styles.pageNumBtn, pageNum === page && styles.pageNumActive]}
                  onPress={() => setPage(pageNum)}
                >
                  <Text style={[styles.pageNumText, pageNum === page && styles.pageNumTextActive]}>
                    {pageNum + 1}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.pageBtn, page === totalPages - 1 && styles.pageBtnDisabled]}
              onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
            >
              <Text style={[styles.pageBtnText, page === totalPages - 1 && styles.pageBtnTextDisabled]}>Next</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: WebColors.tableBorder,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: WebColors.tableHeaderBg,
    borderBottomWidth: 1,
    borderBottomColor: WebColors.tableBorder,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  headerText: {
    fontSize: WebTypo.tableHeader,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    alignItems: 'center',
  },
  rowAlt: {
    backgroundColor: WebColors.tableRowAlt,
  },
  rowHover: {
    backgroundColor: WebColors.tableRowHover,
  },
  rowClickable: {
    // @ts-ignore web cursor
    cursor: 'pointer',
  },
  cell: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: WebTypo.table,
    color: Colors.text,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: WebColors.tableBorder,
  },
  pageInfo: {
    fontSize: WebTypo.small,
    color: Colors.textSecondary,
  },
  pageButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: WebTypo.small,
    fontWeight: '500',
    color: Colors.text,
  },
  pageBtnTextDisabled: {
    color: Colors.textTertiary,
  },
  pageNumBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumActive: {
    backgroundColor: Colors.primary,
  },
  pageNumText: {
    fontSize: WebTypo.small,
    fontWeight: '500',
    color: Colors.text,
  },
  pageNumTextActive: {
    color: '#FFFFFF',
  },
  // Skeleton
  skeletonHeader: {
    height: 12,
    width: 80,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
  },
  skeletonCell: {
    height: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
  },
});
