import { Tabs } from 'expo-router';
import React from 'react';
import { BarChart3, Scissors, Settings, Sparkles } from 'lucide-react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

import { Colors } from '@/constants/colors';
import { HeaderRight } from '@/components/HeaderRight';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          height: 60,
          paddingTop: 8,
          paddingBottom: 8,
          borderTopColor: Colors.tabBarBorder,
          backgroundColor: Colors.tabBar,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: Colors.primary,
          shadowColor: Colors.shadow,
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 6,
        },
        headerTintColor: Colors.headerText,
        headerTitleAlign: 'left',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          letterSpacing: 0.3,
        },
        headerRight: () => <HeaderRight />,
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: 'Billing',
          tabBarIcon: ({ color, size }) => <Scissors color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Sales',
          tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={({ route }) => {
          const focused = getFocusedRouteNameFromRoute(route) ?? 'index';
          return {
            headerShown: focused === 'index',
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
          };
        }}
      />
    </Tabs>
  );
}
