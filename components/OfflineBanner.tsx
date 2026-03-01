/**
 * OfflineBanner — persistent top banner when device is offline,
 * plus a syncing indicator and pending-sales/mutation count.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff, CloudUpload, AlertTriangle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useOfflineSync } from '@/providers/OfflineSyncProvider';

/** Format total pending items (sales + entity mutations) */
function pendingLabel(saleCount: number, mutCount: number): string {
  const parts: string[] = [];
  if (saleCount > 0) parts.push(`${saleCount} sale${saleCount !== 1 ? 's' : ''}`);
  if (mutCount > 0) parts.push(`${mutCount} change${mutCount !== 1 ? 's' : ''}`);
  return parts.join(' · ') || '';
}

function OfflineBanner() {
  const {
    isOffline,
    pendingCount,
    pendingMutationCount,
    totalPendingCount,
    isSyncing,
    syncNow,
    lastSyncResult,
  } = useOfflineSync();
  const insets = useSafeAreaInsets();

  // Nothing to show
  if (!isOffline && totalPendingCount === 0 && !isSyncing) return null;

  const label = pendingLabel(pendingCount, pendingMutationCount);
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);

  // Currently syncing
  if (isSyncing) {
    return (
      <View style={[styles.banner, styles.syncingBanner, { paddingTop: topPadding + 8 }]}>
        <ActivityIndicator size="small" color="#FFFFFF" />
        <Text style={styles.bannerText}>
          Syncing{label ? ` ${label}` : ''}…
        </Text>
      </View>
    );
  }

  // Offline
  if (isOffline) {
    return (
      <View style={[styles.banner, styles.offlineBanner, { paddingTop: topPadding + 8 }]}>
        <WifiOff size={16} color="#FFFFFF" />
        <Text style={styles.bannerText}>
          You're offline{label ? ` · ${label} pending` : ''}
        </Text>
        {totalPendingCount > 0 && (
          <Text style={styles.subText}>Changes will sync automatically when online</Text>
        )}
      </View>
    );
  }

  // Online but has pending items (sync failed earlier)
  if (totalPendingCount > 0) {
    return (
      <TouchableOpacity
        style={[styles.banner, styles.pendingBanner, { paddingTop: topPadding + 8 }]}
        onPress={syncNow}
        activeOpacity={0.8}
      >
        <CloudUpload size={16} color="#FFFFFF" />
        <Text style={styles.bannerText}>
          {label} pending
        </Text>
        <Text style={styles.tapText}>Tap to sync now</Text>
        {lastSyncResult && (lastSyncResult.failed > 0 || lastSyncResult.mutationsFailed > 0) && (
          <View style={styles.errorRow}>
            <AlertTriangle size={12} color="#FEF3C7" />
            <Text style={styles.errorText}>
              {lastSyncResult.failed + lastSyncResult.mutationsFailed} failed — will retry
            </Text>
          </View>
        )}
        {lastSyncResult && lastSyncResult.conflicts > 0 && (
          <View style={styles.errorRow}>
            <AlertTriangle size={12} color="#FDE68A" />
            <Text style={styles.errorText}>
              {lastSyncResult.conflicts} conflict{lastSyncResult.conflicts !== 1 ? 's' : ''} resolved (server wins)
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Fallback
  return null;
}

export default React.memo(OfflineBanner);

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  offlineBanner: {
    backgroundColor: '#6B7280',
  },
  syncingBanner: {
    backgroundColor: Colors.info,
  },
  pendingBanner: {
    backgroundColor: Colors.warning,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  subText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    width: '100%',
    marginTop: 2,
  },
  tapText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 'auto',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    marginTop: 2,
  },
  errorText: {
    color: '#FEF3C7',
    fontSize: 11,
  },
});
