/**
 * Bottom tab bar — mirrors the web app's 5-tab nav
 * (Home / Lists / Stores / Planner / Household).
 *
 * Each tab icon is from `lucide-react-native` (the cross-platform port of
 * lucide). Active color is the ShopNest green (#16a34a). Touch targets are
 * ≥56pt and respect the bottom safe area.
 */

import React from 'react'
import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, ListChecks, Store, CalendarDays, Users } from 'lucide-react-native'
import { BRAND } from '../../lib/theme'

export default function TabsLayout() {
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: BRAND.green,
        tabBarInactiveTintColor: BRAND.textMuted,
        tabBarStyle: {
          backgroundColor: BRAND.white,
          borderTopColor: BRAND.border,
          borderTopWidth: 1,
          height: 56 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: 'Lists',
          tabBarIcon: ({ color }) => <ListChecks color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="stores"
        options={{
          title: 'Stores',
          tabBarIcon: ({ color }) => <Store color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Planner',
          tabBarIcon: ({ color }) => <CalendarDays color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="household"
        options={{
          title: 'Household',
          tabBarIcon: ({ color }) => <Users color={color} size={22} />,
        }}
      />
    </Tabs>
  )
}
