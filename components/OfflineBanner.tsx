/**
 * OfflineBanner — persistent top banner when device is offline,
 * plus a syncing indicator and pending-sales count.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WifiOff, CloudUpload, AlertTriangle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useOfflineSync } from '@/providers/OfflineSyncProvider';

export default function OfflineBanner() {
  const { isOffline, pendingCount, isSyncing, syncNow, lastSyncResult } = useOfflineSync();

  // Nothing to show
  if (!isOffline && pendingCount === 0 && !isSyncing) return null;

  // Currently syncing
  if (isSyncing) {
    return (
      <View style={[styles.banner, styles.syncingBanner]}>
        <ActivityIndicator size="small" color="#FFFFFF" />
        <Text style={styles.bannerText}>Syncing {pendingCount} offline sale{pendingCount !== 1 ? 's' : ''}…</Text>
      </View>
    );
  }

  // Offline
  if (isOffline) {
    return (
      <View style={[styles.banner, styles.offlineBanner]}>
        <WifiOff size={16} color="#FFFFFF" />
        <Text style={styles.bannerText}>
          You're offline{pendingCount > 0 ? ` · ${pendingCount} sale${pendingCount !== 1 ? 's' : ''} pending` : ''}
        </Text>
        {pendingCount > 0 && (
          <Text style={styles.subText}>Sales will sync automatically when online</Text>
        )}
      </View>
    );
  }

  // Online but has pending sales (sync failed earlier)
  if (pendingCount > 0) {
    return (
      <TouchableOpacity
        style={[styles.banner, styles.pendingBanner]}
        onPress={syncNow}
        activeOpacity={0.8}
      >
        <CloudUpload size={16} color="#FFFFFF" />
        <Text style={styles.bannerText}>
          {pendingCount} offline sale{pendingCount !== 1 ? 's' : ''} pending
        </Text>
        <Text style={styles.tapText}>Tap to sync now</Text>
        {lastSyncResult && lastSyncResult.failed > 0 && (
          <View style={styles.errorRow}>
            <AlertTriangle size={12} color="#FEF3C7" />
            <Text style={styles.errorText}>{lastSyncResult.failed} failed — will retry</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return null;
}

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
