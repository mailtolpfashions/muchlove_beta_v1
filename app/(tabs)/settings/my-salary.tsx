import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/typography';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import SalaryCard from '@/components/SalaryCard';

export default function MySalaryScreen() {
  const { user } = useAuth();
  const { attendance, leaveRequests, permissionRequests, employeeSalaries, sales, reload, dataLoading } = useData();

  if (!user) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={dataLoading} onRefresh={reload} />}
    >
      <SalaryCard
        attendance={attendance}
        leaveRequests={leaveRequests}
        permissionRequests={permissionRequests}
        employeeSalaries={employeeSalaries}
        userId={user.id}
        joiningDate={user.joiningDate}
        userName={user.name}
        userMobile={user.mobile}
        sales={sales}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.screen,
    paddingBottom: 100,
  },
});
