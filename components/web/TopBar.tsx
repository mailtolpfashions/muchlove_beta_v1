/**
 * Top bar for the admin panel — shows page title, pending count badge, and user name.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors, WebLayout } from '@/constants/web';
import { useAuth } from '@/providers/AuthProvider';

interface Props {
  title: string;
  pendingCount?: number;
}

export function TopBar({ title, pendingCount = 0 }: Props) {
  const { user } = useAuth();

  return (
    <View style={styles.bar}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.right}>
        {/* Notification bell with badge */}
        <View style={styles.bellWrap}>
          <Bell size={20} color={Colors.textSecondary} />
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {pendingCount > 9 ? '9+' : pendingCount}
              </Text>
            </View>
          )}
        </View>

        {/* User name */}
        <View style={styles.userPill}>
          <View style={styles.dot} />
          <Text style={styles.userName}>{user?.name || 'Admin'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: WebLayout.topBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: WebLayout.contentPadding,
    backgroundColor: WebColors.topBarBg,
    borderBottomWidth: 1,
    borderBottomColor: WebColors.topBarBorder,
  },
  title: {
    fontSize: WebTypo.h3,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  bellWrap: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: -2,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  userName: {
    fontSize: WebTypo.small,
    fontWeight: '600',
    color: Colors.text,
  },
});
